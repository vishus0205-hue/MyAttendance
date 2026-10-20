import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { PlaywrightPortalAdapter } from "@/services/portal/playwright-portal-adapter";
import { encryptCredentials, decryptCredentials } from "@/lib/security/crypto";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Student User ID or Portal Username is required."),
  password: z.string().min(1, "Portal Password is required."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.parse(body);
    const rawUsername = parsed.username.trim();
    const cleanStudentId = rawUsername.replace(/@svkm\.ac\.in$/i, "").trim();
    const password = parsed.password;

    // Find if user already exists by studentId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { studentId: cleanStudentId },
          { studentId: rawUsername },
          { email: rawUsername.toLowerCase() },
          { email: `${cleanStudentId.toLowerCase()}@svkm.ac.in` },
          { email: `${rawUsername.toLowerCase()}@svkm.ac.in` },
        ],
      },
      include: { portalConnection: true },
    });

    const playwrightAdapter = new PlaywrightPortalAdapter();

    if (user) {
      // 1. Existing user: check bcrypt hash
      let isMatch = await bcrypt.compare(password, user.passwordHash);

      // If bcrypt check failed, check whether password matches their stored encrypted portal password
      if (!isMatch && user.portalConnection?.encryptedPassword) {
        try {
          const decryptedSavedPass = decryptCredentials({
            encrypted: user.portalConnection.encryptedPassword,
            iv: user.portalConnection.iv,
            authTag: user.portalConnection.authTag,
          });

          if (decryptedSavedPass === password) {
            isMatch = true;
            // Upgrade/synchronize local bcrypt hash with verified password
            const newHash = await bcrypt.hash(password, 10);
            await prisma.user.update({
              where: { id: user.id },
              data: { passwordHash: newHash },
            });
          }
        } catch {
          // If decryption fails, continue to live portal verification below
        }
      }

      if (!isMatch) {
        // Test against SVKM SAP portal (e.g. if student updated password on official portal)
        try {
          const testResult = await playwrightAdapter.testConnection({
            username: user.studentId || cleanStudentId,
            password,
          });

          const isBrowserMissing = Boolean(
            testResult.message?.includes("Executable doesn't exist") ||
            testResult.message?.includes("browserType.launch") ||
            testResult.message?.includes("playwright")
          );

          if (!testResult.success) {
            if (isBrowserMissing) {
              return NextResponse.json(
                {
                  success: false,
                  error: "Password incorrect. If you recently updated your SAP portal password, please update your credentials in Settings.",
                },
                { status: 401 }
              );
            }
            return NextResponse.json(
              {
                success: false,
                error: testResult.message || "Invalid Student User ID or Portal Password on the SVKM SAP portal.",
              },
              { status: 401 }
            );
          }

          // Portal accepted new password: update stored hash and encrypted credentials
          const newHash = await bcrypt.hash(password, 10);
          const encPass = encryptCredentials(password);

          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash: newHash,
              name: testResult.studentName || user.name,
            },
          });

          if (user.portalConnection) {
            await prisma.portalConnection.update({
              where: { userId: user.id },
              data: {
                encryptedPassword: encPass.encrypted,
                iv: encPass.iv,
                authTag: encPass.authTag,
                connectionStatus: "CONNECTED",
                lastSyncError: null,
              },
            });
          }
        } catch (err: unknown) {
          return NextResponse.json(
            { success: false, error: "Incorrect password for this student account." },
            { status: 401 }
          );
        } finally {
          await playwrightAdapter.closeSession();
        }
      }
    } else {
      // Never create a student account until the portal confirms the credentials.
      const testResult = await playwrightAdapter.testConnection({
        username: cleanStudentId,
        password,
      }).finally(() => playwrightAdapter.closeSession());
      if (!testResult.success) {
        const unavailable = /Executable doesn't exist|browserType\.launch|playwright|Portal connection error/i.test(testResult.message);
        return NextResponse.json(
          {
            success: false,
            error: unavailable
              ? "Portal verification is temporarily unavailable. Please try again later."
              : testResult.message || "Invalid Student User ID or Portal Password on the SVKM SAP portal.",
          },
          { status: unavailable ? 503 : 401 }
        );
      }
      const studentName = testResult.studentName || "Student";

      // Valid portal credentials: create new account automatically
      const passwordHash = await bcrypt.hash(password, 10);
      const encUser = encryptCredentials(cleanStudentId);
      const encPass = encryptCredentials(password);

      const studentEmail = rawUsername.includes("@")
        ? rawUsername.toLowerCase()
        : `${cleanStudentId.toLowerCase()}@svkm.ac.in`;

      user = await prisma.user.create({
        data: {
          studentId: cleanStudentId,
          email: studentEmail,
          passwordHash,
          name: studentName,
          targetThreshold: 75.0,
          portalConnection: {
            create: {
              portalUrl: "https://sdc-sppap1.svkm.ac.in:50001/irj/portal",
              encryptedUsername: encUser.encrypted,
              encryptedPassword: encPass.encrypted,
              iv: encUser.iv,
              authTag: encPass.authTag,
              connectionStatus: "CONNECTED",
              academicYear: "2026-2027",
              semester: "Semester V",
              reportType: "Detail Report",
              startDate: "01.06.2026",
            },
          },
        },
        include: { portalConnection: true },
      });
    }

    // Check if the user already has attendance synced
    const recordCount = await prisma.attendanceRecord.count({
      where: { userId: user.id },
    });

    const hasSynced = recordCount > 0;

    // Issue cryptographic session token
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name || "Student",
      studentId: user.studentId,
      targetThreshold: user.targetThreshold,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      hasSynced,
      recordCount,
      message: hasSynced
        ? `Welcome back, ${user.name}!`
        : `Logged in as ${user.name}. Please configure your Academic Year, Semester, and Dates in Settings to fetch your attendance.`,
      user: {
        id: user.id,
        studentId: user.studentId,
        email: user.email,
        name: user.name,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

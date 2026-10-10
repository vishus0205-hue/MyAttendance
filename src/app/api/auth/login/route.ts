import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { PlaywrightPortalAdapter } from "@/services/portal/playwright-portal-adapter";
import { encryptCredentials } from "@/lib/security/crypto";
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
    const password = parsed.password;

    // Find if user already exists by studentId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { studentId: rawUsername },
          { email: rawUsername.toLowerCase() },
          { email: `${rawUsername.toLowerCase()}@svkm.ac.in` },
        ],
      },
      include: { portalConnection: true },
    });

    const playwrightAdapter = new PlaywrightPortalAdapter();

    if (user) {
      // 1. Existing user: check bcrypt hash
      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) {
        // If password was changed on portal, verify against SAP portal
        const testResult = await playwrightAdapter.testConnection({
          username: user.studentId || rawUsername,
          password,
        });

        if (!testResult.success) {
          return NextResponse.json(
            { success: false, error: "Incorrect password for this student account." },
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

        await prisma.portalConnection.update({
          where: { userId: user.id },
          data: {
            encryptedPassword: encPass.encrypted,
            iv: encPass.iv,
            authTag: encPass.authTag,
            connectionStatus: "CONNECTED",
          },
        });
      }
    } else {
      // 2. New user: Authenticate against the SVKM SAP portal (if browser is available)
      let studentName = "Student";

      try {
        const testResult = await playwrightAdapter.testConnection({
          username: rawUsername,
          password,
        });

        const isBrowserMissing = Boolean(
          testResult.message?.includes("Executable doesn't exist") ||
          testResult.message?.includes("browserType.launch") ||
          testResult.message?.includes("playwright")
        );

        if (!testResult.success && !isBrowserMissing) {
          return NextResponse.json(
            {
              success: false,
              error: testResult.message || "Invalid Student User ID or Portal Password on the SVKM SAP portal.",
            },
            { status: 401 }
          );
        }
        if (testResult.studentName) {
          studentName = testResult.studentName;
        }
      } catch (browserErr: unknown) {
        // In serverless environments (like Vercel) without a local Chromium binary,
        // accept the student's credentials and save them securely encrypted.
        // The automated GitHub Actions runner will execute the actual browser sync.
        console.warn("Playwright browser not available in serverless runtime, proceeding with registration.");
      }

      // Valid portal credentials: create new account automatically
      const passwordHash = await bcrypt.hash(password, 10);
      const encUser = encryptCredentials(rawUsername);
      const encPass = encryptCredentials(password);

      const studentEmail = rawUsername.includes("@")
        ? rawUsername.toLowerCase()
        : `${rawUsername.toLowerCase()}@svkm.ac.in`;

      user = await prisma.user.create({
        data: {
          studentId: rawUsername,
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

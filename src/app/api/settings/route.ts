import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { encryptCredentials } from "@/lib/security/crypto";
import { z } from "zod";

const settingsSchema = z.object({
  targetThreshold: z.number().min(50).max(100).optional(),
  portalUrl: z.string().url().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  autoSyncEnabled: z.boolean().optional(),
  academicYear: z.string().optional(),
  semester: z.string().optional(),
  reportType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    const portalConn = await prisma.portalConnection.findUnique({
      where: { userId: user.id },
      select: {
        portalUrl: true,
        connectionStatus: true,
        autoSyncEnabled: true,
        syncTimeUtc: true,
        lastSuccessfulSyncAt: true,
        lastSyncAttemptAt: true,
        lastSyncError: true,
        academicYear: true,
        semester: true,
        reportType: true,
        startDate: true,
        endDate: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        studentId: user.studentId,
        email: user.email,
        name: user.name,
        targetThreshold: user.targetThreshold,
      },
      connection: portalConn,
      isConfigured: !!portalConn && portalConn.connectionStatus === "CONNECTED",
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await request.json();
    const parsed = settingsSchema.parse(body);

    // 1. Update user threshold if provided
    if (parsed.targetThreshold !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { targetThreshold: parsed.targetThreshold },
      });
    }

    // 2. Update portal credentials and settings if provided
    if (
      parsed.portalUrl ||
      parsed.username ||
      parsed.password ||
      parsed.autoSyncEnabled !== undefined ||
      parsed.academicYear !== undefined ||
      parsed.semester !== undefined ||
      parsed.reportType !== undefined ||
      parsed.startDate !== undefined ||
      parsed.endDate !== undefined
    ) {
      // Validate portal URL domain against SSRF allowlist
      if (parsed.portalUrl) {
        const allowedHosts = (process.env.PORTAL_ALLOWED_HOSTS || "sdc-sppap1.svkm.ac.in").split(",");
        const parsedUrl = new URL(parsed.portalUrl);
        const isAllowed = allowedHosts.some((h) => parsedUrl.hostname === h.trim());
        if (!isAllowed) {
          return NextResponse.json(
            {
              success: false,
              error: `Disallowed portal host: ${parsedUrl.hostname}. Host must match approved university domains.`,
            },
            { status: 400 }
          );
        }
      }

      const updateData: {
        portalUrl?: string;
        autoSyncEnabled?: boolean;
        encryptedUsername?: string;
        encryptedPassword?: string;
        iv?: string;
        authTag?: string;
        connectionStatus?: string;
        academicYear?: string;
        semester?: string;
        reportType?: string;
        startDate?: string;
        endDate?: string | null;
      } = {};

      if (parsed.portalUrl) updateData.portalUrl = parsed.portalUrl;
      if (parsed.autoSyncEnabled !== undefined) updateData.autoSyncEnabled = parsed.autoSyncEnabled;
      if (parsed.academicYear !== undefined) updateData.academicYear = parsed.academicYear;
      if (parsed.semester !== undefined) updateData.semester = parsed.semester;
      if (parsed.reportType !== undefined) updateData.reportType = parsed.reportType;
      if (parsed.startDate !== undefined) updateData.startDate = parsed.startDate;
      if (parsed.endDate !== undefined) updateData.endDate = parsed.endDate;

      if (parsed.username && parsed.password) {
        const encUser = encryptCredentials(parsed.username);
        const encPass = encryptCredentials(parsed.password);

        updateData.encryptedUsername = encUser.encrypted;
        updateData.encryptedPassword = encPass.encrypted;
        updateData.iv = encUser.iv;
        updateData.authTag = encUser.authTag;
        updateData.connectionStatus = "CONNECTED";
      }

      await prisma.portalConnection.upsert({
        where: { userId: user.id },
        update: updateData,
        create: {
          userId: user.id,
          portalUrl: parsed.portalUrl || "https://sdc-sppap1.svkm.ac.in:50001/irj/portal",
          encryptedUsername: updateData.encryptedUsername || "",
          encryptedPassword: updateData.encryptedPassword || "",
          iv: updateData.iv || "",
          authTag: updateData.authTag || "",
          autoSyncEnabled: parsed.autoSyncEnabled ?? true,
          connectionStatus: updateData.connectionStatus || "NOT_CONFIGURED",
          academicYear: parsed.academicYear || "2026-2027",
          semester: parsed.semester || "Semester V",
          reportType: parsed.reportType || "Detail Report",
          startDate: parsed.startDate || "01.06.2026",
          endDate: parsed.endDate || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully.",
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Validation or Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
  }
}

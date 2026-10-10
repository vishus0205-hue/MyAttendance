import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { MockPortalAdapter } from "@/services/portal/mock-portal-adapter";
import { PlaywrightPortalAdapter } from "@/services/portal/playwright-portal-adapter";
import { decryptCredentials } from "@/lib/security/crypto";
import { AttendanceStatus } from "@prisma/client";
import { NormalizedAttendanceRecord } from "@/services/portal/portal-adapter.interface";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    // 1. Prevent concurrent or overlapping sync jobs
    const activeJob = await prisma.attendanceSyncJob.findFirst({
      where: {
        userId: user.id,
        status: "IN_PROGRESS",
        startedAt: {
          gte: new Date(Date.now() - 3 * 60 * 1000), // Within last 3 minutes
        },
      },
    });

    if (activeJob) {
      return NextResponse.json(
        {
          success: false,
          message: "A synchronization job is already in progress. Please wait for it to complete.",
          jobId: activeJob.id,
        },
        { status: 429 }
      );
    }

    // 2. Create the sync job record
    const job = await prisma.attendanceSyncJob.create({
      data: {
        userId: user.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    // 3. Retrieve Portal Connection
    const portalConn = await prisma.portalConnection.findUnique({
      where: { userId: user.id },
    });

    try {
      let inserted = 0;
      let updated = 0;
      let totalFetched = 0;

      // Determine date range: rolling 14-day window up to today
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 14);

      // Check whether live portal credentials are fully set
      const hasLiveCredentials =
        portalConn &&
        portalConn.encryptedUsername &&
        portalConn.encryptedPassword &&
        portalConn.iv &&
        portalConn.authTag &&
        portalConn.connectionStatus === "CONNECTED";

      let normalizedRecords: NormalizedAttendanceRecord[] = [];
      let recordSource = "PORTAL_SYNC";

      // If user has verified live credentials, use Playwright adapter
      if (hasLiveCredentials) {
        let username = "";
        let password = "";

        try {
          username = decryptCredentials({
            encrypted: portalConn.encryptedUsername,
            iv: portalConn.iv,
            authTag: portalConn.authTag,
          });
          password = decryptCredentials({
            encrypted: portalConn.encryptedPassword,
            iv: portalConn.iv,
            authTag: portalConn.authTag,
          });
        } catch (decryptErr: unknown) {
          const detail = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
          throw new Error(`Stored credentials decryption failed: ${detail}. Please re-enter your password in Settings.`);
        }

        const playwrightAdapter = new PlaywrightPortalAdapter();

        // Fetch live report: full academic semester (from June 1st of current year up to today)
        const semesterStartDate = new Date();
        semesterStartDate.setMonth(5); // June
        semesterStartDate.setDate(1);

        const liveReport = await playwrightAdapter.fetchAttendance(
          { username, password, portalUrl: portalConn.portalUrl },
          { startDate: semesterStartDate, endDate },
          {
            academicYear: portalConn.academicYear || "2026-2027",
            semester: portalConn.semester || "Semester V",
            reportType: portalConn.reportType || "Detail Report",
            startDate: portalConn.startDate || "01.06.2026",
            endDate: portalConn.endDate || undefined,
          }
        );
        normalizedRecords = await playwrightAdapter.parseReport(liveReport);
        totalFetched = normalizedRecords.length;
        recordSource = "PORTAL_SYNC";

        if (liveReport.studentName) {
          await prisma.user.update({
            where: { id: user.id },
            data: { name: liveReport.studentName },
          });
        }
      } else {
        // Fallback to Mock provider for demo mode
        const mockAdapter = new MockPortalAdapter();
        const rawReport = await mockAdapter.fetchAttendance(
          { username: "SAP-DEMO-STUDENT" },
          { startDate, endDate }
        );
        normalizedRecords = await mockAdapter.parseReport(rawReport);
        totalFetched = normalizedRecords.length;
        recordSource = "DEMO_SEED";
      }

      // Upsert subjects and records into the database
      for (const item of normalizedRecords) {
        const subject = await prisma.subject.upsert({
          where: {
            userId_name: {
              userId: user.id,
              name: item.subjectName,
            },
          },
          update: { code: item.subjectCode || undefined },
          create: {
            userId: user.id,
            name: item.subjectName,
            code: item.subjectCode || undefined,
          },
        });

        const existing = await prisma.attendanceRecord.findFirst({
          where: {
            userId: user.id,
            subjectId: subject.id,
            attendanceDate: item.attendanceDate,
            periodNumber: item.periodNumber ?? 1,
          },
        });

        if (existing) {
          await prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              status: item.status as AttendanceStatus,
              source: recordSource,
              lastObservedAt: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.attendanceRecord.create({
            data: {
              userId: user.id,
              subjectId: subject.id,
              attendanceDate: item.attendanceDate,
              periodNumber: item.periodNumber ?? 1,
              status: item.status as AttendanceStatus,
              source: recordSource,
              lastObservedAt: new Date(),
            },
          });
          inserted++;
        }
      }

      // 4. Update job and connection to SUCCESS
      await prisma.$transaction([
        prisma.attendanceSyncJob.update({
          where: { id: job.id },
          data: {
            status: "SUCCESS",
            completedAt: new Date(),
            recordsFetched: totalFetched,
            recordsInserted: inserted,
            recordsUpdated: updated,
          },
        }),
        prisma.portalConnection.upsert({
          where: { userId: user.id },
          update: {
            lastSuccessfulSyncAt: new Date(),
            lastSyncAttemptAt: new Date(),
            lastSyncError: null,
          },
          create: {
            userId: user.id,
            portalUrl: "https://sdc-sppap1.svkm.ac.in:50001/irj/portal",
            encryptedUsername: "",
            encryptedPassword: "",
            iv: "",
            authTag: "",
            connectionStatus: "CONNECTED",
            lastSuccessfulSyncAt: new Date(),
            lastSyncAttemptAt: new Date(),
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Attendance synchronized successfully.",
        jobId: job.id,
        recordsFetched: totalFetched,
        recordsInserted: inserted,
        recordsUpdated: updated,
      });
      let errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
      if (errorMsg.includes("Executable doesn't exist") || errorMsg.includes("browserType.launch")) {
        errorMsg = "Live sync runs automatically every night between 6 PM - 7 AM via GitHub Actions. You can also trigger an instant sync from the GitHub Actions tab in your repo!";
      }

      // Record failure without deleting valid stored records
      await prisma.attendanceSyncJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          sanitizedErrorMessage: errorMsg,
        },
      });

      if (portalConn) {
        await prisma.portalConnection.update({
          where: { userId: user.id },
          data: {
            lastSyncAttemptAt: new Date(),
            lastSyncError: errorMsg,
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          jobId: job.id,
        },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

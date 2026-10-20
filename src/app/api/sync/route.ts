import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { MockPortalAdapter } from "@/services/portal/mock-portal-adapter";
import { PlaywrightPortalAdapter } from "@/services/portal/playwright-portal-adapter";
import { decryptCredentials } from "@/lib/security/crypto";
import { NormalizedAttendanceRecord } from "@/services/portal/portal-adapter.interface";
import { persistAttendanceRecords } from "@/services/attendance/persist-records";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

async function triggerGitHubWorkflow(targetUser?: string, fullSync: boolean = false): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
  const repo = process.env.GITHUB_REPOSITORY || "vishus0205-hue/MyAttendance";
  if (!token) return false;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/nightly-sync.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MyAttendance-App",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          targetUser: targetUser || "",
          fullSync: fullSync ? "true" : "false",
        },
      }),
    });
    return res.status === 204;
  } catch (err) {
    console.warn("Failed to trigger GitHub Actions workflow dispatch:", err);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    let isFullSync = false;
    try {
      const body = await request.clone().json();
      if (body?.fullSync === true) {
        isFullSync = true;
      }
    } catch {
      // Body empty or not JSON
    }

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

        // Smart date selection: if incremental, only fetch from 14 days before latest existing record
        let syncStartDate = portalConn.startDate || "01.06.2026";
        if (!isFullSync) {
          const latestRecord = await prisma.attendanceRecord.findFirst({
            where: { userId: user.id },
            orderBy: { attendanceDate: "desc" },
          });

          if (latestRecord) {
            const lookback = new Date(latestRecord.attendanceDate);
            lookback.setDate(lookback.getDate() - 14);
            const day = String(lookback.getDate()).padStart(2, "0");
            const month = String(lookback.getMonth() + 1).padStart(2, "0");
            const year = lookback.getFullYear();
            syncStartDate = `${day}.${month}.${year}`;
          }
        }

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
            startDate: syncStartDate,
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

      ({ inserted, updated } = await persistAttendanceRecords(user.id, normalizedRecords, recordSource));

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
    } catch (syncError: unknown) {
      const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
      const isMissingBrowser = errorMsg.includes("Executable doesn't exist") || errorMsg.includes("browserType.launch");

      if (isMissingBrowser) {
        // Attempt background runner dispatch to GitHub Actions
        const dispatched = await triggerGitHubWorkflow(user.email, isFullSync);

        if (dispatched) {
          await prisma.attendanceSyncJob.update({
            where: { id: job.id },
            data: {
              status: "IN_PROGRESS",
              sanitizedErrorMessage: "Sync dispatched to GitHub Actions background runner",
            },
          });

          return NextResponse.json({
            success: true,
            dispatched: true,
            recordsFetched: 0,
            message: "Sync requested! Fetching your attendance records now. Check back in ~30 seconds.",
            jobId: job.id,
          });
        }

        await prisma.attendanceSyncJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            sanitizedErrorMessage: "Automated sync runner scheduled for 4:00 AM IST.",
          },
        });

        return NextResponse.json(
          {
            success: false,
            serverless: true,
            error:
              "Your attendance is scheduled to sync automatically every morning at 4:00 AM IST.",
            jobId: job.id,
          },
          { status: 503 }
        );
      }

      const isHoursRestricted =
        errorMsg.includes("PORTAL_HOURS_RESTRICTED") ||
        errorMsg.includes("between 06:00 PM to 07:00 AM") ||
        errorMsg.includes("06:00 PM to 07:00 AM");

      if (isHoursRestricted) {
        const friendlyNotice =
          "SVKM SAP Portal restricts attendance viewing to between 06:00 PM and 07:00 AM IST. Portal attendance is locked during daytime university hours. Please try syncing again after 6:00 PM IST.";

        await prisma.attendanceSyncJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            sanitizedErrorMessage: friendlyNotice,
          },
        });

        if (portalConn) {
          await prisma.portalConnection.update({
            where: { userId: user.id },
            data: {
              lastSyncAttemptAt: new Date(),
              lastSyncError: friendlyNotice,
            },
          });
        }

        return NextResponse.json(
          {
            success: false,
            restrictedHours: true,
            error: friendlyNotice,
            jobId: job.id,
          },
          { status: 403 }
        );
      }

      // Record any other unexpected error
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
          error: `Portal sync failed: ${errorMsg}`,
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

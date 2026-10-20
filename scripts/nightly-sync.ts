import { prisma } from "../src/lib/db/prisma";
import { PlaywrightPortalAdapter } from "../src/services/portal/playwright-portal-adapter";
import { decryptCredentials } from "../src/lib/security/crypto";
import { persistAttendanceRecords } from "../src/services/attendance/persist-records";

async function runNightlySync() {
  console.log("🌙 [Nightly Sync] Starting attendance sync job...");
  console.log(`⏰ Current execution time: ${new Date().toISOString()}`);

  const isFullSync = process.env.FULL_SYNC === "true" || process.argv.includes("--full");
  const nonFlagArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const targetUser = (process.env.SYNC_TARGET_USER || nonFlagArgs[0] || "").trim().toLowerCase();

  const allConnections = await prisma.portalConnection.findMany({
    where: {
      autoSyncEnabled: true,
      encryptedUsername: { not: "" },
      encryptedPassword: { not: "" },
    },
    include: {
      user: true,
    },
  });

  const connections = targetUser
    ? allConnections.filter(
        (c) =>
          c.user.email.toLowerCase().includes(targetUser) ||
          (c.user.studentId && c.user.studentId.toLowerCase().includes(targetUser)) ||
          (c.user.name && c.user.name.toLowerCase().includes(targetUser))
      )
    : allConnections;

  if (connections.length === 0) {
    if (targetUser) {
      console.log(`ℹ️ No connections matched target student query: "${targetUser}".`);
    } else {
      console.log("ℹ️ No users found with auto-sync enabled and saved portal credentials.");
    }
    return;
  }

  console.log(`📋 Found ${connections.length} user(s) scheduled for nightly sync${targetUser ? ` (filtered by "${targetUser}")` : ""}. Mode: ${isFullSync ? "Full Semester Sync" : "Incremental Sync"}`);

  for (const conn of connections) {
    const user = conn.user;
    console.log(`\n========================================`);
    console.log(`👤 Syncing attendance for: ${user.name || user.email}`);

    let username = "";
    let password = "";

    try {
      username = decryptCredentials({
        encrypted: conn.encryptedUsername,
        iv: conn.iv,
        authTag: conn.authTag,
      });
      password = decryptCredentials({
        encrypted: conn.encryptedPassword,
        iv: conn.iv,
        authTag: conn.authTag,
      });
    } catch (decryptErr: any) {
      console.error(`❌ Could not decrypt credentials for user ${user.id}:`, decryptErr.message);
      continue;
    }

    const job = await prisma.attendanceSyncJob.create({
      data: {
        userId: user.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    const adapter = new PlaywrightPortalAdapter();
    const endDate = new Date();
    const semesterStartDate = new Date();
    semesterStartDate.setMonth(5); // June 1
    semesterStartDate.setDate(1);

    // Determine smart sync date range:
    // If user already has attendance history and FULL_SYNC is not forced,
    // fetch only the last 14 days up to today. This reduces SAP report generation time from ~12s to <1s.
    let syncStartDate = conn.startDate || "01.06.2026";
    if (!isFullSync) {
      const latestRecord = await prisma.attendanceRecord.findFirst({
        where: { userId: user.id },
        orderBy: { attendanceDate: "desc" },
      });

      if (latestRecord) {
        const lookback = new Date(latestRecord.attendanceDate);
        lookback.setDate(lookback.getDate() - 14); // 14-day rolling buffer to catch retrospective entries
        const day = String(lookback.getDate()).padStart(2, "0");
        const month = String(lookback.getMonth() + 1).padStart(2, "0");
        const year = lookback.getFullYear();
        syncStartDate = `${day}.${month}.${year}`;
        console.log(`⚡ Incremental sync active: fetching from ${syncStartDate} (14-day lookback buffer)`);
      } else {
        console.log(`📚 Initial full sync: no prior records found. Fetching from semester start: ${syncStartDate}.`);
      }
    } else {
      console.log(`🔄 Full semester resync forced: fetching from ${syncStartDate}.`);
    }

    try {
      await prisma.portalConnection.update({
        where: { id: conn.id },
        data: { lastSyncAttemptAt: new Date() },
      });

      console.log(`🌐 Launching Playwright to connect to SVKM SAP portal for ${username}...`);
      const report = await adapter.fetchAttendance(
        {
          username,
          password,
          portalUrl: conn.portalUrl,
        },
        { startDate: semesterStartDate, endDate },
        {
          academicYear: conn.academicYear || "2026-2027",
          semester: conn.semester || "Semester V",
          reportType: conn.reportType || "Detail Report",
          startDate: syncStartDate,
          endDate: conn.endDate || undefined,
        }
      );

      console.log(`📊 Retrieved ${report.items.length} raw attendance records from portal.`);

      if (report.studentName && report.studentName !== user.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: report.studentName },
        });
        console.log(`✅ Updated student profile name to: ${report.studentName}`);
      }

      const records = await adapter.parseReport(report);
      const { inserted, updated } = await persistAttendanceRecords(user.id, records, "PORTAL_SYNC");

      await prisma.$transaction([
        prisma.attendanceSyncJob.update({
          where: { id: job.id },
          data: {
            status: "SUCCESS",
            completedAt: new Date(),
            recordsFetched: records.length,
            recordsInserted: inserted,
            recordsUpdated: updated,
          },
        }),
        prisma.portalConnection.update({
          where: { id: conn.id },
          data: {
            lastSuccessfulSyncAt: new Date(),
            lastSyncError: null,
            connectionStatus: "CONNECTED",
          },
        }),
      ]);

      console.log(`🎉 SUCCESS: User ${user.email} synced! (Fetched: ${records.length}, New: ${inserted}, Updated: ${updated})`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`❌ Sync error for user ${user.email}:`, errMsg);

      const isHoursRestricted =
        errMsg.includes("PORTAL_HOURS_RESTRICTED") ||
        errMsg.includes("between 06:00 PM to 07:00 AM") ||
        errMsg.includes("06:00 PM to 07:00 AM");

      const isAuthFailed =
        errMsg.includes("Invalid credentials") ||
        errMsg.includes("expired password") ||
        errMsg.includes("User authentication failed") ||
        errMsg.includes("Logon failed");

      await prisma.$transaction([
        prisma.attendanceSyncJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            sanitizedErrorMessage: errMsg.substring(0, 500),
          },
        }),
        prisma.portalConnection.update({
          where: { id: conn.id },
          data: {
            lastSyncError: errMsg.substring(0, 255),
            connectionStatus: isAuthFailed ? "AUTH_FAILED" : conn.connectionStatus,
          },
        }),
      ]);

      if (isHoursRestricted) {
        console.warn(
          "\n⛔ [ALERT] SVKM SAP Portal attendance window is closed. (University restriction: 06:00 PM to 07:00 AM IST only)."
        );
        console.warn("Stopping sync job early to avoid repeated timeout errors.");
        break;
      }
    } finally {
      await adapter.closeSession();
    }
  }

  console.log("\n✨ Nightly sync process finished.");
}

runNightlySync()
  .catch((e) => {
    console.error("Fatal error during nightly sync:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

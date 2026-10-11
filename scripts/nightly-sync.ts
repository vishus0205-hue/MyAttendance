import { prisma } from "../src/lib/db/prisma";
import { PlaywrightPortalAdapter } from "../src/services/portal/playwright-portal-adapter";
import { decryptCredentials } from "../src/lib/security/crypto";
import { AttendanceStatus } from "@prisma/client";

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
      let inserted = 0;
      let updated = 0;

      // In-memory cache of subjects for this user to avoid hundreds of redundant database upserts
      const existingSubjects = await prisma.subject.findMany({
        where: { userId: user.id },
      });
      const subjectMap = new Map<string, string>();
      for (const s of existingSubjects) {
        subjectMap.set(s.name, s.id);
      }

      for (const item of records) {
        try {
          let subjectId = subjectMap.get(item.subjectName);
          if (!subjectId) {
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
            subjectId = subject.id;
            subjectMap.set(item.subjectName, subjectId);
          }

          await prisma.attendanceRecord.upsert({
            where: {
              userId_subjectId_attendanceDate_periodNumber: {
                userId: user.id,
                subjectId: subjectId,
                attendanceDate: item.attendanceDate,
                periodNumber: item.periodNumber ?? 1,
              },
            },
            update: {
              status: item.status as AttendanceStatus,
              source: "PORTAL_SYNC",
              lastObservedAt: new Date(),
            },
            create: {
              userId: user.id,
              subjectId: subjectId,
              attendanceDate: item.attendanceDate,
              periodNumber: item.periodNumber ?? 1,
              status: item.status as AttendanceStatus,
              source: "PORTAL_SYNC",
              lastObservedAt: new Date(),
            },
          });
          inserted++;
        } catch (recordErr: any) {
          console.warn(`⚠️ Warning saving record for ${item.subjectName} (${item.attendanceDate}):`, recordErr.message);
        }
      }

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
      console.error(`❌ Sync error for user ${user.email}:`, err.message);
      await prisma.$transaction([
        prisma.attendanceSyncJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            sanitizedErrorMessage: err.message?.substring(0, 500),
          },
        }),
        prisma.portalConnection.update({
          where: { id: conn.id },
          data: {
            lastSyncError: err.message?.substring(0, 255),
          },
        }),
      ]);
    } finally {
      await adapter.closeSession();
    }
  }

  console.log("\n✨ Nightly sync process finished for all users.");
}

runNightlySync()
  .catch((e) => {
    console.error("Fatal error during nightly sync:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

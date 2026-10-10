import { prisma } from "../src/lib/db/prisma";
import { PlaywrightPortalAdapter } from "../src/services/portal/playwright-portal-adapter";
import { decryptCredentials } from "../src/lib/security/crypto";
import { AttendanceStatus } from "@prisma/client";

async function runNightlySync() {
  console.log("🌙 [Nightly Sync] Starting attendance sync job...");
  console.log(`⏰ Current execution time: ${new Date().toISOString()}`);

  const connections = await prisma.portalConnection.findMany({
    where: {
      autoSyncEnabled: true,
      encryptedUsername: { not: "" },
      encryptedPassword: { not: "" },
    },
    include: {
      user: true,
    },
  });

  if (connections.length === 0) {
    console.log("ℹ️ No users found with auto-sync enabled and saved portal credentials.");
    return;
  }

  console.log(`📋 Found ${connections.length} user(s) scheduled for nightly sync.`);

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
          startDate: conn.startDate || "01.06.2026",
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

      for (const item of records) {
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
              source: "PORTAL_SYNC",
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
              source: "PORTAL_SYNC",
              lastObservedAt: new Date(),
            },
          });
          inserted++;
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

import { prisma } from "./src/lib/db/prisma";
import { PlaywrightPortalAdapter } from "./src/services/portal/playwright-portal-adapter";
import { decryptCredentials } from "./src/lib/security/crypto";
import { AttendanceStatus } from "@prisma/client";

async function main() {
  console.log("🚀 Starting live attendance sync into PostgreSQL...");
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: { portalConnection: true },
  });

  if (!user || !user.portalConnection) {
    console.error("No user or portal connection found!");
    return;
  }

  const conn = user.portalConnection;
  const username = decryptCredentials({
    encrypted: conn.encryptedUsername,
    iv: conn.iv,
    authTag: conn.authTag,
  });
  const password = decryptCredentials({
    encrypted: conn.encryptedPassword,
    iv: conn.iv,
    authTag: conn.authTag,
  });

  console.log(`👤 Syncing for student: ${username} (${user.name})`);

  const job = await prisma.attendanceSyncJob.create({
    data: {
      userId: user.id,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  const adapter = new PlaywrightPortalAdapter();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(5); // June
  startDate.setDate(1);

  try {
    const report = await adapter.fetchAttendance(
      { username, password, portalUrl: conn.portalUrl },
      { startDate, endDate }
    );

    console.log(`📄 Fetched ${report.items.length} raw attendance items from portal.`);

    if (report.studentName) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: report.studentName },
      });
      console.log(`✅ Updated student profile name to: ${report.studentName}`);
    }

    const records = await adapter.parseReport(report);
    console.log(`🔄 Parsed ${records.length} normalized attendance records.`);

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
        where: { userId: user.id },
        data: {
          lastSuccessfulSyncAt: new Date(),
          lastSyncAttemptAt: new Date(),
          lastSyncError: null,
          connectionStatus: "CONNECTED",
        },
      }),
    ]);

    console.log(`\n🎉 SYNC COMPLETED SUCCESSFULLY!`);
    console.log(`- Total Records Fetched: ${records.length}`);
    console.log(`- New Records Inserted: ${inserted}`);
    console.log(`- Records Updated: ${updated}`);

  } catch (err: any) {
    console.error("❌ Sync failed:", err.message);
    await prisma.attendanceSyncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        sanitizedErrorMessage: err.message,
      },
    });
  } finally {
    await adapter.closeSession();
    await prisma.$disconnect();
  }
}

main();

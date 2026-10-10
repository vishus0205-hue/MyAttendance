import { PrismaClient, AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptCredentials } from "../src/lib/security/crypto";
import { MockPortalAdapter } from "../src/services/portal/mock-portal-adapter";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding for MyAttendace...");

  // 1. Create or update Demo User
  const demoEmail = "student@svkm.ac.in";
  const passwordHash = await bcrypt.hash("demoPassword123", 10);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      name: "Alex Mercer (Demo Student)",
      targetThreshold: 75.0,
    },
    create: {
      email: demoEmail,
      name: "Alex Mercer (Demo Student)",
      passwordHash,
      targetThreshold: 75.0,
    },
  });

  console.log(`✅ User ready: ${user.email} (${user.id})`);

  // 2. Setup Portal Connection with encrypted dummy credentials
  const encryptedUser = encryptCredentials("SAP70012345");
  const encryptedPass = encryptCredentials("portalPassword2026!");

  await prisma.portalConnection.upsert({
    where: { userId: user.id },
    update: {
      portalUrl: "https://sdc-sppap1.svkm.ac.in:50001/irj/portal",
      encryptedUsername: encryptedUser.encrypted,
      encryptedPassword: encryptedPass.encrypted,
      iv: encryptedUser.iv,
      authTag: encryptedUser.authTag,
      connectionStatus: "CONNECTED",
      lastSuccessfulSyncAt: new Date(),
      lastSyncAttemptAt: new Date(),
    },
    create: {
      userId: user.id,
      portalUrl: "https://sdc-sppap1.svkm.ac.in:50001/irj/portal",
      encryptedUsername: encryptedUser.encrypted,
      encryptedPassword: encryptedPass.encrypted,
      iv: encryptedUser.iv,
      authTag: encryptedUser.authTag,
      connectionStatus: "CONNECTED",
      lastSuccessfulSyncAt: new Date(),
      lastSyncAttemptAt: new Date(),
    },
  });

  console.log("✅ Portal connection configured with encrypted credentials reference");

  // 3. Define Standard Academic Subjects
  const subjectDefs = [
    { name: "Computer Networks", code: "CS401" },
    { name: "Database Management Systems", code: "CS402" },
    { name: "Machine Learning", code: "CS403" },
    { name: "Operating Systems", code: "CS404" },
    { name: "Software Engineering", code: "CS405" },
    { name: "Cloud Computing Lab", code: "CS406L" },
  ];

  const subjectMap = new Map<string, string>();
  for (const s of subjectDefs) {
    const sub = await prisma.subject.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: s.name,
        },
      },
      update: { code: s.code },
      create: {
        userId: user.id,
        name: s.name,
        code: s.code,
      },
    });
    subjectMap.set(s.name, sub.id);
  }

  console.log(`✅ ${subjectMap.size} academic subjects initialized`);

  // 4. Generate 60 days of synthetic historical records via MockPortalAdapter
  const mockAdapter = new MockPortalAdapter();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 60);

  const rawReport = await mockAdapter.fetchAttendance(
    { username: "SAP70012345" },
    { startDate, endDate }
  );
  const normalizedRecords = await mockAdapter.parseReport(rawReport);

  console.log(`📊 Generated ${normalizedRecords.length} records. Upserting into PostgreSQL...`);

  let inserted = 0;
  let updated = 0;

  for (const r of normalizedRecords) {
    const subjectId = subjectMap.get(r.subjectName);
    if (!subjectId) continue;

    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        userId: user.id,
        subjectId,
        attendanceDate: r.attendanceDate,
        periodNumber: r.periodNumber ?? 1,
      },
    });

    if (existing) {
      await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: r.status as AttendanceStatus,
          lastObservedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.attendanceRecord.create({
        data: {
          userId: user.id,
          subjectId,
          attendanceDate: r.attendanceDate,
          periodNumber: r.periodNumber ?? 1,
          status: r.status as AttendanceStatus,
          source: "DEMO_SEED",
          lastObservedAt: new Date(),
        },
      });
      inserted++;
    }
  }

  // 5. Create Seed Sync Job Entry
  await prisma.attendanceSyncJob.create({
    data: {
      userId: user.id,
      status: "SUCCESS",
      startedAt: new Date(Date.now() - 5000),
      completedAt: new Date(),
      recordsFetched: normalizedRecords.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
    },
  });

  console.log(`🎉 Seeding completed successfully!`);
  console.log(`   - Records Inserted: ${inserted}`);
  console.log(`   - Records Updated: ${updated}`);
  console.log(`   - Total Processed: ${inserted + updated}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

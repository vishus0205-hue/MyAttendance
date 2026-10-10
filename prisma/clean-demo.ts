import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDemoData() {
  console.log("🧹 Cleaning demo data from PostgreSQL...");

  // 1. Delete all demo attendance records
  const deletedRecords = await prisma.attendanceRecord.deleteMany({
    where: { source: "DEMO_SEED" },
  });
  console.log(`✅ Deleted ${deletedRecords.count} demo attendance records.`);

  // 2. Delete demo subjects (that have no remaining live records)
  const deletedSubjects = await prisma.subject.deleteMany({
    where: { records: { none: {} } },
  });
  console.log(`✅ Deleted ${deletedSubjects.count} demo subjects.`);

  // 3. Clear initial demo sync jobs
  const deletedJobs = await prisma.attendanceSyncJob.deleteMany({
    where: {
      OR: [
        { recordsFetched: 176 },
        { recordsInserted: 176 },
        { recordsUpdated: 176 },
      ],
    },
  });
  console.log(`✅ Deleted ${deletedJobs.count} demo sync job logs.`);

  // 4. Update user name from demo student
  await prisma.user.updateMany({
    data: { name: "Student" },
  });
  console.log("✅ Updated student profile name to 'Student'.");

  console.log("✨ All demo data successfully removed! The database is now clean for your live college data.");
}

cleanDemoData()
  .catch((e) => {
    console.error("Error clearing demo data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

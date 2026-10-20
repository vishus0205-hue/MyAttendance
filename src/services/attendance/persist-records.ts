import { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/db/prisma";
import { NormalizedAttendanceRecord } from "../portal/portal-adapter.interface";

/** Saves a report and returns counts only for writes that completed successfully. */
export async function persistAttendanceRecords(
  userId: string,
  records: NormalizedAttendanceRecord[],
  source: string
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const subjects = new Map<string, string>();

  for (const item of records) {
    let subjectId = subjects.get(item.subjectName);
    if (!subjectId) {
      const subject = await prisma.subject.upsert({
        where: { userId_name: { userId, name: item.subjectName } },
        update: { code: item.subjectCode || undefined },
        create: { userId, name: item.subjectName, code: item.subjectCode || undefined },
      });
      subjectId = subject.id;
      subjects.set(item.subjectName, subjectId);
    }

    const key = {
      userId,
      subjectId,
      attendanceDate: item.attendanceDate,
      periodNumber: item.periodNumber ?? 1,
    };
    const data = {
      status: item.status as AttendanceStatus,
      source,
      lastObservedAt: new Date(),
    };

    try {
      await prisma.attendanceRecord.create({ data: { ...key, ...data } });
      inserted++;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      await prisma.attendanceRecord.update({
        where: { userId_subjectId_attendanceDate_periodNumber: key },
        data,
      });
      updated++;
    }
  }

  return { inserted, updated };
}

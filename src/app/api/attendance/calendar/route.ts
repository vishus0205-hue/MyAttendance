import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);

    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);

    // Range for specified month with buffer
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const records = await prisma.attendanceRecord.findMany({
      where: {
        userId: user.id,
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ attendanceDate: "asc" }, { periodNumber: "asc" }],
    });

    // Group records by Date string (YYYY-MM-DD)
    const dayMap = new Map<
      string,
      {
        date: string;
        totalPeriods: number;
        attendedCount: number;
        absentCount: number;
        onDutyCount: number;
        medicalCount: number;
        dayStatus: "FULL" | "PARTIAL" | "ABSENT" | "ON_DUTY" | "EXCUSED";
        records: Array<{
          id: string;
          periodNumber: number | null;
          status: string;
          subjectName: string;
          subjectCode?: string | null;
        }>;
      }
    >();

    for (const r of records) {
      const dateKey = new Date(r.attendanceDate).toISOString().split("T")[0];

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          totalPeriods: 0,
          attendedCount: 0,
          absentCount: 0,
          onDutyCount: 0,
          medicalCount: 0,
          dayStatus: "FULL",
          records: [],
        });
      }

      const dayData = dayMap.get(dateKey)!;
      dayData.totalPeriods++;

      if (r.status === "PRESENT") dayData.attendedCount++;
      else if (r.status === "ABSENT") dayData.absentCount++;
      else if (r.status === "ON_DUTY") dayData.onDutyCount++;
      else if (r.status === "MEDICAL_LEAVE") dayData.medicalCount++;

      dayData.records.push({
        id: r.id,
        periodNumber: r.periodNumber,
        status: r.status,
        subjectName: r.subject?.name || "Unassigned",
        subjectCode: r.subject?.code,
      });
    }

    // Determine dayStatus for each day
    const days = Array.from(dayMap.values()).map((day) => {
      const attended = day.attendedCount + day.onDutyCount;
      let status: "FULL" | "PARTIAL" | "ABSENT" | "ON_DUTY" | "EXCUSED" = "FULL";

      if (day.absentCount === day.totalPeriods) {
        status = "ABSENT";
      } else if (day.absentCount > 0) {
        status = "PARTIAL";
      } else if (day.onDutyCount === day.totalPeriods) {
        status = "ON_DUTY";
      }

      return {
        ...day,
        dayStatus: status,
      };
    });

    return NextResponse.json({
      success: true,
      year,
      month,
      days,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

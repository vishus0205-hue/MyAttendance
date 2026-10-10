import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  calculateSubjectSummary,
  calculateOverallSummary,
  AttendanceStatusType,
} from "@/services/attendance/attendance-calculator";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    // 1. Fetch portal connection details
    const portalConn = await prisma.portalConnection.findUnique({
      where: { userId: user.id },
      select: {
        portalUrl: true,
        connectionStatus: true,
        autoSyncEnabled: true,
        lastSuccessfulSyncAt: true,
        lastSyncAttemptAt: true,
        lastSyncError: true,
      },
    });

    // 2. Fetch all subjects belonging to this user
    const subjects = await prisma.subject.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    // 3. Fetch all attendance records
    const records = await prisma.attendanceRecord.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        subjectId: true,
        status: true,
        attendanceDate: true,
        periodNumber: true,
        source: true,
      },
      orderBy: { attendanceDate: "desc" },
    });

    // 4. Calculate source breakdown (Live vs Demo)
    let demoCount = 0;
    let liveCount = 0;
    let manualCount = 0;

    for (const r of records) {
      if (r.source === "DEMO_SEED") demoCount++;
      else if (r.source === "PORTAL_SYNC") liveCount++;
      else manualCount++;
    }

    // 5. Calculate subject-wise summaries
    const subjectSummaries = subjects.map((sub) => {
      const subjectRecords = records
        .filter((r) => r.subjectId === sub.id)
        .map((r) => ({
          status: r.status as AttendanceStatusType,
          attendanceDate: r.attendanceDate,
          subjectId: r.subjectId,
          periodNumber: r.periodNumber,
        }));

      return calculateSubjectSummary(
        subjectRecords,
        { id: sub.id, name: sub.name, code: sub.code },
        user.targetThreshold
      );
    });

    // 6. Calculate overall summary
    const overall = calculateOverallSummary(subjectSummaries, user.targetThreshold);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        targetThreshold: user.targetThreshold,
      },
      connection: portalConn,
      dataSources: {
        totalRecords: records.length,
        demoRecords: demoCount,
        liveRecords: liveCount,
        manualRecords: manualCount,
        isDemoMode: demoCount > 0 && liveCount === 0,
      },
      overall,
      subjects: subjectSummaries,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

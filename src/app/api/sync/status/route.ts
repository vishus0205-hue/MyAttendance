import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    // Fetch the latest 5 sync jobs for this user
    const jobs = await prisma.attendanceSyncJob.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 5,
    });

    const latestJob = jobs[0] || null;

    const portalConn = await prisma.portalConnection.findUnique({
      where: { userId: user.id },
      select: {
        lastSuccessfulSyncAt: true,
        lastSyncAttemptAt: true,
        lastSyncError: true,
        connectionStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      latestJob,
      recentJobs: jobs,
      connection: portalConn,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

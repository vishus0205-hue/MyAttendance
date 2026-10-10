import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AttendanceStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await request.json();
    const csvContent = body.csvContent as string;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { success: false, error: "Please provide valid CSV content to import." },
        { status: 400 }
      );
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      return NextResponse.json(
        { success: false, error: "CSV file has no data rows." },
        { status: 400 }
      );
    }

    let inserted = 0;
    let updated = 0;

    // Skip header row if present
    const startIndex = lines[0].toLowerCase().includes("date") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 3) continue;

      const dateStr = parts[0];
      const subjectName = parts[1];
      const periodNumber = parseInt(parts[2], 10) || 1;
      const rawStatus = (parts[3] || "PRESENT").toUpperCase();

      const attendanceDate = new Date(dateStr);
      if (isNaN(attendanceDate.getTime())) continue;

      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      if (rawStatus.includes("ABSENT") || rawStatus === "A") {
        status = AttendanceStatus.ABSENT;
      } else if (rawStatus.includes("DUTY") || rawStatus === "OD") {
        status = AttendanceStatus.ON_DUTY;
      } else if (rawStatus.includes("MED") || rawStatus === "ML") {
        status = AttendanceStatus.MEDICAL_LEAVE;
      } else if (rawStatus.includes("CANCEL")) {
        status = AttendanceStatus.CANCELLED;
      }

      // Upsert subject
      const subject = await prisma.subject.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: subjectName,
          },
        },
        update: {},
        create: {
          userId: user.id,
          name: subjectName,
        },
      });

      const existing = await prisma.attendanceRecord.findFirst({
        where: {
          userId: user.id,
          subjectId: subject.id,
          attendanceDate,
          periodNumber,
        },
      });

      if (existing) {
        await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status,
            source: "MANUAL_IMPORT",
            lastObservedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.attendanceRecord.create({
          data: {
            userId: user.id,
            subjectId: subject.id,
            attendanceDate,
            periodNumber,
            status,
            source: "MANUAL_IMPORT",
            lastObservedAt: new Date(),
          },
        });
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${inserted} records added, ${updated} records updated.`,
      inserted,
      updated,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Import Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

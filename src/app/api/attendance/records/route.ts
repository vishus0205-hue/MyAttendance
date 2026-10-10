import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AttendanceStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const subjectId = searchParams.get("subjectId") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const format = searchParams.get("format");

    // Build Prisma where filter strictly scoped to authenticated user
    const whereClause: {
      userId: string;
      subjectId?: string;
      status?: AttendanceStatus;
      attendanceDate?: { gte?: Date; lte?: Date };
      OR?: Array<
        | { subject: { name: { contains: string; mode: "insensitive" } } }
        | { subject: { code: { contains: string; mode: "insensitive" } } }
      >;
    } = {
      userId: user.id,
      ...(subjectId && { subjectId }),
      ...(status && Object.values(AttendanceStatus).includes(status as AttendanceStatus) && {
        status: status as AttendanceStatus,
      }),
      ...((startDate || endDate) && {
        attendanceDate: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
      ...(search && {
        OR: [
          { subject: { name: { contains: search, mode: "insensitive" } } },
          { subject: { code: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    // If format is CSV, stream all matching records
    if (format === "csv") {
      const allRecords = await prisma.attendanceRecord.findMany({
        where: whereClause,
        include: { subject: { select: { name: true, code: true } } },
        orderBy: [{ attendanceDate: "desc" }, { periodNumber: "asc" }],
      });

      // Format CSV with formula injection prevention (escape leading =, +, -, @)
      const sanitizeCell = (text: string | number | null | undefined): string => {
        if (text === null || text === undefined) return '""';
        let str = String(text);
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`; // Prefix with single quote to disable spreadsheet execution
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = ["Date", "Day", "Subject Code", "Subject Name", "Period", "Status", "Source"];
      const rows = allRecords.map((r) => {
        const dateObj = new Date(r.attendanceDate);
        const dateStr = dateObj.toISOString().split("T")[0];
        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

        return [
          sanitizeCell(dateStr),
          sanitizeCell(dayName),
          sanitizeCell(r.subject?.code || "N/A"),
          sanitizeCell(r.subject?.name || "Unassigned"),
          sanitizeCell(r.periodNumber || 1),
          sanitizeCell(r.status),
          sanitizeCell(r.source),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="myattendance_records_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Standard JSON pagination
    const [totalRecords, records, subjects] = await Promise.all([
      prisma.attendanceRecord.count({ where: whereClause }),
      prisma.attendanceRecord.findMany({
        where: whereClause,
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ attendanceDate: "desc" }, { periodNumber: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subject.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      records: records.map((r) => ({
        id: r.id,
        attendanceDate: r.attendanceDate,
        dayOfWeek: new Date(r.attendanceDate).toLocaleDateString("en-US", { weekday: "short" }),
        periodNumber: r.periodNumber,
        status: r.status,
        source: r.source,
        subject: r.subject,
      })),
      subjects,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

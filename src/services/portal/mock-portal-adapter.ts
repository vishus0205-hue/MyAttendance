import {
  IPortalAdapter,
  PortalCredentials,
  ConnectionTestResult,
  DateRange,
  RawAttendanceReport,
  RawAttendanceItem,
  NormalizedAttendanceRecord,
} from "./portal-adapter.interface";
import { AttendanceStatusType } from "../attendance/attendance-calculator";

const SAMPLE_SUBJECTS = [
  { name: "Computer Networks", code: "CS401", weight: 0.88 },
  { name: "Database Management Systems", code: "CS402", weight: 0.82 },
  { name: "Machine Learning", code: "CS403", weight: 0.72 }, // Deliberately lower to test warnings
  { name: "Operating Systems", code: "CS404", weight: 0.85 },
  { name: "Software Engineering", code: "CS405", weight: 0.90 },
  { name: "Cloud Computing Lab", code: "CS406L", weight: 0.78 },
];

export class MockPortalAdapter implements IPortalAdapter {
  readonly adapterName = "MOCK_PROVIDER";

  async testConnection(credentials: PortalCredentials): Promise<ConnectionTestResult> {
    // Artificial latency to simulate network roundtrip
    await new Promise((res) => setTimeout(res, 500));

    if (!credentials.username) {
      return {
        success: false,
        message: "Demo Error: Username is required",
      };
    }

    return {
      success: true,
      message: "Connected successfully (Demo Mode)",
      studentName: "Alex Mercer (Demo Student)",
      studentId: credentials.username || "SAP-DEMO-2026",
      sessionValidUntil: new Date(Date.now() + 3600 * 1000),
    };
  }

  async fetchAttendance(
    credentials: PortalCredentials,
    dateRange: DateRange
  ): Promise<RawAttendanceReport> {
    await new Promise((res) => setTimeout(res, 600));

    const items: RawAttendanceItem[] = [];
    const current = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = current.toISOString().split("T")[0];

        // 4 to 5 periods per day
        const numPeriods = 4;
        for (let period = 1; period <= numPeriods; period++) {
          const subject = SAMPLE_SUBJECTS[(period + dayOfWeek) % SAMPLE_SUBJECTS.length];
          // Deterministic pseudo-random generation based on date and period
          const seed = (current.getDate() * 17 + period * 23 + subject.name.length) % 100;

          let rawStatus = "Present";
          if (seed > 88) {
            rawStatus = "Absent";
          } else if (seed > 84) {
            rawStatus = "On Duty";
          } else if (seed > 82) {
            rawStatus = "Medical Leave";
          }

          items.push({
            date: dateStr,
            subjectName: subject.name,
            subjectCode: subject.code,
            period: period,
            status: rawStatus,
            faculty: "Dr. Sharma / Prof. Mehta",
            room: `Hall-${300 + period}`,
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return {
      fetchedAt: new Date(),
      source: "MOCK_PORTAL_PROVIDER",
      studentName: "Alex Mercer (Demo Student)",
      studentId: credentials.username || "SAP-DEMO-2026",
      term: "Semester VII (2026-2027)",
      items,
    };
  }

  async parseReport(rawReport: RawAttendanceReport): Promise<NormalizedAttendanceRecord[]> {
    return rawReport.items.map((item) => {
      let status: AttendanceStatusType = "UNKNOWN";
      const normalizedStatusStr = item.status.trim().toUpperCase();

      if (normalizedStatusStr === "PRESENT" || normalizedStatusStr === "P") {
        status = "PRESENT";
      } else if (normalizedStatusStr === "ABSENT" || normalizedStatusStr === "A") {
        status = "ABSENT";
      } else if (
        normalizedStatusStr === "ON DUTY" ||
        normalizedStatusStr === "OD" ||
        normalizedStatusStr === "ONDUTY"
      ) {
        status = "ON_DUTY";
      } else if (
        normalizedStatusStr.includes("MEDICAL") ||
        normalizedStatusStr === "ML"
      ) {
        status = "MEDICAL_LEAVE";
      } else if (normalizedStatusStr.includes("CANCEL")) {
        status = "CANCELLED";
      }

      return {
        attendanceDate: new Date(item.date),
        subjectName: item.subjectName,
        subjectCode: item.subjectCode,
        periodNumber: typeof item.period === "number" ? item.period : parseInt(String(item.period), 10) || null,
        status,
        source: "DEMO_SEED",
        rawStatus: item.status,
      };
    });
  }
}

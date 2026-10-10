import { AttendanceStatusType } from "../attendance/attendance-calculator";

export interface PortalCredentials {
  username: string;
  password?: string;
  portalUrl?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  studentName?: string;
  studentId?: string;
  sessionValidUntil?: Date;
  details?: Record<string, unknown>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface RawAttendanceItem {
  date: string;
  subjectName: string;
  subjectCode?: string;
  period?: number | string;
  status: string; // Raw status from portal e.g. "P", "A", "OD", "Present"
  faculty?: string;
  room?: string;
  remarks?: string;
}

export interface RawAttendanceReport {
  fetchedAt: Date;
  source: string;
  studentName?: string;
  studentId?: string;
  term?: string;
  items: RawAttendanceItem[];
}

export interface NormalizedAttendanceRecord {
  attendanceDate: Date;
  subjectName: string;
  subjectCode?: string;
  periodNumber?: number | null;
  status: AttendanceStatusType;
  source: string;
  rawStatus: string;
}

export interface AttendanceReportOptions {
  academicYear?: string | null;
  semester?: string | null;
  reportType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface IPortalAdapter {
  readonly adapterName: string;

  /**
   * Tests authentication against the portal without persisting records.
   */
  testConnection(credentials: PortalCredentials): Promise<ConnectionTestResult>;

  /**
   * Fetches raw attendance report for the given date range and academic options.
   */
  fetchAttendance(
    credentials: PortalCredentials,
    dateRange: DateRange,
    options?: AttendanceReportOptions
  ): Promise<RawAttendanceReport>;

  /**
   * Normalizes raw portal report items into clean standardized domain records.
   */
  parseReport(rawReport: RawAttendanceReport): Promise<NormalizedAttendanceRecord[]>;

  /**
   * Cleans up browser resources, sessions, or temporary files.
   */
  closeSession?(): Promise<void>;
}

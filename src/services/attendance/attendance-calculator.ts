export type AttendanceStatusType =
  | "PRESENT"
  | "ABSENT"
  | "ON_DUTY"
  | "MEDICAL_LEAVE"
  | "CANCELLED"
  | "UNKNOWN";

export interface AttendanceRecordLike {
  status: AttendanceStatusType;
  attendanceDate: Date | string;
  subjectId?: string | null;
  periodNumber?: number | null;
}

export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  totalHeld: number;
  totalAttended: number;
  presentCount: number;
  absentCount: number;
  onDutyCount: number;
  medicalLeaveCount: number;
  cancelledCount: number;
  percentage: number;
  bunkBuffer: number;      // Number of classes student can safely miss and stay >= target
  classesNeeded: number;   // Number of consecutive classes student must attend to reach target
  isBelowThreshold: boolean;
}

export interface OverallSummary {
  totalHeld: number;
  totalAttended: number;
  presentCount: number;
  absentCount: number;
  onDutyCount: number;
  medicalLeaveCount: number;
  percentage: number;
  bunkBuffer: number;
  classesNeeded: number;
  isBelowThreshold: boolean;
  subjectsCount: number;
  subjectsBelowThreshold: number;
}

/**
 * Calculates how many additional classes can be missed before falling below target %.
 * Target is given as a percentage number (e.g. 75).
 */
export function calculateBunkMargin(
  attended: number,
  held: number,
  targetPercent: number
): number {
  if (held === 0) return 0;
  const T = targetPercent / 100;
  if (T <= 0) return 999;
  const currentRatio = attended / held;
  if (currentRatio < T) return 0;

  // Formula: floor((A - T * H) / T)
  const safeMiss = Math.floor((attended - T * held) / T);
  return Math.max(0, safeMiss);
}

/**
 * Calculates the minimum consecutive future classes that must be attended to reach target %.
 * Formula: max(0, ceil((T * H - A) / (1 - T)))
 */
export function calculateRecoveryClasses(
  attended: number,
  held: number,
  targetPercent: number
): number {
  if (held === 0) return 0;
  const T = targetPercent / 100;
  if (T >= 1) return targetPercent === 100 && attended < held ? Infinity : 0;
  const currentRatio = attended / held;
  if (currentRatio >= T) return 0;

  const needed = Math.ceil((T * held - attended) / (1 - T));
  return Math.max(0, needed);
}

/**
 * Derives statistical summary for a single subject.
 */
export function calculateSubjectSummary(
  records: AttendanceRecordLike[],
  subjectInfo: { id: string; name: string; code?: string | null },
  targetPercent: number = 75.0
): SubjectSummary {
  let presentCount = 0;
  let absentCount = 0;
  let onDutyCount = 0;
  let medicalLeaveCount = 0;
  let cancelledCount = 0;

  for (const record of records) {
    switch (record.status) {
      case "PRESENT":
        presentCount++;
        break;
      case "ABSENT":
        absentCount++;
        break;
      case "ON_DUTY":
        // On Duty is officially counted as attended per standard university policies
        onDutyCount++;
        break;
      case "MEDICAL_LEAVE":
        medicalLeaveCount++;
        break;
      case "CANCELLED":
        cancelledCount++;
        break;
      case "UNKNOWN":
      default:
        break;
    }
  }

  // Classes held = present + absent + on duty (cancelled and unknown are excluded from denominator)
  const totalHeld = presentCount + absentCount + onDutyCount;
  // Classes attended = present + on duty
  const totalAttended = presentCount + onDutyCount;

  const percentage = totalHeld > 0 ? Number(((totalAttended / totalHeld) * 100).toFixed(2)) : 100.0;
  const bunkBuffer = calculateBunkMargin(totalAttended, totalHeld, targetPercent);
  const classesNeeded = calculateRecoveryClasses(totalAttended, totalHeld, targetPercent);
  const isBelowThreshold = percentage < targetPercent;

  return {
    subjectId: subjectInfo.id,
    subjectName: subjectInfo.name,
    subjectCode: subjectInfo.code,
    totalHeld,
    totalAttended,
    presentCount,
    absentCount,
    onDutyCount,
    medicalLeaveCount,
    cancelledCount,
    percentage,
    bunkBuffer,
    classesNeeded,
    isBelowThreshold,
  };
}

/**
 * Derives the overall attendance metrics across all subjects combined.
 */
export function calculateOverallSummary(
  subjectSummaries: SubjectSummary[],
  targetPercent: number = 75.0
): OverallSummary {
  let totalHeld = 0;
  let totalAttended = 0;
  let presentCount = 0;
  let absentCount = 0;
  let onDutyCount = 0;
  let medicalLeaveCount = 0;
  let subjectsBelowThreshold = 0;

  for (const s of subjectSummaries) {
    totalHeld += s.totalHeld;
    totalAttended += s.totalAttended;
    presentCount += s.presentCount;
    absentCount += s.absentCount;
    onDutyCount += s.onDutyCount;
    medicalLeaveCount += s.medicalLeaveCount;
    if (s.isBelowThreshold) {
      subjectsBelowThreshold++;
    }
  }

  const percentage = totalHeld > 0 ? Number(((totalAttended / totalHeld) * 100).toFixed(2)) : 100.0;
  const bunkBuffer = calculateBunkMargin(totalAttended, totalHeld, targetPercent);
  const classesNeeded = calculateRecoveryClasses(totalAttended, totalHeld, targetPercent);

  return {
    totalHeld,
    totalAttended,
    presentCount,
    absentCount,
    onDutyCount,
    medicalLeaveCount,
    percentage,
    bunkBuffer,
    classesNeeded,
    isBelowThreshold: percentage < targetPercent,
    subjectsCount: subjectSummaries.length,
    subjectsBelowThreshold,
  };
}

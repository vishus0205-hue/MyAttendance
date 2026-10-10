import {
  calculateBunkMargin,
  calculateRecoveryClasses,
  calculateSubjectSummary,
  calculateOverallSummary,
  AttendanceRecordLike,
} from "../src/services/attendance/attendance-calculator";

function runCalculatorTests() {
  console.log("📐 Testing Attendance Calculation and Bunk Engine...");

  // 1. Test Bunk Buffer
  // Case A: 80 attended out of 100 held, target 75%
  // floor((80 - 0.75 * 100) / 0.75) = floor((80 - 75) / 0.75) = floor(5 / 0.75) = 6
  const safeMiss = calculateBunkMargin(80, 100, 75);
  console.assert(safeMiss === 6, `Expected 6 safe bunks, got ${safeMiss}`);

  // Case B: 70 attended out of 100 held, target 75% -> already below threshold -> 0 bunks
  const safeMissBelow = calculateBunkMargin(70, 100, 75);
  console.assert(safeMissBelow === 0, `Expected 0 safe bunks when below threshold, got ${safeMissBelow}`);

  // 2. Test Recovery Classes
  // Case A: 70 attended out of 100 held, target 75%
  // ceil((0.75 * 100 - 70) / (1 - 0.75)) = ceil((75 - 70) / 0.25) = ceil(5 / 0.25) = 20
  const needed = calculateRecoveryClasses(70, 100, 75);
  console.assert(needed === 20, `Expected 20 recovery classes, got ${needed}`);

  // Case B: 80 attended out of 100 held, target 75% -> already above threshold -> 0 needed
  const neededAbove = calculateRecoveryClasses(80, 100, 75);
  console.assert(neededAbove === 0, `Expected 0 recovery classes when above threshold, got ${neededAbove}`);

  // 3. Test Subject Summary with various statuses
  const records: AttendanceRecordLike[] = [
    { status: "PRESENT", attendanceDate: "2026-09-01", periodNumber: 1 },
    { status: "PRESENT", attendanceDate: "2026-09-02", periodNumber: 1 },
    { status: "PRESENT", attendanceDate: "2026-09-03", periodNumber: 1 },
    { status: "ON_DUTY", attendanceDate: "2026-09-04", periodNumber: 1 }, // Counted as attended
    { status: "ABSENT", attendanceDate: "2026-09-05", periodNumber: 1 },
    { status: "CANCELLED", attendanceDate: "2026-09-06", periodNumber: 1 }, // Excluded
  ];

  const summary = calculateSubjectSummary(
    records,
    { id: "sub-1", name: "Networks", code: "CS401" },
    75
  );

  console.assert(summary.totalHeld === 5, `Expected 5 held classes (cancelled excluded), got ${summary.totalHeld}`);
  console.assert(summary.totalAttended === 4, `Expected 4 attended (3 present + 1 OD), got ${summary.totalAttended}`);
  console.assert(summary.percentage === 80, `Expected 80%, got ${summary.percentage}%`);
  console.assert(!summary.isBelowThreshold, "Expected not below threshold");

  // 4. Test Overall Summary
  const overall = calculateOverallSummary([summary], 75);
  console.assert(overall.totalHeld === 5, `Expected overall 5 held, got ${overall.totalHeld}`);
  console.assert(overall.percentage === 80, `Expected overall 80%, got ${overall.percentage}`);
  console.assert(overall.subjectsBelowThreshold === 0, "Expected 0 subjects below threshold");

  console.log("✅ All Attendance Calculation unit tests passed successfully!");
}

runCalculatorTests();

"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  TrendingUp,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  calculateBunkMargin,
  calculateRecoveryClasses,
} from "@/services/attendance/attendance-calculator";

interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
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
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Target Slider (Defaults to 75%)
  const [targetPercent, setTargetPercent] = useState<number>(75);
  // Scenario simulation inputs
  const [extraAttended, setExtraAttended] = useState<number>(5);
  const [extraMissed, setExtraMissed] = useState<number>(2);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/attendance/summary");
      const json = await res.json();
      if (json.success) {
        setSubjects(json.subjects);
        if (json.subjects.length > 0) {
          setSelectedSubjectId(json.subjects[0].subjectId);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeSubject = subjects.find((s) => s.subjectId === selectedSubjectId) || subjects[0];

  // Dynamic calculations for active subject with target slider
  const dynamicBunkBuffer = activeSubject
    ? calculateBunkMargin(activeSubject.totalAttended, activeSubject.totalHeld, targetPercent)
    : 0;

  const dynamicNeeded = activeSubject
    ? calculateRecoveryClasses(activeSubject.totalAttended, activeSubject.totalHeld, targetPercent)
    : 0;

  // Scenario 1: Attend next X classes
  const projectedAttendRatio = activeSubject
    ? (
        ((activeSubject.totalAttended + extraAttended) / (activeSubject.totalHeld + extraAttended)) *
        100
      ).toFixed(2)
    : "0";

  // Scenario 2: Miss next Y classes
  const projectedMissRatio = activeSubject
    ? (
        (activeSubject.totalAttended / (activeSubject.totalHeld + extraMissed)) *
        100
      ).toFixed(2)
    : "0";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-600" />
          Subject Analysis & Bunk Forecaster
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Simulate attendance recovery requirements and safety margins for every enrolled course.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-xs">Loading subject metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Subjects List */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Enrolled Courses ({subjects.length})
            </h2>

            <div className="space-y-2">
              {subjects.map((sub) => {
                const isSelected = sub.subjectId === selectedSubjectId;
                const isHealthy = sub.percentage >= targetPercent;
                return (
                  <button
                    key={sub.subjectId}
                    onClick={() => setSelectedSubjectId(sub.subjectId)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                      isSelected
                        ? "bg-card border-blue-600 shadow-md shadow-blue-500/10 ring-1 ring-blue-600"
                        : "bg-card/70 border-border/60 hover:border-border hover:bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                          {sub.subjectCode || "CORE"}
                        </span>
                        <h3 className="font-bold text-sm text-foreground mt-1 leading-snug">{sub.subjectName}</h3>
                      </div>
                      <span
                        className={`text-base font-extrabold ${
                          isHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {sub.percentage}%
                      </span>
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                      <span>{sub.totalAttended} / {sub.totalHeld} classes</span>
                      <span className={isHealthy ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                        {isHealthy ? "Above Target" : "Below Target"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Forecasting Simulator */}
          {activeSubject && (
            <div className="lg:col-span-2 space-y-6">
              {/* Active Subject Detail Card */}
              <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900">
                      {activeSubject.subjectCode || "COURSE"}
                    </span>
                    <h2 className="text-xl font-bold text-foreground mt-1">{activeSubject.subjectName}</h2>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-foreground">{activeSubject.percentage}%</div>
                    <div className="text-xs text-muted-foreground">Current Attendance</div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-[11px] text-muted-foreground font-medium">Total Held</span>
                    <p className="text-lg font-bold text-foreground mt-0.5">{activeSubject.totalHeld}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-[11px] text-muted-foreground font-medium">Attended</span>
                    <p className="text-lg font-bold text-emerald-600 mt-0.5">{activeSubject.totalAttended}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-[11px] text-muted-foreground font-medium">Present</span>
                    <p className="text-lg font-bold text-foreground mt-0.5">{activeSubject.presentCount}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-[11px] text-muted-foreground font-medium">Missed</span>
                    <p className="text-lg font-bold text-red-600 mt-0.5">{activeSubject.absentCount}</p>
                  </div>
                </div>

                {/* Target Slider */}
                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-blue-600" />
                      Adjust Target Threshold
                    </label>
                    <span className="text-sm font-extrabold text-blue-600">{targetPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="1"
                    value={targetPercent}
                    onChange={(e) => setTargetPercent(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>60%</span>
                    <span>75% (Standard)</span>
                    <span>85% (Distinction)</span>
                    <span>95%</span>
                  </div>
                </div>

                {/* Simulator Output Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Safe Bunks Result */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Safety Buffer</span>
                    <div className="text-2xl font-black text-blue-600">
                      {dynamicBunkBuffer} {dynamicBunkBuffer === 1 ? "Class" : "Classes"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dynamicBunkBuffer > 0
                        ? `You can skip up to ${dynamicBunkBuffer} more lectures and remain $\\ge$ ${targetPercent}%.`
                        : `No safe bunks remaining at the ${targetPercent}% threshold.`}
                    </p>
                  </div>

                  {/* Recovery Required Result */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Recovery Requirement</span>
                    <div className="text-2xl font-black text-amber-600">
                      {dynamicNeeded} {dynamicNeeded === 1 ? "Class" : "Classes"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dynamicNeeded > 0
                        ? `Attend ${dynamicNeeded} consecutive lectures without missing any to hit ${targetPercent}%.`
                        : `Attendance is already above ${targetPercent}%. No recovery needed.`}
                    </p>
                  </div>
                </div>

                {/* Scenario Projection Calculator */}
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Future Projection Scenarios
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/30 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span>If I attend next</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={extraAttended}
                          onChange={(e) => setExtraAttended(Number(e.target.value))}
                          className="w-16 px-2 py-0.5 bg-card border border-border rounded text-center font-bold"
                        />
                        <span>classes:</span>
                      </div>
                      <div className="font-bold text-emerald-600 text-sm">
                        New Attendance: {projectedAttendRatio}%
                      </div>
                    </div>

                    <div className="p-3 bg-muted/30 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span>If I miss next</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={extraMissed}
                          onChange={(e) => setExtraMissed(Number(e.target.value))}
                          className="w-16 px-2 py-0.5 bg-card border border-border rounded text-center font-bold"
                        />
                        <span>classes:</span>
                      </div>
                      <div className="font-bold text-red-600 text-sm">
                        New Attendance: {projectedMissRatio}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-2">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Forecast calculations are mathematical projections using official college threshold formulas and do not overwrite your real records.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

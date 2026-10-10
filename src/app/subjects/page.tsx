"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

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
  isBelowThreshold: boolean;
}

function SubjectsContent() {
  const searchParams = useSearchParams();
  const querySubjectId = searchParams.get("id");

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [targetPercent, setTargetPercent] = useState<number>(75);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/attendance/summary");
      const json = await res.json();
      if (json.success) {
        setSubjects(json.subjects || []);
        if (json.user?.targetThreshold) {
          setTargetPercent(json.user.targetThreshold);
        }
        if (json.subjects?.length > 0) {
          const matched = json.subjects.find((s: SubjectSummary) => s.subjectId === querySubjectId);
          setSelectedSubjectId(matched ? matched.subjectId : json.subjects[0].subjectId);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeSubject = subjects.find((s) => s.subjectId === selectedSubjectId) || subjects[0];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          Enrolled Subjects & Attendance Breakdown
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review official held classes, attended sessions, and attendance percentages recorded till date.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-xs">Loading course metrics...</span>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-card p-12 rounded-2xl border border-dashed border-border text-center space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-sm font-bold text-foreground">No Enrolled Courses Found</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Sync your attendance from the portal or configure your academic parameters in Settings.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
          >
            <span>Open Settings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
                      <span>{sub.totalAttended} / {sub.totalHeld} attended</span>
                      <span className={isHealthy ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                        {isHealthy ? "Above Cutoff" : "Below Cutoff"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Breakdown Till Now */}
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
                    <div
                      className={`text-3xl font-extrabold ${
                        activeSubject.percentage >= targetPercent
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {activeSubject.percentage}%
                    </div>
                    <div className="text-xs text-muted-foreground">Current Attendance Rate</div>
                  </div>
                </div>

                {/* Status Notice */}
                <div
                  className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                    activeSubject.percentage >= targetPercent
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300"
                  }`}
                >
                  {activeSubject.percentage >= targetPercent ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div>
                    <strong>
                      {activeSubject.percentage >= targetPercent
                        ? "Meets Required Attendance Minimum"
                        : "Below Required Attendance Minimum"}
                    </strong>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      Attended {activeSubject.totalAttended} out of {activeSubject.totalHeld} conducted sessions till now (Target: {targetPercent}%).
                    </p>
                  </div>
                </div>

                {/* Stats Breakdown Grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                    Session Breakdown Till Now
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-muted/30 border border-border/50 rounded-xl">
                      <span className="text-[11px] text-muted-foreground font-medium">Conducted Till Date</span>
                      <p className="text-2xl font-bold text-foreground mt-1">{activeSubject.totalHeld}</p>
                      <span className="text-[10px] text-muted-foreground">Total lecture slots</span>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border/50 rounded-xl">
                      <span className="text-[11px] text-muted-foreground font-medium">Total Attended</span>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">{activeSubject.totalAttended}</p>
                      <span className="text-[10px] text-muted-foreground">Present + On Duty</span>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border/50 rounded-xl">
                      <span className="text-[11px] text-muted-foreground font-medium">Present in Lecture</span>
                      <p className="text-2xl font-bold text-foreground mt-1">{activeSubject.presentCount}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {activeSubject.totalHeld > 0
                          ? `${((activeSubject.presentCount / activeSubject.totalHeld) * 100).toFixed(1)}% of total`
                          : "0%"}
                      </span>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border/50 rounded-xl">
                      <span className="text-[11px] text-muted-foreground font-medium">Absent / Missed</span>
                      <p className="text-2xl font-bold text-red-600 mt-1">{activeSubject.absentCount}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {activeSubject.totalHeld > 0
                          ? `${((activeSubject.absentCount / activeSubject.totalHeld) * 100).toFixed(1)}% of total`
                          : "0%"}
                      </span>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border/50 rounded-xl">
                      <span className="text-[11px] text-muted-foreground font-medium">On Duty (OD)</span>
                      <p className="text-2xl font-bold text-blue-600 mt-1">{activeSubject.onDutyCount}</p>
                      <span className="text-[10px] text-muted-foreground">Official college approval</span>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border/50 rounded-xl">
                      <span className="text-[11px] text-muted-foreground font-medium">Medical Leave</span>
                      <p className="text-2xl font-bold text-purple-600 mt-1">{activeSubject.medicalLeaveCount}</p>
                      <span className="text-[10px] text-muted-foreground">Excused absence</span>
                    </div>
                  </div>
                </div>

                {/* Visual Attendance Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Attendance Distribution</span>
                    <span className="text-muted-foreground">
                      {activeSubject.presentCount} Present • {activeSubject.onDutyCount} OD • {activeSubject.absentCount} Absent
                    </span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                    {activeSubject.totalHeld > 0 ? (
                      <>
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{
                            width: `${(activeSubject.presentCount / activeSubject.totalHeld) * 100}%`,
                          }}
                          title={`Present: ${activeSubject.presentCount}`}
                        />
                        <div
                          className="bg-blue-500 h-full transition-all"
                          style={{
                            width: `${(activeSubject.onDutyCount / activeSubject.totalHeld) * 100}%`,
                          }}
                          title={`On Duty: ${activeSubject.onDutyCount}`}
                        />
                        <div
                          className="bg-red-500 h-full transition-all"
                          style={{
                            width: `${(activeSubject.absentCount / activeSubject.totalHeld) * 100}%`,
                          }}
                          title={`Absent: ${activeSubject.absentCount}`}
                        />
                      </>
                    ) : (
                      <div className="bg-muted h-full w-full" />
                    )}
                  </div>
                </div>

                {/* Direct Link to Records */}
                <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    View each individual lecture date, time, and status for this course:
                  </span>
                  <Link
                    href={`/attendance?subjectId=${activeSubject.subjectId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl border border-border transition shrink-0"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                    <span>View Course Log</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-xs">Loading course metrics...</span>
        </div>
      }
    >
      <SubjectsContent />
    </Suspense>
  );
}

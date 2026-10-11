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
  Sparkles,
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
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
            <BookOpen className="h-5 w-5" />
          </div>
          <span>Enrolled Subjects & Attendance Breakdown</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Review official held classes, attended sessions, and attendance percentages recorded till date.
        </p>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-2xl glass-panel flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
          <span className="text-xs font-semibold text-slate-400">Loading course analytics...</span>
        </div>
      ) : subjects.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4">
          <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">No Enrolled Courses Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Sync your attendance from the portal or configure your academic parameters in Settings.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition"
          >
            <span>Open Settings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-0">
          {/* Mobile Horizontal Course Selector (< lg) */}
          <div className="flex lg:hidden overflow-x-auto pb-1 gap-2 no-scrollbar">
            {subjects.map((sub) => {
              const isSelected = sub.subjectId === selectedSubjectId;
              const isHealthy = sub.percentage >= targetPercent;
              return (
                <button
                  key={sub.subjectId}
                  onClick={() => setSelectedSubjectId(sub.subjectId)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-left border transition-all text-xs ${
                    isSelected
                      ? "glass-panel border-indigo-500 shadow-md ring-1 ring-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/50"
                      : "glass-card opacity-80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[120px]">
                      {sub.subjectCode || sub.subjectName}
                    </span>
                    <span className={`font-black text-xs ${isHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {sub.percentage}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Desktop Left Column: Full Subjects List (hidden on mobile, replaced by horizontal selector above) */}
            <div className="hidden lg:block space-y-3">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Enrolled Courses ({subjects.length})
              </h2>

              <div className="space-y-2.5">
                {subjects.map((sub) => {
                  const isSelected = sub.subjectId === selectedSubjectId;
                  const isHealthy = sub.percentage >= targetPercent;
                  return (
                    <button
                      key={sub.subjectId}
                      onClick={() => setSelectedSubjectId(sub.subjectId)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? "glass-panel border-indigo-500/70 dark:border-indigo-400/60 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20 translate-x-1"
                          : "glass-card hover:translate-x-1"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 glass-pill px-2 py-0.5 rounded-lg border border-white/40 dark:border-white/10 uppercase tracking-wider font-mono">
                            {sub.subjectCode || "CORE"}
                          </span>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5 leading-snug">{sub.subjectName}</h3>
                        </div>
                        <span
                          className={`text-base font-black ${
                            isHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {sub.percentage}%
                        </span>
                      </div>

                      <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>{sub.totalAttended} / {sub.totalHeld} attended</span>
                        <span className={isHealthy ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
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
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Active Subject Detail Card */}
                <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/10 shadow-xl space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200/50 dark:border-slate-800/50">
                  <div>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 glass-pill px-3 py-1 rounded-xl border border-indigo-500/30">
                      {activeSubject.subjectCode || "COURSE"}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">{activeSubject.subjectName}</h2>
                  </div>

                  <div className="text-left sm:text-right">
                    <div
                      className={`text-3xl sm:text-4xl font-black tracking-tight ${
                        activeSubject.percentage >= targetPercent
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {activeSubject.percentage}%
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">Current Rate (Cutoff: {targetPercent}%)</div>
                  </div>
                </div>

                {/* Status Notice */}
                <div
                  className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-medium ${
                    activeSubject.percentage >= targetPercent
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                  }`}
                >
                  {activeSubject.percentage >= targetPercent ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                  )}
                  <div>
                    <strong className="block">
                      {activeSubject.percentage >= targetPercent
                        ? "Meets Required Attendance Minimum"
                        : "Below Required Attendance Minimum"}
                    </strong>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      Attended {activeSubject.totalAttended} out of {activeSubject.totalHeld} conducted sessions till date.
                    </p>
                  </div>
                </div>

                {/* Stats Breakdown Grid */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Conducted Session Breakdown</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-3 sm:p-4 glass-card rounded-xl sm:rounded-2xl">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Conducted</span>
                      <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 sm:mt-1">{activeSubject.totalHeld}</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">Total lecture slots</span>
                    </div>

                    <div className="p-3 sm:p-4 glass-card rounded-xl sm:rounded-2xl">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Attended</span>
                      <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 sm:mt-1">{activeSubject.totalAttended}</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">Present + On Duty</span>
                    </div>

                    <div className="p-3 sm:p-4 glass-card rounded-xl sm:rounded-2xl">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Present</span>
                      <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 sm:mt-1">{activeSubject.presentCount}</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">
                        {activeSubject.totalHeld > 0
                          ? `${((activeSubject.presentCount / activeSubject.totalHeld) * 100).toFixed(1)}% of total`
                          : "0%"}
                      </span>
                    </div>

                    <div className="p-3 sm:p-4 glass-card rounded-xl sm:rounded-2xl">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Absent / Missed</span>
                      <p className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 sm:mt-1">{activeSubject.absentCount}</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">
                        {activeSubject.totalHeld > 0
                          ? `${((activeSubject.absentCount / activeSubject.totalHeld) * 100).toFixed(1)}% of total`
                          : "0%"}
                      </span>
                    </div>

                    <div className="p-3 sm:p-4 glass-card rounded-xl sm:rounded-2xl">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold">On Duty (OD)</span>
                      <p className="text-xl sm:text-2xl font-black text-blue-600 mt-0.5 sm:mt-1">{activeSubject.onDutyCount}</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">College approved</span>
                    </div>

                    <div className="p-3 sm:p-4 glass-card rounded-xl sm:rounded-2xl">
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Medical Leave</span>
                      <p className="text-xl sm:text-2xl font-black text-purple-600 mt-0.5 sm:mt-1">{activeSubject.medicalLeaveCount}</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">Excused absence</span>
                    </div>
                  </div>
                </div>

                {/* Visual Attendance Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Attendance Distribution</span>
                    <span className="text-slate-400 text-[11px]">
                      {activeSubject.presentCount} Present • {activeSubject.onDutyCount} OD • {activeSubject.absentCount} Missed
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden flex p-0.5 border border-white/20">
                    {activeSubject.totalHeld > 0 ? (
                      <>
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-l-full transition-all"
                          style={{
                            width: `${(activeSubject.presentCount / activeSubject.totalHeld) * 100}%`,
                          }}
                          title={`Present: ${activeSubject.presentCount}`}
                        />
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all"
                          style={{
                            width: `${(activeSubject.onDutyCount / activeSubject.totalHeld) * 100}%`,
                          }}
                          title={`On Duty: ${activeSubject.onDutyCount}`}
                        />
                        <div
                          className="bg-gradient-to-r from-rose-500 to-red-500 h-full rounded-r-full transition-all"
                          style={{
                            width: `${(activeSubject.absentCount / activeSubject.totalHeld) * 100}%`,
                          }}
                          title={`Absent: ${activeSubject.absentCount}`}
                        />
                      </>
                    ) : (
                      <div className="bg-slate-200 h-full w-full rounded-full" />
                    )}
                  </div>
                </div>

                {/* Direct Link to Records */}
                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    View each individual lecture date, period, and status:
                  </span>
                  <Link
                    href={`/attendance?subjectId=${activeSubject.subjectId}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all shrink-0"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>View Course Log</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);
}

export default function SubjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-2xl glass-panel flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
          <span className="text-xs font-semibold text-slate-400">Loading course analytics...</span>
        </div>
      }
    >
      <SubjectsContent />
    </Suspense>
  );
}

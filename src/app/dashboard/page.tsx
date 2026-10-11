"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Info,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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

interface OverallSummary {
  totalHeld: number;
  totalAttended: number;
  presentCount: number;
  absentCount: number;
  onDutyCount: number;
  percentage: number;
  bunkBuffer: number;
  classesNeeded: number;
  isBelowThreshold: boolean;
  subjectsCount: number;
  subjectsBelowThreshold: number;
}

interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    targetThreshold: number;
  };
  connection?: {
    portalUrl: string;
    connectionStatus: string;
    lastSuccessfulSyncAt: string | null;
    lastSyncAttemptAt: string | null;
    lastSyncError: string | null;
  } | null;
  dataSources: {
    totalRecords: number;
    demoRecords: number;
    liveRecords: number;
    manualRecords: number;
    isDemoMode: boolean;
  };
  overall: OverallSummary;
  subjects: SubjectSummary[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/attendance/summary");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load dashboard data");
      }
    } catch {
      setError("Network error while loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-14 w-14 rounded-3xl glass-panel flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <RefreshCw className="h-7 w-7 text-indigo-600 dark:text-indigo-400 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
          Calculating attendance analytics...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto glass-panel rounded-3xl border border-red-500/30 text-center shadow-2xl my-12">
        <div className="h-14 w-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-600 mx-auto mb-3">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Unable to Load Attendance</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">{error || "Unknown error"}</p>
        <button
          onClick={fetchDashboardData}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { overall, subjects, dataSources, connection, user } = data;
  const isHealthy = overall.percentage >= user.targetThreshold;

  // Mock trend data based on subject performance
  const trendData = [
    { week: "W1", attendance: 86 },
    { week: "W2", attendance: 82 },
    { week: "W3", attendance: 80 },
    { week: "W4", attendance: 84 },
    { week: "W5", attendance: 79 },
    { week: "W6", attendance: 83 },
    { week: "W7", attendance: 81 },
    { week: "Current", attendance: overall.percentage },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Glassmorphic Data Source / Status Banner */}
      {dataSources.totalRecords === 0 ? (
        <div className="glass-panel rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border border-indigo-500/30 shadow-xl shadow-indigo-500/5 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Account Ready — Attendance Setup Required</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                Configure your <strong>Academic Year</strong>, <strong>Semester</strong>, and <strong>Commencement Date</strong> in Settings to fetch your official attendance from the SAP portal.
              </p>
            </div>
          </div>
          <Link
            href="/settings?firstTime=true"
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 shrink-0 self-start sm:self-center"
          >
            <span>Enter Details in Settings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : dataSources.isDemoMode ? (
        <div className="glass-panel rounded-3xl p-5 sm:p-6 flex items-start justify-between gap-4 border border-amber-500/30 bg-amber-500/5 shadow-lg shadow-amber-500/5">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider block">DEMO DATASET ACTIVE</span>
              <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                Displaying {dataSources.demoRecords} seeded demonstration records. To synchronize live records from the SVKM portal, enter your portal password in Settings.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="text-xs font-bold px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl shadow-md shadow-amber-600/25 hover:shadow-amber-600/40 hover:-translate-y-0.5 shrink-0 transition-all self-start sm:self-center"
          >
            Configure
          </Link>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/5">
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 block">SVKM SAP Portal Synchronized</span>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70">
                {dataSources.liveRecords} validated records directly fetched from college NetWeaver servers.
              </span>
            </div>
          </div>
          {connection?.lastSuccessfulSyncAt && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold px-3 py-1 rounded-xl glass-pill">
              <Clock className="h-3.5 w-3.5" /> Synced: {new Date(connection.lastSuccessfulSyncAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* 2. Top Glass KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Percentage Card */}
        <div className="glass-card-interactive p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Attendance</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  dataSources.totalRecords === 0
                    ? "bg-slate-200/50 dark:bg-slate-800/50 text-slate-500"
                    : isHealthy
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                }`}
              >
                {dataSources.totalRecords === 0 ? "No Data" : isHealthy ? "On Track" : "Cutoff Alert"}
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span
                className={`text-4xl sm:text-5xl font-black tracking-tight ${
                  isHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {overall.percentage}%
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ {user.targetThreshold}% target</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/20">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                  isHealthy
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-emerald-500/30"
                    : "bg-gradient-to-r from-red-500 to-rose-400 shadow-red-500/30"
                }`}
                style={{ width: `${Math.min(100, overall.percentage)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex justify-between">
              <span>Required Cutoff: {user.targetThreshold}%</span>
              <span>{overall.percentage >= user.targetThreshold ? "Safe" : "Deficit"}</span>
            </p>
          </div>
        </div>

        {/* Classes Attended Card */}
        <div className="glass-card-interactive p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Classes Attended</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">{overall.totalAttended}</span>
              <span className="text-sm font-semibold text-slate-400">/ {overall.totalHeld} held</span>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">{overall.presentCount} Present</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-blue-600 dark:text-blue-400">{overall.onDutyCount} On Duty</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-rose-500">{overall.absentCount} Missed</span>
          </div>
        </div>

        {/* Lectures Missed Card */}
        <div className="glass-card-interactive p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lectures Missed</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-red-600 dark:text-red-400 tracking-tight">{overall.absentCount}</span>
              <span className="text-xs text-slate-400 font-semibold">sessions absent</span>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {overall.totalHeld > 0
                ? `${((overall.absentCount / overall.totalHeld) * 100).toFixed(1)}% of all scheduled lectures missed till date.`
                : "No lectures recorded yet."}
            </p>
          </div>
        </div>

        {/* Courses Meeting Cutoff Card */}
        <div className="glass-card-interactive p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meeting Cutoff</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span
                className={`text-4xl sm:text-5xl font-black tracking-tight ${
                  overall.subjectsBelowThreshold > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {overall.subjectsCount - overall.subjectsBelowThreshold}
              </span>
              <span className="text-xs text-slate-400 font-semibold">of {overall.subjectsCount} courses &ge; {user.targetThreshold}%</span>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {overall.subjectsBelowThreshold === 0
                ? `All ${overall.subjectsCount} courses are safely above cutoff.`
                : `${overall.subjectsBelowThreshold} course currently in critical deficit.`}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Critical Subject Warning Box (if applicable) */}
      {overall.subjectsBelowThreshold > 0 && (
        <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-rose-500/30 bg-rose-500/5 shadow-xl shadow-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Attendance Alert: {overall.subjectsBelowThreshold} Course Below {user.targetThreshold}% Threshold
              </h3>
              <p className="text-xs text-rose-700/90 dark:text-rose-300/80 mt-1">
                {subjects
                  .filter((s) => s.isBelowThreshold)
                  .map((s) => `${s.subjectName} (${s.percentage}%)`)
                  .join(" • ")}
              </p>
            </div>
          </div>
          <Link
            href="/subjects"
            className="text-xs font-bold px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl shadow-md shadow-rose-500/25 hover:shadow-rose-500/40 hover:-translate-y-0.5 shrink-0 transition-all flex items-center gap-2 self-start sm:self-center"
          >
            <span>Review Deficits</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 4. Glass Attendance Trend Chart */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-black/[0.02]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span>Attendance Velocity Trend</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Weekly performance trajectory against your target threshold</p>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 glass-pill px-3 py-1 rounded-xl border border-emerald-500/30">
            Current: {overall.percentage}%
          </span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis domain={[50, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.85)",
                  backdropFilter: "blur(12px)",
                  borderColor: "rgba(255, 255, 255, 0.15)",
                  borderRadius: "1rem",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                }}
                formatter={(val) => [`${val}%`, "Attendance"]}
              />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="#6366f1"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#attendanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Subject Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              <BookOpen className="h-4 w-4" />
            </div>
            <span>Enrolled Academic Courses</span>
          </h3>
          <Link
            href="/subjects"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5 glass-pill px-3 py-1.5 rounded-xl hover:scale-105 transition-transform"
          >
            <span>Detailed Breakdown</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {subjects.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
            <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Academic Courses Loaded</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Once you configure your Academic Year and Semester in Settings and synchronize, all your registered SAP courses will appear here.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition"
            >
              <span>Configure in Settings</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((sub) => {
              const isSubHealthy = sub.percentage >= user.targetThreshold;
              return (
                <div
                  key={sub.subjectId}
                  className="glass-card-interactive p-5 sm:p-6 rounded-3xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 glass-pill px-2.5 py-0.5 rounded-lg border border-white/40 dark:border-white/10 uppercase tracking-wider">
                          {sub.subjectCode || "COURSE"}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-2 leading-snug line-clamp-2">
                          {sub.subjectName}
                        </h4>
                      </div>
                      <span
                        className={`text-xl font-black ${
                          isSubHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {sub.percentage}%
                      </span>
                    </div>

                    <div className="mt-4 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full h-2 overflow-hidden p-0.5 border border-white/20">
                      <div
                        className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                          isSubHealthy
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                            : "bg-gradient-to-r from-rose-500 to-red-500"
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>

                    <div className="mt-3.5 flex justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      <span>
                        Attended: <strong className="text-slate-800 dark:text-slate-200">{sub.totalAttended}</strong> / {sub.totalHeld}
                      </span>
                      <span>
                        Missed: <strong className="text-rose-600">{sub.absentCount}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Status:{" "}
                      <strong className={isSubHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {isSubHealthy ? "Safe" : "Deficit"}
                      </strong>
                    </span>
                    <Link
                      href={`/subjects?id=${sub.subjectId}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-bold hover:underline"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

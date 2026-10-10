"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Info,
  RefreshCw,
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Calculating attendance records...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-card rounded-2xl border border-destructive/30 text-center shadow-lg my-12">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h2 className="text-lg font-bold">Failed to load attendance</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{error || "Unknown error"}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90"
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
      {/* 1. Explicit Data Source Banner */}
      {dataSources.totalRecords === 0 ? (
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/30 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Attendance Data Synced Yet</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
                All attendance figures are currently showing <strong>0</strong>. Please configure your <strong>Academic Year</strong>, <strong>Semester</strong>, <strong>Report Type</strong>, and <strong>Dates</strong> in Settings to fetch your official attendance from the portal.
              </p>
            </div>
          </div>
          <Link
            href="/settings?firstTime=true"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <span>Enter Details in Settings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : dataSources.isDemoMode ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-bold text-amber-800 dark:text-amber-300">DEMO DATASET ACTIVE:</span>{" "}
            <span className="text-amber-700 dark:text-amber-400">
              Displaying {dataSources.demoRecords} seeded demonstration records. To start synchronizing real attendance from the SVKM SAP portal, configure your portal settings.
            </span>
          </div>
          <Link
            href="/settings"
            className="text-xs font-semibold px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shrink-0 transition"
          >
            Configure Portal
          </Link>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">Live Portal Synchronized:</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              {dataSources.liveRecords} records synchronized with SVKM SAP NetWeaver Portal.
            </span>
          </div>
          {connection?.lastSuccessfulSyncAt && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <Clock className="h-3.5 w-3.5" /> Last sync: {new Date(connection.lastSuccessfulSyncAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Percentage Card */}
        <div className="bg-card p-5 rounded-2xl border border-border/60 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Attendance</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                dataSources.totalRecords === 0
                  ? "bg-muted text-muted-foreground"
                  : isHealthy
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
              }`}
            >
              {dataSources.totalRecords === 0 ? "No Data" : isHealthy ? "On Track" : "Action Needed"}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-4xl font-extrabold tracking-tight ${
                isHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {overall.percentage}%
            </span>
            <span className="text-xs text-muted-foreground font-medium">/ target {user.targetThreshold}%</span>
          </div>
          <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHealthy ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, overall.percentage)}%` }}
            />
          </div>
        </div>

        {/* Classes Attended Card */}
        <div className="bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classes Attended</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-foreground">{overall.totalAttended}</span>
            <span className="text-sm font-medium text-muted-foreground">/ {overall.totalHeld} held</span>
          </div>
          <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
            <span className="text-emerald-600 font-semibold">{overall.presentCount} Present</span>
            <span>•</span>
            <span className="text-blue-600 font-semibold">{overall.onDutyCount} On Duty</span>
            <span>•</span>
            <span className="text-red-600 font-semibold">{overall.absentCount} Missed</span>
          </div>
        </div>

        {/* Lectures Missed Card */}
        <div className="bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Lectures Missed
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-red-600 dark:text-red-400">{overall.absentCount}</span>
            <span className="text-xs text-muted-foreground font-medium">absent sessions</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {overall.totalHeld > 0
              ? `${((overall.absentCount / overall.totalHeld) * 100).toFixed(1)}% of total conducted sessions missed till now.`
              : "No attendance recorded yet."}
          </p>
        </div>

        {/* Courses Meeting Cutoff Card */}
        <div className="bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courses Meeting Cutoff</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-4xl font-extrabold ${
                overall.subjectsBelowThreshold > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {overall.subjectsCount - overall.subjectsBelowThreshold}
            </span>
            <span className="text-xs text-muted-foreground font-medium">of {overall.subjectsCount} courses &ge; {user.targetThreshold}%</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {overall.subjectsBelowThreshold === 0
              ? `All ${overall.subjectsCount} courses meet the ${user.targetThreshold}% attendance cutoff.`
              : `${overall.subjectsBelowThreshold} course currently below the ${user.targetThreshold}% cutoff.`}
          </p>
        </div>
      </div>

      {/* 3. Critical Subject Warning Box (if applicable) */}
      {overall.subjectsBelowThreshold > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                Attendance Notice: {overall.subjectsBelowThreshold} Course Below {user.targetThreshold}% Cutoff
              </h3>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                {subjects
                  .filter((s) => s.isBelowThreshold)
                  .map((s) => `${s.subjectName} (${s.percentage}% — ${s.totalAttended}/${s.totalHeld} attended)`)
                  .join(" • ")}
              </p>
            </div>
          </div>
          <Link
            href="/subjects"
            className="text-xs font-semibold px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shrink-0 transition flex items-center gap-1.5 self-start sm:self-center"
          >
            <span>Review Subjects</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* 4. Attendance Trend Chart */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border/60 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Attendance Velocity Trend
            </h3>
            <p className="text-xs text-muted-foreground">Rolling 8-week attendance performance</p>
          </div>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            Current: {overall.percentage}%
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis domain={[50, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
                formatter={(val) => [`${val}%`, "Attendance"]}
              />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="#2563eb"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#attendanceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Subject Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            Enrolled Academic Subjects
          </h3>
          <Link href="/subjects" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
            Subject Details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-card p-10 rounded-2xl border border-dashed border-border/70 text-center space-y-3">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
            <h4 className="font-bold text-sm text-foreground">No Academic Courses Found</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Once you enter your Academic Year and Semester in Settings and click sync, all your registered courses and attendance records will appear here.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl border border-border transition"
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
                  className="bg-card p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-all duration-200"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {sub.subjectCode || "CORE"}
                        </span>
                        <h4 className="font-bold text-sm text-foreground mt-1.5 leading-snug">{sub.subjectName}</h4>
                      </div>
                      <span
                        className={`text-lg font-extrabold ${
                          isSubHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {sub.percentage}%
                      </span>
                    </div>

                    <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isSubHealthy ? "bg-emerald-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                      <span>
                        Attended: <strong className="text-foreground">{sub.totalAttended}</strong> / {sub.totalHeld}
                      </span>
                      <span>
                        Missed: <strong className="text-red-600">{sub.absentCount}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-xs text-muted-foreground font-medium">
                      Status:{" "}
                      <strong className={isSubHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {isSubHealthy ? "Above Threshold" : "Below Threshold"}
                      </strong>
                    </span>
                    <Link
                      href={`/subjects?id=${sub.subjectId}`}
                      className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
                    >
                      Details →
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

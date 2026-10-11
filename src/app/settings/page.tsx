"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  RefreshCw,
  Sparkles,
  Layers,
  Calendar,
  CalendarRange,
  ArrowRight,
  User,
} from "lucide-react";

function SettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstTime = searchParams.get("firstTime") === "true";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Student Profile
  const [fullName, setFullName] = useState("");

  // Portal Credentials
  const [portalUrl, setPortalUrl] = useState("https://sdc-sppap1.svkm.ac.in:50001/irj/portal");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Portal Report Filters
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [semester, setSemester] = useState("Semester V");
  const [reportType, setReportType] = useState("Detail Report");
  const [startDate, setStartDate] = useState("01.06.2026");
  const [endDate, setEndDate] = useState("");

  // Threshold & Auto Sync
  const [threshold, setThreshold] = useState(75.0);
  const [autoSync, setAutoSync] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("NOT_CONFIGURED");

  // Manual CSV Import
  const [csvContent, setCsvContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.success) {
        if (json.connection?.portalUrl) setPortalUrl(json.connection.portalUrl);
        if (json.connection?.connectionStatus) setConnectionStatus(json.connection.connectionStatus);
        if (json.connection?.autoSyncEnabled !== undefined) setAutoSync(json.connection.autoSyncEnabled);
        if (json.connection?.academicYear) setAcademicYear(json.connection.academicYear);
        if (json.connection?.semester) setSemester(json.connection.semester);
        if (json.connection?.reportType) setReportType(json.connection.reportType);
        if (json.connection?.startDate) setStartDate(json.connection.startDate);
        if (json.connection?.endDate) setEndDate(json.connection.endDate);
        if (json.user?.name && json.user.name !== "Student") setFullName(json.user.name);
        if (json.user?.studentId && !username) setUsername(json.user.studentId);
        if (json.user?.targetThreshold) setThreshold(json.user.targetThreshold);
      }
    } catch {
      console.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettingsPayload = async () => {
    const payload: {
      portalUrl: string;
      targetThreshold: number;
      autoSyncEnabled: boolean;
      academicYear: string;
      semester: string;
      reportType: string;
      startDate: string;
      endDate: string | null;
      name?: string;
      username?: string;
      password?: string;
    } = {
      portalUrl,
      targetThreshold: threshold,
      autoSyncEnabled: autoSync,
      academicYear,
      semester,
      reportType,
      startDate,
      endDate: endDate.trim() ? endDate.trim() : null,
    };

    if (fullName.trim()) payload.name = fullName.trim();
    if (username.trim()) payload.username = username.trim();
    if (password.trim()) payload.password = password.trim();

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return await res.json();
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const json = await saveSettingsPayload();
      if (json.success) {
        setMessage({ text: "Settings saved successfully! Details remembered for your account.", type: "success" });
        setPassword("");
        fetchSettings();
      } else {
        setMessage({ text: json.error || "Failed to save settings.", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error occurred while saving.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSync = async () => {
    setSaving(true);
    setSyncing(true);
    setMessage(null);

    try {
      // 1. Save settings first
      const saveJson = await saveSettingsPayload();
      if (!saveJson.success) {
        setMessage({ text: saveJson.error || "Failed to save settings before sync.", type: "error" });
        setSaving(false);
        setSyncing(false);
        return;
      }

      setMessage({ text: "Settings saved! Contacting SVKM SAP Portal to fetch attendance PDF...", type: "success" });

      // 2. Trigger sync
      try {
        const syncRes = await fetch("/api/sync", { method: "POST" });
        const syncJson = await syncRes.json();

        if (syncJson.success && syncJson.recordsFetched > 0) {
          setMessage({
            text: `Success! Synced ${syncJson.recordsFetched} attendance records from the portal. Redirecting to dashboard...`,
            type: "success",
          });
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1500);
        } else if (syncJson.dispatched) {
          setMessage({
            text: syncJson.message || "Sync dispatched to GitHub Actions runner! Records will update in ~1-2 minutes.",
            type: "success",
          });
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 2500);
        } else if (syncJson.success) {
          setMessage({
            text: syncJson.message || "Settings saved successfully! Your attendance is scheduled to synchronize automatically every morning at 4:00 AM IST.",
            type: "success",
          });
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 2000);
        } else {
          setMessage({
            text: syncJson.error || syncJson.message || "Settings saved. To sync attendance immediately, trigger 'SVKM Portal Nightly Attendance Sync' in GitHub Actions.",
            type: "error",
          });
        }
      } catch {
        setMessage({
          text: "Settings saved! If manual sync fails on host, run 'SVKM Portal Nightly Attendance Sync' in GitHub Actions.",
          type: "success",
        });
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 2000);
      }
    } catch {
      setMessage({ text: "Network error occurred while synchronizing.", type: "error" });
    } finally {
      setSaving(false);
      setSyncing(false);
    }
  };

  const handleImportCsv = async () => {
    if (!csvContent.trim()) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });
      const json = await res.json();
      if (json.success) {
        setImportResult(json.message);
        setCsvContent("");
      } else {
        setImportResult(`Error: ${json.error}`);
      }
    } catch {
      setImportResult("Network error during import");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-xs">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* First-time prompt banner */}
      {isFirstTime && (
        <div className="glass-panel p-6 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 shadow-xl shadow-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">One-Time Attendance Setup Required</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Please enter your <strong>Academic Year</strong>, <strong>Semester</strong>, and <strong>Date Range</strong> below. You only need to enter this once—your attendance will always be fetched and saved specifically for your account!
            </p>
          </div>
          <button
            onClick={handleSaveAndSync}
            disabled={saving || syncing}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all shrink-0 flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            <span>{syncing ? "Fetching..." : "Save & Sync Now"}</span>
          </button>
        </div>
      )}

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <span>Settings & Portal Configuration</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure your Academic Year, Semester, and Report parameters once to synchronize attendance automatically.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 glass-panel ${
            message.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 shadow-lg shadow-emerald-500/5"
              : "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300 shadow-lg shadow-red-500/5"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 1. Academic Year, Semester & Report Parameters Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-black/[0.02] space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">SAP Attendance Report Parameters</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These settings match the dropdowns on the SVKM Attendance Display WebDynpro portal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Academic Year</label>
              <div className="relative">
                <CalendarRange className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 2026-2027"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">E.g. 2026-2027, 2025-2026, 2024-2025</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Trimester / Semester</label>
              <div className="relative">
                <Layers className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Semester V"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">E.g. Semester V, Semester IV, Semester VI</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
              >
                <option value="Detail Report">Detail Report (Individual lecture breakdown)</option>
                <option value="Summary Report">Summary Report (Subject totals)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Start Date (DD.MM.YYYY)</label>
              <div className="relative">
                <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="01.06.2026"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Semester commencement date (e.g. 01.06.2026)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                End Date (DD.MM.YYYY) <span className="text-slate-400 font-normal">(Optional, defaults to today)</span>
              </label>
              <div className="relative">
                <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Leave empty for current date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Portal Credentials Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-black/[0.02] space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">SVKM SAP NetWeaver Portal Credentials</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Encrypted using AES-256-GCM. Isolated per student with zero cross-user access.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Your Full Name (Display Name)</label>
              <div className="relative">
                <User className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma (auto-detected from portal)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Portal URL</label>
              <div className="relative">
                <Globe className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url"
                  value={portalUrl}
                  onChange={(e) => setPortalUrl(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Student Portal User ID (SAP ID)</label>
                <input
                  type="text"
                  placeholder="e.g. 70472400419"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Portal Password <span className="text-slate-400 font-normal">(Leave empty to keep saved)</span>
                </label>
                <div className="relative">
                  <Key className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Target Threshold */}
          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Attendance Target Threshold</label>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{threshold}%</span>
            </div>
            <input
              type="range"
              min="65"
              max="90"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Courses below this threshold trigger risk alerts and show required classes.
            </p>
          </div>

          {/* Automatic Sync */}
          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Automatic Daily Synchronization</label>
              <span className="text-[11px] text-slate-400">
                Fetch attendance automatically in background every morning at 04:00 AM IST.
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
            <button
              type="submit"
              disabled={saving || syncing}
              className="w-full sm:w-auto px-5 py-2.5 glass-pill hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition active:scale-95 disabled:opacity-50"
            >
              {saving && !syncing ? "Saving..." : "Save Settings Only"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndSync}
              disabled={saving || syncing}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Connecting & Syncing Attendance...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Save & Sync Attendance Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* 3. Manual CSV Import Fallback */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/60 dark:border-white/10 shadow-xl shadow-black/[0.02] space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Manual Report / CSV Import Fallback</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              If the SAP portal is under maintenance or campus firewall blocks connection, paste CSV records here.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            CSV Records (Format: <code className="bg-slate-200/50 dark:bg-slate-800/50 px-1 py-0.5 rounded text-[10px]">Date, Subject Name, Period, Status</code>)
          </label>
          <textarea
            rows={4}
            placeholder={`2026-09-10, Computer Networks, 1, Present\n2026-09-10, Database Management Systems, 2, Present\n2026-09-11, Machine Learning, 1, Absent`}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            className="w-full p-3 font-mono text-xs glass-input rounded-xl text-slate-900 dark:text-white focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {importResult && <span className="font-bold text-emerald-600">{importResult}</span>}
          </div>
          <button
            type="button"
            onClick={handleImportCsv}
            disabled={importing || !csvContent.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/35 transition active:scale-95 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{importing ? "Importing..." : "Import CSV Rows"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-xs">Loading configuration...</span>
        </div>
      }
    >
      <SettingsForm />
    </Suspense>
  );
}

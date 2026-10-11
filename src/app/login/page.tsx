"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, User, ArrowRight, AlertCircle, Shield, CheckCircle2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.hasSynced) {
          setInfoMsg(`Welcome back, ${data.user?.name || "Student"}! Loading attendance...`);
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 800);
        } else {
          setInfoMsg("Connected successfully! Please set your Semester details in Settings...");
          setTimeout(() => {
            router.push("/settings?firstTime=true");
            router.refresh();
          }, 1200);
        }
      } else {
        setError(data.error || "Failed to authenticate. Please check your credentials.");
      }
    } catch {
      setError("Network error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Centered Glassmorphic Authentication Card */}
      <div className="max-w-md w-full space-y-7 glass-panel p-8 sm:p-10 rounded-3xl shadow-2xl shadow-indigo-500/10 border border-white/70 dark:border-white/10 relative z-10 backdrop-blur-2xl">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-4 hover:scale-105 transition-transform">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Sign In with Portal
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Use your official <strong>SVKM SAP Portal Student ID & Password</strong>. Isolated per student with zero cross-user access.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-md text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {infoMsg && (
          <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Student User ID (SAP ID)
            </label>
            <div className="relative">
              <User className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. 70472400419"
                className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none font-mono font-medium"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Your 11-digit Student Registration / SAP ID number.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Portal Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Authenticating with SAP Portal..." : "Sign In & Access Attendance"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 text-center flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Shield className="h-3.5 w-3.5 text-indigo-500" />
          <span>Zero plaintext storage • AES-256-GCM encrypted session</span>
        </div>
      </div>
    </div>
  );
}

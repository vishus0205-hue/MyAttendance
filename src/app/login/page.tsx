"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, User, ArrowRight, AlertCircle, Shield, CheckCircle2 } from "lucide-react";

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
          setInfoMsg(`Welcome back, ${data.user?.name || "Student"}! Loading your attendance...`);
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 800);
        } else {
          setInfoMsg("Connected successfully! Please set your Academic Year, Semester, and Dates in Settings...");
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
    <div className="min-h-[82vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-7 bg-card p-8 sm:p-10 rounded-3xl border border-border/60 shadow-xl shadow-black/5">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-foreground">
            Sign In with Portal
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Use your official <strong>SVKM SAP Portal Student ID & Password</strong>. Your attendance data is strictly isolated to your account.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoMsg && (
          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Student User ID (SAP ID)</label>
            <div className="relative">
              <User className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. 70472400419"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Your 11-digit Student Registration / SAP ID number.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Portal Password</label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-[0.99]"
          >
            {loading ? "Authenticating with SAP Portal..." : "Sign In & Access Attendance"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-border/50 text-center flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-blue-600" />
          <span>Zero plaintext storage • AES-256-GCM encrypted session</span>
        </div>
      </div>
    </div>
  );
}

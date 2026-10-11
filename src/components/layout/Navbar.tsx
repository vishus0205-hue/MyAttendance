"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Calendar,
  Settings,
  RefreshCw,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDark, setIsDark] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    // Sync theme state with <html> tag
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    if (nextIsDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    if (isAuthPage) {
      setUser(null);
      return;
    }
    fetchUser();
  }, [pathname, isAuthPage]);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/attendance", label: "Daily Log", icon: CalendarDays },
    { href: "/subjects", label: "Subjects", icon: BookOpen },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const handleQuickSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg("Connecting to portal...");

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success && data.recordsFetched > 0) {
        setSyncStatusMsg(`Synced successfully! (${data.recordsFetched || 0} records)`);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      } else if (data.dispatched) {
        setSyncStatusMsg("Syncing attendance in background... (~30s)");
        
        // Poll job status every 4 seconds for up to 90 seconds
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetch("/api/sync/status");
            const statusData = await statusRes.json();
            const job = statusData?.latestJob;

            if (job && job.status === "SUCCESS") {
              clearInterval(pollInterval);
              setSyncStatusMsg(`Sync complete! (${job.recordsFetched || 0} records updated)`);
              setTimeout(() => {
                window.location.reload();
              }, 1200);
            } else if (job && job.status === "FAILED") {
              clearInterval(pollInterval);
              setSyncStatusMsg("Sync failed. Check your password in Settings.");
              setTimeout(() => {
                setIsSyncing(false);
                setSyncStatusMsg(null);
              }, 4000);
            } else if (attempts >= 20) { // ~80 seconds
              clearInterval(pollInterval);
              setSyncStatusMsg("Sync is still processing. Please refresh in a moment.");
              setTimeout(() => {
                setIsSyncing(false);
                setSyncStatusMsg(null);
              }, 4000);
            }
          } catch {
            // Network polling error; continue waiting
          }
        }, 4000);
        return;
      } else if (data.success) {
        setSyncStatusMsg(data.message || "Attendance scheduled to sync automatically at 4:00 AM IST");
      } else {
        setSyncStatusMsg(data.error || data.message || "Sync failed. Check settings or portal password.");
      }
    } catch {
      setSyncStatusMsg("Network error during sync.");
    }

    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatusMsg(null);
    }, 4000);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Top Floating Glass Header */}
      <header className="sticky top-2 sm:top-3 z-40 w-full px-2.5 sm:px-6 lg:px-8 mb-1.5 sm:mb-2">
        <div className="max-w-7xl mx-auto glass-panel rounded-2xl sm:rounded-3xl shadow-xl shadow-black/[0.03] transition-all">
          <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
            {/* Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 sm:gap-3 font-bold text-base sm:text-lg tracking-tight group"
              >
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform shrink-0">
                  <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent font-black tracking-tight text-sm sm:text-lg">
                    MyAttendance
                  </span>
                  <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 font-medium -mt-1 tracking-normal">
                    Student Attendance Tracker
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Center Navigation Tabs (Frosted Inset Pill) */}
            {!isAuthPage && user && (
              <nav className="hidden md:flex items-center gap-1.5 glass-pill p-1.5 rounded-2xl">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md shadow-black/5 border border-white/60 dark:border-white/10"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Actions & Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-slate-200/50 dark:border-slate-800/50 transition-all hover:scale-105 active:scale-95 shadow-sm"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle Theme"
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 transition-transform -rotate-12 hover:rotate-0" />
                )}
              </button>

              {!isAuthPage && user ? (
                <>
                  {/* Glowing Sync Button */}
                  <button
                    onClick={handleQuickSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 ${
                      isSyncing
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-wait"
                        : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                    }`}
                    title="Fetch latest attendance records from SVKM Portal"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Now"}</span>
                  </button>

                  {/* Student Profile Pill */}
                  <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-300/40 dark:border-slate-700/50">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-gradient-to-tr from-blue-500/20 to-purple-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] sm:text-xs border border-blue-400/30 shadow-inner shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-200">{user.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[120px]">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Log Out"
                    >
                      <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </>
              ) : !isAuthPage ? (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>
              ) : null}
            </div>
          </div>

          {/* Sync Status Banner */}
          {syncStatusMsg && (
            <div className="border-t border-white/40 dark:border-white/5 py-1.5 sm:py-2 px-3 sm:px-4 text-center text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-b-2xl">
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin text-blue-600" />
              ) : syncStatusMsg.includes("success") || syncStatusMsg.includes("Synced") ? (
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" />
              ) : (
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
              <span className="truncate">{syncStatusMsg}</span>
            </div>
          )}
        </div>
      </header>

      {/* Floating Glass Bottom Navigation Bar for Mobile Phones */}
      {!isAuthPage && user && (
        <nav
          aria-label="Mobile Navigation"
          className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white/85 dark:bg-slate-950/85 backdrop-blur-2xl border-t border-slate-200/60 dark:border-slate-800/60 px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/20"
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl text-[10px] font-bold transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 mb-0.5 transition-transform ${isActive ? "text-blue-600 dark:text-blue-400 scale-110" : ""}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

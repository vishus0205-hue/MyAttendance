"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Calendar,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User as UserIcon,
} from "lucide-react";

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

  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isAuthPage) {
      setUser(null);
      return;
    }
    if (!user) {
      fetchUser();
    }
  }, [pathname, isAuthPage, user]);

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
    setSyncStatusMsg("Synchronizing attendance records with SVKM portal...");

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success && data.recordsFetched > 0) {
        setSyncStatusMsg(`Synced successfully! (${data.recordsFetched || 0} records)`);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setSyncStatusMsg(data.message || "Attendance scheduled to sync automatically at 4:00 AM IST");
      }
    } catch {
      setSyncStatusMsg("Attendance scheduled to sync automatically at 4:00 AM IST");
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStatusMsg(null);
      }, 4000);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                MyAttendace
              </span>
              <span className="block text-[10px] text-muted-foreground font-medium -mt-1 tracking-normal">
                SVKM Portal Companion
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Tabs (Only when authenticated and not on login page) */}
        {!isAuthPage && user && (
          <nav className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-card text-foreground shadow-sm shadow-black/5 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : ""}`} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Actions & Profile */}
        <div className="flex items-center gap-3">
          {!isAuthPage && user ? (
            <>
              {/* Quick Sync Button */}
              <button
                onClick={handleQuickSync}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${
                  isSyncing
                    ? "bg-muted text-muted-foreground cursor-wait"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95"
                }`}
                title="Fetch latest attendance records from SVKM Portal"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
              </button>

              {/* Student Profile Pill */}
              <div className="flex items-center gap-2 pl-2 border-l border-border/60">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-200 dark:border-blue-800">
                  {getInitials(user.name)}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-semibold leading-tight">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ml-1"
                  title="Log Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : !isAuthPage ? (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900 py-1.5 px-4 text-center text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
          {isSyncing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : syncStatusMsg.includes("success") ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
          )}
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Mobile Nav Bar */}
      {!isAuthPage && user && (
        <div className="flex md:hidden border-t border-border/50 px-2 py-1 justify-around bg-card">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center py-1 px-2 rounded text-[11px] font-medium ${
                  isActive ? "text-blue-600 font-bold" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MyAttendace — SVKM Portal Attendance Dashboard",
  description: "Official SVKM SAP Portal student attendance tracker and real-time performance dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full ${plusJakarta.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="font-sans min-h-full flex flex-col bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased relative selection:bg-indigo-500/20 selection:text-indigo-600">
        {/* Ambient Glowing Background Orbs for Dynamic Glassmorphism Refraction */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-[15%] left-[10%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-blue-400/20 via-indigo-500/20 to-purple-400/15 blur-[120px] dark:from-blue-600/15 dark:via-indigo-600/15 dark:to-purple-600/10 animate-orb-1" />
          <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-cyan-400/20 via-sky-500/20 to-blue-500/15 blur-[130px] dark:from-cyan-600/12 dark:via-sky-600/12 dark:to-blue-600/10 animate-orb-2" />
          <div className="absolute -bottom-[15%] left-[25%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-violet-400/20 via-fuchsia-400/15 to-indigo-500/15 blur-[140px] dark:from-violet-700/15 dark:via-fuchsia-700/10 dark:to-indigo-600/10 animate-orb-3" />
        </div>

        {/* Floating Frosted Glass Navbar */}
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 z-0">
          {children}
        </main>

        {/* Frosted Glass Footer */}
        <footer className="mt-auto py-5 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-white/40 dark:border-white/5 backdrop-blur-md bg-white/30 dark:bg-slate-950/40">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold tracking-tight text-slate-700 dark:text-slate-300">
              MyAttendace © 2026 • Student Attendance Tracker
            </span>
            <span className="text-slate-500 dark:text-slate-500">
              Secure & Encrypted • Automatic Daily Sync
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

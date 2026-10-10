import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

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
    <html lang="en" className="h-full">
      <body className="font-sans min-h-full flex flex-col bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
          <p>MyAttendace © 2026 • SVKM SAP NetWeaver Portal Sync Engine • All data private and encrypted at rest</p>
        </footer>
      </body>
    </html>
  );
}

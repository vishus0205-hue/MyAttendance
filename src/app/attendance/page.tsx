"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";

interface AttendanceRecordItem {
  id: string;
  attendanceDate: string;
  dayOfWeek: string;
  periodNumber: number | null;
  status: string;
  source: string;
  subject: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
}

export default function AttendanceLogPage() {
  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    fetchRecords();
  }, [page, selectedSubject, selectedStatus]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });

      if (selectedSubject) params.set("subjectId", selectedSubject);
      if (selectedStatus) params.set("status", selectedStatus);
      if (search) params.set("search", search);

      const res = await fetch(`/api/attendance/records?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setRecords(json.records);
        setSubjects(json.subjects);
        setTotalPages(json.pagination.totalPages);
        setTotalRecords(json.pagination.totalRecords);
      }
    } catch (err) {
      console.error("Failed to load records", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (selectedSubject) params.set("subjectId", selectedSubject);
    if (selectedStatus) params.set("status", selectedStatus);
    if (search) params.set("search", search);
    params.set("format", "csv");

    window.open(`/api/attendance/records?${params.toString()}`, "_blank");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            Present
          </span>
        );
      case "ABSENT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.15)]">
            Absent
          </span>
        );
      case "ON_DUTY":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 shadow-[0_0_12px_rgba(14,165,233,0.15)]">
            On Duty
          </span>
        );
      case "MEDICAL_LEAVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
            Medical Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold glass-pill text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Daily Attendance Records</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Showing <span className="font-semibold text-foreground">{totalRecords}</span> logged period-level records from your college enrollment.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 glass-panel glass-card-interactive text-foreground text-xs font-semibold rounded-2xl shadow-sm self-start sm:self-auto"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by subject name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 glass-input rounded-2xl text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </form>

        {/* Subject Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setPage(1);
            }}
            className="glass-input rounded-2xl py-2.5 px-3.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="glass-input rounded-2xl py-2.5 px-3.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="ON_DUTY">On Duty</option>
            <option value="MEDICAL_LEAVE">Medical Leave</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-xs font-medium">Loading attendance records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40 text-blue-400" />
            <p className="text-sm font-bold text-foreground">No attendance records found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground font-semibold">
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5">Day</th>
                  <th className="py-3.5 px-5">Subject</th>
                  <th className="py-3.5 px-5">Period</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {records.map((r) => {
                  const dateStr = new Date(r.attendanceDate).toISOString().split("T")[0];
                  return (
                    <tr key={r.id} className="hover:bg-white/5 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-5 font-mono font-medium text-foreground">{dateStr}</td>
                      <td className="py-3.5 px-5 text-muted-foreground">{r.dayOfWeek}</td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-foreground">{r.subject?.name || "Unassigned"}</div>
                        {r.subject?.code && (
                          <div className="text-[10px] text-muted-foreground/80 font-mono">{r.subject.code}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-muted-foreground">Period {r.periodNumber || 1}</td>
                      <td className="py-3.5 px-5">{getStatusBadge(r.status)}</td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                            r.source === "PORTAL_SYNC"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {r.source === "PORTAL_SYNC" ? "LIVE_PORTAL" : "DEMO_SEED"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground bg-muted/10 backdrop-blur-sm">
          <span>
            Page <strong className="text-foreground">{page}</strong> of{" "}
            <strong className="text-foreground">{totalPages}</strong> ({totalRecords} records)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-xl border border-border/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-xl border border-border/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Present
          </span>
        );
      case "ABSENT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
            Absent
          </span>
        );
      case "ON_DUTY":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            On Duty
          </span>
        );
      case "MEDICAL_LEAVE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Medical Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Attendance Records</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {totalRecords} logged period-level records from your college enrollment.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-muted border border-border text-foreground text-xs font-semibold rounded-xl shadow-sm transition active:scale-95 self-start sm:self-auto"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by subject name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border/80 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="bg-muted/40 border border-border/80 rounded-xl py-2 px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="bg-muted/40 border border-border/80 rounded-xl py-2 px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No attendance records found</p>
            <p className="text-xs">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Day</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {records.map((r) => {
                  const dateStr = new Date(r.attendanceDate).toISOString().split("T")[0];
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-foreground">{dateStr}</td>
                      <td className="py-3 px-4 text-muted-foreground">{r.dayOfWeek}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{r.subject?.name || "Unassigned"}</div>
                        {r.subject?.code && (
                          <div className="text-[10px] text-muted-foreground font-mono">{r.subject.code}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-muted-foreground">Period {r.periodNumber || 1}</td>
                      <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            r.source === "PORTAL_SYNC"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
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
        <div className="p-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
          <span>
            Page <strong className="text-foreground">{page}</strong> of{" "}
            <strong className="text-foreground">{totalPages}</strong> ({totalRecords} records)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-border/80 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-border/80 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

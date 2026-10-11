"use client";

import { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

interface DayRecord {
  id: string;
  periodNumber: number | null;
  status: string;
  subjectName: string;
  subjectCode?: string | null;
}

interface CalendarDay {
  date: string; // YYYY-MM-DD
  totalPeriods: number;
  attendedCount: number;
  absentCount: number;
  onDutyCount: number;
  medicalCount: number;
  dayStatus: "FULL" | "PARTIAL" | "ABSENT" | "ON_DUTY" | "EXCUSED";
  records: DayRecord[];
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed

  useEffect(() => {
    fetchCalendarData(year, month);
  }, [year, month]);

  const fetchCalendarData = async (y: number, m: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/calendar?year=${y}&month=${m}`);
      const json = await res.json();
      if (json.success) {
        setDays(json.days);
        // Default select the latest day with records
        if (json.days.length > 0) {
          setSelectedDay(json.days[json.days.length - 1]);
        } else {
          setSelectedDay(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  // Generate calendar grid dates for this month
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Create array of day numbers with offset
  const calendarSlots: Array<{ dayNum: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarSlots.push({ dayNum: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarSlots.push({ dayNum: d, dateStr: dStr });
  }

  const dayDataMap = new Map<string, CalendarDay>();
  days.forEach((d) => dayDataMap.set(d.date, d));

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Month Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 shadow-sm">
              <CalendarIcon className="h-6 w-6" />
            </div>
            Attendance Calendar
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            View attendance patterns and period-level activity day by day.
          </p>
        </div>

        <div className="flex items-center gap-2 glass-panel p-1.5 rounded-2xl shadow-sm self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold px-3 text-foreground min-w-[130px] text-center tracking-wide">
            {monthNames[month - 1]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 Cols on lg) */}
        <div className="lg:col-span-2 glass-panel p-5 sm:p-6 rounded-3xl space-y-4">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-foreground pb-2 border-b border-border/30">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Slots Grid */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-xs font-medium">Loading calendar schedule...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarSlots.map((slot, index) => {
                if (!slot.dayNum || !slot.dateStr) {
                  return <div key={`empty-${index}`} className="h-20 sm:h-24 rounded-2xl bg-white/[0.02] border border-transparent opacity-30" />;
                }

                const dayData = dayDataMap.get(slot.dateStr);
                const isSelected = selectedDay?.date === slot.dateStr;

                return (
                  <button
                    key={slot.dateStr}
                    onClick={() => dayData && setSelectedDay(dayData)}
                    disabled={!dayData}
                    className={`h-20 sm:h-24 p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? "border-blue-500/80 bg-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-blue-500"
                        : dayData
                        ? "glass-card hover:border-blue-400/50 hover:bg-white/10 dark:hover:bg-white/5 active:scale-[0.98]"
                        : "border-transparent bg-white/[0.02] opacity-40 cursor-default"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-xs font-bold ${isSelected ? "text-blue-500 font-extrabold" : "text-foreground"}`}>
                        {slot.dayNum}
                      </span>
                      {dayData && (
                        <span
                          className={`h-2 w-2 rounded-full ring-2 ring-background ${
                            dayData.dayStatus === "FULL"
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              : dayData.dayStatus === "PARTIAL"
                              ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                              : dayData.dayStatus === "ON_DUTY"
                              ? "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"
                              : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                          }`}
                        />
                      )}
                    </div>

                    {dayData ? (
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <div className="font-semibold text-foreground">
                          {dayData.attendedCount + dayData.onDutyCount}/{dayData.totalPeriods} attended
                        </div>
                        {dayData.absentCount > 0 && (
                          <div className="text-rose-500 dark:text-rose-400 font-bold">
                            {dayData.absentCount} missed
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground/50">No classes</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Color Key Legend */}
          <div className="pt-3 border-t border-border/30 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              <span>Full Attendance (100%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
              <span>Partial Attendance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
              <span>All Missed (Absent)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.4)]" />
              <span>On Duty</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-4 self-start">
          <div className="pb-3 border-b border-border/30">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected Day Log</h2>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {selectedDay ? selectedDay.date : "No date selected"}
            </div>
          </div>

          {selectedDay ? (
            <div className="space-y-3">
              <div className="flex justify-between p-3.5 glass-card rounded-2xl text-xs font-medium">
                <span>Classes Held: <strong className="text-foreground">{selectedDay.totalPeriods}</strong></span>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold">
                  Attended: {selectedDay.attendedCount + selectedDay.onDutyCount}
                </span>
                {selectedDay.absentCount > 0 && (
                  <span className="text-rose-500 dark:text-rose-400 font-bold">Missed: {selectedDay.absentCount}</span>
                )}
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {selectedDay.records.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl glass-card hover:bg-white/10 dark:hover:bg-white/5 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">{r.subjectName}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Period {r.periodNumber || 1}</div>
                    </div>
                    <div>
                      {r.status === "PRESENT" ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                          Present
                        </span>
                      ) : r.status === "ON_DUTY" ? (
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/15 px-2.5 py-0.5 rounded-full border border-sky-500/25 shadow-[0_0_10px_rgba(14,165,233,0.15)]">
                          On Duty
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/25 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                          Absent
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-30 text-blue-400" />
              Click any highlighted day on the calendar to view its classes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

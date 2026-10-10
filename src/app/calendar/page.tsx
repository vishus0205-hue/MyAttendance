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
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            Attendance Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View attendance patterns and period-level activity day by day.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border shadow-sm self-start sm:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold px-3 text-foreground min-w-[120px] text-center">
            {monthNames[month - 1]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 Cols on lg) */}
        <div className="lg:col-span-2 bg-card p-5 sm:p-6 rounded-2xl border border-border/60 shadow-sm space-y-4">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-foreground pb-2 border-b border-border/40">
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
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading calendar dates...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarSlots.map((slot, index) => {
                if (!slot.dayNum || !slot.dateStr) {
                  return <div key={`empty-${index}`} className="h-20 sm:h-24 rounded-xl bg-muted/10 opacity-30" />;
                }

                const dayData = dayDataMap.get(slot.dateStr);
                const isSelected = selectedDay?.date === slot.dateStr;

                return (
                  <button
                    key={slot.dateStr}
                    onClick={() => dayData && setSelectedDay(dayData)}
                    disabled={!dayData}
                    className={`h-20 sm:h-24 p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-600 shadow-sm"
                        : dayData
                        ? "border-border/60 hover:border-blue-400 bg-card hover:bg-muted/30"
                        : "border-transparent bg-muted/20 opacity-50 cursor-default"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-xs font-bold ${isSelected ? "text-blue-600" : "text-foreground"}`}>
                        {slot.dayNum}
                      </span>
                      {dayData && (
                        <span
                          className={`h-2 w-2 rounded-full ${
                            dayData.dayStatus === "FULL"
                              ? "bg-emerald-500"
                              : dayData.dayStatus === "PARTIAL"
                              ? "bg-amber-500"
                              : dayData.dayStatus === "ON_DUTY"
                              ? "bg-blue-500"
                              : "bg-red-500"
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
                          <div className="text-red-600 font-bold">
                            {dayData.absentCount} missed
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground/60">No classes</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Color Key Legend */}
          <div className="pt-3 border-t border-border/40 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Full Attendance (100%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Partial Attendance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>All Missed (Absent)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>On Duty</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border/60 shadow-sm space-y-4 self-start">
          <div className="pb-3 border-b border-border/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected Day Log</h2>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {selectedDay ? selectedDay.date : "No date selected"}
            </div>
          </div>

          {selectedDay ? (
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-muted/40 rounded-xl text-xs font-medium">
                <span>Classes Held: {selectedDay.totalPeriods}</span>
                <span className="text-emerald-600 font-bold">
                  Attended: {selectedDay.attendedCount + selectedDay.onDutyCount}
                </span>
                {selectedDay.absentCount > 0 && (
                  <span className="text-red-600 font-bold">Missed: {selectedDay.absentCount}</span>
                )}
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {selectedDay.records.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground">{r.subjectName}</div>
                      <div className="text-[10px] text-muted-foreground">Period {r.periodNumber || 1}</div>
                    </div>
                    <div>
                      {r.status === "PRESENT" ? (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Present
                        </span>
                      ) : r.status === "ON_DUTY" ? (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          On Duty
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
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
              <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Click any highlighted day on the calendar to view its classes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

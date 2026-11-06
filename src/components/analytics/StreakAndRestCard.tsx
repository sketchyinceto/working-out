import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Moon,
  X,
  Zap,
} from 'lucide-react';
import { WorkoutSession } from '../../types/workout';
import { computeStreakAndRestStats } from '../../utils/analytics';
import { getSplitPalette } from '../../utils/splitTheme';

interface StreakAndRestCardProps {
  workouts: WorkoutSession[];
  selectedDateStr: string | null;
  onSelectDateStr: (dateStr: string | null) => void;
  recordedSplits?: Set<string>;
}

function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const StreakAndRestCard: React.FC<StreakAndRestCardProps> = ({
  workouts,
  selectedDateStr,
  onSelectDateStr,
  recordedSplits,
}) => {
  const now = new Date();
  const [viewMonthOffset, setViewMonthOffset] = useState<number>(0);

  const stats = useMemo(() => computeStreakAndRestStats(workouts), [workouts]);

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const w of workouts) {
      const dStr = toLocalDateStr(new Date(w.startTime));
      const list = map.get(dStr) || [];
      list.push(w);
      map.set(dStr, list);
    }
    return map;
  }, [workouts]);

  const restBadge = useMemo(() => {
    if (stats.daysSinceLastWorkout === null) {
      return {
        label: 'No workouts yet',
        style: 'bg-[#2c2c2e] text-[#8e8e93]',
        icon: 'moon' as const,
      };
    }
    if (stats.daysSinceLastWorkout === 0) {
      return {
        label: 'Trained Today',
        style: 'bg-[#a4ff00]/15 text-[#a4ff00]',
        icon: 'zap' as const,
      };
    }
    if (stats.daysSinceLastWorkout === 1) {
      return {
        label: '1 Rest Day',
        style: 'bg-[#2c2c2e] text-white',
        icon: 'moon' as const,
      };
    }
    return {
      label: `${stats.daysSinceLastWorkout} Rest Days`,
      style: 'bg-[#2c2c2e] text-white',
      icon: 'moon' as const,
    };
  }, [stats.daysSinceLastWorkout]);

  const calendarMonth = useMemo(() => {
    const firstOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + viewMonthOffset,
      1
    );
    const year = firstOfMonth.getFullYear();
    const month = firstOfMonth.getMonth();
    const monthTitle = firstOfMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingEmptyDays = (firstOfMonth.getDay() + 6) % 7;

    const todayStr = toLocalDateStr(now);
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    let liftDaysCount = 0;
    let restDaysCount = 0;

    const days: {
      dayNumber: number;
      dateStr: string;
      isToday: boolean;
      isFuture: boolean;
      sessions: WorkoutSession[];
      splitTag?: WorkoutSession['splitTag'];
    }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const dateStr = toLocalDateStr(cellDate);
      const isFuture = cellDate.getTime() > todayMidnight;
      const sessions = workoutsByDate.get(dateStr) || [];

      if (!isFuture) {
        if (sessions.length > 0) liftDaysCount += 1;
        else restDaysCount += 1;
      }

      days.push({
        dayNumber: day,
        dateStr,
        isToday: dateStr === todayStr,
        isFuture,
        sessions,
        splitTag: sessions[0]?.splitTag,
      });
    }

    return {
      monthTitle,
      leadingEmptyDays,
      days,
      liftDaysCount,
      restDaysCount,
    };
  }, [now, viewMonthOffset, workoutsByDate]);

  return (
    <div className="af-card p-4 sm:p-5 space-y-4">
      {/* Streak Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>

          <div>
            <div className="text-base sm:text-lg font-bold font-mono-num text-white leading-tight">
              {stats.activeWeekStreak} Week Streak
            </div>
            <div className="text-[11px] text-[#8e8e93] font-mono-num mt-0.5">
              This week:{' '}
              <strong className="text-white">{stats.thisWeekWorkouts} lifts</strong>
              {' • '}
              <strong className="text-white">{stats.thisWeekRestDays} rest</strong>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full shrink-0 ${restBadge.style}`}
        >
          {restBadge.icon === 'zap' ? (
            <Zap className="w-3 h-3 fill-current" />
          ) : (
            <Moon className="w-3 h-3" />
          )}
          {restBadge.label}
        </span>
      </div>

      {/* Apple Fitness Monthly Calendar */}
      <div className="bg-black/45 border border-white/[0.06] rounded-[18px] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">
              {calendarMonth.monthTitle}
            </h3>
            <div className="text-[11px] text-[#8e8e93] font-mono-num">
              <span className="text-[#a4ff00] font-semibold">
                {calendarMonth.liftDaysCount} Lift Days
              </span>
              {' • '}
              <span>{calendarMonth.restDaysCount} Rest Days</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMonthOffset((m) => m - 1)}
              className="p-1.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white transition"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {viewMonthOffset !== 0 && (
              <button
                type="button"
                onClick={() => setViewMonthOffset(0)}
                className="px-2.5 py-1 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[10px] font-bold text-[#a4ff00]"
              >
                Today
              </button>
            )}
            <button
              type="button"
              disabled={viewMonthOffset >= 0}
              onClick={() => setViewMonthOffset((m) => Math.min(0, m + 1))}
              className="p-1.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] disabled:opacity-30 text-white transition"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Column Headers (Mon - Sun) */}
        <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
          <div>M</div>
          <div>T</div>
          <div>W</div>
          <div>T</div>
          <div>F</div>
          <div>S</div>
          <div>S</div>
        </div>

        {/* Standard 7-Column Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: calendarMonth.leadingEmptyDays }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10" />
          ))}

          {calendarMonth.days.map((day) => {
            const hasSession = day.sessions.length > 0;
            const isSelected = selectedDateStr === day.dateStr;
            const sessionPillStyle = getSplitPalette(day.splitTag).ringClass;

            return (
              <button
                key={day.dateStr}
                type="button"
                disabled={!hasSession}
                onClick={() =>
                  onSelectDateStr(isSelected ? null : day.dateStr)
                }
                className={`h-10 rounded-2xl flex flex-col items-center justify-center relative transition-all ${
                  hasSession
                    ? `${sessionPillStyle} cursor-pointer active:scale-95 font-bold`
                    : day.isFuture
                    ? 'bg-[#1c1c1e]/40 text-[#48484a] cursor-default'
                    : 'bg-[#1c1c1e] text-[#8e8e93] cursor-default'
                } ${
                  isSelected
                    ? 'ring-2 ring-white scale-105 z-10 bg-white/15 text-white'
                    : day.isToday && !hasSession
                    ? 'ring-1 ring-[#a4ff00] text-[#a4ff00] font-bold'
                    : ''
                }`}
              >
                <span className="text-xs font-mono-num leading-none">
                  {day.dayNumber}
                </span>
                {hasSession ? (
                  <span className="text-[8px] uppercase tracking-tighter font-extrabold leading-none mt-0.5">
                    {day.splitTag ? day.splitTag.slice(0, 4) : 'Lift'}
                  </span>
                ) : !day.isFuture ? (
                  <span className="text-[8px] text-[#48484a] leading-none mt-0.5">
                    Rest
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Legend & Active Date Filter Chip */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-white/[0.06] text-[10px] text-[#8e8e93]">
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1">
            {(
              [
                { label: 'Push', color: '#fa114f' },
                { label: 'Pull', color: '#00f5ea' },
                { label: 'Legs', color: '#bf5af2' },
                { label: 'Upper', color: '#ff9f0a' },
                { label: 'Lower', color: '#5e5ce6' },
                { label: 'Full Body', color: '#30d158' },
                { label: 'Custom', color: '#ffd60a' },
              ] as const
            )
              .filter((item) => !recordedSplits || recordedSplits.has(item.label))
              .map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />{' '}
                  {item.label}
                </span>
              ))}
          </div>

          {selectedDateStr && (
            <button
              type="button"
              onClick={() => onSelectDateStr(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#a4ff00]/20 text-[#a4ff00] font-semibold"
            >
              Showing {selectedDateStr} <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

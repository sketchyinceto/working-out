import React from 'react';
import { Check, Play, Settings2 } from 'lucide-react';
import { Routine, TrainingProfile } from '../../types/workout';
import { GOAL_LABELS } from '../../data/programmes';
import { ScheduleDay, WEEKDAY_SHORT } from '../../utils/coach/schedule';
import { getSplitPalette } from '../../utils/splitTheme';
import { toLocalDateStr } from '../../utils/dates';

interface WeekScheduleProps {
  days: ScheduleDay[];
  profile: TrainingProfile;
  /** Without a programme there's no plan, just what you've done. */
  hasProgramme: boolean;
  onStartRoutine: (routine: Routine) => void;
  onOpenBuilder: () => void;
}

const STATUS_STYLE: Record<ScheduleDay['status'], string> = {
  done: 'bg-[#a4ff00] text-black',
  extra: 'bg-[#a4ff00]/60 text-black',
  today: 'bg-white text-black',
  upcoming: 'bg-[#2c2c2e] text-white',
  missed: 'bg-[#fa114f]/20 text-[#fa114f]',
  rest: 'bg-transparent text-[#636366] border border-white/[0.06]',
};

export const WeekSchedule: React.FC<WeekScheduleProps> = ({
  days,
  profile,
  hasProgramme,
  onStartRoutine,
  onOpenBuilder,
}) => {
  const today = days.find((d) => d.status === 'today');
  const upcoming = days.filter((d) => d.plannedRoutine && d.status !== 'today');
  const done = days.filter((d) => d.status === 'done' || d.status === 'extra').length;
  const planned = days.filter((d) => d.isTrainingDay).length;

  return (
    <section className="af-card p-4 space-y-3" aria-labelledby="week-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="week-title" className="text-sm font-bold text-white">
            This Week
          </h2>
          <p className="text-[11px] text-[#8e8e93]">
            {hasProgramme
              ? `${done} of ${planned} sessions · ${GOAL_LABELS[profile.goal]}`
              : `${done} workout${done === 1 ? '' : 's'} logged this week`}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenBuilder}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#2c2c2e] text-[11px] font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" /> Programme Builder
        </button>
      </div>

      {!hasProgramme && (
        <p className="text-[11px] text-[#ffe620] bg-[#ffe620]/10 rounded-xl px-3 py-2">
          No programme yet, so there's no weekly plan. Open the Programme Builder to plan your week.
        </p>
      )}

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <div key={d.dateStr} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-[#8e8e93] font-semibold">{WEEKDAY_SHORT[d.weekday][0]}</span>
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-mono-num ${STATUS_STYLE[d.status]}`}
              title={d.status}
            >
              {d.status === 'done' || d.status === 'extra' ? <Check className="w-4 h-4 stroke-[3]" /> : d.dayNumber}
            </span>
            <span className="text-[9px] text-[#8e8e93] h-3 truncate max-w-full">
              {d.workouts[0]?.splitTag || d.plannedRoutine?.splitTag || ''}
            </span>
          </div>
        ))}
      </div>

      {hasProgramme &&
        (today?.plannedRoutine ? (
        <button
          type="button"
          onClick={() => onStartRoutine(today.plannedRoutine!)}
          className={`w-full py-2.5 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1.5 ${getSplitPalette(today.plannedRoutine.splitTag).buttonClass}`}
        >
          <Play className="w-3.5 h-3.5 fill-current" /> Start Today: {today.plannedRoutine.name}
        </button>
      ) : (
        <p className="text-xs text-[#d1d1d6]">
          {days.find((d) => d.dateStr === toLocalDateStr() && (d.status === 'done' || d.status === 'extra'))
            ? 'Done for today. Nice work.'
            : 'Rest day today. Recovery is when the growth happens.'}
        </p>
      ))}

      {upcoming.length > 0 && (
        <div className="space-y-1">
          {upcoming.map((d) => (
            <div key={d.dateStr} className="flex items-center justify-between text-xs">
              <span className="text-[#8e8e93]">{WEEKDAY_SHORT[d.weekday]}</span>
              <span className="text-white truncate ml-3">{d.plannedRoutine!.name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

import React from 'react';
import { Check } from 'lucide-react';
import { ScheduleDay, WEEKDAY_SHORT } from '../../utils/coach/schedule';

const STATUS_STYLE: Record<ScheduleDay['status'], string> = {
  done: 'bg-[#a4ff00] text-black',
  extra: 'bg-[#a4ff00]/60 text-black',
  today: 'bg-white text-black',
  upcoming: 'bg-[#2c2c2e] text-white',
  missed: 'bg-[#fa114f]/20 text-[#fa114f]',
  rest: 'bg-transparent text-[#636366] border border-white/[0.06]',
};

const STATUS_LABEL: Record<ScheduleDay['status'], string> = {
  done: 'done',
  extra: 'extra session',
  today: 'today',
  upcoming: 'planned',
  missed: 'missed',
  rest: 'rest day',
};

/** Mon–Sun with what's done and which workout is planned for each day. */
export const WeekStrip: React.FC<{ days: ScheduleDay[] }> = ({ days }) => {
  const done = days.filter((d) => d.status === 'done' || d.status === 'extra').length;
  const planned = days.filter((d) => d.isTrainingDay).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
        <span>This Week</span>
        <span className="font-mono-num normal-case tracking-normal font-semibold">
          {done} of {planned} sessions
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const tag = d.workouts[0]?.splitTag || d.plannedRoutine?.splitTag || '';
          return (
            <div key={d.dateStr} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-[#8e8e93] font-semibold">{WEEKDAY_SHORT[d.weekday][0]}</span>
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-mono-num ${STATUS_STYLE[d.status]}`}
                aria-label={`${WEEKDAY_SHORT[d.weekday]} ${d.dayNumber}: ${STATUS_LABEL[d.status]}${tag ? `, ${tag}` : ''}`}
              >
                {d.status === 'done' || d.status === 'extra' ? <Check className="w-4 h-4 stroke-[3]" /> : d.dayNumber}
              </span>
              <span className="text-[9px] text-[#8e8e93] h-3 truncate max-w-full">{tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

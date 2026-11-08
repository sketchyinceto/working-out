import React from 'react';
import { ChevronDown } from 'lucide-react';
import { ProgrammeTemplate } from '../../data/programmes';

interface WeekPickerProps {
  template: ProgrammeTemplate;
  weekNumber: number;
  color: string;
  onSetWeek: (week: number) => void;
}

/**
 * "Week 5 of 39 ▾": pick the week you're actually on (e.g. after time off, or
 * if you started the programme before using the app). Week 1 = this week.
 */
export const WeekPicker: React.FC<WeekPickerProps> = ({ template, weekNumber, color, onSetWeek }) => (
  <label className="relative inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
    <span>
      Week {weekNumber} of {template.weeks.length}
    </span>
    <ChevronDown className="w-3 h-3" aria-hidden="true" />
    <select
      aria-label="Change programme week"
      value={Math.min(weekNumber, template.weeks.length)}
      onChange={(e) => onSetWeek(Number(e.target.value))}
      className="absolute inset-0 opacity-0 cursor-pointer"
    >
      {template.weeks.map((w) => (
        <option key={w.week} value={w.week}>
          Week {w.week} · {w.block}
          {w.kind === 'deload' ? ' (deload)' : w.kind === 'test' ? ' (test)' : w.kind === 'transition' ? ' (transition)' : ''}
        </option>
      ))}
    </select>
  </label>
);

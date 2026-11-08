import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GoalType } from '../../types/workout';
import { GOAL_LABELS, PROGRAMMES, ProgrammeTemplate } from '../../data/programmes';
import { PHASE_COLOR } from './ProgrammeCard';

interface ProgrammePickerProps {
  goal: GoalType;
  currentId?: string;
  onStart: (template: ProgrammeTemplate) => void;
  onClose: () => void;
}

const months = (weeks: number) => (weeks >= 13 ? `${Math.round(weeks / 4.33)} months` : `${weeks} weeks`);

/** Programme list, with the best fit for your goal first. */
export const ProgrammePicker: React.FC<ProgrammePickerProps> = ({ goal, currentId, onStart, onClose }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...PROGRAMMES].sort((a, b) => {
    const rank = (p: ProgrammeTemplate) => (p.goals[0] === goal ? 0 : p.goals.includes(goal) ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-3 max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Choose a Programme</h3>
            <p className="text-[11px] text-[#8e8e93]">Your goal: {GOAL_LABELS[goal]}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
          {sorted.map((p, i) => {
            const isOpen = openId === p.id;
            const recommended = i === 0 && p.goals.includes(goal);
            return (
              <div key={p.id} className="bg-[#2c2c2e]/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {recommended && (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#a4ff00] text-black">
                          Best for your goal
                        </span>
                      )}
                      {p.id === currentId && (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/15 text-white">
                          Current
                        </span>
                      )}
                      <span className="text-[10px] text-[#8e8e93] font-semibold">{months(p.weeks.length)}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{p.name}</h4>
                    <p className="text-[11px] text-[#d1d1d6] leading-snug">{p.tagline}</p>
                  </div>
                </div>

                <div className="flex gap-[2px] h-1.5" aria-hidden="true">
                  {p.weeks.map((w) => (
                    <div key={w.week} className="flex-1 rounded-[1px]" style={{ backgroundColor: PHASE_COLOR[w.phase], opacity: w.kind === 'deload' ? 0.4 : 0.9 }} />
                  ))}
                </div>

                {isOpen && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#d1d1d6] leading-snug">{p.description}</p>
                    <ul className="space-y-1">
                      {p.evidence.map((e) => (
                        <li key={e} className="text-[11px] text-[#8e8e93] leading-snug">
                          • {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : p.id)}
                    className="flex-1 py-2 rounded-full bg-black/50 text-white text-xs font-semibold"
                  >
                    {isOpen ? 'Less' : 'Details & research'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        currentId &&
                        !window.confirm(`Switch to "${p.name}"? It starts from week 1 this week.`)
                      ) {
                        return;
                      }
                      onStart(p);
                    }}
                    className="flex-1 py-2 rounded-full bg-[#a4ff00] text-black text-xs font-bold"
                  >
                    {p.id === currentId ? 'Restart' : 'Start'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

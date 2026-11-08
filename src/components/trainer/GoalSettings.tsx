import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ExperienceLevel, GoalType, Routine, TrainingProfile } from '../../types/workout';
import { GOAL_LABELS } from '../../data/programmes';
import { WEEKDAY_SHORT, splitHint } from '../../utils/coach/schedule';

interface GoalSettingsProps {
  profile: TrainingProfile;
  routines: Routine[];
  onSave: (profile: TrainingProfile) => void;
  onClose: () => void;
}

const EXPERIENCE: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Under 1 year of consistent lifting' },
  { value: 'intermediate', label: 'Intermediate', hint: '1–3 years' },
  { value: 'advanced', label: 'Advanced', hint: '3+ years' },
];

export const GoalSettings: React.FC<GoalSettingsProps> = ({ profile, routines, onSave, onClose }) => {
  const [goal, setGoal] = useState<GoalType>(profile.goal);
  const [experience, setExperience] = useState<ExperienceLevel>(profile.experience);
  const [days, setDays] = useState<number[]>(profile.trainingDays);
  const [rotation, setRotation] = useState<string[]>(
    profile.rotationRoutineIds.filter((id) => routines.some((r) => r.id === id))
  );

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  const toggleRoutine = (id: string) =>
    setRotation((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const label = 'block text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1.5';
  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold transition ${
      on ? 'bg-[#a4ff00] text-black' : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (days.length === 0 || rotation.length === 0) return;
          onSave({ goal, experience, trainingDays: days, rotationRoutineIds: rotation });
        }}
        className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Goal & Schedule</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <span className={label}>Goal</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((g) => (
              <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Experience</span>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPERIENCE.map((x) => (
              <button
                key={x.value}
                type="button"
                aria-pressed={experience === x.value}
                onClick={() => setExperience(x.value)}
                className={`${chip(experience === x.value)} rounded-xl! py-2 text-center`}
              >
                <div>{x.label}</div>
                <div className={`text-[9px] font-normal ${experience === x.value ? 'text-black/70' : 'text-[#636366]'}`}>{x.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Training Days ({days.length} a week)</span>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((d, i) => (
              <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)} className={`${chip(days.includes(i))} px-0!`}>
                {d}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#8e8e93] mt-1.5">{splitHint(days.length)}</p>
        </div>

        <div>
          <span className={label}>Routine Rotation</span>
          <p className="text-[11px] text-[#8e8e93] mb-1.5">
            Tap routines in the order you want to cycle through them. Your training days follow this order.
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {routines.map((r) => {
              const pos = rotation.indexOf(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={pos >= 0}
                  onClick={() => toggleRoutine(r.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition ${
                    pos >= 0 ? 'bg-[#a4ff00]/15 text-white' : 'bg-[#2c2c2e]/70 text-[#8e8e93]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      pos >= 0 ? 'bg-[#a4ff00] text-black' : 'bg-black/40 text-[#636366]'
                    }`}
                  >
                    {pos >= 0 ? pos + 1 : ''}
                  </span>
                  <span className="truncate">{r.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {(days.length === 0 || rotation.length === 0) && (
          <p className="text-[11px] text-[#fa114f]">Pick at least one training day and one routine.</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={days.length === 0 || rotation.length === 0}
            className="px-4 py-2 rounded-full bg-[#a4ff00] disabled:opacity-40 text-black text-xs font-bold"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

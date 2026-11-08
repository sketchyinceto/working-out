import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { ExperienceLevel, GoalType, TrainingProfile } from '../../types/workout';
import { GOAL_LABELS, programmeForGoal } from '../../data/programmes';
import { splitForDays } from '../../data/programmeSplits';
import { EXPERIENCE_VOLUME } from '../../utils/coach/programmeWorkouts';
import { WEEKDAY_SHORT } from '../../utils/coach/schedule';
import { PHASE_COLOR } from './ProgrammeCard';

const EXPERIENCE: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Under 1 year' },
  { value: 'intermediate', label: 'Intermediate', hint: '1–3 years' },
  { value: 'advanced', label: 'Advanced', hint: '3+ years' },
];

const months = (weeks: number) => (weeks >= 13 ? `${Math.round(weeks / 4.33)} months` : `${weeks} weeks`);

interface ProgrammeBuilderProps {
  profile: TrainingProfile;
  /** Template id of the programme being followed, if any. */
  activeTemplateId?: string;
  onSave: (profile: TrainingProfile) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * One place to design the programme: the goal picks the programme, the
 * training days pick the weekly layout (and which workout lands on which
 * day), and experience sets how many sets.
 */
export const ProgrammeBuilder: React.FC<ProgrammeBuilderProps> = ({
  profile,
  activeTemplateId,
  onSave,
  onRemove,
  onClose,
}) => {
  const [goal, setGoal] = useState<GoalType>(profile.goal);
  const [experience, setExperience] = useState<ExperienceLevel>(profile.experience);
  const [days, setDays] = useState<number[]>(profile.trainingDays);
  const [showResearch, setShowResearch] = useState(false);

  const template = programmeForGoal(goal);
  const split = splitForDays(days.length);
  const sortedDays = [...days].sort((a, b) => a - b);
  const switching = !!activeTemplateId && activeTemplateId !== template.id;

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const label = 'block text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1.5';
  const chip = (on: boolean) =>
    `rounded-xl text-xs font-semibold transition ${
      on ? 'bg-[#a4ff00] text-black' : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (days.length === 0) return;
          onSave({ ...profile, goal, experience, trainingDays: sortedDays });
        }}
        className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Programme Builder</h3>
            <p className="text-[11px] text-[#8e8e93]">Your goal and schedule design the programme.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Goal → programme */}
        <div>
          <span className={label}>1 · Goal</span>
          <div className="space-y-1.5">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((g) => {
              const p = programmeForGoal(g);
              const on = goal === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoal(g)}
                  className={`w-full text-left px-3 py-2 ${chip(on)}`}
                >
                  <div className="font-bold">{GOAL_LABELS[g]}</div>
                  <div className={`text-[10px] font-normal ${on ? 'text-black/70' : 'text-[#636366]'}`}>
                    {p.name} · {months(p.weeks.length)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Training days → weekly layout */}
        <div>
          <span className={label}>2 · Training Days ({days.length} a week)</span>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(i)}
                onClick={() => toggleDay(i)}
                className={`py-1.5 ${chip(days.includes(i))}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Experience → volume */}
        <div>
          <span className={label}>3 · Experience</span>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPERIENCE.map((x) => (
              <button
                key={x.value}
                type="button"
                aria-pressed={experience === x.value}
                onClick={() => setExperience(x.value)}
                className={`py-2 text-center ${chip(experience === x.value)}`}
              >
                <div>{x.label}</div>
                <div className={`text-[9px] font-normal ${experience === x.value ? 'text-black/70' : 'text-[#636366]'}`}>
                  {x.hint}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="bg-black/40 rounded-2xl p-3.5 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#a4ff00]">Your Programme</div>
            <div className="text-sm font-bold text-white">{template.name}</div>
            <p className="text-[11px] text-[#d1d1d6] leading-snug">{template.tagline}</p>
          </div>

          <div className="flex gap-[2px] h-2" aria-hidden="true">
            {template.weeks.map((w) => (
              <div
                key={w.week}
                className="flex-1 rounded-[1px]"
                style={{ backgroundColor: PHASE_COLOR[w.phase], opacity: w.kind === 'deload' ? 0.4 : 0.9 }}
              />
            ))}
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1">
              Weekly plan · {split.name}
            </div>
            {sortedDays.length === 0 ? (
              <p className="text-[11px] text-[#fa114f]">Pick at least one training day.</p>
            ) : (
              <div className="space-y-0.5">
                {sortedDays.map((d, i) => (
                  <div key={d} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#8e8e93] w-9 shrink-0">{WEEKDAY_SHORT[d]}</span>
                    <span className="text-white truncate flex-1">
                      {split.workouts[i % split.workouts.length].name}
                    </span>
                  </div>
                ))}
                {sortedDays.length < 3 && (
                  <p className="text-[10px] text-[#8e8e93] pt-1">
                    The 3 full-body workouts rotate across your {sortedDays.length} day
                    {sortedDays.length === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#8e8e93]">
            Sets per exercise: {Math.round(EXPERIENCE_VOLUME[experience] * 100)}% of standard for{' '}
            {experience} lifters. Each workout is adjusted after every session based on how it went.
          </p>

          <button
            type="button"
            onClick={() => setShowResearch((v) => !v)}
            aria-expanded={showResearch}
            className="text-[11px] font-semibold text-[#a4ff00] inline-flex items-center gap-1"
          >
            {showResearch ? 'Hide' : 'Show'} details & research
            {showResearch ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showResearch && (
            <div className="space-y-2">
              <p className="text-[11px] text-[#d1d1d6] leading-snug">{template.description}</p>
              <ul className="space-y-1">
                {template.evidence.map((e) => (
                  <li key={e} className="text-[11px] text-[#8e8e93] leading-snug">
                    • {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {switching && (
          <p className="text-[11px] text-[#ffe620] bg-[#ffe620]/10 rounded-xl px-3 py-2">
            This changes your programme. The new one starts at week 1; your workout history is kept.
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {activeTemplateId ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#fa114f]/15 text-[#fa114f] text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Programme
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={days.length === 0}
              className="px-4 py-2 rounded-full bg-[#a4ff00] disabled:opacity-40 text-black text-xs font-bold"
            >
              {!activeTemplateId ? 'Start Programme' : switching ? 'Switch Programme' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

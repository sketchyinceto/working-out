import React, { useState } from 'react';
import { CalendarRange, ChevronDown, ChevronUp, Utensils } from 'lucide-react';
import { ProgrammePhase } from '../../data/programmes';
import { WeekPicker } from './WeekPicker';
import { WeekStrip } from './WeekStrip';
import type { ScheduleDay } from '../../utils/coach/schedule';
import {
  ProgrammeStatus,
  WEEK_KIND_LABEL,
  describeRir,
  nutritionTargets,
} from '../../utils/coach/programme';

export const PHASE_COLOR: Record<ProgrammePhase, string> = {
  bulk: '#a4ff00',
  maintain: '#8e8e93',
  cut: '#00f5ea',
  recomp: '#bf5af2',
  strength: '#ffe620',
};

interface ProgrammeCardProps {
  status: ProgrammeStatus | null;
  bodyweightKg: number | null;
  onChoose: () => void;
  onEnd: () => void;
  onSetWeek: (week: number) => void;
  /** This week's days with planned programme workouts. */
  weekDays: ScheduleDay[];
  /** Shown when a mostly-missed week was repeated. */
  notice?: string | null;
}

export const ProgrammeCard: React.FC<ProgrammeCardProps> = ({
  status,
  bodyweightKg,
  onChoose,
  onEnd,
  onSetWeek,
  weekDays,
  notice,
}) => {
  const [showPlan, setShowPlan] = useState(false);

  if (!status) {
    return (
      <section className="af-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-[#a4ff00]" />
          <h2 className="text-sm font-bold text-white">Programme</h2>
        </div>
        <p className="text-xs text-[#d1d1d6]">
          Set your goal, training days and experience, and a long-term programme is built for you:
          a weekly workout plan, deloads, nutrition targets, and automatic adjustments after every
          session.
        </p>
        <button
          type="button"
          onClick={onChoose}
          className="w-full py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs"
        >
          Build Your Programme
        </button>
      </section>
    );
  }

  const { template, week, weekNumber, finished, notStarted, startMonday } = status;

  if (finished || !week) {
    return (
      <section className="af-card p-4 space-y-3">
        <h2 className="text-sm font-bold text-white">{template.name}</h2>
        <p className="text-xs text-[#d1d1d6]">
          Programme complete. Check your progress review, then pick what's next.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onChoose} className="flex-1 py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs">
            Build Next Programme
          </button>
          <button type="button" onClick={onEnd} className="px-4 py-2.5 rounded-full bg-[#2c2c2e] text-white font-semibold text-xs">
            Clear
          </button>
        </div>
      </section>
    );
  }

  const nutrition = nutritionTargets(week, bodyweightKg);
  const color = PHASE_COLOR[week.phase];
  const changeText = nutrition.weeklyChangeKg
    ? nutrition.weeklyChangeKg[0] === 0 && nutrition.weeklyChangeKg[1] === 0
      ? 'Hold your weight steady'
      : `${nutrition.weeklyChangeKg[0] > 0 ? '+' : ''}${nutrition.weeklyChangeKg[0]} to ${nutrition.weeklyChangeKg[1] > 0 ? '+' : ''}${nutrition.weeklyChangeKg[1]} kg per week`
    : `${nutrition.guide.weeklyChangePct[0]}% to ${nutrition.guide.weeklyChangePct[1]}% of bodyweight per week`;
  const proteinText = nutrition.proteinGrams
    ? `${nutrition.proteinGrams[0]}–${nutrition.proteinGrams[1]} g protein a day`
    : `${nutrition.guide.proteinGPerKg[0]}–${nutrition.guide.proteinGPerKg[1]} g protein per kg a day`;

  // Group weeks into blocks for the full plan list.
  const blocks: { name: string; from: number; to: number; phase: ProgrammePhase }[] = [];
  for (const w of template.weeks) {
    const last = blocks[blocks.length - 1];
    if (last && last.name === w.block) last.to = w.week;
    else blocks.push({ name: w.block, from: w.week, to: w.week, phase: w.phase });
  }

  return (
    <section className="af-card p-4 space-y-3.5" aria-labelledby="programme-title">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 flex-wrap" style={{ color }}>
            {notStarted ? (
              `Starts ${startMonday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · week 1 preview`
            ) : (
              <>
                <WeekPicker template={template} weekNumber={weekNumber} color={color} onSetWeek={onSetWeek} />
                <span>· {WEEK_KIND_LABEL[week.kind]}</span>
              </>
            )}
          </div>
          <h2 id="programme-title" className="text-base font-bold text-white leading-tight mt-0.5">
            {week.block}
          </h2>
          <p className="text-[11px] text-[#8e8e93] truncate">{template.name}</p>
        </div>
        <button
          type="button"
          onClick={onChoose}
          className="px-3 py-1.5 rounded-full bg-[#2c2c2e] text-[11px] font-semibold text-white shrink-0"
        >
          Edit
        </button>
      </div>

      {notice && (
        <p className="text-[11px] text-[#ffe620] bg-[#ffe620]/10 rounded-xl px-3 py-2">{notice}</p>
      )}

      <WeekStrip days={weekDays} />

      {/* Whole-programme timeline: one segment per week, coloured by phase */}
      <div>
        <div className="flex gap-[2px] h-2.5" aria-hidden="true">
          {template.weeks.map((w) => (
            <div
              key={w.week}
              className="flex-1 rounded-[2px]"
              style={{
                backgroundColor: PHASE_COLOR[w.phase],
                opacity: w.week < weekNumber ? 0.85 : w.week === weekNumber ? 1 : 0.25,
                outline: w.week === weekNumber ? '1.5px solid white' : undefined,
                height: w.kind === 'deload' ? '60%' : '100%',
                alignSelf: 'flex-end',
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-[#8e8e93]">
          {[...new Set(template.weeks.map((w) => w.phase))].map((p) => (
            <span key={p} className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLOR[p] }} />
              {p === 'maintain' ? 'Maintenance' : p[0].toUpperCase() + p.slice(1)}
            </span>
          ))}
          <span>· short bars = deload weeks</span>
        </div>
      </div>

      <div className="bg-black/40 rounded-xl p-3 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">This Week's Training</div>
        <p className="text-xs text-[#d1d1d6] leading-snug">{week.focus}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-0.5">
          <span className="text-[#8e8e93]">Compound lifts</span>
          <span className="text-white font-semibold text-right">
            {week.compoundReps[0]}–{week.compoundReps[1]} reps
          </span>
          <span className="text-[#8e8e93]">Isolation lifts</span>
          <span className="text-white font-semibold text-right">
            {week.isolationReps[0]}–{week.isolationReps[1]} reps
          </span>
          <span className="text-[#8e8e93]">Sets vs standard</span>
          <span className="text-white font-semibold text-right">{Math.round(week.setsMultiplier * 100)}%</span>
          <span className="text-[#8e8e93]">Effort</span>
          <span className="text-white font-semibold text-right">{describeRir(week.rir)}</span>
        </div>
      </div>

      <div className="bg-black/40 rounded-xl p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
          <Utensils className="w-3 h-3" /> Nutrition · {nutrition.guide.label}
        </div>
        <p className="text-xs text-white">{nutrition.guide.calories}</p>
        <p className="text-[11px] text-[#d1d1d6]">
          {changeText} · {proteinText}
        </p>
        {!bodyweightKg && (
          <p className="text-[11px] text-[#8e8e93]">Log your weight on Summary to see these in kg and grams.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowPlan((v) => !v)}
        aria-expanded={showPlan}
        className="w-full text-[11px] font-semibold text-[#a4ff00] inline-flex items-center justify-center gap-1"
      >
        {showPlan ? 'Hide' : 'Show'} full plan & research
        {showPlan ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showPlan && (
        <div className="space-y-3">
          <p className="text-xs text-[#d1d1d6] leading-snug">{template.description}</p>
          <div className="space-y-1">
            {blocks.map((b) => (
              <div key={`${b.name}-${b.from}`} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_COLOR[b.phase] }} />
                  {b.name}
                </span>
                <span className="font-mono-num text-[#8e8e93]">
                  {b.from === b.to ? `Week ${b.from}` : `Weeks ${b.from}–${b.to}`}
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1">Based On</div>
            <ul className="space-y-1">
              {template.evidence.map((e) => (
                <li key={e} className="text-[11px] text-[#8e8e93] leading-snug">
                  • {e}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              onEnd();
            }}
            className="w-full py-2 rounded-full bg-[#fa114f]/15 text-[#fa114f] text-xs font-bold"
          >
            Remove Programme
          </button>
        </div>
      )}
    </section>
  );
};

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ActiveProgramme,
  BodyMeasurementEntry,
  Exercise,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import { blockBoundaries, buildBlockReview } from '../../utils/coach/review';
import { formatVolume, kgToDisplay } from '../../utils/calculators';

interface ProgressReviewProps {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  measurements: BodyMeasurementEntry[];
  programme: ActiveProgramme | null | undefined;
  unit: WeightUnit;
}

function Delta({ now, before, format }: { now: number; before: number | null; format?: (n: number) => string }) {
  if (before === null || before === 0) return null;
  const diff = now - before;
  if (diff === 0) return <span className="text-[10px] text-[#8e8e93]">same</span>;
  const shown = format ? format(Math.abs(diff)) : String(Math.abs(diff));
  return (
    <span className={`text-[10px] font-semibold ${diff > 0 ? 'text-[#a4ff00]' : 'text-[#fa114f]'}`}>
      {diff > 0 ? '▲' : '▼'} {shown}
    </span>
  );
}

/** 4-week block review, browsable back through earlier blocks. */
export const ProgressReview: React.FC<ProgressReviewProps> = ({
  workouts,
  exercises,
  measurements,
  programme,
  unit,
}) => {
  const bounds = useMemo(() => blockBoundaries(workouts, programme), [workouts, programme]);
  const [index, setIndex] = useState<number | null>(null);
  // Default to the latest block; clamp in case the list got shorter.
  const current = Math.min(index ?? bounds.length - 1, bounds.length - 1);

  const review = useMemo(
    () => buildBlockReview(current, bounds, workouts, exercises, measurements, programme),
    [current, bounds, workouts, exercises, measurements, programme]
  );

  const stats = [
    { label: 'Sessions', now: review.totals.sessions, before: review.previous?.sessions ?? null, text: String(review.totals.sessions) },
    { label: 'Sets', now: review.totals.sets, before: review.previous?.sets ?? null, text: String(review.totals.sets) },
    {
      label: `Volume ${unit}`,
      now: review.totals.volumeKg,
      before: review.previous?.volumeKg ?? null,
      // Unit is in the label so the number fits the tile.
      text: formatVolume(review.totals.volumeKg, unit).replace(` ${unit}`, ''),
      format: (n: number) => formatVolume(n, unit).replace(` ${unit}`, ''),
    },
    { label: 'PR sets', now: review.totals.prs, before: review.previous?.prs ?? null, text: String(review.totals.prs) },
  ];

  return (
    <div className="pt-3 border-t border-white/[0.08] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Progress Review</h3>
          <p className="text-[11px] text-[#8e8e93]">
            {review.label}
            {review.inProgress ? ' · in progress' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous 4 weeks"
            disabled={current === 0}
            onClick={() => setIndex(current - 1)}
            className="p-1.5 rounded-full bg-[#2c2c2e] text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Next 4 weeks"
            disabled={current === bounds.length - 1}
            onClick={() => setIndex(current + 1)}
            className="p-1.5 rounded-full bg-[#2c2c2e] text-white disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {stats.map((s) => (
          <div key={s.label} className="bg-black/40 rounded-xl px-2 py-2">
            <div className="text-[9px] uppercase tracking-wider text-[#8e8e93] font-semibold">{s.label}</div>
            <div className="text-sm font-bold font-mono-num text-white truncate">{s.text}</div>
            <Delta now={s.now} before={s.before} format={s.format} />
          </div>
        ))}
      </div>
      {review.previous && (
        <p className="text-[10px] text-[#636366] -mt-1.5">Arrows compare with the previous 4 weeks.</p>
      )}

      {review.highlights.length > 0 && (
        <ul className="space-y-1">
          {review.highlights.map((h) => (
            <li key={h} className="text-xs text-[#d1d1d6] flex gap-1.5">
              <span className="text-[#a4ff00]">•</span>
              {h}
            </li>
          ))}
        </ul>
      )}

      {review.lifts.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
            <span>Main Lifts</span>
            <span>Est. 1RM · vs before</span>
          </div>
          {review.lifts.map((l) => (
            <div key={l.exercise.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-white truncate">{l.exercise.name}</span>
              <span className="font-mono-num shrink-0">
                <span className="text-white font-semibold">
                  {kgToDisplay(l.bestKg, unit)} {unit}
                </span>{' '}
                {l.changePct === null ? (
                  <span className="text-[#8e8e93]">new</span>
                ) : (
                  <span
                    className={
                      l.changePct >= 1 ? 'text-[#a4ff00]' : l.changePct <= -1 ? 'text-[#fa114f]' : 'text-[#8e8e93]'
                    }
                  >
                    {l.changePct > 0 ? '+' : ''}
                    {l.changePct}%
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-black/40 rounded-xl px-3 py-2.5 text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-0.5">Bodyweight</div>
        {review.bodyweight ? (
          <>
            <div className="text-white">
              {review.bodyweight.startKg} → {review.bodyweight.endKg} kg (
              {review.bodyweight.changeKg > 0 ? '+' : ''}
              {review.bodyweight.changeKg} kg, {review.bodyweight.weeklyPct > 0 ? '+' : ''}
              {review.bodyweight.weeklyPct}%/week)
            </div>
            {review.bodyweight.targetPct && (
              <div className="text-[#8e8e93]">
                Target {review.bodyweight.targetPct[0]}% to {review.bodyweight.targetPct[1]}% per week
              </div>
            )}
            <div className="text-[#d1d1d6] mt-0.5">{review.bodyweight.verdict}</div>
          </>
        ) : (
          <div className="text-[#8e8e93]">
            Log your weight on the Summary tab at least twice in a block to track your bulk or cut here.
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import { Award, ChevronDown, ChevronUp, Dumbbell, Pencil, Trophy } from 'lucide-react';
import { Exercise, MuscleGroup, WeightUnit, WorkoutSession } from '../../types/workout';
import { MUSCLE_LABELS } from '../../data/seedExercises';
import { getWorkingSets } from '../../utils/analytics';
import { calculateEstimated1RM, formatVolume, kgToDisplay } from '../../utils/calculators';
import { getMusclePalette, getSplitPalette } from '../../utils/splitTheme';
import { setBadgeLabel } from '../../utils/setTypes';

export function formatActivityDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (d.toDateString() === now.toDateString()) return `Today • ${timeStr}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday • ${timeStr}`;
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr} • ${timeStr}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} MIN`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}H ${m}M` : `${h}H`;
}

interface WorkoutCardProps {
  session: WorkoutSession;
  exerciseMap: Map<string, Exercise>;
  unit: WeightUnit;
  showAllSets: boolean;
  /** Hidden when a single day is selected (sets are always shown then). */
  canToggleSets: boolean;
  onToggleSets: () => void;
  onEdit: () => void;
  onOpenExerciseDetail: (exerciseId: string) => void;
}

/** A finished workout in the History feed. */
export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  session,
  exerciseMap,
  unit,
  showAllSets,
  canToggleSets,
  onToggleSets,
  onEdit,
  onOpenExerciseDetail,
}) => {
  const totals = useMemo(() => {
    let volumeKg = 0;
    let workingSets = 0;
    let reps = 0;
    let prCount = 0;
    const muscleSetCounts: Partial<Record<MuscleGroup, number>> = {};

    for (const block of session.exercises) {
      const meta = exerciseMap.get(block.exerciseId);
      const working = getWorkingSets(block.sets);
      workingSets += working.length;
      if (meta && working.length > 0) {
        muscleSetCounts[meta.primaryMuscle] =
          (muscleSetCounts[meta.primaryMuscle] || 0) + working.length;
      }
      for (const s of working) {
        volumeKg += s.weightKg * s.reps;
        reps += s.reps;
        if (s.prs && s.prs.length > 0) prCount += 1;
      }
    }

    const muscles = (Object.entries(muscleSetCounts) as [MuscleGroup, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, count]) => ({
        muscle,
        label: MUSCLE_LABELS[muscle].replace(' & Traps', '').replace(' & Core', ''),
        pct: Math.round((count / Math.max(1, workingSets)) * 100),
      }));

    return { volumeKg, workingSets, reps, prCount, muscles };
  }, [session, exerciseMap]);

  const palette = getSplitPalette(session.splitTag);
  const shades = palette.barShades;

  const metrics = [
    { label: 'Total Volume', value: formatVolume(totals.volumeKg, unit) },
    { label: 'Duration', value: formatDuration(session.durationMinutes) },
    { label: 'Sets', value: String(totals.workingSets) },
    { label: 'Reps', value: String(totals.reps) },
  ];

  return (
    <article
      style={palette.cardGlowStyle}
      className={`af-card border ${palette.cardBorderClass} overflow-hidden`}
    >
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${palette.badgeClass}`}
            >
              <Dumbbell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${palette.badgeClass}`}>
                  {session.splitTag}
                </span>
                <span className="text-[11px] text-[#8e8e93] font-medium">
                  {formatActivityDateTime(session.startTime)}
                </span>
              </div>
              <h2 className="text-base font-bold text-white truncate mt-0.5">{session.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {totals.prCount > 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${palette.badgeClass}`}>
                <Trophy className="w-3.5 h-3.5" /> {totals.prCount}{' '}
                {totals.prCount === 1 ? 'PR' : 'PRs'}
              </span>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93] hover:text-white transition"
              title="Edit workout"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {session.notes && (
          <p className="text-xs text-[#d1d1d6] bg-[#2c2c2e] rounded-xl px-3 py-2 mt-2.5">
            {session.notes}
          </p>
        )}

        <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-white/[0.06]">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] uppercase tracking-wider text-[#8e8e93] font-semibold">
                {m.label}
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-num text-white mt-0.5">
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {totals.muscles.length > 0 && (
          <div className="mt-3">
            <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-[#2c2c2e] gap-0.5">
              {totals.muscles.map((m, i) => (
                <div
                  key={m.muscle}
                  style={{ width: `${m.pct}%` }}
                  className={shades[i % shades.length]}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-[#8e8e93]">
              {totals.muscles.map((m, i) => (
                <span key={m.muscle} className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${shades[i % shades.length]}`} />
                  <strong className="text-white">{m.label}</strong> {m.pct}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3.5 pt-2.5 bg-black/35 border-t border-white/[0.06] space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
          <span>Exercises</span>
          <span>Top Set</span>
        </div>

        <div className="space-y-1.5">
          {session.exercises.map((block) => {
            const meta = exerciseMap.get(block.exerciseId);
            const working = getWorkingSets(block.sets);
            if (!meta || working.length === 0) return null;

            const bestSet = working.reduce(
              (best, cur) =>
                calculateEstimated1RM(cur.weightKg, cur.reps) >
                calculateEstimated1RM(best.weightKg, best.reps)
                  ? cur
                  : best,
              working[0]
            );
            const best1RM = calculateEstimated1RM(bestSet.weightKg, bestSet.reps);
            const blockHasPR = working.some((s) => s.prs && s.prs.length > 0);
            const exPalette = getMusclePalette(meta.primaryMuscle);
            let workingIdx = 0;

            return (
              <div key={block.id} className="rounded-[14px] bg-[#2c2c2e]/75 p-2.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenExerciseDetail(meta.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenExerciseDetail(meta.id);
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-full font-mono-num font-bold text-xs flex items-center justify-center shrink-0 ${exPalette.badgeClass}`}>
                      {working.length}×
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-white hover:underline truncate">
                      {meta.name}
                    </span>
                    {blockHasPR && <Award className={`w-3.5 h-3.5 ${exPalette.textClass} shrink-0`} />}
                  </div>
                  <div className="text-right font-mono-num shrink-0">
                    <span className="text-xs font-bold text-white">
                      {kgToDisplay(bestSet.weightKg, unit)} {unit} × {bestSet.reps}
                    </span>
                    <span className="text-[10px] text-[#8e8e93] ml-1.5 hidden sm:inline">
                      (1RM {kgToDisplay(best1RM, unit)})
                    </span>
                  </div>
                </div>

                {showAllSets && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
                    {block.sets
                      .filter((s) => s.completed)
                      .map((s) => {
                        const isWarmup = s.type === 'warmup';
                        if (!isWarmup) workingIdx += 1;
                        const isPR = !!s.prs && s.prs.length > 0;
                        return (
                          <span
                            key={s.id}
                            className={`text-[11px] font-mono-num px-2.5 py-0.5 rounded-full ${
                              isPR
                                ? 'bg-[#a4ff00]/15 text-[#a4ff00] font-bold'
                                : isWarmup
                                ? 'bg-black/40 text-[#8e8e93]'
                                : 'bg-black/60 text-white'
                            }`}
                          >
                            <span className="text-[#8e8e93] mr-1">
                              {setBadgeLabel(s.type, workingIdx)}:
                            </span>
                            {kgToDisplay(s.weightKg, unit)}
                            {unit} × {s.reps}
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canToggleSets && (
          <button
            type="button"
            onClick={onToggleSets}
            className={`w-full pt-1 text-[11px] font-semibold ${palette.textClass} flex items-center justify-center gap-1`}
          >
            {showAllSets ? (
              <>
                Hide Individual Sets <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                {totals.workingSets === 1 ? 'Show Set' : `Show All ${totals.workingSets} Sets`}{' '}
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
};

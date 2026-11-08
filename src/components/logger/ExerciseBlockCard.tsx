import React from 'react';
import { Award, Check, Minus, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { Exercise, WeightUnit, WorkoutExercise, WorkoutSet } from '../../types/workout';
import { MUSCLE_LABELS } from '../../data/seedExercises';
import type { getLastPerformedExerciseBlock } from '../../utils/analytics';
import type { evaluateExercisePrescription } from '../../utils/trainerEngine';
import { displayToKg, kgToDisplay } from '../../utils/calculators';
import { getMusclePalette } from '../../utils/splitTheme';
import { setBadgeLabel, setBadgeStyle } from '../../utils/setTypes';
import { NumericInput } from '../common/NumericInput';

export interface ExerciseInsight {
  lastPerf: ReturnType<typeof getLastPerformedExerciseBlock>;
  statDiag: ReturnType<typeof evaluateExercisePrescription>;
}

interface ExerciseBlockCardProps {
  block: WorkoutExercise;
  meta: Exercise;
  insight: ExerciseInsight;
  /** Rep range to aim for (the programme week's, or the exercise's own). */
  targetRange: [number, number];
  /**
   * Show the history-based coach hint. Off during a programme, whose weekly
   * targets would otherwise conflict with it.
   */
  showInsight: boolean;
  unit: WeightUnit;
  inputUnit: WeightUnit;
  onToggleInputUnit: () => void;
  onUpdateSet: (setId: string, update: (s: WorkoutSet) => WorkoutSet) => void;
  /** Applies new weight/reps to every set not done yet. */
  onSetRemaining: (weightKg: number, reps: number) => void;
  onToggleComplete: (set: WorkoutSet) => void;
  onCycleSetType: (set: WorkoutSet) => void;
  onAddSet: () => void;
  onRemoveLastSet: () => void;
  onSwap: () => void;
  onRemove: () => void;
  onFocusField: (setId: string, field: 'weight' | 'reps') => void;
  onOpenExerciseDetail: (exerciseId: string) => void;
}

/** One exercise in the live workout: coach hints plus its set rows. */
export const ExerciseBlockCard: React.FC<ExerciseBlockCardProps> = ({
  block,
  meta,
  insight,
  targetRange,
  showInsight,
  unit,
  inputUnit,
  onToggleInputUnit,
  onUpdateSet,
  onSetRemaining,
  onToggleComplete,
  onCycleSetType,
  onAddSet,
  onRemoveLastSet,
  onSwap,
  onRemove,
  onFocusField,
  onOpenExerciseDetail,
}) => {
  const { lastPerf, statDiag } = insight;
  const palette = getMusclePalette(meta.primaryMuscle);
  const [minReps, maxReps] = targetRange;
  const previousWorkingSets = lastPerf
    ? lastPerf.exerciseBlock.sets.filter((s) => s.type !== 'warmup')
    : [];

  const completedWorking = block.sets.filter((s) => s.completed && s.type !== 'warmup');
  const latestDone = completedWorking[completedWorking.length - 1];
  const hasRemaining = block.sets.some((s) => !s.completed && s.type !== 'warmup');
  const incrementKg = meta.equipment === 'barbell' || meta.equipment === 'machine' ? 2.5 : 2;
  const beatRange = !!latestDone && latestDone.reps >= maxReps + 1;
  const belowRange = !!latestDone && latestDone.reps < minReps;

  let workingIndex = 0;

  return (
    <div
      style={palette.cardGlowStyle}
      className={`af-card border ${palette.cardBorderClass} p-3.5 sm:p-4 space-y-3`}
    >
      {/* Title + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${palette.badgeClass}`}>
              {MUSCLE_LABELS[meta.primaryMuscle]}
            </span>
            <button
              type="button"
              onClick={() => onOpenExerciseDetail(meta.id)}
              className="text-sm sm:text-base font-bold text-white hover:underline text-left truncate"
            >
              {meta.name}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#8e8e93] mt-1 font-mono-num flex-wrap">
            <span>
              Target {minReps}–{maxReps} reps
            </span>
            <span>•</span>
            <span>{block.restSeconds}s rest</span>
            {showInsight && statDiag.hasMeaningfulInsight && (
              <>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 ${palette.textClass} font-semibold`}>
                  <Sparkles className="w-3 h-3" /> {statDiag.headline} ({statDiag.statBadge})
                </span>
                {hasRemaining && (
                  <button
                    type="button"
                    onClick={() =>
                      onSetRemaining(statDiag.recommendedWeightKg, statDiag.recommendedReps)
                    }
                    className="px-2 py-0.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[10px] font-bold text-white transition"
                  >
                    Apply {kgToDisplay(statDiag.recommendedWeightKg, unit)}
                    {unit}×{statDiag.recommendedReps}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onSwap}
            className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
            title="Swap exercise"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-[#fa114f]"
            title="Remove exercise"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live tip after a set that missed or beat the rep range */}
      {hasRemaining && (beatRange || belowRange) && latestDone && (
        <div className="bg-black/50 border border-white/[0.07] rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
          {beatRange ? (
            <>
              <span className="text-[#d1d1d6] text-[11px]">
                <strong className={palette.textClass}>Coach Tip:</strong> Hit{' '}
                {latestDone.reps} reps (above {minReps}–{maxReps}) — ready to bump the
                remaining sets!
              </span>
              <button
                type="button"
                onClick={() =>
                  onSetRemaining(Number((latestDone.weightKg + incrementKg).toFixed(2)), minReps)
                }
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${palette.solidPillClass}`}
              >
                +{kgToDisplay(incrementKg, unit)} {unit} Next Sets
              </button>
            </>
          ) : (
            <>
              <span className="text-[#d1d1d6] text-[11px]">
                <strong className="text-[#ffe620]">Fatigue Alert:</strong> Reps dropped below{' '}
                {minReps}. Rest 3 min or reduce the load ~5% to stay in your target range.
              </span>
              <button
                type="button"
                onClick={() =>
                  onSetRemaining(
                    Math.max(2.5, Math.round((latestDone.weightKg * 0.925) / 2.5) * 2.5),
                    minReps
                  )
                }
                className="px-2.5 py-1 rounded-full bg-[#2c2c2e] text-white text-[10px] font-bold shrink-0"
              >
                -7.5% Load
              </button>
            </>
          )}
        </div>
      )}

      {/* Set table */}
      <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] px-1">
        <div className="col-span-2">Set</div>
        <div className="col-span-3">Prev</div>
        <div className="col-span-3 text-center flex items-center justify-center">
          <button
            type="button"
            onClick={onToggleInputUnit}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#a4ff00] font-mono-num font-bold text-[9px] transition"
            title="Switch weight input between KG and LB"
          >
            {inputUnit.toUpperCase()}
          </button>
        </div>
        <div className="col-span-2 text-center">Reps</div>
        <div className="col-span-2 text-right">Done</div>
      </div>

      <div className="space-y-1.5">
        {block.sets.map((set) => {
          if (set.type !== 'warmup') workingIndex += 1;
          const prevSet =
            set.type === 'warmup'
              ? undefined
              : previousWorkingSets[workingIndex - 1] ||
                previousWorkingSets[previousWorkingSets.length - 1];
          const hasPR = !!set.prs && set.prs.length > 0;

          return (
            <div
              key={set.id}
              className={`grid grid-cols-12 gap-1.5 items-center p-1.5 rounded-[16px] transition-all ${
                set.completed ? palette.ringClass : 'bg-black/45'
              }`}
            >
              <div className="col-span-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onCycleSetType(set)}
                  title="Tap to change set type (working, warm-up, drop set, failure)"
                  className={`w-7 h-7 rounded-full text-xs font-bold font-mono-num flex items-center justify-center ${setBadgeStyle(set.type)}`}
                >
                  {setBadgeLabel(set.type, workingIndex)}
                </button>
              </div>

              <div className="col-span-3 min-w-0">
                {hasPR ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffe620]/20 text-[#ffe620]">
                    <Award className="w-3 h-3" /> PR
                  </span>
                ) : prevSet ? (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSet(set.id, (cur) => ({
                        ...cur,
                        weightKg: prevSet.weightKg,
                        reps: prevSet.reps,
                      }))
                    }
                    title="Copy last time's weight and reps"
                    className="text-xs font-mono-num text-[#8e8e93] hover:text-white truncate block w-full text-left"
                  >
                    {kgToDisplay(prevSet.weightKg, inputUnit)}×{prevSet.reps}
                  </button>
                ) : (
                  <span className="text-xs text-[#48484a]">—</span>
                )}
              </div>

              <div className="col-span-3">
                <NumericInput
                  decimal
                  aria-label={`Set ${workingIndex} weight`}
                  placeholder="0"
                  value={kgToDisplay(set.weightKg, inputUnit)}
                  onFocus={() => onFocusField(set.id, 'weight')}
                  onValueChange={(v) =>
                    onUpdateSet(set.id, (cur) => ({ ...cur, weightKg: displayToKg(v, inputUnit) }))
                  }
                  className="w-full bg-[#2c2c2e] focus:ring-1 focus:ring-white/40 rounded-xl py-1.5 text-center text-sm font-bold font-mono-num text-white placeholder-[#636366] focus:outline-none"
                />
              </div>

              <div className="col-span-2">
                <NumericInput
                  aria-label={`Set ${workingIndex} reps`}
                  placeholder="0"
                  value={set.reps}
                  onFocus={() => onFocusField(set.id, 'reps')}
                  onValueChange={(v) => onUpdateSet(set.id, (cur) => ({ ...cur, reps: v }))}
                  className="w-full bg-[#2c2c2e] focus:ring-1 focus:ring-white/40 rounded-xl py-1.5 text-center text-sm font-bold font-mono-num text-white placeholder-[#636366] focus:outline-none"
                />
              </div>

              <div className="col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onToggleComplete(set)}
                  aria-label={set.completed ? 'Mark set not done' : 'Mark set done'}
                  aria-pressed={set.completed}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    set.completed
                      ? palette.solidPillClass
                      : 'bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93]'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.75]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onAddSet}
          className="flex-1 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs font-semibold text-white inline-flex items-center justify-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5 text-[#a4ff00]" /> Add Set
        </button>
        {block.sets.length > 1 && (
          <button
            type="button"
            onClick={onRemoveLastSet}
            className="px-3 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs text-[#8e8e93] hover:text-[#fa114f] inline-flex items-center justify-center transition"
            title="Remove last set"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

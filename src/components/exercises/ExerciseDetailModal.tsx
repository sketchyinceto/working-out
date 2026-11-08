import React, { useMemo } from 'react';
import { Award, Pencil, Sparkles, X } from 'lucide-react';
import { Exercise, WeightUnit, WorkoutSession } from '../../types/workout';
import { MUSCLE_LABELS } from '../../data/seedExercises';
import { getExerciseProgressionSeries } from '../../utils/analytics';
import { kgToDisplay } from '../../utils/calculators';
import { getMusclePalette } from '../../utils/splitTheme';
import { evaluateExercisePrescription } from '../../utils/trainerEngine';
import { ProgressionChart } from '../analytics/ProgressionChart';
import { ExerciseDiagram } from './ExerciseDiagram';

interface ExerciseDetailModalProps {
  exercise: Exercise;
  workouts: WorkoutSession[];
  unit: WeightUnit;
  onClose: () => void;
  /** Shown for custom exercises only. */
  onEdit?: (exercise: Exercise) => void;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  exercise,
  workouts,
  unit,
  onClose,
  onEdit,
}) => {
  const palette = getMusclePalette(exercise.primaryMuscle);

  const activeSeries = useMemo(
    () => getExerciseProgressionSeries(exercise.id, workouts, null),
    [exercise.id, workouts]
  );

  const statPrescription = useMemo(
    () => evaluateExercisePrescription(exercise, workouts, [exercise], unit),
    [exercise, workouts, unit]
  );

  const showStatisticalTarget =
    statPrescription.hasMeaningfulInsight &&
    (statPrescription.status === 'overload_weight' ||
      statPrescription.status === 'pr_momentum');

  const bestE1RMKg = useMemo(() => {
    if (activeSeries.length === 0) return 0;
    return Math.max(...activeSeries.map((s) => s.bestE1RMKg));
  }, [activeSeries]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        style={palette.cardGlowStyle}
        className={`w-full max-w-2xl bg-[#1c1c1e] border-t sm:border ${palette.cardBorderClass} rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.badgeClass}`}
              >
                {palette.key} • {MUSCLE_LABELS[exercise.primaryMuscle]}
              </span>
              <span className="text-xs text-[#8e8e93] capitalize">
                {exercise.equipment.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1 truncate">
              {exercise.name}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {exercise.isCustom && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(exercise)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#2c2c2e] text-xs font-semibold text-white hover:bg-[#3a3a3c]"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
              aria-label="Close exercise details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full Biomechanical Movement Diagram + Form Cue */}
        <div className="space-y-2">
          <ExerciseDiagram exercise={exercise} size="lg" />
          {exercise.cues && (
            <div className="bg-[#2c2c2e] rounded-xl px-3.5 py-2.5 text-xs text-white">
              <strong className={palette.textClass}>Form Cue:</strong> {exercise.cues}
            </div>
          )}
        </div>

        <div className="bg-black/45 border border-white/[0.06] rounded-[18px] p-3.5">
          <ProgressionChart
            data={activeSeries}
            unit={unit}
            splitKey={palette.key}
            height={175}
          />
        </div>

        {showStatisticalTarget && (
          <div className="bg-[#2c2c2e] rounded-[16px] px-3.5 py-2.5 space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-white font-semibold">
                <Sparkles className={`w-3.5 h-3.5 ${palette.textClass} shrink-0`} />{' '}
                Suggested Target ({statPrescription.statBadge})
              </span>
              <span className={`font-mono-num font-bold ${palette.textClass}`}>
                {kgToDisplay(statPrescription.recommendedWeightKg, unit)} {unit} ×{' '}
                {statPrescription.recommendedReps}
              </span>
            </div>
            <p className="text-[11px] text-[#8e8e93] leading-snug">
              {statPrescription.coachTip}
            </p>
          </div>
        )}

        {/* Rep-Max Projection Table */}
        {bestE1RMKg > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] mb-2 flex items-center gap-1.5">
              <Award className={`w-3.5 h-3.5 ${palette.textClass}`} /> Rep-Max Projections
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { rm: '1RM', pct: 1.0 },
                { rm: '3RM', pct: 0.92 },
                { rm: '5RM', pct: 0.86 },
                { rm: '8RM', pct: 0.79 },
                { rm: '10RM', pct: 0.75 },
                { rm: '12RM', pct: 0.7 },
              ].map((row) => (
                <div
                  key={row.rm}
                  className="bg-[#2c2c2e] rounded-xl p-2 text-center"
                >
                  <div className="text-[10px] font-bold text-[#8e8e93]">
                    {row.rm}
                  </div>
                  <div className="text-xs sm:text-sm font-bold font-mono-num text-white mt-0.5">
                    {kgToDisplay(bestE1RMKg * row.pct, unit)} {unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Log History */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93] mb-2">
            History ({activeSeries.length})
          </h3>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {[...activeSeries].reverse().map((pt) => (
              <div
                key={pt.sessionId}
                className="flex items-center justify-between text-xs bg-[#2c2c2e]/75 rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#8e8e93] w-14">{pt.shortDate}</span>
                  <span className="font-mono-num text-white font-bold">
                    {kgToDisplay(pt.heaviestWeightKg, unit)} {unit} × {pt.bestWeightReps}
                  </span>
                  {pt.hasPR && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] font-bold">
                      PR
                    </span>
                  )}
                </div>
                <div className="text-[#8e8e93] font-mono-num text-[11px]">
                  1RM <span className="text-white font-bold">{kgToDisplay(pt.bestE1RMKg, unit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

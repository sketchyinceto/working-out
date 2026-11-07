import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ActiveWorkoutDraft,
  Exercise,
  SetType,
  WeightUnit,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../types/workout';
import { MUSCLE_LABELS, searchExercises } from '../../data/seedExercises';
import {
  evaluateSetPRs,
  getLastPerformedExerciseBlock,
} from '../../utils/analytics';
import { evaluateExercisePrescription } from '../../utils/trainerEngine';
import {
  displayToKg,
  formatVolume,
  kgToDisplay,
} from '../../utils/calculators';
import { getMusclePalette, getSplitPalette } from '../../utils/splitTheme';

interface ActiveWorkoutViewProps {
  draft: ActiveWorkoutDraft;
  exercises: Exercise[];
  workouts: WorkoutSession[];
  unit: WeightUnit;
  onUpdateDraft: (updated: ActiveWorkoutDraft) => void;
  onFinishWorkout: () => void;
  onDiscardWorkout: () => void;
  onStartRestTimer: (durationSeconds: number, exerciseName: string) => void;
  onOpenExerciseDetail: (exerciseId: string) => void;
}

const SET_TYPE_ORDER: SetType[] = ['working', 'warmup', 'dropset', 'failure'];

export const ActiveWorkoutView: React.FC<ActiveWorkoutViewProps> = ({
  draft,
  exercises,
  workouts,
  unit,
  onUpdateDraft,
  onFinishWorkout,
  onDiscardWorkout,
  onStartRestTimer,
  onOpenExerciseDetail,
}) => {
  const [inputUnit, setInputUnit] = useState<WeightUnit>(unit);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    Math.max(0, Math.floor((Date.now() - new Date(draft.startTime).getTime()) / 1000))
  );
  const [focusedCell, setFocusedCell] = useState<{
    blockId: string;
    setId: string;
    field: 'weight' | 'reps';
  } | null>(null);
  const [editingRawValue, setEditingRawValue] = useState<string | null>(null);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [swapBlockId, setSwapBlockId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - new Date(draft.startTime).getTime()) / 1000))
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [draft.startTime]);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const sessionStats = useMemo(() => {
    let completedSets = 0;
    let anyCompletedSet = false;
    let totalVolumeKg = 0;

    for (const block of draft.exercises) {
      for (const s of block.sets) {
        if (s.completed) {
          anyCompletedSet = true;
          if (s.type !== 'warmup') {
            completedSets += 1;
            totalVolumeKg += s.weightKg * s.reps;
          }
        }
      }
    }
    return { completedSets, anyCompletedSet, totalVolumeKg };
  }, [draft.exercises]);

  const updateSet = (
    blockId: string,
    setId: string,
    updater: (s: WorkoutSet, block: WorkoutExercise) => WorkoutSet
  ) => {
    const nextExercises = draft.exercises.map((block) => {
      if (block.id !== blockId) return block;
      const nextSets = block.sets.map((s) => {
        if (s.id !== setId) return s;
        const updated = updater(s, block);
        if (updated.completed && updated.type !== 'warmup') {
          updated.prs = evaluateSetPRs(block.exerciseId, updated, workouts);
        } else {
          updated.prs = undefined;
        }
        return updated;
      });
      return { ...block, sets: nextSets };
    });
    onUpdateDraft({ ...draft, exercises: nextExercises });
  };

  const handleToggleComplete = (block: WorkoutExercise, set: WorkoutSet) => {
    const meta = exerciseMap.get(block.exerciseId);
    const nextCompleted = !set.completed;

    updateSet(block.id, set.id, (cur) => ({
      ...cur,
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
    }));

    if (nextCompleted) {
      onStartRestTimer(
        block.restSeconds || meta?.defaultRestSeconds || 120,
        meta?.name || 'Exercise'
      );
    }
  };

  const handleCycleSetType = (blockId: string, set: WorkoutSet) => {
    const nextType =
      SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(set.type) + 1) % SET_TYPE_ORDER.length];
    updateSet(blockId, set.id, (cur) => ({ ...cur, type: nextType }));
  };

  const handleAddSet = (block: WorkoutExercise) => {
    const lastSet = block.sets[block.sets.length - 1];
    const newSet: WorkoutSet = {
      id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      setNumber: block.sets.length + 1,
      type: 'working',
      weightKg: lastSet ? lastSet.weightKg : 20,
      reps: lastSet ? lastSet.reps : 10,
      completed: false,
    };
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.map((b) =>
        b.id === block.id ? { ...b, sets: [...b.sets, newSet] } : b
      ),
    });
  };

  const handleRemoveLastSet = (block: WorkoutExercise) => {
    if (block.sets.length <= 1) return;
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.map((b) =>
        b.id === block.id ? { ...b, sets: b.sets.slice(0, -1) } : b
      ),
    });
  };

  const handleAddOrSwapExercise = (exercise: Exercise) => {
    const lastPerf = getLastPerformedExerciseBlock(exercise.id, workouts);
    const defaultSets: WorkoutSet[] = lastPerf
      ? lastPerf.exerciseBlock.sets
          .filter((s) => s.type !== 'warmup')
          .slice(0, 3)
          .map((s, i) => ({
            id: `s-${Date.now()}-${i}`,
            setNumber: i + 1,
            type: 'working',
            weightKg: s.weightKg,
            reps: s.reps,
            completed: false,
          }))
      : [1, 2, 3].map((n) => ({
          id: `s-${Date.now()}-${n}`,
          setNumber: n,
          type: 'working',
          weightKg: exercise.barWeightKg || 20,
          reps: exercise.targetRepRange[0],
          completed: false,
        }));

    if (swapBlockId) {
      onUpdateDraft({
        ...draft,
        exercises: draft.exercises.map((b) =>
          b.id === swapBlockId
            ? {
                ...b,
                exerciseId: exercise.id,
                restSeconds: exercise.defaultRestSeconds,
                sets: defaultSets,
              }
            : b
        ),
      });
      setSwapBlockId(null);
    } else {
      const newBlock: WorkoutExercise = {
        id: `we-${Date.now()}`,
        exerciseId: exercise.id,
        restSeconds: exercise.defaultRestSeconds,
        sets: defaultSets,
      };
      onUpdateDraft({
        ...draft,
        exercises: [...draft.exercises, newBlock],
      });
    }
    setShowAddExerciseModal(false);
    setExerciseSearch('');
  };

  const handleRemoveExerciseBlock = (blockId: string) => {
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.filter((b) => b.id !== blockId),
    });
  };

  const applyQuickStep = (delta: number) => {
    if (!focusedCell) return;
    setEditingRawValue(null);
    updateSet(focusedCell.blockId, focusedCell.setId, (cur) => {
      if (focusedCell.field === 'weight') {
        const curDisp = kgToDisplay(cur.weightKg, inputUnit);
        const nextDisp = Math.max(0, Number((curDisp + delta).toFixed(2)));
        return { ...cur, weightKg: displayToKg(nextDisp, inputUnit) };
      } else {
        const nextReps = Math.max(0, cur.reps + delta);
        return { ...cur, reps: nextReps };
      }
    });
  };

  const weightSteps =
    inputUnit === 'kg'
      ? [-2.5, -1.25, +1.25, +2.5, +5]
      : [-5, -2.5, +2.5, +5, +10];
  const repSteps = [-2, -1, +1, +2];

  const filteredExercises = useMemo(
    () => searchExercises(exercises, exerciseSearch),
    [exercises, exerciseSearch]
  );

  const headerPalette = getSplitPalette(draft.splitTag);

  return (
    <div className="space-y-3.5 pb-28">
      {/* Apple Watch / Apple Fitness Sticky Workout Header */}
      <div
        style={headerPalette.cardGlowStyle}
        className={`sticky top-14 z-30 bg-[#1c1c1e]/95 backdrop-blur-2xl border ${headerPalette.cardBorderClass} rounded-[22px] p-3.5 shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${headerPalette.badgeClass}`}
              >
                {draft.splitTag}
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => onUpdateDraft({ ...draft, name: e.target.value })}
                className="text-sm sm:text-base font-bold text-white bg-transparent focus:outline-none truncate w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-num mt-0.5 text-[#8e8e93]">
              <span
                className={`inline-flex items-center gap-1 ${headerPalette.textClass} font-bold`}
              >
                <Clock className="w-3 h-3" /> {formatDuration(elapsedSeconds)}
              </span>
              <span>•</span>
              <span className="text-white font-semibold">{sessionStats.completedSets} sets</span>
              <span>•</span>
              <span className="text-white font-semibold">
                {formatVolume(sessionStats.totalVolumeKg, unit)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onDiscardWorkout}
              className="p-2 rounded-full bg-[#2c2c2e] hover:bg-[#fa114f]/20 text-[#8e8e93] hover:text-[#fa114f] transition"
              title="Discard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onFinishWorkout}
              disabled={!sessionStats.anyCompletedSet}
              title={
                sessionStats.anyCompletedSet
                  ? 'Finish and save workout'
                  : 'Complete at least one set to finish'
              }
              className={`px-4 py-2 rounded-full font-bold text-xs transition ${
                sessionStats.anyCompletedSet
                  ? headerPalette.buttonClass
                  : 'bg-[#2c2c2e] text-[#636366] cursor-not-allowed'
              }`}
            >
              End
            </button>
          </div>
        </div>
      </div>

      {/* Exercise Cards */}
      <div className="space-y-3.5">
        {draft.exercises.map((block) => {
          const meta = exerciseMap.get(block.exerciseId);
          if (!meta) return null;

          const exPalette = getMusclePalette(meta.primaryMuscle);
          const lastPerf = getLastPerformedExerciseBlock(meta.id, workouts);
          const statDiag = evaluateExercisePrescription(
            meta,
            workouts,
            exercises,
            unit
          );
          const previousWorkingSets = lastPerf
            ? lastPerf.exerciseBlock.sets.filter((s) => s.type !== 'warmup')
            : [];

          const completedWorkingSets = block.sets.filter(
            (s) => s.completed && s.type !== 'warmup'
          );
          const latestCompletedWorking =
            completedWorkingSets[completedWorkingSets.length - 1];
          const hasUncompletedWorking = block.sets.some(
            (s) => !s.completed && s.type !== 'warmup'
          );
          const incrementKg =
            meta.equipment === 'barbell' || meta.equipment === 'machine'
              ? 2.5
              : 2;

          let workingIndex = 0;

          return (
            <div
              key={block.id}
              style={exPalette.cardGlowStyle}
              className={`af-card border ${exPalette.cardBorderClass} p-3.5 sm:p-4 space-y-3`}
            >
              {/* Title + Action Icons */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${exPalette.badgeClass}`}
                    >
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

                  {/* Subtitle: Only show Coach Insight when a statistical trend exists */}
                  <div className="flex items-center gap-2 text-[11px] text-[#8e8e93] mt-1 font-mono-num flex-wrap">
                    <span>
                      Target {meta.targetRepRange[0]}–{meta.targetRepRange[1]} reps
                    </span>
                    <span>•</span>
                    <span>{block.restSeconds}s rest</span>
                    {statDiag.hasMeaningfulInsight && (
                      <>
                        <span>•</span>
                        <span
                          className={`inline-flex items-center gap-1 ${exPalette.textClass} font-semibold`}
                        >
                          <Sparkles className="w-3 h-3" /> {statDiag.headline} (
                          {statDiag.statBadge})
                        </span>
                        {hasUncompletedWorking && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateDraft({
                                ...draft,
                                exercises: draft.exercises.map((b) =>
                                  b.id === block.id
                                    ? {
                                        ...b,
                                        sets: b.sets.map((s) =>
                                          !s.completed && s.type !== 'warmup'
                                            ? {
                                                ...s,
                                                weightKg:
                                                  statDiag.recommendedWeightKg,
                                                reps: statDiag.recommendedReps,
                                              }
                                            : s
                                        ),
                                      }
                                    : b
                                ),
                              });
                            }}
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
                    onClick={() => {
                      setSwapBlockId(block.id);
                      setShowAddExerciseModal(true);
                    }}
                    className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
                    title="Swap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveExerciseBlock(block.id)}
                    className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-[#fa114f]"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Live Set-by-Set Auto-Regulation Coach Tip */}
              {latestCompletedWorking &&
                hasUncompletedWorking &&
                (latestCompletedWorking.reps >= meta.targetRepRange[1] + 1 ||
                  latestCompletedWorking.reps < meta.targetRepRange[0]) && (
                  <div className="bg-black/50 border border-white/[0.07] rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    {latestCompletedWorking.reps >=
                    meta.targetRepRange[1] + 1 ? (
                      <>
                        <span className="text-[#d1d1d6] text-[11px]">
                          <strong className={exPalette.textClass}>
                            Coach Tip:
                          </strong>{' '}
                          Hit {latestCompletedWorking.reps} reps (top of{' '}
                          {meta.targetRepRange[0]}–{meta.targetRepRange[1]}{' '}
                          range) — ready to bump remaining sets!
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextW = Number(
                              (
                                latestCompletedWorking.weightKg + incrementKg
                              ).toFixed(2)
                            );
                            onUpdateDraft({
                              ...draft,
                              exercises: draft.exercises.map((b) =>
                                b.id === block.id
                                  ? {
                                      ...b,
                                      sets: b.sets.map((s) =>
                                        !s.completed && s.type !== 'warmup'
                                          ? {
                                              ...s,
                                              weightKg: nextW,
                                              reps: meta.targetRepRange[0],
                                            }
                                          : s
                                      ),
                                    }
                                  : b
                              ),
                            });
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${exPalette.solidPillClass}`}
                        >
                          +{kgToDisplay(incrementKg, unit)} {unit} Next Sets
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-[#d1d1d6] text-[11px]">
                          <strong className="text-[#ffe620]">
                            Fatigue Alert:
                          </strong>{' '}
                          Reps dropped below {meta.targetRepRange[0]}. Rest 3m
                          or reduce load ~5% to stay in target zone.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const reducedW = Math.max(
                              2.5,
                              Math.round(
                                (latestCompletedWorking.weightKg * 0.925) / 2.5
                              ) * 2.5
                            );
                            onUpdateDraft({
                              ...draft,
                              exercises: draft.exercises.map((b) =>
                                b.id === block.id
                                  ? {
                                      ...b,
                                      sets: b.sets.map((s) =>
                                        !s.completed && s.type !== 'warmup'
                                          ? {
                                              ...s,
                                              weightKg: reducedW,
                                              reps: meta.targetRepRange[0],
                                            }
                                          : s
                                      ),
                                    }
                                  : b
                              ),
                            });
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#2c2c2e] text-white text-[10px] font-bold shrink-0"
                        >
                          -7.5% Load
                        </button>
                      </>
                    )}
                  </div>
                )}

              {/* Clean Set Table Header */}
              <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] px-1">
                <div className="col-span-2">Set</div>
                <div className="col-span-3">Prev</div>
                <div className="col-span-3 text-center flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setInputUnit((u) => (u === 'kg' ? 'lbs' : 'kg'))}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#a4ff00] font-mono-num font-bold text-[9px] transition"
                    title="Tap to toggle weight input unit between KG and LB"
                  >
                    {inputUnit.toUpperCase()}
                  </button>
                </div>
                <div className="col-span-2 text-center">Reps</div>
                <div className="col-span-2 text-right">Done</div>
              </div>

              {/* Set Rows */}
              <div className="space-y-1.5">
                {block.sets.map((set) => {
                  if (set.type !== 'warmup') workingIndex += 1;
                  const prevSet =
                    set.type === 'warmup'
                      ? undefined
                      : previousWorkingSets[workingIndex - 1] ||
                        previousWorkingSets[previousWorkingSets.length - 1];

                  const setBadgeStyle =
                    set.type === 'warmup'
                      ? 'bg-[#ffe620]/20 text-[#ffe620]'
                      : set.type === 'dropset'
                      ? 'bg-[#bf5af2]/20 text-[#bf5af2]'
                      : set.type === 'failure'
                      ? 'bg-[#fa114f]/20 text-[#fa114f]'
                      : 'bg-[#2c2c2e] text-white';

                  const setBadgeLabel =
                    set.type === 'warmup'
                      ? 'W'
                      : set.type === 'dropset'
                      ? 'D'
                      : set.type === 'failure'
                      ? 'F'
                      : String(workingIndex);

                  const displayWeightVal = kgToDisplay(set.weightKg, inputUnit);
                  const hasPR = set.prs && set.prs.length > 0;

                  return (
                    <div
                      key={set.id}
                      className={`grid grid-cols-12 gap-1.5 items-center p-1.5 rounded-[16px] transition-all ${
                        set.completed
                          ? `${exPalette.ringClass}`
                          : 'bg-black/45'
                      }`}
                    >
                      {/* Set Badge */}
                      <div className="col-span-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCycleSetType(block.id, set)}
                          className={`w-7 h-7 rounded-full text-xs font-bold font-mono-num flex items-center justify-center ${setBadgeStyle}`}
                        >
                          {setBadgeLabel}
                        </button>
                      </div>

                      {/* Previous Set (or PR Badge if completed PR) */}
                      <div className="col-span-3 min-w-0">
                        {hasPR ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffe620]/20 text-[#ffe620]">
                            <Award className="w-3 h-3" /> PR
                          </span>
                        ) : prevSet ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateSet(block.id, set.id, (cur) => ({
                                ...cur,
                                weightKg: prevSet.weightKg,
                                reps: prevSet.reps,
                              }))
                            }
                            className="text-xs font-mono-num text-[#8e8e93] hover:text-white truncate block w-full text-left"
                          >
                            {kgToDisplay(prevSet.weightKg, inputUnit)}×{prevSet.reps}
                          </button>
                        ) : (
                          <span className="text-xs text-[#48484a]">—</span>
                        )}
                      </div>

                      {/* Weight Input */}
                      <div className="col-span-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={
                            focusedCell?.blockId === block.id &&
                            focusedCell?.setId === set.id &&
                            focusedCell?.field === 'weight' &&
                            editingRawValue !== null
                              ? editingRawValue
                              : displayWeightVal === 0
                              ? ''
                              : String(displayWeightVal)
                          }
                          onFocus={() => {
                            setFocusedCell({
                              blockId: block.id,
                              setId: set.id,
                              field: 'weight',
                            });
                            setEditingRawValue(
                              displayWeightVal === 0 ? '' : String(displayWeightVal)
                            );
                          }}
                          onBlur={() => setEditingRawValue(null)}
                          onChange={(e) => {
                            const cleaned = e.target.value
                              .replace(/[^0-9.]/g, '')
                              .replace(/^0+(?=\d)/, '');
                            setEditingRawValue(cleaned);
                            const val = parseFloat(cleaned);
                            updateSet(block.id, set.id, (cur) => ({
                              ...cur,
                              weightKg: isNaN(val)
                                ? 0
                                : displayToKg(Math.max(0, val), inputUnit),
                            }));
                          }}
                          className="w-full bg-[#2c2c2e] focus:ring-1 focus:ring-white/40 rounded-xl py-1.5 text-center text-sm font-bold font-mono-num text-white placeholder-[#636366] focus:outline-none"
                        />
                      </div>

                      {/* Reps Input */}
                      <div className="col-span-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={
                            focusedCell?.blockId === block.id &&
                            focusedCell?.setId === set.id &&
                            focusedCell?.field === 'reps' &&
                            editingRawValue !== null
                              ? editingRawValue
                              : set.reps === 0
                              ? ''
                              : String(set.reps)
                          }
                          onFocus={() => {
                            setFocusedCell({
                              blockId: block.id,
                              setId: set.id,
                              field: 'reps',
                            });
                            setEditingRawValue(set.reps === 0 ? '' : String(set.reps));
                          }}
                          onBlur={() => setEditingRawValue(null)}
                          onChange={(e) => {
                            const cleaned = e.target.value
                              .replace(/[^0-9]/g, '')
                              .replace(/^0+(?=\d)/, '');
                            setEditingRawValue(cleaned);
                            const val = parseInt(cleaned, 10);
                            updateSet(block.id, set.id, (cur) => ({
                              ...cur,
                              reps: isNaN(val) ? 0 : Math.max(0, val),
                            }));
                          }}
                          className="w-full bg-[#2c2c2e] focus:ring-1 focus:ring-white/40 rounded-xl py-1.5 text-center text-sm font-bold font-mono-num text-white placeholder-[#636366] focus:outline-none"
                        />
                      </div>

                      {/* Done Checkmark */}
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(block, set)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            set.completed
                              ? exPalette.solidPillClass
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

              {/* Add / Remove Set Row */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleAddSet(block)}
                  className="flex-1 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs font-semibold text-white inline-flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-[#a4ff00]" /> Add Set
                </button>
                {block.sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLastSet(block)}
                    className="px-3 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs text-[#8e8e93] hover:text-[#fa114f] inline-flex items-center justify-center transition"
                    title="Remove last set"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Exercise Button */}
      <button
        type="button"
        onClick={() => {
          setSwapBlockId(null);
          setShowAddExerciseModal(true);
        }}
        className="w-full py-3.5 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.06] text-[#a4ff00] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition"
      >
        <Plus className="w-4 h-4" /> Add Exercise
      </button>

      {/* Bottom Thumb-Zone Quick-Stepper Pill Bar when an input is focused */}
      {focusedCell && (
        <div className="fixed bottom-16 inset-x-0 z-30 px-3 pb-2 pointer-events-none">
          <div className="max-w-md mx-auto bg-[#1c1c1e]/95 backdrop-blur-2xl border border-[#a4ff00]/40 rounded-full px-3.5 py-2 flex items-center justify-between gap-2 shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#a4ff00]">
                {focusedCell.field === 'weight' ? inputUnit.toUpperCase() : 'Reps'}
              </span>
              {focusedCell.field === 'weight' && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInputUnit((u) => (u === 'kg' ? 'lbs' : 'kg'));
                  }}
                  className="px-2 py-0.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[9px] font-bold text-white transition"
                >
                  {inputUnit === 'kg' ? 'Switch to LB' : 'Switch to KG'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {(focusedCell.field === 'weight' ? weightSteps : repSteps).map((step) => (
                <button
                  key={step}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyQuickStep(step);
                  }}
                  className="px-2.5 py-1 rounded-full bg-[#2c2c2e] active:bg-[#a4ff00] active:text-black text-xs font-mono-num font-bold text-white"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFocusedCell(null)}
                className="p-1 text-[#8e8e93] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Swap Exercise Picker Modal */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] sm:rounded-[26px] p-4 sm:p-5 space-y-3.5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {swapBlockId ? 'Swap Exercise' : 'Add Exercise'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddExerciseModal(false);
                  setSwapBlockId(null);
                }}
                className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search exercise or muscle (e.g. pec fly)..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="w-full bg-[#2c2c2e] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
            />

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleAddOrSwapExercise(ex)}
                  className="w-full text-left p-3 rounded-2xl bg-[#2c2c2e]/75 hover:bg-[#2c2c2e] flex items-center justify-between transition"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{ex.name}</div>
                    <div className="text-xs text-[#8e8e93]">
                      {MUSCLE_LABELS[ex.primaryMuscle]} • {ex.equipment.replace('_', ' ')}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-black px-3 py-1 rounded-full bg-[#a4ff00]">
                    Add
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

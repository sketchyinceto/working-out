import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import {
  ActiveWorkoutDraft,
  Exercise,
  WeightUnit,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../types/workout';
import { evaluateSetPRs, getLastPerformedExerciseBlock } from '../../utils/analytics';
import { evaluateExercisePrescription } from '../../utils/trainerEngine';
import { displayToKg, formatVolume, kgToDisplay } from '../../utils/calculators';
import { getSplitPalette } from '../../utils/splitTheme';
import { nextSetType } from '../../utils/setTypes';
import { pluralize } from '../../utils/text';
import { WEEK_KIND_LABEL, isCompound } from '../../utils/coach/programme';
import { ExerciseBlockCard, ExerciseInsight } from './ExerciseBlockCard';
import { ExercisePickerModal } from './ExercisePickerModal';
import { QuickStepBar } from './QuickStepBar';

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

/** Ticking session clock. Its own component so only it re-renders each second. */
const ElapsedTime: React.FC<{ startTime: string }> = ({ startTime }) => {
  const elapsed = () =>
    Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
  const [seconds, setSeconds] = useState(elapsed);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds(elapsed()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return <>{h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`}</>;
};

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
  const [focusedCell, setFocusedCell] = useState<{
    blockId: string;
    setId: string;
    field: 'weight' | 'reps';
  } | null>(null);
  // null = closed; 'add' = add an exercise; otherwise the block being swapped.
  const [picker, setPicker] = useState<'add' | { swapBlockId: string } | null>(null);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const toggleInputUnit = () => setInputUnit((u) => (u === 'kg' ? 'lbs' : 'kg'));

  const sessionStats = useMemo(() => {
    let completedSets = 0;
    let anyCompletedSet = false;
    let totalVolumeKg = 0;
    for (const block of draft.exercises) {
      for (const s of block.sets) {
        if (!s.completed) continue;
        anyCompletedSet = true;
        if (s.type !== 'warmup') {
          completedSets += 1;
          totalVolumeKg += s.weightKg * s.reps;
        }
      }
    }
    return { completedSets, anyCompletedSet, totalVolumeKg };
  }, [draft.exercises]);

  // Coach insights depend only on history, not on the live set inputs, so
  // compute them once per exercise instead of on every keystroke.
  const exerciseIdsKey = draft.exercises.map((b) => b.exerciseId).join('|');
  const insightsByExercise = useMemo(() => {
    const map = new Map<string, ExerciseInsight>();
    for (const exerciseId of new Set(exerciseIdsKey.split('|'))) {
      const meta = exerciseMap.get(exerciseId);
      if (!meta) continue;
      map.set(exerciseId, {
        lastPerf: getLastPerformedExerciseBlock(meta.id, workouts),
        statDiag: evaluateExercisePrescription(meta, workouts, exercises, unit),
      });
    }
    return map;
  }, [exerciseIdsKey, exerciseMap, workouts, exercises, unit]);

  // --- Draft updates ---

  const updateBlock = (blockId: string, update: (b: WorkoutExercise) => WorkoutExercise) =>
    onUpdateDraft({
      ...draft,
      exercises: draft.exercises.map((b) => (b.id === blockId ? update(b) : b)),
    });

  const updateSet = (blockId: string, setId: string, update: (s: WorkoutSet) => WorkoutSet) => {
    const block = draft.exercises.find((b) => b.id === blockId);
    const current = block?.sets.find((s) => s.id === setId);
    if (!block || !current) return;
    const updated = update(current);
    if (updated.completed && updated.type !== 'warmup') {
      // Compare against history *and* the other sets already done in this
      // session, so three identical sets don't all show as PRs.
      const thisSession: WorkoutSession = {
        id: draft.id,
        name: draft.name,
        startTime: draft.startTime,
        endTime: draft.startTime,
        durationMinutes: 0,
        exercises: draft.exercises.map((b) => ({
          ...b,
          sets: b.sets.filter((other) => other.completed && other.id !== setId),
        })),
      };
      updated.prs = evaluateSetPRs(block.exerciseId, updated, [thisSession, ...workouts]);
    } else {
      updated.prs = undefined;
    }
    updateBlock(blockId, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.id === setId ? updated : s)),
    }));
  };

  const setRemaining = (blockId: string, weightKg: number, reps: number) =>
    updateBlock(blockId, (b) => ({
      ...b,
      sets: b.sets.map((s) =>
        !s.completed && s.type !== 'warmup' ? { ...s, weightKg, reps } : s
      ),
    }));

  const toggleComplete = (block: WorkoutExercise, set: WorkoutSet) => {
    const meta = exerciseMap.get(block.exerciseId);
    const nowDone = !set.completed;
    updateSet(block.id, set.id, (cur) => ({
      ...cur,
      completed: nowDone,
      completedAt: nowDone ? new Date().toISOString() : undefined,
    }));
    if (nowDone) {
      onStartRestTimer(
        block.restSeconds || meta?.defaultRestSeconds || 120,
        meta?.name || 'Exercise'
      );
    }
  };

  const addSet = (block: WorkoutExercise) => {
    const last = block.sets[block.sets.length - 1];
    const newSet: WorkoutSet = {
      id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      setNumber: block.sets.length + 1,
      type: 'working',
      weightKg: last ? last.weightKg : 20,
      reps: last ? last.reps : 10,
      completed: false,
    };
    updateBlock(block.id, (b) => ({ ...b, sets: [...b.sets, newSet] }));
  };

  const pickExercise = (exercise: Exercise) => {
    const lastPerf = getLastPerformedExerciseBlock(exercise.id, workouts);
    const now = Date.now();
    const sets: WorkoutSet[] = lastPerf
      ? lastPerf.exerciseBlock.sets
          .filter((s) => s.type !== 'warmup')
          .slice(0, 3)
          .map((s, i) => ({
            id: `s-${now}-${i}`,
            setNumber: i + 1,
            type: 'working',
            weightKg: s.weightKg,
            reps: s.reps,
            completed: false,
          }))
      : [1, 2, 3].map((n) => ({
          id: `s-${now}-${n}`,
          setNumber: n,
          type: 'working' as const,
          weightKg: exercise.barWeightKg || 20,
          reps: exercise.targetRepRange[0],
          completed: false,
        }));

    if (picker && picker !== 'add') {
      updateBlock(picker.swapBlockId, (b) => ({
        ...b,
        exerciseId: exercise.id,
        notes: undefined,
        restSeconds: exercise.defaultRestSeconds,
        sets,
      }));
    } else {
      onUpdateDraft({
        ...draft,
        exercises: [
          ...draft.exercises,
          { id: `we-${now}`, exerciseId: exercise.id, restSeconds: exercise.defaultRestSeconds, sets },
        ],
      });
    }
    setPicker(null);
  };

  const applyQuickStep = (delta: number) => {
    if (!focusedCell) return;
    updateSet(focusedCell.blockId, focusedCell.setId, (cur) => {
      if (focusedCell.field === 'reps') return { ...cur, reps: Math.max(0, cur.reps + delta) };
      const next = Math.max(0, Number((kgToDisplay(cur.weightKg, inputUnit) + delta).toFixed(2)));
      return { ...cur, weightKg: displayToKg(next, inputUnit) };
    });
  };

  const headerPalette = getSplitPalette(draft.splitTag);

  return (
    <div className="space-y-3.5 pb-28">
      {/* Sticky workout header */}
      <div
        style={headerPalette.cardGlowStyle}
        className={`sticky safe-below-header z-30 bg-[#1c1c1e]/95 backdrop-blur-2xl border ${headerPalette.cardBorderClass} rounded-[22px] p-3.5 shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${headerPalette.badgeClass}`}>
                {draft.splitTag}
              </span>
              <input
                type="text"
                aria-label="Workout name"
                value={draft.name}
                onChange={(e) => onUpdateDraft({ ...draft, name: e.target.value })}
                className="text-sm sm:text-base font-bold text-white bg-transparent focus:outline-none truncate w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-num mt-0.5 text-[#8e8e93]">
              <span className={`inline-flex items-center gap-1 ${headerPalette.textClass} font-bold`}>
                <Clock className="w-3 h-3" /> <ElapsedTime startTime={draft.startTime} />
              </span>
              <span>•</span>
              <span className="text-white font-semibold">
                {pluralize(sessionStats.completedSets, 'set')}
              </span>
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
        {draft.programmeWeek && (
          <div className="mt-2 pt-2 border-t border-white/[0.08] text-[11px] leading-snug">
            <div className="font-bold text-white">
              Week {draft.programmeWeek.week}/{draft.programmeWeek.totalWeeks} · {draft.programmeWeek.block}
              {draft.programmeWeek.kind !== 'build' && (
                <span className={headerPalette.textClass}> · {WEEK_KIND_LABEL[draft.programmeWeek.kind]}</span>
              )}
            </div>
            <div className="text-[#8e8e93]">
              {draft.programmeWeek.repsNote} · {draft.programmeWeek.rirNote}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3.5">
        {draft.exercises.map((block) => {
          const meta = exerciseMap.get(block.exerciseId);
          const insight = insightsByExercise.get(block.exerciseId);
          if (!meta || !insight) return null;
          return (
            <ExerciseBlockCard
              key={block.id}
              block={block}
              meta={meta}
              insight={insight}
              targetRange={
                draft.programmeWeek
                  ? isCompound(meta)
                    ? draft.programmeWeek.compoundReps
                    : draft.programmeWeek.isolationReps
                  : meta.targetRepRange
              }
              showInsight={!draft.programmeWeek}
              unit={unit}
              inputUnit={inputUnit}
              onToggleInputUnit={toggleInputUnit}
              onUpdateSet={(setId, update) => updateSet(block.id, setId, update)}
              onSetRemaining={(weightKg, reps) => setRemaining(block.id, weightKg, reps)}
              onToggleComplete={(set) => toggleComplete(block, set)}
              onCycleSetType={(set) =>
                updateSet(block.id, set.id, (cur) => ({ ...cur, type: nextSetType(cur.type) }))
              }
              onAddSet={() => addSet(block)}
              onRemoveLastSet={() =>
                updateBlock(block.id, (b) =>
                  b.sets.length > 1 ? { ...b, sets: b.sets.slice(0, -1) } : b
                )
              }
              onSwap={() => setPicker({ swapBlockId: block.id })}
              onRemove={() =>
                onUpdateDraft({
                  ...draft,
                  exercises: draft.exercises.filter((b) => b.id !== block.id),
                })
              }
              onFocusField={(setId, field) => setFocusedCell({ blockId: block.id, setId, field })}
              onOpenExerciseDetail={onOpenExerciseDetail}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPicker('add')}
        className="w-full py-3.5 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.06] text-[#a4ff00] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition"
      >
        <Plus className="w-4 h-4" /> Add Exercise
      </button>

      {focusedCell && (
        <QuickStepBar
          field={focusedCell.field}
          inputUnit={inputUnit}
          onToggleUnit={toggleInputUnit}
          onStep={applyQuickStep}
          onClose={() => setFocusedCell(null)}
        />
      )}

      {picker && (
        <ExercisePickerModal
          title={picker === 'add' ? 'Add Exercise' : 'Swap Exercise'}
          exercises={exercises}
          onPick={pickExercise}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
};

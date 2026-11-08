import {
  ActiveWorkoutDraft,
  Exercise,
  Routine,
  WorkoutExercise,
  WorkoutSession,
} from '../types/workout';
import { evaluateSetPRs, getLastPerformedExerciseBlock } from './analytics';
import type { ExercisePrescription } from './trainerEngine';

/** Statuses where the coach's suggested numbers replace last session's. */
const PRESCRIPTION_STATUSES_TO_APPLY = new Set<ExercisePrescription['status']>([
  'overload_weight',
  'pr_momentum',
  'regression',
]);

/**
 * Turns a routine into a ready-to-log workout. Each set starts from what was
 * lifted last time (or the bar weight for a new exercise); with coach
 * prescriptions, the coach's numbers are used where there's a clear trend.
 */
export function buildDraftFromRoutine(
  routine: Routine,
  exercises: Exercise[],
  workouts: WorkoutSession[],
  prescriptions: ExercisePrescription[] = []
): ActiveWorkoutDraft {
  const now = Date.now();
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const prescMap = new Map(prescriptions.map((p) => [p.exercise.id, p]));

  const blocks: WorkoutExercise[] = routine.exercises.map((tmpl, idx) => {
    const meta = exMap.get(tmpl.exerciseId);
    const presc = prescMap.get(tmpl.exerciseId);
    const useCoachTarget =
      !!presc &&
      presc.hasMeaningfulInsight &&
      PRESCRIPTION_STATUSES_TO_APPLY.has(presc.status);

    const lastBlock = getLastPerformedExerciseBlock(tmpl.exerciseId, workouts);
    const prevWorking = lastBlock
      ? lastBlock.exerciseBlock.sets.filter((s) => s.type !== 'warmup')
      : [];

    const sets = Array.from({ length: tmpl.targetSets }).map((_, sIdx) => {
      const prev = prevWorking[sIdx] || prevWorking[prevWorking.length - 1];
      return {
        id: `set-${now}-${idx}-${sIdx}`,
        setNumber: sIdx + 1,
        type: 'working' as const,
        weightKg: useCoachTarget
          ? presc!.recommendedWeightKg
          : prev
          ? prev.weightKg
          : meta?.barWeightKg || 20,
        reps: useCoachTarget
          ? presc!.recommendedReps
          : prev
          ? prev.reps
          : tmpl.targetRepRange[0],
        completed: false,
      };
    });

    return {
      id: `we-${now}-${idx}`,
      exerciseId: tmpl.exerciseId,
      supersetGroup: tmpl.supersetGroup,
      notes: tmpl.notes,
      restSeconds: tmpl.restSeconds || meta?.defaultRestSeconds || 120,
      sets,
    };
  });

  return {
    id: `draft-${now}`,
    name: routine.name,
    routineId: routine.id,
    splitTag: routine.splitTag,
    startTime: new Date(now).toISOString(),
    notes: '',
    exercises: blocks,
    isMinimized: false,
  };
}

export function buildEmptyDraft(exercises: Exercise[]): ActiveWorkoutDraft {
  const now = Date.now();
  const first = exercises.find((e) => !e.isArchived);
  return {
    id: `draft-${now}`,
    name: 'Custom Workout',
    splitTag: 'Custom',
    startTime: new Date(now).toISOString(),
    notes: '',
    exercises: first
      ? [
          {
            id: `we-${now}-0`,
            exerciseId: first.id,
            restSeconds: first.defaultRestSeconds,
            sets: [
              {
                id: `set-${now}-1`,
                setNumber: 1,
                type: 'working',
                weightKg: first.barWeightKg || 20,
                reps: first.targetRepRange[0],
                completed: false,
              },
            ],
          },
        ]
      : [],
    isMinimized: false,
  };
}

/**
 * Turns the in-progress draft into a saved workout: keeps only completed
 * sets, and marks PRs set by set (so a PR earlier in the session raises the
 * bar for later sets). Returns null if nothing was completed.
 */
export function finalizeWorkout(
  draft: ActiveWorkoutDraft,
  history: WorkoutSession[]
): WorkoutSession | null {
  const endTime = new Date().toISOString();
  const doneBlocks: WorkoutExercise[] = [];

  for (const block of draft.exercises) {
    const evaluatedSets: WorkoutExercise['sets'] = [];
    for (const s of block.sets.filter((x) => x.completed)) {
      const sessionSoFar: WorkoutSession = {
        id: 'in-progress-session',
        name: draft.name,
        splitTag: draft.splitTag,
        startTime: draft.startTime,
        endTime,
        durationMinutes: 1,
        exercises: [...doneBlocks, { ...block, sets: evaluatedSets }],
      };
      const prs =
        s.type !== 'warmup'
          ? evaluateSetPRs(block.exerciseId, s, [sessionSoFar, ...history])
          : [];
      evaluatedSets.push({ ...s, completed: true, prs: prs.length > 0 ? prs : undefined });
    }
    if (evaluatedSets.length > 0) doneBlocks.push({ ...block, sets: evaluatedSets });
  }

  if (doneBlocks.length === 0) return null;

  const durationMinutes = Math.max(
    1,
    Math.round((new Date(endTime).getTime() - new Date(draft.startTime).getTime()) / 60000)
  );

  return {
    id: `wk-${Date.now()}`,
    name: draft.name || 'Workout Session',
    routineId: draft.routineId,
    splitTag: draft.splitTag,
    startTime: draft.startTime,
    endTime,
    durationMinutes,
    notes: draft.notes || undefined,
    exercises: doneBlocks,
  };
}

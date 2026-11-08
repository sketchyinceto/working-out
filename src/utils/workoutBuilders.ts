import {
  ActiveWorkoutDraft,
  Exercise,
  Routine,
  WorkoutExercise,
  WorkoutSession,
} from '../types/workout';
import { evaluateSetPRs, getLastPerformedExerciseBlock } from './analytics';
import { calculateEstimated1RM } from './calculators';
import type { ProgrammeWeek } from '../data/programmes';
import { repRangeFor, weekNote } from './coach/programme';

const roundTo2_5 = (kg: number) => Math.max(0, Math.round(kg / 2.5) * 2.5);

/**
 * Turns a routine into a ready-to-log workout. Each set starts from what was
 * lifted last time (or the bar weight for a new exercise).
 *
 * During a programme the week adjusts it: the number of sets scales with the
 * week (more as a block builds, half on deloads, fewer in a cut), reps move
 * into the week's range (with the weight re-estimated so the effort matches),
 * and deload weeks start ~10% lighter.
 */
export function buildDraftFromRoutine(
  routine: Routine,
  exercises: Exercise[],
  workouts: WorkoutSession[],
  programme?: { week: ProgrammeWeek; totalWeeks: number }
): ActiveWorkoutDraft {
  const now = Date.now();
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const week = programme?.week;

  const blocks: WorkoutExercise[] = routine.exercises.map((tmpl, idx) => {
    const meta = exMap.get(tmpl.exerciseId);
    const lastBlock = getLastPerformedExerciseBlock(tmpl.exerciseId, workouts);
    const prevWorking = lastBlock
      ? lastBlock.exerciseBlock.sets.filter((s) => s.type !== 'warmup')
      : [];

    const setCount = week
      ? Math.max(1, Math.round(tmpl.targetSets * week.setsMultiplier))
      : tmpl.targetSets;
    const range = week && meta ? repRangeFor(meta, week) : tmpl.targetRepRange;

    const sets = Array.from({ length: setCount }).map((_, sIdx) => {
      const prev = prevWorking[sIdx] || prevWorking[prevWorking.length - 1];
      let weightKg = prev ? prev.weightKg : meta?.barWeightKg || 20;
      let reps = prev ? prev.reps : range[0];

      if (week && prev) {
        // Moving into a new rep range (e.g. 8–12 → 5–8): pick the weight
        // that matches the same effort at the new reps (Epley estimate).
        const targetReps = Math.min(range[1], Math.max(range[0], prev.reps));
        if (targetReps !== prev.reps) {
          const e1rm = calculateEstimated1RM(prev.weightKg, prev.reps);
          weightKg = roundTo2_5(e1rm / (1 + targetReps / 30)) || prev.weightKg;
          reps = targetReps;
        }
      }
      if (week && week.loadMultiplier !== 1) {
        weightKg = roundTo2_5(weightKg * week.loadMultiplier);
      }

      return {
        id: `set-${now}-${idx}-${sIdx}`,
        setNumber: sIdx + 1,
        type: 'working' as const,
        weightKg,
        reps,
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
    ...(programme ? { programmeWeek: weekNote(programme.week, programme.totalWeeks) } : {}),
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

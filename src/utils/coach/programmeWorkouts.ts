import {
  ActiveProgramme,
  ActiveWorkoutDraft,
  Exercise,
  ExperienceLevel,
  Routine,
  TrainingProfile,
  WorkoutExercise,
  WorkoutSession,
} from '../../types/workout';
import { ProgrammeWeek } from '../../data/programmes';
import {
  ProgrammeSlot,
  ProgrammeSplit,
  ProgrammeWorkout,
  splitForDays,
} from '../../data/programmeSplits';
import { getLastPerformedExerciseBlock } from '../analytics';
import { calculateEstimated1RM } from '../calculators';
import { ProgrammeStatus, repRangeFor, weekNote } from './programme';

/** Programme workouts are stored on sessions with this routine-id prefix. */
export const PROGRAMME_ROUTINE_PREFIX = 'programme:';

export const roundToStep = (kg: number, step = 2.5) => Math.max(0, Math.round(kg / step) * step);

/** Smallest sensible jump for the equipment. */
export function weightStep(ex: Exercise): number {
  return ex.equipment === 'dumbbell' || ex.equipment === 'cable' || ex.equipment === 'ez_bar' ? 2 : 2.5;
}

/**
 * The weekly layout comes from your training days in Goal & Schedule:
 * 3 days → full body, 4 → upper/lower, 5 → upper/lower + PPL, 6 → PPL ×2.
 * (Fewer than 3 days rotates the 3 full-body workouts.)
 */
export function activeSplit(_programme: ActiveProgramme, profile: TrainingProfile): ProgrammeSplit {
  return splitForDays(profile.trainingDays.length);
}

/**
 * Newer lifters grow on less volume and recover from less; experienced
 * lifters often need more to keep progressing.
 */
export const EXPERIENCE_VOLUME: Record<ExperienceLevel, number> = {
  beginner: 0.75,
  intermediate: 1,
  advanced: 1.15,
};

export function slotExerciseId(programme: ActiveProgramme, slot: ProgrammeSlot): string {
  return programme.exerciseOverrides?.[slot.id] ?? slot.exerciseId;
}

export interface PlannedSlot {
  slot: ProgrammeSlot;
  exercise: Exercise;
  sets: number;
  weightKg: number;
  reps: number;
  range: [number, number];
  restSeconds: number;
  /** Why the numbers are what they are (from the last analysis). */
  reason?: string;
  swapSuggestion?: Exercise;
}

/**
 * What each exercise in a programme workout should be this time: sets from
 * the slot (± any adjustment from earlier sessions) scaled by the week, and
 * weight/reps from the last analysis, or estimated from history.
 */
export function planProgrammeWorkout(
  workout: ProgrammeWorkout,
  programme: ActiveProgramme,
  week: ProgrammeWeek,
  exercises: Exercise[],
  history: WorkoutSession[],
  experience: ExperienceLevel = 'intermediate'
): PlannedSlot[] {
  const volume = EXPERIENCE_VOLUME[experience] ?? 1;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const planned: PlannedSlot[] = [];

  for (const slot of workout.slots) {
    const exercise = exMap.get(slotExerciseId(programme, slot));
    if (!exercise) continue;
    const range = repRangeFor(exercise, week);
    const target = programme.targets?.[slot.id];
    const targetValid = !!target && target.exerciseId === exercise.id;

    const slotSets = Math.max(1, Math.round(slot.sets * volume));
    const baseSets = Math.max(1, slotSets + (targetValid ? target!.setDelta : 0));
    const sets = Math.max(1, Math.round(baseSets * week.setsMultiplier));

    let weightKg: number;
    let reps: number;
    if (targetValid && target!.range[0] === range[0] && target!.range[1] === range[1]) {
      weightKg = target!.weightKg;
      reps = target!.reps;
    } else {
      // New exercise or new rep range: estimate from the last session.
      const last = getLastPerformedExerciseBlock(exercise.id, history);
      const lastSets = last?.exerciseBlock.sets.filter((s) => s.completed && s.type !== 'warmup' && s.reps > 0);
      if (lastSets && lastSets.length > 0) {
        const best = lastSets.reduce((a, b) =>
          calculateEstimated1RM(b.weightKg, b.reps) > calculateEstimated1RM(a.weightKg, a.reps) ? b : a
        );
        reps = Math.min(range[1], Math.max(range[0], best.reps));
        const e1rm = calculateEstimated1RM(best.weightKg, best.reps);
        // Aim a little under the estimate so the first session lands in range.
        weightKg = roundToStep((e1rm / (1 + reps / 30)) * 0.97, weightStep(exercise)) || best.weightKg;
      } else {
        reps = range[0];
        weightKg = exercise.barWeightKg || 20;
      }
    }
    if (week.loadMultiplier !== 1) weightKg = roundToStep(weightKg * week.loadMultiplier, weightStep(exercise));

    const swap = targetValid && target!.swapSuggestion ? exMap.get(target!.swapSuggestion) : undefined;
    planned.push({
      slot,
      exercise,
      sets,
      weightKg,
      reps,
      range,
      restSeconds: (targetValid && target!.restSeconds) || exercise.defaultRestSeconds,
      reason: targetValid ? target!.reason : undefined,
      swapSuggestion: swap && !swap.isArchived ? swap : undefined,
    });
  }
  return planned;
}

export function buildProgrammeDraft(
  workout: ProgrammeWorkout,
  status: ProgrammeStatus,
  programme: ActiveProgramme,
  exercises: Exercise[],
  history: WorkoutSession[],
  experience: ExperienceLevel = 'intermediate'
): ActiveWorkoutDraft {
  const week = status.week!;
  const now = Date.now();
  const plan = planProgrammeWorkout(workout, programme, week, exercises, history, experience);

  const blocks: WorkoutExercise[] = plan.map((p, idx) => ({
    id: `we-${now}-${idx}`,
    exerciseId: p.exercise.id,
    slotId: p.slot.id,
    notes: p.slot.note,
    restSeconds: p.restSeconds,
    sets: Array.from({ length: p.sets }).map((_, sIdx) => ({
      id: `set-${now}-${idx}-${sIdx}`,
      setNumber: sIdx + 1,
      type: 'working' as const,
      weightKg: p.weightKg,
      reps: p.reps,
      completed: false,
    })),
  }));

  return {
    id: `draft-${now}`,
    name: workout.name,
    routineId: `${PROGRAMME_ROUTINE_PREFIX}${workout.id}`,
    programmeWorkoutId: workout.id,
    splitTag: workout.splitTag,
    startTime: new Date(now).toISOString(),
    notes: '',
    exercises: blocks,
    isMinimized: false,
    programmeWeek: weekNote(week, status.totalWeeks),
  };
}

/** Programme workouts shaped like routines, for the weekly schedule. */
export function programmeWorkoutsAsRoutines(split: ProgrammeSplit, programme: ActiveProgramme): Routine[] {
  return split.workouts.map((w) => ({
    id: `${PROGRAMME_ROUTINE_PREFIX}${w.id}`,
    name: w.name,
    folder: 'Custom',
    splitTag: w.splitTag,
    description: '',
    accentColor: 'violet',
    exercises: w.slots.map((slot) => ({
      id: slot.id,
      exerciseId: slotExerciseId(programme, slot),
      targetSets: slot.sets,
      targetRepRange: [8, 12],
      restSeconds: 0,
    })),
  }));
}

export function findProgrammeWorkout(split: ProgrammeSplit, routineOrWorkoutId: string): ProgrammeWorkout | undefined {
  const id = routineOrWorkoutId.startsWith(PROGRAMME_ROUTINE_PREFIX)
    ? routineOrWorkoutId.slice(PROGRAMME_ROUTINE_PREFIX.length)
    : routineOrWorkoutId;
  return split.workouts.find((w) => w.id === id);
}

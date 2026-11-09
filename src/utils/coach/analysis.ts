import {
  ActiveProgramme,
  Exercise,
  ProgrammeTarget,
  WorkoutSession,
} from '../../types/workout';
import { ProgrammeWeek } from '../../data/programmes';
import { getExerciseProgressionSeries, getWorkingSets } from '../analytics';
import { kgToDisplay } from '../calculators';
import { programmeWeekAt, repRangeFor } from './programme';
import { roundToStep, weightStep } from './programmeWorkouts';

const MAX_SET_DELTA = 2;
const MIN_SET_DELTA = -2;
/** Reps lost from first to last set that signal too much fatigue. */
const DROP_OFF_REPS = 4;

export interface ExerciseAnalysis {
  slotId: string;
  exercise: Exercise;
  /** One line per change: "Bench Press: 80 → 82.5 kg (every set hit 8)". */
  summary: string;
  kind: 'weight_up' | 'reps_up' | 'weight_down' | 'hold' | 'swap';
}

export interface SessionAnalysis {
  targets: Record<string, ProgrammeTarget>;
  items: ExerciseAnalysis[];
  /** Shown instead of items when nothing was analysed (deload/test weeks). */
  message?: string;
}

const kg = (n: number) => `${kgToDisplay(n, 'kg')} kg`;

/**
 * Looks at how each exercise in a finished programme workout went and sets
 * the next session's target. The rules follow double progression: add reps
 * within the range, then add weight once every set reaches the top (adding
 * reps or load built similar muscle and strength in Plotkin et al., 2022).
 *
 * - Every set at the top of the range → add weight, reset to the bottom.
 *   Two sessions in a row → also add a set (not during a cut).
 * - Within the range → same weight, aim for one more rep.
 * - Below the range → take off ~5%. A big drop-off across sets → one set
 *   fewer and longer rest.
 * - No progress in 3 sessions → suggest a similar exercise to swap in.
 */
export function analyzeProgrammeSession(
  session: WorkoutSession,
  programme: ActiveProgramme,
  week: ProgrammeWeek,
  exercises: Exercise[],
  /** All workouts including this session. */
  allWorkouts: WorkoutSession[],
  /** Slot id → the exercise the programme expects there (skips one-off swaps). */
  expectedExerciseBySlot?: Record<string, string>
): SessionAnalysis {
  const targets: Record<string, ProgrammeTarget> = {};
  const items: ExerciseAnalysis[] = [];

  if (week.kind === 'deload' || week.kind === 'test') {
    return {
      targets,
      items,
      message:
        week.kind === 'deload'
          ? 'Deload week: lighter sessions are planned, so your targets carry over unchanged to the next block.'
          : 'Test week: your results here set the baseline for what comes next.',
    };
  }

  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const inWorkout = new Set(session.exercises.map((b) => b.exerciseId));
  const now = new Date().toISOString();

  for (const block of session.exercises) {
    if (!block.slotId) continue;
    // A one-off swap ("just today"): leave the regular exercise's targets alone.
    const expectedId = expectedExerciseBySlot?.[block.slotId];
    if (expectedId && expectedId !== block.exerciseId) continue;
    const exercise = exMap.get(block.exerciseId);
    if (!exercise) continue;
    const sets = getWorkingSets(block.sets);
    if (sets.length === 0) continue;

    const range = repRangeFor(exercise, week);
    const [lo, hi] = range;
    const prev = programme.targets?.[block.slotId];
    const prevValid = prev && prev.exerciseId === exercise.id;
    let setDelta = prevValid ? prev!.setDelta : 0;
    let restSeconds = prevValid ? prev!.restSeconds : undefined;

    const topWeight = Math.max(...sets.map((s) => s.weightKg));
    const atTop = sets.filter((s) => s.weightKg === topWeight);
    const allTop = atTop.length === sets.length && sets.every((s) => s.reps >= hi);
    const belowCount = sets.filter((s) => s.reps < lo).length;
    const dropOff = sets[0].reps - sets[sets.length - 1].reps;
    const step = weightStep(exercise);

    let weightKg = topWeight;
    let reps: number;
    let reason: string;
    let kind: ExerciseAnalysis['kind'];
    let topStreak = 0;

    if (allTop) {
      weightKg = roundToStep(topWeight + step, step);
      reps = lo;
      topStreak = (prevValid ? prev!.topStreak ?? 0 : 0) + 1;
      reason = `Every set hit ${hi}+ reps at ${kg(topWeight)}, so the weight goes up.`;
      kind = 'weight_up';
      if (topStreak >= 2 && week.phase !== 'cut' && setDelta < MAX_SET_DELTA) {
        setDelta += 1;
        reason += ' Two easy sessions in a row: one extra set added.';
        topStreak = 0;
      }
    } else if (belowCount > 0 && (belowCount >= Math.ceil(sets.length / 2) || sets[0].reps < lo)) {
      // ~5% lighter, but always at least one plate/dumbbell step down.
      weightKg = Math.max(0, Math.min(topWeight - step, roundToStep(topWeight * 0.95, step)));
      reps = lo;
      reason = `${belowCount} of ${sets.length} sets fell below ${lo} reps, so the weight drops about 5%.`;
      kind = 'weight_down';
      if (dropOff >= DROP_OFF_REPS && setDelta > MIN_SET_DELTA) {
        setDelta -= 1;
        restSeconds = Math.min(240, (restSeconds ?? exercise.defaultRestSeconds) + 30);
        reason += ' Reps faded a lot across sets: one set fewer and 30 s more rest.';
      }
    } else {
      const lowest = Math.min(...atTop.map((s) => s.reps));
      reps = Math.min(hi, Math.max(lo, lowest + 1));
      reason = `In range at ${kg(topWeight)}: same weight, aim for ${reps} reps on every set.`;
      kind = 'reps_up';
      if (dropOff >= DROP_OFF_REPS) {
        restSeconds = Math.min(240, (restSeconds ?? exercise.defaultRestSeconds) + 30);
        reason += ' Rest 30 s longer to keep later sets strong.';
      }
    }

    // Stall check across sessions (deload/test weeks left out).
    let swapSuggestion: string | undefined;
    const series = getExerciseProgressionSeries(exercise.id, allWorkouts).filter((p) => {
      const wk = programmeWeekAt(programme, new Date(p.date));
      return !wk || (wk.kind !== 'deload' && wk.kind !== 'test');
    });
    if (series.length >= 4) {
      const recent = series.slice(-3);
      const before = series.slice(0, -3);
      const stalled =
        Math.max(...recent.map((p) => p.bestE1RMKg)) <= Math.max(...before.map((p) => p.bestE1RMKg));
      if (stalled) {
        const candidates = exercises.filter(
          (e) =>
            e.id !== exercise.id &&
            !e.isArchived &&
            !inWorkout.has(e.id) &&
            e.primaryMuscle === exercise.primaryMuscle
        );
        const alt = candidates.find((e) => e.equipment !== exercise.equipment) ?? candidates[0];
        if (alt) {
          swapSuggestion = alt.id;
          kind = kind === 'weight_up' ? kind : 'swap';
          reason += ` No progress in 3 sessions: consider swapping to ${alt.name}.`;
        }
      }
    }

    targets[block.slotId] = {
      exerciseId: exercise.id,
      weightKg,
      reps,
      setDelta,
      ...(restSeconds ? { restSeconds } : {}),
      range,
      reason,
      updatedAt: now,
      ...(swapSuggestion ? { swapSuggestion } : {}),
      ...(topStreak ? { topStreak } : {}),
    };

    const change =
      kind === 'weight_up'
        ? `${kg(topWeight)} → ${kg(weightKg)}`
        : kind === 'weight_down'
        ? `${kg(topWeight)} → ${kg(weightKg)}`
        : `${kg(weightKg)} × ${reps}`;
    items.push({
      slotId: block.slotId,
      exercise,
      kind,
      summary: `${change}. ${reason}`,
    });
  }

  return { targets, items };
}

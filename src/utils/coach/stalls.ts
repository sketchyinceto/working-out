import {
  ActiveProgramme,
  Exercise,
  Routine,
  WorkoutSession,
} from '../../types/workout';
import { ExerciseSessionDataPoint, getExerciseProgressionSeries } from '../analytics';
import { getProgrammeStatus, programmeWeekAt } from './programme';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sessions that must show no progress before a lift counts as stalled. */
const STALL_SESSIONS = 3;
/** Only lifts trained in this window count (old lifts aren't "stalled"). */
const ACTIVE_WINDOW_DAYS = 28;

export interface StallFix {
  title: string;
  detail: string;
}

export interface StallAlert {
  exercise: Exercise;
  kind: 'plateau' | 'regression';
  /** Best estimated 1-rep max before the stall. */
  previousBestKg: number;
  /** Best estimated 1-rep max in the last few sessions. */
  recentBestKg: number;
  sessions: number;
  headline: string;
  fixes: StallFix[];
  /** A similar exercise to rotate in, if one exists. */
  alternative?: Exercise;
  /** Routines that contain this exercise (for a one-tap swap). */
  routineIds: string[];
}

/**
 * Lifts that haven't improved over their last few sessions, judged by
 * estimated 1-rep max. Deload and test weeks are left out, because lighter
 * or unusual sessions there are planned, not stalls.
 */
export function findStalls(
  workouts: WorkoutSession[],
  exercises: Exercise[],
  routines: Routine[],
  programme: ActiveProgramme | null | undefined,
  now: Date = new Date()
): StallAlert[] {
  const status = getProgrammeStatus(programme, now);
  const inCut = status?.week?.phase === 'cut';
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const exerciseIds = new Set<string>();
  for (const w of workouts) for (const b of w.exercises) exerciseIds.add(b.exerciseId);

  const alerts: StallAlert[] = [];
  for (const id of exerciseIds) {
    const exercise = exMap.get(id);
    if (!exercise) continue;

    const points: ExerciseSessionDataPoint[] = getExerciseProgressionSeries(id, workouts).filter(
      (p) => {
        const wk = programmeWeekAt(programme, new Date(p.date));
        return !wk || (wk.kind !== 'deload' && wk.kind !== 'test');
      }
    );
    if (points.length < STALL_SESSIONS + 1) continue;
    const last = points[points.length - 1];
    if (now.getTime() - Date.parse(last.date) > ACTIVE_WINDOW_DAYS * DAY_MS) continue;

    const recent = points.slice(-STALL_SESSIONS);
    const before = points.slice(0, -STALL_SESSIONS);
    const previousBestKg = Math.max(...before.map((p) => p.bestE1RMKg));
    const recentBestKg = Math.max(...recent.map((p) => p.bestE1RMKg));
    const latestKg = last.bestE1RMKg;

    const regression = latestKg < previousBestKg * 0.95 && recentBestKg < previousBestKg * 0.98;
    const plateau = !regression && recentBestKg <= previousBestKg;
    if (!regression && !plateau) continue;
    // In a cut, holding strength is the goal; only real drops matter.
    if (inCut && !regression) continue;

    const routineIds = routines
      .filter((r) => r.exercises.some((item) => item.exerciseId === id))
      .map((r) => r.id);
    // Don't suggest something already in those routines (it would appear twice).
    const alreadyUsed = new Set(
      routines
        .filter((r) => routineIds.includes(r.id))
        .flatMap((r) => r.exercises.map((item) => item.exerciseId))
    );
    const candidates = exercises.filter(
      (e) =>
        e.id !== id &&
        !e.isArchived &&
        !alreadyUsed.has(e.id) &&
        e.primaryMuscle === exercise.primaryMuscle
    );
    const alternative =
      candidates.find((e) => e.equipment !== exercise.equipment) || candidates[0];

    alerts.push({
      exercise,
      kind: regression ? 'regression' : 'plateau',
      previousBestKg,
      recentBestKg,
      sessions: STALL_SESSIONS,
      headline: regression
        ? `${exercise.name} has dropped about ${Math.round((1 - latestKg / previousBestKg) * 100)}% from your best`
        : `${exercise.name} hasn't improved in ${STALL_SESSIONS} sessions`,
      fixes: regression ? regressionFixes(inCut) : plateauFixes(alternative),
      alternative,
      routineIds,
    });
  }

  // Drops first, then by how far below best.
  return alerts.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'regression' ? -1 : 1;
    return a.recentBestKg / a.previousBestKg - b.recentBestKg / b.previousBestKg;
  });
}

function plateauFixes(alternative?: Exercise): StallFix[] {
  const fixes: StallFix[] = [
    {
      title: 'Add reps before weight',
      detail:
        'Keep the weight and aim for one more rep per set each session. Only add weight once every set reaches the top of the rep range.',
    },
    {
      title: 'Reset and build back',
      detail:
        'Drop the weight about 10% for one session, then work back up over 2–3 sessions. Often you pass the old best.',
    },
  ];
  if (alternative) {
    fixes.push({
      title: `Rotate to ${alternative.name}`,
      detail: 'A similar exercise for the same muscle for the next block gives a fresh stimulus.',
    });
  }
  return fixes;
}

function regressionFixes(inCut: boolean): StallFix[] {
  return [
    inCut
      ? {
          title: 'Check the rate of loss',
          detail:
            'Strength dropping in a cut can mean losing weight too fast. Aim for 0.5–1% of bodyweight per week and keep protein high.',
        }
      : {
          title: 'Check recovery',
          detail:
            'A real drop is usually fatigue: sleep, food or stress. Make sure you are eating enough protein and calories.',
        },
    {
      title: 'Take a deload',
      detail:
        'Do one lighter week: half the sets and ~10% less weight. Strength usually rebounds afterwards.',
    },
  ];
}

import { Routine, TrainingProfile, WorkoutSession } from '../../types/workout';
import { toLocalDateStr } from '../dates';
import { workoutsNewestFirst } from '../analytics';
import { mondayOf } from './programme';

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type DayStatus = 'done' | 'today' | 'upcoming' | 'missed' | 'rest' | 'extra';

export interface ScheduleDay {
  dateStr: string;
  weekday: number; // 0 = Mon
  dayNumber: number;
  isTrainingDay: boolean;
  status: DayStatus;
  /** Workouts logged that day. */
  workouts: WorkoutSession[];
  /** Planned routine for a training day that hasn't been done yet. */
  plannedRoutine?: Routine;
}

/** Sensible starting profile before the user sets one. */
export function defaultProfile(routines: Routine[]): TrainingProfile {
  const ppl = ['routine-ppl-push', 'routine-ppl-pull', 'routine-ppl-legs'].filter((id) =>
    routines.some((r) => r.id === id)
  );
  return {
    goal: 'lean_muscle',
    experience: 'intermediate',
    trainingDays: [0, 1, 2, 3, 4, 5], // Mon–Sat: push/pull/legs twice a week
    rotationRoutineIds: ppl.length > 0 ? ppl : routines.slice(0, 3).map((r) => r.id),
  };
}

/** Recommended number of training days for a split rotation. */
export function rotationRoutines(profile: TrainingProfile, routines: Routine[]): Routine[] {
  const byId = new Map(routines.map((r) => [r.id, r]));
  return profile.rotationRoutineIds
    .map((id) => byId.get(id))
    .filter((r): r is Routine => !!r);
}

/**
 * This week (Mon–Sun) with what's been done and what's planned. Remaining
 * training days get the next routines in the rotation, continuing from the
 * last routine you did.
 */
export function buildWeekSchedule(
  profile: TrainingProfile,
  routines: Routine[],
  workouts: WorkoutSession[],
  now: Date = new Date()
): ScheduleDay[] {
  const rotation = rotationRoutines(profile, routines);
  const todayStr = toLocalDateStr(now);
  const monday = mondayOf(now);
  const trainingDays = new Set(profile.trainingDays);

  const byDate = new Map<string, WorkoutSession[]>();
  for (const w of workouts) {
    const key = toLocalDateStr(new Date(w.startTime));
    const list = byDate.get(key);
    if (list) list.push(w);
    else byDate.set(key, [w]);
  }

  // Continue the rotation after the most recent workout that used it.
  let nextIdx = 0;
  const lastInRotation = workoutsNewestFirst(workouts).find(
    (w) => w.routineId && rotation.some((r) => r.id === w.routineId)
  );
  if (lastInRotation) {
    nextIdx = (rotation.findIndex((r) => r.id === lastInRotation.routineId) + 1) % rotation.length;
  }

  return Array.from({ length: 7 }).map((_, weekday) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + weekday);
    const dateStr = toLocalDateStr(date);
    const dayWorkouts = byDate.get(dateStr) || [];
    const isTrainingDay = trainingDays.has(weekday);
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;

    let status: DayStatus;
    if (dayWorkouts.length > 0) status = isTrainingDay ? 'done' : 'extra';
    else if (!isTrainingDay) status = 'rest';
    else if (isToday) status = 'today';
    else if (isPast) status = 'missed';
    else status = 'upcoming';

    let plannedRoutine: Routine | undefined;
    if ((status === 'today' || status === 'upcoming') && rotation.length > 0) {
      plannedRoutine = rotation[nextIdx % rotation.length];
      nextIdx += 1;
    }

    return {
      dateStr,
      weekday,
      dayNumber: date.getDate(),
      isTrainingDay,
      status,
      workouts: dayWorkouts,
      plannedRoutine,
    };
  });
}

/** Which split each number of weekly sessions suits, for the settings hint. */
export function splitHint(daysPerWeek: number): string {
  if (daysPerWeek <= 2) return 'Full body each session works best at 2 days a week.';
  if (daysPerWeek === 3) return 'Full body 3×/week, or Push/Pull/Legs once (each muscle only once a week).';
  if (daysPerWeek === 4) return 'Upper/Lower twice a week hits every muscle twice.';
  if (daysPerWeek === 5) return 'Upper/Lower + Push/Pull/Legs, or PPL with two extra days.';
  return 'Push/Pull/Legs twice a week hits every muscle twice.';
}

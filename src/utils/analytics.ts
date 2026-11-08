import {
  Exercise,
  MuscleGroup,
  PRType,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../types/workout';
import { calculateEstimated1RM } from './calculators';
import { toLocalDateStr } from './dates';

export interface ExerciseSessionDataPoint {
  sessionId: string;
  date: string; // ISO
  shortDate: string; // e.g. "Oct 12"
  bestE1RMKg: number;
  heaviestWeightKg: number;
  bestWeightReps: number;
  bestSetVolumeKg: number;
  totalSessionVolumeKg: number;
  workingSetsCount: number;
  hasPR: boolean;
  topSetSummary: string;
}

export interface ProgressiveOverloadHint {
  lastDate: string;
  lastSetsSummary: string;
  suggestionText: string;
  recommendedWeightKg: number;
  recommendedReps: number;
  status: 'increase_weight' | 'increase_reps' | 'first_time';
}

export function getWorkingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => s.completed && s.type !== 'warmup' && s.reps > 0);
}

export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getExerciseProgressionSeries(
  exerciseId: string,
  workouts: WorkoutSession[],
  daysFilter: number | null = null
): ExerciseSessionDataPoint[] {
  const cutoffMs = daysFilter ? Date.now() - daysFilter * 24 * 60 * 60 * 1000 : 0;

  // Sort workouts chronologically (oldest -> newest) to track PRs accurately
  const chronological = [...workouts].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  let runningMaxE1RM = 0;
  let runningMaxWeight = 0;
  const allPoints: ExerciseSessionDataPoint[] = [];

  for (const session of chronological) {
    const matchingBlocks = session.exercises.filter((e) => e.exerciseId === exerciseId);
    if (matchingBlocks.length === 0) continue;

    const workingSets = matchingBlocks.flatMap((b) => getWorkingSets(b.sets));
    if (workingSets.length === 0) continue;

    let bestE1RMKg = 0;
    let heaviestWeightKg = 0;
    let bestWeightReps = 0;
    let bestSetVolumeKg = 0;
    let totalSessionVolumeKg = 0;
    let hasPR = false;

    for (const s of workingSets) {
      const e1rm = calculateEstimated1RM(s.weightKg, s.reps);
      const vol = s.weightKg * s.reps;
      totalSessionVolumeKg += vol;

      if (e1rm > bestE1RMKg) {
        bestE1RMKg = e1rm;
      }
      if (s.weightKg > heaviestWeightKg || (s.weightKg === heaviestWeightKg && s.reps > bestWeightReps)) {
        heaviestWeightKg = s.weightKg;
        bestWeightReps = s.reps;
      }
      if (vol > bestSetVolumeKg) {
        bestSetVolumeKg = vol;
      }
      if (s.prs && s.prs.length > 0) {
        hasPR = true;
      }
    }

    if (allPoints.length > 0 && (bestE1RMKg > runningMaxE1RM || heaviestWeightKg > runningMaxWeight)) {
      hasPR = true;
    }
    runningMaxE1RM = Math.max(runningMaxE1RM, bestE1RMKg);
    runningMaxWeight = Math.max(runningMaxWeight, heaviestWeightKg);

    allPoints.push({
      sessionId: session.id,
      date: session.startTime,
      shortDate: formatShortDate(session.startTime),
      bestE1RMKg: Number(bestE1RMKg.toFixed(1)),
      heaviestWeightKg: Number(heaviestWeightKg.toFixed(1)),
      bestWeightReps,
      bestSetVolumeKg: Math.round(bestSetVolumeKg),
      totalSessionVolumeKg: Math.round(totalSessionVolumeKg),
      workingSetsCount: workingSets.length,
      hasPR,
      topSetSummary: `${heaviestWeightKg}kg × ${bestWeightReps}`,
    });
  }

  if (!daysFilter) return allPoints;
  return allPoints.filter((p) => new Date(p.date).getTime() >= cutoffMs);
}

export function getLastPerformedExerciseBlock(
  exerciseId: string,
  workouts: WorkoutSession[]
): { sessionDate: string; exerciseBlock: WorkoutExercise } | null {
  const sortedNewestFirst = [...workouts].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  for (const w of sortedNewestFirst) {
    const found = w.exercises.find(
      (e) => e.exerciseId === exerciseId && getWorkingSets(e.sets).length > 0
    );
    if (found) {
      return { sessionDate: w.startTime, exerciseBlock: found };
    }
  }
  return null;
}

export function getProgressiveOverloadHint(
  exercise: Exercise,
  workouts: WorkoutSession[]
): ProgressiveOverloadHint {
  const last = getLastPerformedExerciseBlock(exercise.id, workouts);
  if (!last) {
    return {
      lastDate: 'Never',
      lastSetsSummary: 'No previous history',
      suggestionText: `Target ${exercise.targetRepRange[0]}–${exercise.targetRepRange[1]} reps with controlled form to establish baseline.`,
      recommendedWeightKg: exercise.barWeightKg || 20,
      recommendedReps: exercise.targetRepRange[0],
      status: 'first_time',
    };
  }

  const working = getWorkingSets(last.exerciseBlock.sets);
  const topSet = working.reduce((best, cur) =>
    cur.weightKg > best.weightKg || (cur.weightKg === best.weightKg && cur.reps > best.reps)
      ? cur
      : best
  , working[0]);

  const [minReps, maxReps] = exercise.targetRepRange;
  const allHitMax = working.every((s) => s.reps >= maxReps && s.weightKg >= topSet.weightKg);
  const topHitMax = topSet.reps >= maxReps;

  const incrementKg =
    exercise.equipment === 'barbell' || exercise.equipment === 'machine' ? 2.5 : 2;

  const setsStr = working.map((s) => `${s.weightKg}×${s.reps}`).join(', ');

  if (allHitMax || topHitMax) {
    const nextWeight = Number((topSet.weightKg + incrementKg).toFixed(2));
    return {
      lastDate: formatShortDate(last.sessionDate),
      lastSetsSummary: setsStr,
      suggestionText: `Hit top of rep range (${topSet.reps} reps) last time — progress load to +${incrementKg} kg today!`,
      recommendedWeightKg: nextWeight,
      recommendedReps: minReps,
      status: 'increase_weight',
    };
  }

  const nextReps = Math.min(maxReps, topSet.reps + 1);
  return {
    lastDate: formatShortDate(last.sessionDate),
    lastSetsSummary: setsStr,
    suggestionText: `Aim to add +1 rep on working sets at current weight before increasing load.`,
    recommendedWeightKg: topSet.weightKg,
    recommendedReps: nextReps,
    status: 'increase_reps',
  };
}

export function evaluateSetPRs(
  exerciseId: string,
  candidateSet: WorkoutSet,
  workouts: WorkoutSession[]
): PRType[] {
  if (!candidateSet.completed || candidateSet.type === 'warmup' || candidateSet.reps <= 0 || candidateSet.weightKg <= 0) {
    return [];
  }

  let historicalMaxWeight = 0;
  let historicalMaxE1RM = 0;
  let historicalMaxVolume = 0;
  let hasHistory = false;

  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of getWorkingSets(ex.sets)) {
        hasHistory = true;
        if (s.weightKg > historicalMaxWeight) historicalMaxWeight = s.weightKg;
        const e1rm = calculateEstimated1RM(s.weightKg, s.reps);
        if (e1rm > historicalMaxE1RM) historicalMaxE1RM = e1rm;
        const vol = s.weightKg * s.reps;
        if (vol > historicalMaxVolume) historicalMaxVolume = vol;
      }
    }
  }

  if (!hasHistory) return ['weight', '1rm'];

  const prs: PRType[] = [];
  const candidateE1RM = calculateEstimated1RM(candidateSet.weightKg, candidateSet.reps);
  const candidateVol = candidateSet.weightKg * candidateSet.reps;

  if (candidateSet.weightKg > historicalMaxWeight) prs.push('weight');
  if (candidateE1RM > historicalMaxE1RM) prs.push('1rm');
  if (candidateVol > historicalMaxVolume) prs.push('volume');

  return prs;
}

export function computeWeeklyMuscleVolumes(
  workouts: WorkoutSession[],
  exercises: Exercise[],
  daysBack = 7
): Record<MuscleGroup, number> {
  const volumes: Record<MuscleGroup, number> = {
    chest: 0,
    lats: 0,
    upper_back: 0,
    front_delts: 0,
    side_delts: 0,
    rear_delts: 0,
    biceps: 0,
    triceps: 0,
    forearms: 0,
    quads: 0,
    hamstrings: 0,
    glutes: 0,
    calves: 0,
    abs: 0,
    lower_back: 0,
  };

  const cutoffMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const weeksFactor = Math.max(1, daysBack / 7);

  for (const w of workouts) {
    if (new Date(w.startTime).getTime() < cutoffMs) continue;
    for (const block of w.exercises) {
      const meta = exMap.get(block.exerciseId);
      if (!meta) continue;
      const workingCount = getWorkingSets(block.sets).length;
      if (workingCount === 0) continue;

      // Primary muscle gets 1.0 effective set per working set
      volumes[meta.primaryMuscle] += workingCount;
      // Secondary muscles get 0.5 effective sets per working set
      for (const sec of meta.secondaryMuscles) {
        volumes[sec] += workingCount * 0.5;
      }
    }
  }

  // Normalize to weekly rate if daysBack > 7
  for (const key of Object.keys(volumes) as MuscleGroup[]) {
    volumes[key] = Number((volumes[key] / weeksFactor).toFixed(1));
  }

  return volumes;
}

export interface WeeklyVolumeSummary {
  weekLabel: string;
  weekStartISO: string;
  totalVolumeKg: number;
  totalWorkingSets: number;
  sessionsCount: number;
  pushSets: number;
  pullSets: number;
  legsSets: number;
}

export function computeWeeklyTonnageTrends(
  workouts: WorkoutSession[],
  exercises: Exercise[],
  weeksCount = 10
): WeeklyVolumeSummary[] {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const now = new Date();
  // Align to start of current week (Monday)
  const dayOfWeek = (now.getDay() + 6) % 7;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - dayOfWeek);
  currentMonday.setHours(0, 0, 0, 0);

  const buckets: WeeklyVolumeSummary[] = [];

  for (let i = weeksCount - 1; i >= 0; i--) {
    const start = new Date(currentMonday);
    start.setDate(currentMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const weekLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let totalVolumeKg = 0;
    let totalWorkingSets = 0;
    let sessionsCount = 0;
    let pushSets = 0;
    let pullSets = 0;
    let legsSets = 0;

    for (const w of workouts) {
      const t = new Date(w.startTime).getTime();
      if (t >= start.getTime() && t < end.getTime()) {
        sessionsCount += 1;
        for (const block of w.exercises) {
          const meta = exMap.get(block.exerciseId);
          const working = getWorkingSets(block.sets);
          totalWorkingSets += working.length;
          for (const s of working) {
            totalVolumeKg += s.weightKg * s.reps;
          }
          if (meta) {
            if (['chest', 'front_delts', 'side_delts', 'triceps'].includes(meta.primaryMuscle)) {
              pushSets += working.length;
            } else if (['lats', 'upper_back', 'rear_delts', 'biceps', 'forearms'].includes(meta.primaryMuscle)) {
              pullSets += working.length;
            } else {
              legsSets += working.length;
            }
          }
        }
      }
    }

    buckets.push({
      weekLabel,
      weekStartISO: start.toISOString(),
      totalVolumeKg: Math.round(totalVolumeKg),
      totalWorkingSets,
      sessionsCount,
      pushSets,
      pullSets,
      legsSets,
    });
  }

  return buckets;
}

export interface DayActivityCell {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // M, T, W, T, F, S, S
  dayNumber: number; // 1..31
  isToday: boolean;
  isFuture: boolean;
  workouts: WorkoutSession[];
  splitTag?: WorkoutSession['splitTag'];
}

export interface StreakAndRestSummary {
  activeWeekStreak: number;
  daysSinceLastWorkout: number | null; // 0 = trained today, 1 = 1 rest day, etc.
  thisWeekWorkouts: number;
  thisWeekRestDays: number;
  last30dWorkouts: number;
  last30dRestDays: number;
  currentWeekStrip: DayActivityCell[];
  recentWeeksGrid: DayActivityCell[][]; // 8 weeks of 7 days (Mon..Sun)
}


export function computeStreakAndRestStats(
  workouts: WorkoutSession[]
): StreakAndRestSummary {
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Map YYYY-MM-DD -> WorkoutSession[]
  const byDate = new Map<string, WorkoutSession[]>();
  for (const w of workouts) {
    const dStr = toLocalDateStr(new Date(w.startTime));
    const list = byDate.get(dStr) || [];
    list.push(w);
    byDate.set(dStr, list);
  }

  // Days since last workout (rest day counter)
  let daysSinceLastWorkout: number | null = null;
  if (workouts.length > 0) {
    const newest = workouts.reduce((latest, cur) =>
      new Date(cur.startTime).getTime() > new Date(latest.startTime).getTime()
        ? cur
        : latest
    , workouts[0]);
    const lastDate = new Date(newest.startTime);
    const lastMidnight = new Date(
      lastDate.getFullYear(),
      lastDate.getMonth(),
      lastDate.getDate()
    );
    daysSinceLastWorkout = Math.max(
      0,
      Math.round((todayMidnight.getTime() - lastMidnight.getTime()) / (24 * 60 * 60 * 1000))
    );
  }

  // Align to Monday of current week
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon .. 6 = Sun
  const currentMonday = new Date(todayMidnight);
  currentMonday.setDate(todayMidnight.getDate() - dayOfWeek);

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const buildWeekCells = (mondayDate: Date): DayActivityCell[] => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const cellDate = new Date(mondayDate);
      cellDate.setDate(mondayDate.getDate() + idx);
      const dateStr = toLocalDateStr(cellDate);
      const dayWorkouts = byDate.get(dateStr) || [];
      return {
        dateStr,
        dayLabel: dayLabels[idx],
        dayNumber: cellDate.getDate(),
        isToday: dateStr === todayStr,
        isFuture: cellDate.getTime() > todayMidnight.getTime(),
        workouts: dayWorkouts,
        splitTag: dayWorkouts[0]?.splitTag,
      };
    });
  };

  const currentWeekStrip = buildWeekCells(currentMonday);
  const elapsedDaysThisWeek = dayOfWeek + 1;
  const thisWeekWorkouts = currentWeekStrip.filter(
    (c) => !c.isFuture && c.workouts.length > 0
  ).length;
  const thisWeekRestDays = Math.max(0, elapsedDaysThisWeek - thisWeekWorkouts);

  // Build 8 weeks grid (oldest -> newest)
  const recentWeeksGrid: DayActivityCell[][] = [];
  for (let w = 7; w >= 0; w--) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - w * 7);
    recentWeeksGrid.push(buildWeekCells(monday));
  }

  // Calculate consecutive active weeks streak (Hevy style: weeks with >=1 workout)
  let activeWeekStreak = 0;
  for (let w = 0; w < 52; w++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - w * 7);
    const cells = buildWeekCells(monday);
    const hasWorkout = cells.some((c) => c.workouts.length > 0);
    if (hasWorkout) {
      activeWeekStreak += 1;
    } else if (w === 0) {
      // If current week hasn't had a workout yet, check if previous week was active
      continue;
    } else {
      break;
    }
  }

  // Last 30 days workout days vs rest days
  let last30dWorkouts = 0;
  for (let d = 0; d < 30; d++) {
    const dt = new Date(todayMidnight);
    dt.setDate(todayMidnight.getDate() - d);
    if ((byDate.get(toLocalDateStr(dt)) || []).length > 0) {
      last30dWorkouts += 1;
    }
  }
  const last30dRestDays = 30 - last30dWorkouts;

  return {
    activeWeekStreak,
    daysSinceLastWorkout,
    thisWeekWorkouts,
    thisWeekRestDays,
    last30dWorkouts,
    last30dRestDays,
    currentWeekStrip,
    recentWeeksGrid,
  };
}


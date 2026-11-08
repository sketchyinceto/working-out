import { Exercise, WeightUnit, WorkoutSession } from '../types/workout';
import { getExerciseProgressionSeries, getWorkingSets, workoutsNewestFirst } from './analytics';
import { kgToDisplay } from './calculators';

export type ProgressionStatus =
  | 'plateau'
  | 'regression'
  | 'fatigue_dropoff'
  | 'overload_weight'
  | 'pr_momentum'
  | 'build_reps'
  | 'baseline';

export interface ExercisePrescription {
  exercise: Exercise;
  targetSets: number;
  targetRepRange: [number, number];
  recommendedWeightKg: number;
  recommendedReps: number;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastDateStr: string;
  e1rmDeltaPct: number;
  slopePctPerSession: number;
  rSquared: number;
  avgSetDropoffPct: number;
  sessionsAnalyzed: number;
  hasMeaningfulInsight: boolean;
  statBadge: string;
  status: ProgressionStatus;
  headline: string;
  coachTip: string;
  suggestedSwapExercise?: Exercise;
}

/**
 * Ordinary Least Squares (OLS) linear regression on a numeric series.
 * Returns normalized slope (% change per step relative to mean) and R^2 goodness-of-fit.
 */
function computeLinearTrendStats(values: number[]): {
  slopePctPerStep: number;
  rSquared: number;
} {
  const n = values.length;
  if (n < 2) return { slopePctPerStep: 0, rSquared: 0 };

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  if (meanY <= 0) return { slopePctPerStep: 0, rSquared: 0 };

  let num = 0;
  let denX = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    const dy = values[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    ssTot += dy * dy;
  }

  const slope = denX > 0 ? num / denX : 0;
  const slopePctPerStep = Number(((slope / meanY) * 100).toFixed(2));

  if (ssTot <= 1e-6) {
    return { slopePctPerStep: 0, rSquared: 1 };
  }

  let ssRes = 0;
  const intercept = meanY - slope * meanX;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    ssRes += (values[i] - pred) ** 2;
  }

  const rSquared = Number(Math.max(0, Math.min(1, 1 - ssRes / ssTot)).toFixed(2));
  return { slopePctPerStep, rSquared };
}

/**
 * Evaluates intra-session set-to-set fatigue drop-off across recent workouts for an exercise.
 * Measures % rep loss from Set 1 to the final working set.
 */
function computeRecentSetDropoffStats(
  exerciseId: string,
  workouts: WorkoutSession[],
  maxSessions = 3
): {
  avgDropoffPct: number;
  latestFirstReps: number;
  latestLastReps: number;
  allLatestSetsClearedReps: (minTarget: number) => boolean;
} {
  const sortedNewest = workoutsNewestFirst(workouts);

  const sessionWorkingSets: { weightKg: number; reps: number }[][] = [];
  for (const w of sortedNewest) {
    const block = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!block) continue;
    const working = getWorkingSets(block.sets);
    if (working.length > 0) {
      sessionWorkingSets.push(working);
      if (sessionWorkingSets.length >= maxSessions) break;
    }
  }

  if (sessionWorkingSets.length === 0) {
    return {
      avgDropoffPct: 0,
      latestFirstReps: 0,
      latestLastReps: 0,
      allLatestSetsClearedReps: () => false,
    };
  }

  const latestSets = sessionWorkingSets[0];
  const latestFirstReps = latestSets[0]?.reps ?? 0;
  const latestLastReps = latestSets[latestSets.length - 1]?.reps ?? 0;

  const dropoffs: number[] = [];
  for (const sets of sessionWorkingSets) {
    if (sets.length < 2) continue;
    const first = sets[0];
    const last = sets[sets.length - 1];
    if (first.reps > 0) {
      const firstVol = first.weightKg * first.reps;
      const lastVol = last.weightKg * last.reps;
      const repDrop = (first.reps - last.reps) / first.reps;
      const volDrop = firstVol > 0 ? (firstVol - lastVol) / firstVol : 0;
      dropoffs.push(Math.max(repDrop, volDrop) * 100);
    }
  }

  const avgDropoffPct =
    dropoffs.length > 0
      ? Number(
          (dropoffs.reduce((a, b) => a + b, 0) / dropoffs.length).toFixed(1)
        )
      : 0;

  return {
    avgDropoffPct,
    latestFirstReps,
    latestLastReps,
    allLatestSetsClearedReps: (minTarget: number) =>
      latestSets.length >= 2 && latestSets.every((s) => s.reps >= minTarget),
  };
}

export function evaluateExercisePrescription(
  exercise: Exercise,
  workouts: WorkoutSession[],
  allExercises: Exercise[],
  unit: WeightUnit,
  targetSetsOverride?: number,
  targetRepRangeOverride?: [number, number]
): ExercisePrescription {
  const series = getExerciseProgressionSeries(exercise.id, workouts, null);
  const targetSets = targetSetsOverride || 3;
  const targetRepRange: [number, number] =
    targetRepRangeOverride || exercise.targetRepRange;
  const [minReps, maxReps] = targetRepRange;

  const incrementKg =
    exercise.equipment === 'barbell' ||
    exercise.equipment === 'machine' ||
    exercise.equipment === 'smith_machine'
      ? 2.5
      : 2;

  const alternateSwap =
    allExercises.find(
      (e) =>
        e.id !== exercise.id &&
        !e.isArchived &&
        e.primaryMuscle === exercise.primaryMuscle &&
        e.equipment !== exercise.equipment
    ) ||
    allExercises.find(
      (e) =>
        e.id !== exercise.id &&
        !e.isArchived &&
        e.primaryMuscle === exercise.primaryMuscle
    );

  if (series.length === 0) {
    const startKg = exercise.barWeightKg || 20;
    return {
      exercise,
      targetSets,
      targetRepRange,
      recommendedWeightKg: startKg,
      recommendedReps: minReps,
      lastWeightKg: null,
      lastReps: null,
      lastDateStr: 'First Session',
      e1rmDeltaPct: 0,
      slopePctPerSession: 0,
      rSquared: 0,
      avgSetDropoffPct: 0,
      sessionsAnalyzed: 0,
      hasMeaningfulInsight: false,
      statBadge: 'No Data',
      status: 'baseline',
      headline: `Establish ${minReps}–${maxReps} Rep Baseline`,
      coachTip: '',
      suggestedSwapExercise: alternateSwap,
    };
  }

  const recentWindow = series.slice(-5);
  const sessionsAnalyzed = recentWindow.length;
  const latest = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;

  const e1rmDeltaPct =
    prev && prev.bestE1RMKg > 0
      ? Number(
          (((latest.bestE1RMKg - prev.bestE1RMKg) / prev.bestE1RMKg) * 100).toFixed(
            1
          )
        )
      : 0;

  const { slopePctPerStep: slopePctPerSession, rSquared } =
    computeLinearTrendStats(recentWindow.map((pt) => pt.bestE1RMKg));

  const setDropStats = computeRecentSetDropoffStats(exercise.id, workouts, 3);
  const recentPeak1RM = Math.max(...recentWindow.map((pt) => pt.bestE1RMKg));
  const dropFromPeakPct =
    recentPeak1RM > 0
      ? Number(
          (((latest.bestE1RMKg - recentPeak1RM) / recentPeak1RM) * 100).toFixed(1)
        )
      : 0;

  // STATISTICAL INSIGHT 1: Multi-Session 1RM Regression / Local Overreaching (requires >= 3 sessions)
  if (
    series.length >= 3 &&
    (dropFromPeakPct <= -3.5 || slopePctPerSession <= -1.2)
  ) {
    const deloadWeightKg =
      Math.round((latest.heaviestWeightKg * 0.925) / 2.5) * 2.5 ||
      latest.heaviestWeightKg;
    return {
      exercise,
      targetSets,
      targetRepRange,
      recommendedWeightKg: deloadWeightKg,
      recommendedReps: minReps + 1,
      lastWeightKg: latest.heaviestWeightKg,
      lastReps: latest.bestWeightReps,
      lastDateStr: latest.shortDate,
      e1rmDeltaPct,
      slopePctPerSession,
      rSquared,
      avgSetDropoffPct: setDropStats.avgDropoffPct,
      sessionsAnalyzed,
      hasMeaningfulInsight: true,
      statBadge: `1RM ${dropFromPeakPct}% vs Peak (n=${sessionsAnalyzed})`,
      status: 'regression',
      headline: `Strength Regression (${dropFromPeakPct}% from Recent Peak)`,
      coachTip: `Estimated 1RM has trended down (${slopePctPerSession}%/session over your last ${sessionsAnalyzed} exposures), indicating local peripheral fatigue. Back off load to ${kgToDisplay(deloadWeightKg, unit)} ${unit} or cut 1 working set this week to restore performance.`,
      suggestedSwapExercise: alternateSwap,
    };
  }

  // STATISTICAL INSIGHT 2: High Intra-Session Set-to-Set Fatigue Drop-Off (>= 26% drop from Set 1 to Set 3 across >= 3 sessions)
  if (series.length >= 3 && setDropStats.avgDropoffPct >= 26) {
    return {
      exercise,
      targetSets,
      targetRepRange,
      recommendedWeightKg: latest.heaviestWeightKg,
      recommendedReps: Math.max(minReps, latest.bestWeightReps - 1),
      lastWeightKg: latest.heaviestWeightKg,
      lastReps: latest.bestWeightReps,
      lastDateStr: latest.shortDate,
      e1rmDeltaPct,
      slopePctPerSession,
      rSquared,
      avgSetDropoffPct: setDropStats.avgDropoffPct,
      sessionsAnalyzed,
      hasMeaningfulInsight: true,
      statBadge: `Set 1→End -${ Math.round(setDropStats.avgDropoffPct)}% Reps`,
      status: 'fatigue_dropoff',
      headline: `High Set-to-Set Fatigue Drop-Off (-${Math.round(setDropStats.avgDropoffPct)}%)`,
      coachTip: `Across your last 3 sessions, output drops from ${setDropStats.latestFirstReps} reps on Set 1 down to ${setDropStats.latestLastReps} reps by your final set. Do not increase weight yet — leave 2 RIR on Set 1 and extend rest by +30s to stabilize volume across all ${targetSets} sets.`,
      suggestedSwapExercise: alternateSwap,
    };
  }

  // STATISTICAL INSIGHT 3: Multi-Session Plateau (flat OLS slope |b| <= 0.35%/session over >= 3 sessions below rep ceiling)
  const isPlateaued =
    series.length >= 3 &&
    Math.abs(slopePctPerSession) <= 0.35 &&
    latest.bestWeightReps < maxReps;

  if (isPlateaued) {
    const deloadWeightKg =
      Math.round((latest.heaviestWeightKg * 0.9) / 2.5) * 2.5 ||
      latest.heaviestWeightKg;
    return {
      exercise,
      targetSets,
      targetRepRange,
      recommendedWeightKg: latest.heaviestWeightKg,
      recommendedReps: Math.min(maxReps, latest.bestWeightReps + 1),
      lastWeightKg: latest.heaviestWeightKg,
      lastReps: latest.bestWeightReps,
      lastDateStr: latest.shortDate,
      e1rmDeltaPct,
      slopePctPerSession,
      rSquared,
      avgSetDropoffPct: setDropStats.avgDropoffPct,
      sessionsAnalyzed,
      hasMeaningfulInsight: true,
      statBadge: `Slope ${slopePctPerSession >= 0 ? '+' : ''}${slopePctPerSession}%/sess (n=${sessionsAnalyzed})`,
      status: 'plateau',
      headline: `Stagnant 1RM Trend (${sessionsAnalyzed} Sessions Flat)`,
      coachTip: alternateSwap
        ? `Linear trend slope is ${slopePctPerSession}%/session over your last ${sessionsAnalyzed} workouts at ${kgToDisplay(latest.heaviestWeightKg, unit)} ${unit}. Try a wave reset (${kgToDisplay(deloadWeightKg, unit)} ${unit} for higher reps) or rotate to ${alternateSwap.name} to bypass accommodation.`
        : `Linear trend slope is ${slopePctPerSession}%/session over your last ${sessionsAnalyzed} workouts. Use a 10% wave reset (${kgToDisplay(deloadWeightKg, unit)} ${unit}) with a controlled eccentric pause.`,
      suggestedSwapExercise: alternateSwap,
    };
  }

  // STATISTICAL INSIGHT 4: All Working Sets Cleared Rep Ceiling across >= 3 tracked sessions
  const allSetsClearedMax = setDropStats.allLatestSetsClearedReps(maxReps);
  if (series.length >= 3 && allSetsClearedMax && slopePctPerSession >= 0) {
    const nextWeightKg = Number((latest.heaviestWeightKg + incrementKg).toFixed(2));
    return {
      exercise,
      targetSets,
      targetRepRange,
      recommendedWeightKg: nextWeightKg,
      recommendedReps: minReps,
      lastWeightKg: latest.heaviestWeightKg,
      lastReps: latest.bestWeightReps,
      lastDateStr: latest.shortDate,
      e1rmDeltaPct,
      slopePctPerSession,
      rSquared,
      avgSetDropoffPct: setDropStats.avgDropoffPct,
      sessionsAnalyzed,
      hasMeaningfulInsight: true,
      statBadge: `All Sets ≥ ${maxReps} Reps (n=${sessionsAnalyzed})`,
      status: 'overload_weight',
      headline: `Rep Range Ceiling Cleared Across All Working Sets`,
      coachTip: `You completed ≥${maxReps} reps across every working set at ${kgToDisplay(latest.heaviestWeightKg, unit)} ${unit} with only ${Math.round(setDropStats.avgDropoffPct)}% intra-session fatigue drop-off. Graduate to ${kgToDisplay(nextWeightKg, unit)} ${unit} and reset to ${minReps} reps.`,
      suggestedSwapExercise: alternateSwap,
    };
  }

  // STATISTICAL INSIGHT 5: High-Velocity Linear Breakout Trend (OLS slope >= +1.6%/session with R^2 >= 0.75 over >= 4 sessions)
  if (series.length >= 4 && slopePctPerSession >= 1.6 && rSquared >= 0.75) {
    const nextReps = Math.min(maxReps, latest.bestWeightReps + 1);
    return {
      exercise,
      targetSets,
      targetRepRange,
      recommendedWeightKg: latest.heaviestWeightKg,
      recommendedReps: nextReps,
      lastWeightKg: latest.heaviestWeightKg,
      lastReps: latest.bestWeightReps,
      lastDateStr: latest.shortDate,
      e1rmDeltaPct,
      slopePctPerSession,
      rSquared,
      avgSetDropoffPct: setDropStats.avgDropoffPct,
      sessionsAnalyzed,
      hasMeaningfulInsight: true,
      statBadge: `+${slopePctPerSession}%/sess (R²=${rSquared})`,
      status: 'pr_momentum',
      headline: `Strong Linear 1RM Trend (+${slopePctPerSession}%/session)`,
      coachTip: `Consistent strength velocity over ${sessionsAnalyzed} sessions (R² = ${rSquared}, slope +${slopePctPerSession}%/session). Current volume and recovery frequency are optimal — keep stimulus unchanged.`,
      suggestedSwapExercise: alternateSwap,
    };
  }

  // NORMAL IN-RANGE PROGRESSION (No statistical anomaly — do not emit noisy tip card)
  const nextReps =
    latest.bestWeightReps < maxReps
      ? latest.bestWeightReps + 1
      : latest.bestWeightReps;
  return {
    exercise,
    targetSets,
    targetRepRange,
    recommendedWeightKg: latest.heaviestWeightKg,
    recommendedReps: nextReps,
    lastWeightKg: latest.heaviestWeightKg,
    lastReps: latest.bestWeightReps,
    lastDateStr: latest.shortDate,
    e1rmDeltaPct,
    slopePctPerSession,
    rSquared,
    avgSetDropoffPct: setDropStats.avgDropoffPct,
    sessionsAnalyzed,
    hasMeaningfulInsight: false,
    statBadge: `In ${minReps}–${maxReps} Rep Zone`,
    status: 'build_reps',
    headline: `Steady in ${minReps}–${maxReps} Rep Window`,
    coachTip: '',
    suggestedSwapExercise: alternateSwap,
  };
}

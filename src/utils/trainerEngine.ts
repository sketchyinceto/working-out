import {
  Exercise,
  MuscleGroup,
  Routine,
  WeightUnit,
  WorkoutSession,
} from '../types/workout';
import { MUSCLE_CATEGORY_MAP, MUSCLE_LABELS } from '../data/seedExercises';
import {
  computeStreakAndRestStats,
  computeWeeklyMuscleVolumes,
  computeWeeklyTonnageTrends,
  formatShortDate,
  getExerciseProgressionSeries,
  getWorkingSets,
} from './analytics';
import { kgToDisplay } from './calculators';
import { pluralize } from './text';

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

export interface NextWorkoutPrescription {
  recommendedSplit: 'Push' | 'Pull' | 'Legs';
  recommendedRoutine: Routine;
  reason: string;
  daysSinceThisSplit: number | null;
  prescriptions: ExercisePrescription[];
  estimatedDurationMin: number;
  totalTargetSets: number;
}

export interface MuscleGapSuggestion {
  muscle: MuscleGroup;
  muscleLabel: string;
  split: 'Push' | 'Pull' | 'Legs';
  weeklySets: number;
  targetMinSets: number;
  targetMaxSets: number;
  status: 'under' | 'optimal' | 'over';
  DeficitSets: number;
  coachAdvice: string;
  recommendedExercises: Exercise[];
  targetRoutineId?: string;
  targetRoutineName?: string;
}

export interface CoachingTipCard {
  id: string;
  category: 'recovery' | 'overload' | 'balance' | 'technique';
  splitKey: 'Push' | 'Pull' | 'Legs' | 'Neutral';
  title: string;
  body: string;
  metricBadge: string;
}

export interface TrainerTimePoint {
  weekLabel: string;
  weekStartISO: string;
  overloadScore: number;
  consistencyScore: number;
  balanceScore: number;
  strengthScore: number;
}

export interface TrainerEvaluationReport {
  overallScore: number;
  gradeLabel: 'Elite' | 'Optimal' | 'Building' | 'Needs Work';
  consistencyScore: number;
  overloadScore: number;
  balanceScore: number;
  strengthScore: number;
  scoreHistory: TrainerTimePoint[];
  readinessStatus: 'Primed to Train' | 'Active Recovery' | 'High Fatigue';
  coachSummary: string;
  nextWorkout: NextWorkoutPrescription;
  exerciseDiagnostics: ExercisePrescription[];
  muscleVolumeAudit: MuscleGapSuggestion[];
  coachingTips: CoachingTipCard[];
}

function muscleToSplit(muscle: MuscleGroup): 'Push' | 'Pull' | 'Legs' {
  const cat = MUSCLE_CATEGORY_MAP[muscle];
  if (cat === 'Push') return 'Push';
  if (cat === 'Pull') return 'Pull';
  return 'Legs';
}

const MUSCLE_LANDMARKS: Record<
  MuscleGroup,
  { min: number; max: number; priority: number }
> = {
  chest: { min: 10, max: 18, priority: 1 },
  lats: { min: 10, max: 18, priority: 1 },
  upper_back: { min: 8, max: 16, priority: 2 },
  quads: { min: 8, max: 16, priority: 1 },
  hamstrings: { min: 6, max: 14, priority: 1 },
  glutes: { min: 6, max: 14, priority: 2 },
  side_delts: { min: 8, max: 18, priority: 1 },
  front_delts: { min: 4, max: 12, priority: 3 },
  rear_delts: { min: 6, max: 14, priority: 2 },
  triceps: { min: 6, max: 14, priority: 2 },
  biceps: { min: 6, max: 14, priority: 2 },
  calves: { min: 6, max: 14, priority: 2 },
  abs: { min: 4, max: 12, priority: 3 },
  forearms: { min: 2, max: 10, priority: 4 },
  lower_back: { min: 2, max: 8, priority: 4 },
};

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
  const sortedNewest = [...workouts].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

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

export function generateTrainerEvaluation(
  workouts: WorkoutSession[],
  exercises: Exercise[],
  routines: Routine[],
  unit: WeightUnit
): TrainerEvaluationReport {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const streakStats = computeStreakAndRestStats(workouts);
  const weeklyMuscleVolumes = computeWeeklyMuscleVolumes(workouts, exercises, 7);
  const tonnageTrends = computeWeeklyTonnageTrends(workouts, exercises, 4);

  // 1. Determine Recommended Next Split & Routine
  const sortedNewest = [...workouts].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  const lastSession = sortedNewest[0];
  const recommendedSplit: 'Push' | 'Pull' | 'Legs' =
    lastSession?.splitTag === 'Push'
      ? 'Pull'
      : lastSession?.splitTag === 'Pull'
      ? 'Legs'
      : 'Push';

  const lastSameSplitSession = sortedNewest.find(
    (w) => w.splitTag === recommendedSplit
  );
  const daysSinceThisSplit = lastSameSplitSession
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(lastSameSplitSession.startTime).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : null;

  const recommendedRoutine =
    routines.find(
      (r) =>
        r.splitTag === recommendedSplit &&
        r.id === `routine-ppl-${recommendedSplit.toLowerCase()}`
    ) ||
    routines.find((r) => r.splitTag === recommendedSplit) ||
    routines[0];

  const prescriptions: ExercisePrescription[] = (
    recommendedRoutine?.exercises || []
  )
    .map((tmpl) => {
      const meta = exMap.get(tmpl.exerciseId);
      if (!meta) return null;
      return evaluateExercisePrescription(
        meta,
        workouts,
        exercises,
        unit,
        tmpl.targetSets,
        tmpl.targetRepRange
      );
    })
    .filter((p): p is ExercisePrescription => p !== null);

  const totalTargetSets = prescriptions.reduce((sum, p) => sum + p.targetSets, 0);
  const estimatedDurationMin = Math.max(35, Math.round(totalTargetSets * 3.2));

  // 2. Evaluate all performed exercises for statistical diagnostics
  const performedExerciseIds = new Set<string>();
  for (const w of sortedNewest.slice(0, 15)) {
    for (const b of w.exercises) {
      if (getWorkingSets(b.sets).length > 0) {
        performedExerciseIds.add(b.exerciseId);
      }
    }
  }

  const allEvaluatedLifts: ExercisePrescription[] = Array.from(
    performedExerciseIds
  )
    .map((id) => {
      const meta = exMap.get(id);
      if (!meta) return null;
      return evaluateExercisePrescription(meta, workouts, exercises, unit);
    })
    .filter((d): d is ExercisePrescription => d !== null);

  // Only surface exercises with a statistically meaningful multi-session pattern
  const exerciseDiagnostics: ExercisePrescription[] = allEvaluatedLifts
    .filter((d) => d.hasMeaningfulInsight)
    .sort((a, b) => {
      const order: Record<ProgressionStatus, number> = {
        regression: 0,
        plateau: 1,
        fatigue_dropoff: 2,
        overload_weight: 3,
        pr_momentum: 4,
        build_reps: 5,
        baseline: 6,
      };
      return order[a.status] - order[b.status];
    });

  // 3. Muscle Volume Audit & Exercise Suggestions
  const priorityMuscles: MuscleGroup[] = [
    'chest',
    'lats',
    'upper_back',
    'side_delts',
    'quads',
    'hamstrings',
    'glutes',
    'triceps',
    'biceps',
    'rear_delts',
    'calves',
    'abs',
  ];

  const muscleVolumeAudit: MuscleGapSuggestion[] = priorityMuscles.map(
    (muscle) => {
      const weeklySets = weeklyMuscleVolumes[muscle] || 0;
      const landmark = MUSCLE_LANDMARKS[muscle];
      const split = muscleToSplit(muscle);
      const targetRoutine =
        routines.find((r) => r.splitTag === split) || routines[0];

      const candidateExercises = exercises.filter(
        (e) => e.primaryMuscle === muscle && !e.isArchived
      );

      let status: 'under' | 'optimal' | 'over' = 'optimal';
      let coachAdvice = `Hitting ${weeklySets} effective sets/wk — right inside the ${landmark.min}–${landmark.max} set hypertrophy zone.`;

      if (weeklySets < landmark.min) {
        status = 'under';
        const deficit = Math.ceil(landmark.min - weeklySets);
        const topPick = candidateExercises[0]?.name || 'an isolation movement';
        coachAdvice = `${pluralize(deficit, 'set')} below minimum effective volume (${landmark.min} sets/wk). Add 3 sets of ${topPick} on ${split} day.`;
      } else if (weeklySets > landmark.max) {
        status = 'over';
        coachAdvice = `High weekly volume (${weeklySets} sets/wk > ${landmark.max}). Monitor joint recovery and trim 2–3 junk sets if strength stalls.`;
      }

      return {
        muscle,
        muscleLabel: MUSCLE_LABELS[muscle]
          .replace(' & Traps', '')
          .replace(' & Core', ''),
        split,
        weeklySets,
        targetMinSets: landmark.min,
        targetMaxSets: landmark.max,
        status,
        DeficitSets: Math.max(0, Math.ceil(landmark.min - weeklySets)),
        coachAdvice,
        recommendedExercises: candidateExercises.slice(0, 2),
        targetRoutineId: targetRoutine?.id,
        targetRoutineName: targetRoutine?.name,
      };
    }
  );

  // 4. Calculate Sub-Scores & Overall Score
  const hasWorkouts = workouts.length > 0;

  // Consistency (target ~3.5 workouts/wk = 14 workouts/30d)
  const consistencyRaw = Math.min(
    100,
    Math.round((streakStats.last30dWorkouts / 13) * 100)
  );
  const consistencyScore = hasWorkouts
    ? Math.max(20, Math.min(100, consistencyRaw))
    : 0;

  // Progressive Overload Rate (% of active lifts with positive or non-stalled multi-session slope)
  const progressingCount = allEvaluatedLifts.filter(
    (d) =>
      d.status === 'overload_weight' ||
      d.status === 'pr_momentum' ||
      (d.status === 'build_reps' && d.slopePctPerSession >= 0)
  ).length;
  const overloadScore =
    hasWorkouts && allEvaluatedLifts.length > 0
      ? Math.round((progressingCount / allEvaluatedLifts.length) * 100)
      : 0;

  // Muscle Balance Score
  const optimalMusclesCount = muscleVolumeAudit.filter(
    (m) => m.status === 'optimal' || m.weeklySets >= m.targetMinSets * 0.75
  ).length;
  const balanceScore = hasWorkouts
    ? Math.round((optimalMusclesCount / muscleVolumeAudit.length) * 100)
    : 0;

  // Strength Score (out of 100, evaluated against compound 1RM standards)
  const strengthBenchmarks: { id: string; target1RMKg: number }[] = [
    { id: 'ex-bench-press', target1RMKg: 115 },
    { id: 'ex-barbell-squat', target1RMKg: 150 },
    { id: 'ex-rdl', target1RMKg: 155 },
    { id: 'ex-barbell-row', target1RMKg: 105 },
    { id: 'ex-lat-pulldown', target1RMKg: 95 },
    { id: 'ex-ohp', target1RMKg: 72.5 },
  ];

  const liftStrengthRatios: number[] = [];
  for (const bm of strengthBenchmarks) {
    const s = getExerciseProgressionSeries(bm.id, workouts, null);
    if (s.length > 0) {
      const max1RM = Math.max(...s.map((pt) => pt.bestE1RMKg));
      liftStrengthRatios.push(
        Math.min(100, Math.round((max1RM / bm.target1RMKg) * 100))
      );
    }
  }
  const strengthScore = !hasWorkouts
    ? 0
    : liftStrengthRatios.length > 0
    ? Math.max(
        35,
        Math.min(
          100,
          Math.round(
            liftStrengthRatios.reduce((a, b) => a + b, 0) /
              liftStrengthRatios.length
          )
        )
      )
    : 60;

  const overallScore = hasWorkouts
    ? Math.round(
        overloadScore * 0.3 +
          consistencyScore * 0.25 +
          balanceScore * 0.2 +
          strengthScore * 0.25
      )
    : 0;

  // Build 8-week historical time series for the 4 metrics (all out of 100)
  const weeksCount = 8;
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - dayOfWeek);
  currentMonday.setHours(0, 0, 0, 0);

  const scoreHistory: TrainerTimePoint[] = [];
  for (let i = weeksCount - 1; i >= 0; i--) {
    const start = new Date(currentMonday);
    start.setDate(currentMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const window14Start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);

    const weekLabel =
      i === 0
        ? 'Now'
        : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (i === 0) {
      scoreHistory.push({
        weekLabel,
        weekStartISO: start.toISOString(),
        overloadScore,
        consistencyScore,
        balanceScore,
        strengthScore,
      });
      continue;
    }

    const workoutsUpToEnd = workouts.filter(
      (w) => new Date(w.startTime).getTime() < end.getTime()
    );
    if (workoutsUpToEnd.length === 0) {
      scoreHistory.push({
        weekLabel,
        weekStartISO: start.toISOString(),
        overloadScore: 0,
        consistencyScore: 0,
        balanceScore: 0,
        strengthScore: 0,
      });
      continue;
    }

    const workoutsIn14d = workoutsUpToEnd.filter(
      (w) => new Date(w.startTime).getTime() >= window14Start.getTime()
    );

    // 1. Historical Consistency Score (target ~6 sessions per 14 days)
    const histConsistency =
      workoutsIn14d.length > 0
        ? Math.max(25, Math.min(100, Math.round((workoutsIn14d.length / 6) * 100)))
        : 0;

    // 2. Historical Overload Score
    const recentExIds = new Set<string>();
    for (const w of workoutsIn14d) {
      for (const b of w.exercises) {
        if (getWorkingSets(b.sets).length > 0) recentExIds.add(b.exerciseId);
      }
    }
    let histProgCount = 0;
    for (const exId of recentExIds) {
      const s = getExerciseProgressionSeries(exId, workoutsUpToEnd, null);
      if (s.length >= 2) {
        const lastPt = s[s.length - 1];
        const prevPt = s[s.length - 2];
        if (
          lastPt.bestE1RMKg >= prevPt.bestE1RMKg ||
          lastPt.bestWeightReps > prevPt.bestWeightReps
        ) {
          histProgCount += 1;
        }
      } else if (s.length === 1) {
        histProgCount += 1;
      }
    }
    const histOverload =
      recentExIds.size > 0
        ? Math.max(
            30,
            Math.min(100, Math.round((histProgCount / recentExIds.size) * 100))
          )
        : 0;

    // 3. Historical Muscle Balance Score (7-day normalized effective sets in that window)
    const histMuscleSets: Partial<Record<MuscleGroup, number>> = {};
    for (const w of workoutsIn14d) {
      for (const b of w.exercises) {
        const meta = exMap.get(b.exerciseId);
        if (!meta) continue;
        const wc = getWorkingSets(b.sets).length;
        histMuscleSets[meta.primaryMuscle] =
          (histMuscleSets[meta.primaryMuscle] || 0) + wc / 2;
        for (const sec of meta.secondaryMuscles) {
          histMuscleSets[sec] = (histMuscleSets[sec] || 0) + (wc * 0.5) / 2;
        }
      }
    }
    let histOptimalMuscles = 0;
    for (const m of priorityMuscles) {
      const sets = histMuscleSets[m] || 0;
      const lm = MUSCLE_LANDMARKS[m];
      if (sets >= lm.min * 0.75 && sets <= lm.max * 1.15) {
        histOptimalMuscles += 1;
      }
    }
    const histBalance =
      workoutsIn14d.length > 0
        ? Math.max(
            20,
            Math.min(
              100,
              Math.round((histOptimalMuscles / priorityMuscles.length) * 100)
            )
          )
        : 0;

    // 4. Historical Strength Score up to `end`
    const histRatios: number[] = [];
    for (const bm of strengthBenchmarks) {
      const s = getExerciseProgressionSeries(bm.id, workoutsUpToEnd, null);
      if (s.length > 0) {
        const max1RM = Math.max(...s.map((pt) => pt.bestE1RMKg));
        histRatios.push(
          Math.min(100, Math.round((max1RM / bm.target1RMKg) * 100))
        );
      }
    }
    const histStrength =
      histRatios.length > 0
        ? Math.max(
            35,
            Math.min(
              100,
              Math.round(
                histRatios.reduce((a, b) => a + b, 0) / histRatios.length
              )
            )
          )
        : 50;

    scoreHistory.push({
      weekLabel,
      weekStartISO: start.toISOString(),
      overloadScore: histOverload,
      consistencyScore: histConsistency,
      balanceScore: histBalance,
      strengthScore: histStrength,
    });
  }

  const gradeLabel: TrainerEvaluationReport['gradeLabel'] =
    overallScore >= 85
      ? 'Elite'
      : overallScore >= 72
      ? 'Optimal'
      : overallScore >= 55
      ? 'Building'
      : 'Needs Work';

  const readinessStatus: TrainerEvaluationReport['readinessStatus'] =
    streakStats.daysSinceLastWorkout === 0
      ? 'Active Recovery'
      : (streakStats.daysSinceLastWorkout ?? 2) <= 3
      ? 'Primed to Train'
      : 'Primed to Train';

  // 5. Generate Strictly Statistical Coaching Insights (Only when meaningful trends exist)
  const coachingTips: CoachingTipCard[] = [];

  const stalledOrRegressing = exerciseDiagnostics.filter(
    (d) => d.status === 'regression' || d.status === 'plateau'
  );
  if (stalledOrRegressing.length > 0) {
    const topIssue = stalledOrRegressing[0];
    coachingTips.push({
      id: 'tip-stall-regression',
      category: 'technique',
      splitKey: muscleToSplit(topIssue.exercise.primaryMuscle),
      title:
        topIssue.status === 'regression'
          ? `${topIssue.exercise.name}: 1RM Dip Detected`
          : `${topIssue.exercise.name}: ${topIssue.sessionsAnalyzed}-Session Plateau`,
      body: topIssue.coachTip,
      metricBadge: topIssue.statBadge,
    });
  }

  const highDropoffLifts = exerciseDiagnostics.filter(
    (d) => d.status === 'fatigue_dropoff'
  );
  if (highDropoffLifts.length > 0) {
    const dropLift = highDropoffLifts[0];
    coachingTips.push({
      id: 'tip-set-dropoff',
      category: 'recovery',
      splitKey: muscleToSplit(dropLift.exercise.primaryMuscle),
      title: `Excessive Set-to-Set Drop on ${dropLift.exercise.name}`,
      body: dropLift.coachTip,
      metricBadge: dropLift.statBadge,
    });
  }

  const curWeek = tonnageTrends[tonnageTrends.length - 1];
  const priorWeeks = tonnageTrends.slice(0, -1).filter((w) => w.totalVolumeKg > 0);
  const chronicAvgKg =
    priorWeeks.length > 0
      ? priorWeeks.reduce((s, w) => s + w.totalVolumeKg, 0) / priorWeeks.length
      : 0;
  if (curWeek && chronicAvgKg > 0) {
    const acwr = Number((curWeek.totalVolumeKg / chronicAvgKg).toFixed(2));
    if (acwr >= 1.25) {
      coachingTips.push({
        id: 'tip-acwr-spike',
        category: 'recovery',
        splitKey: 'Neutral',
        title: `High Acute:Chronic Workload Ratio (${acwr}x)`,
        body: `7-day volume is ${Math.round((acwr - 1) * 100)}% above your ${priorWeeks.length}-week rolling mean. Cap compound sets at 2 RIR this week to prevent connective tissue overload.`,
        metricBadge: `ACWR ${acwr}`,
      });
    } else if (acwr <= 0.72 && curWeek.totalVolumeKg > 0) {
      coachingTips.push({
        id: 'tip-acwr-dip',
        category: 'overload',
        splitKey: 'Neutral',
        title: `Weekly Volume Dip (${Math.round(acwr * 100)}% of Baseline)`,
        body: `Current weekly tonnage is ${Math.round((1 - acwr) * 100)}% below your chronic rolling average. Consistency drives long-term hypertrophy.`,
        metricBadge: `ACWR ${acwr}`,
      });
    }
  }

  const breakoutOrGraduated = exerciseDiagnostics.filter(
    (d) => d.status === 'pr_momentum' || d.status === 'overload_weight'
  );
  if (coachingTips.length < 3 && breakoutOrGraduated.length > 0) {
    const topPos = breakoutOrGraduated[0];
    coachingTips.push({
      id: 'tip-stat-breakout',
      category: 'overload',
      splitKey: muscleToSplit(topPos.exercise.primaryMuscle),
      title:
        topPos.status === 'pr_momentum'
          ? `${topPos.exercise.name}: Top Responder`
          : `${topPos.exercise.name}: Rep Ceiling Cleared`,
      body: topPos.coachTip,
      metricBadge: topPos.statBadge,
    });
  }

  const anomalyCount = stalledOrRegressing.length + highDropoffLifts.length;

  const coachSummary = !hasWorkouts
    ? `Log at least 3 sessions per lift to unlock multi-session regression, plateau, and set-fatigue analytics.`
    : exerciseDiagnostics.length === 0
    ? `All ${allEvaluatedLifts.length} tracked exercises are progressing steadily inside their target rep ranges with no plateaus or fatigue anomalies detected.`
    : `${exerciseDiagnostics.length} statistical ${
        exerciseDiagnostics.length === 1 ? 'insight' : 'insights'
      } detected across ${allEvaluatedLifts.length} tracked lifts (${anomalyCount} ${
        anomalyCount === 1 ? 'requires' : 'require'
      } load/fatigue adjustment, ${progressingCount}/${allEvaluatedLifts.length} trending upward).`;

  return {
    overallScore,
    gradeLabel,
    consistencyScore,
    overloadScore,
    balanceScore,
    strengthScore,
    scoreHistory,
    readinessStatus,
    coachSummary,
    nextWorkout: {
      recommendedSplit,
      recommendedRoutine,
      reason:
        daysSinceThisSplit !== null
          ? daysSinceThisSplit === 0
            ? `You already trained ${recommendedSplit} today`
            : `${pluralize(daysSinceThisSplit, 'day')} of recovery since your last ${recommendedSplit} workout`
          : `Next in your Push / Pull / Legs rotation`,
      daysSinceThisSplit,
      prescriptions,
      estimatedDurationMin,
      totalTargetSets,
    },
    exerciseDiagnostics,
    muscleVolumeAudit,
    coachingTips: coachingTips.slice(0, 3),
  };
}

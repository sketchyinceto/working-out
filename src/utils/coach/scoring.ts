import {
  ActiveProgramme,
  BodyMeasurementEntry,
  Exercise,
  MuscleGroup,
  TrainingProfile,
  WorkoutSession,
} from '../../types/workout';
import { getExerciseProgressionSeries, getWorkingSets } from '../analytics';
import { MUSCLE_LABELS } from '../../data/seedExercises';
import { getProgrammeStatus, latestBodyweightKg } from './programme';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;

export type ScoreKey = 'consistency' | 'progression' | 'volume' | 'strength';

export interface SubScore {
  key: ScoreKey;
  label: string;
  /** 0–100, or null when there isn't enough data to judge. */
  score: number | null;
  /** How much it counts toward the overall score. */
  weight: number;
  /** Plain-language explanation of where the number came from. */
  detail: string;
}

export interface TrainerScore {
  overall: number | null;
  grade: 'Elite' | 'On Track' | 'Building' | 'Needs Work' | 'Getting Started';
  summary: string;
  subscores: SubScore[];
}

/** Muscles checked for weekly volume (small helper muscles are left out). */
const MAJOR_MUSCLES: MuscleGroup[] = [
  'chest',
  'lats',
  'upper_back',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
];

/**
 * Intermediate-level estimated 1-rep max as a multiple of bodyweight. Rough
 * benchmarks for a trained adult man; beginner/advanced targets scale these.
 */
const STRENGTH_STANDARDS: { id: string; bodyweightRatio: number; absoluteKg: number }[] = [
  { id: 'ex-bench-press', bodyweightRatio: 1.25, absoluteKg: 95 },
  { id: 'ex-barbell-squat', bodyweightRatio: 1.5, absoluteKg: 115 },
  { id: 'ex-conventional-deadlift', bodyweightRatio: 1.75, absoluteKg: 135 },
  { id: 'ex-rdl', bodyweightRatio: 1.4, absoluteKg: 105 },
  { id: 'ex-ohp', bodyweightRatio: 0.75, absoluteKg: 57.5 },
  { id: 'ex-barbell-row', bodyweightRatio: 1.0, absoluteKg: 75 },
  { id: 'ex-lat-pulldown', bodyweightRatio: 0.9, absoluteKg: 70 },
];
const EXPERIENCE_FACTOR = { beginner: 0.7, intermediate: 1, advanced: 1.3 };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function weeklySetTarget(phase?: string): [number, number] {
  // Fewer sets are enough to keep muscle while cutting (Bickel et al., 2011).
  return phase === 'cut' ? [6, 14] : [10, 20];
}

/**
 * Overall training score from four parts, each judged over the last 4 weeks:
 * showing up as planned, getting stronger, doing enough sets for every muscle,
 * and strength relative to bodyweight.
 */
export function computeTrainerScore(
  workouts: WorkoutSession[],
  exercises: Exercise[],
  measurements: BodyMeasurementEntry[],
  profile: TrainingProfile,
  programme: ActiveProgramme | null | undefined,
  now: Date = new Date()
): TrainerScore {
  const nowMs = now.getTime();
  const windowStart = nowMs - WINDOW_DAYS * DAY_MS;
  const recent = workouts.filter((w) => {
    const t = Date.parse(w.startTime);
    return t >= windowStart && t <= nowMs;
  });

  if (workouts.length === 0) {
    return {
      overall: null,
      grade: 'Getting Started',
      summary: 'Log a few workouts and your score will appear here.',
      subscores: [],
    };
  }

  const phase = getProgrammeStatus(programme, now)?.week?.phase;
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  // --- Consistency: sessions done vs planned ---
  const firstMs = Math.min(...workouts.map((w) => Date.parse(w.startTime)));
  const daysTracked = Math.min(WINDOW_DAYS, Math.max(7, (nowMs - firstMs) / DAY_MS));
  const perWeek = Math.max(1, profile.trainingDays.length || 3);
  const planned = Math.max(1, Math.round((perWeek * daysTracked) / 7));
  const consistency: SubScore = {
    key: 'consistency',
    label: 'Consistency',
    weight: 0.25,
    score: clamp((recent.length / planned) * 100),
    detail: `${recent.length} of ${planned} planned sessions in the last ${Math.round(daysTracked / 7)} weeks.`,
  };

  // --- Progression: lifts that got stronger (or held, in a cut) ---
  const recentIds = new Set<string>();
  for (const w of recent) for (const b of w.exercises) if (getWorkingSets(b.sets).length) recentIds.add(b.exerciseId);
  let compared = 0;
  let points = 0;
  let improved = 0;
  for (const id of recentIds) {
    const series = getExerciseProgressionSeries(id, workouts);
    const before = series.filter((p) => Date.parse(p.date) < windowStart);
    const inWindow = series.filter((p) => Date.parse(p.date) >= windowStart);
    if (before.length === 0 || inWindow.length === 0) continue;
    const prevBest = Math.max(...before.slice(-6).map((p) => p.bestE1RMKg));
    const nowBest = Math.max(...inWindow.map((p) => p.bestE1RMKg));
    compared += 1;
    if (nowBest >= prevBest * 1.01) {
      points += 1;
      improved += 1;
    } else if (nowBest >= prevBest * 0.99) {
      points += phase === 'cut' ? 1 : 0.5;
    }
  }
  const progression: SubScore = {
    key: 'progression',
    label: 'Progression',
    weight: 0.3,
    score: compared > 0 ? clamp((points / compared) * 100) : null,
    detail:
      compared > 0
        ? `${improved} of ${compared} lifts beat their previous best in the last 4 weeks${phase === 'cut' ? ' (holding strength also counts during a cut)' : ''}.`
        : 'Needs a few more weeks of history to compare lifts against.',
  };

  // --- Volume: weekly hard sets per major muscle vs the target range ---
  const [minSets, maxSets] = weeklySetTarget(phase);
  const muscleSets: Partial<Record<MuscleGroup, number>> = {};
  for (const w of recent) {
    for (const b of w.exercises) {
      const meta = exMap.get(b.exerciseId);
      if (!meta) continue;
      const n = getWorkingSets(b.sets).length;
      muscleSets[meta.primaryMuscle] = (muscleSets[meta.primaryMuscle] || 0) + n;
      for (const sec of meta.secondaryMuscles) muscleSets[sec] = (muscleSets[sec] || 0) + n * 0.5;
    }
  }
  const weeks = daysTracked / 7;
  let volumeTotal = 0;
  const low: string[] = [];
  for (const m of MAJOR_MUSCLES) {
    const perWeekSets = (muscleSets[m] || 0) / weeks;
    if (perWeekSets < minSets) {
      volumeTotal += perWeekSets / minSets;
      low.push(MUSCLE_LABELS[m].replace(' & Traps', '').replace(' & Core', ''));
    } else if (perWeekSets > maxSets * 1.25) {
      volumeTotal += Math.max(0, 1 - (perWeekSets - maxSets * 1.25) / maxSets);
    } else {
      volumeTotal += 1;
    }
  }
  const volume: SubScore = {
    key: 'volume',
    label: 'Volume',
    weight: 0.2,
    score: clamp((volumeTotal / MAJOR_MUSCLES.length) * 100),
    detail:
      low.length === 0
        ? `Every major muscle gets at least ${minSets} sets a week.`
        : `Below ${minSets} sets a week: ${low.slice(0, 4).join(', ')}${low.length > 4 ? ` +${low.length - 4} more` : ''}.`,
  };

  // --- Strength: best recent lifts vs bodyweight standards ---
  const bodyweight = latestBodyweightKg(measurements);
  const factor = EXPERIENCE_FACTOR[profile.experience] ?? 1;
  const ratios: number[] = [];
  for (const std of STRENGTH_STANDARDS) {
    const series = getExerciseProgressionSeries(std.id, workouts);
    if (series.length === 0) continue;
    const recentPts = series.filter((p) => Date.parse(p.date) >= nowMs - 8 * 7 * DAY_MS);
    const best = Math.max(...(recentPts.length ? recentPts : series).map((p) => p.bestE1RMKg));
    const target = (bodyweight ? std.bodyweightRatio * bodyweight : std.absoluteKg) * factor;
    ratios.push(Math.min(1, best / target));
  }
  const strength: SubScore = {
    key: 'strength',
    label: 'Strength',
    weight: 0.25,
    score: ratios.length ? clamp((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : null,
    detail: ratios.length
      ? bodyweight
        ? `Your main lifts vs ${profile.experience}-level targets for your ${bodyweight} kg bodyweight.`
        : `Your main lifts vs typical ${profile.experience} targets. Log your bodyweight on Summary for a fairer score.`
      : 'Log bench, squat, deadlift, overhead press or rows to get a strength score.',
  };

  const subscores = [consistency, progression, volume, strength];
  const scored = subscores.filter((s) => s.score !== null);
  const weightSum = scored.reduce((a, s) => a + s.weight, 0);
  const overall = scored.length
    ? Math.round(scored.reduce((a, s) => a + (s.score as number) * s.weight, 0) / weightSum)
    : null;

  const grade: TrainerScore['grade'] =
    overall === null
      ? 'Getting Started'
      : overall >= 85
      ? 'Elite'
      : overall >= 70
      ? 'On Track'
      : overall >= 50
      ? 'Building'
      : 'Needs Work';

  const weakest = [...scored].sort((a, b) => (a.score as number) - (b.score as number))[0];
  const summary =
    overall === null
      ? 'Keep logging and your score will fill in.'
      : weakest && (weakest.score as number) < 70
      ? `Biggest opportunity: ${weakest.label.toLowerCase()}. ${weakest.detail}`
      : 'Everything is in a good place. Keep it going.';

  return { overall, grade, summary, subscores };
}

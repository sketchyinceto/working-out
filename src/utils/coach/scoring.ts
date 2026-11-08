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

export type ScoreKey = 'consistency' | 'progression' | 'strength';

/** One colour per score part, shared by its bar and its trend line. */
export const SCORE_COLORS: Record<ScoreKey, string> = {
  consistency: '#00f5ea',
  progression: '#bf5af2',
  strength: '#ffe620',
};

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

/**
 * Overall training score from three parts, judged over the last 4 weeks:
 * showing up as planned (30%), getting stronger (40%), and strength relative
 * to bodyweight (30%).
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
    weight: 0.3,
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
    weight: 0.4,
    score: compared > 0 ? clamp((points / compared) * 100) : null,
    detail:
      compared > 0
        ? `${improved} of ${compared} lifts beat their previous best in the last 4 weeks${phase === 'cut' ? ' (holding strength also counts during a cut)' : ''}.`
        : 'Needs a few more weeks of history to compare lifts against.',
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
    weight: 0.3,
    score: ratios.length ? clamp((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : null,
    detail: ratios.length
      ? bodyweight
        ? `Your main lifts vs ${profile.experience}-level targets for your ${bodyweight} kg bodyweight.`
        : `Your main lifts vs typical ${profile.experience} targets. Log your bodyweight on Summary for a fairer score.`
      : 'Log bench, squat, deadlift, overhead press or rows to get a strength score.',
  };

  const subscores = [consistency, progression, strength];
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

export interface ScoreHistoryPoint {
  label: string;
  consistency: number | null;
  progression: number | null;
  strength: number | null;
}

/**
 * The score parts as they stood at the end of each of the last `weeks`
 * weeks (the last point is today), using only data logged by then.
 */
export function computeScoreHistory(
  workouts: WorkoutSession[],
  exercises: Exercise[],
  measurements: BodyMeasurementEntry[],
  profile: TrainingProfile,
  programme: ActiveProgramme | null | undefined,
  weeks = 8,
  now: Date = new Date()
): ScoreHistoryPoint[] {
  const points: ScoreHistoryPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const asOf = new Date(now.getTime() - i * 7 * DAY_MS);
    const asOfMs = asOf.getTime();
    const pastWorkouts = workouts.filter((w) => Date.parse(w.startTime) <= asOfMs);
    const pastMeasurements = measurements.filter((m) => m.date <= toYmd(asOf));
    const label =
      i === 0 ? 'Now' : asOf.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (pastWorkouts.length === 0) {
      points.push({ label, consistency: null, progression: null, strength: null });
      continue;
    }
    const score = computeTrainerScore(pastWorkouts, exercises, pastMeasurements, profile, programme, asOf);
    const get = (key: ScoreKey) => score.subscores.find((s) => s.key === key)?.score ?? null;
    points.push({
      label,
      consistency: get('consistency'),
      progression: get('progression'),
      strength: get('strength'),
    });
  }
  return points;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

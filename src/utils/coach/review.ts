import {
  ActiveProgramme,
  BodyMeasurementEntry,
  Exercise,
  WorkoutSession,
} from '../../types/workout';
import { getWorkingSets } from '../analytics';
import { calculateEstimated1RM } from '../calculators';
import { nutritionFor } from '../../data/programmes';
import { getProgrammeStatus, mondayOf, parseLocalDate, programmeWeekAt } from './programme';

const DAY_MS = 24 * 60 * 60 * 1000;
const BLOCK_DAYS = 28;

export interface BlockTotals {
  sessions: number;
  sets: number;
  volumeKg: number;
  prs: number;
}

export interface LiftChange {
  exercise: Exercise;
  bestKg: number;
  previousBestKg: number | null;
  changePct: number | null;
}

export interface BodyweightChange {
  startKg: number;
  endKg: number;
  changeKg: number;
  /** % of bodyweight per week. */
  weeklyPct: number;
  /** Target range for this block's phase, if following a programme. */
  targetPct: [number, number] | null;
  verdict: string;
}

export interface BlockReview {
  index: number;
  start: Date;
  /** Exclusive. */
  end: Date;
  label: string;
  inProgress: boolean;
  totals: BlockTotals;
  previous: BlockTotals | null;
  lifts: LiftChange[];
  bodyweight: BodyweightChange | null;
  highlights: string[];
}

/**
 * Splits training into 4-week blocks. With a programme they line up with the
 * programme's weeks (1–4, 5–8, …); otherwise they end with the current week.
 * Returns oldest → newest, going back to the first logged workout.
 */
export function blockBoundaries(
  workouts: WorkoutSession[],
  programme: ActiveProgramme | null | undefined,
  now: Date = new Date()
): { start: Date; end: Date }[] {
  const thisMonday = mondayOf(now);
  const anchor = programme?.startDate ? mondayOf(parseLocalDate(programme.startDate)) : null;

  // The block containing today.
  let currentStart: Date;
  if (anchor && anchor <= thisMonday) {
    const weeks = Math.round((thisMonday.getTime() - anchor.getTime()) / (7 * DAY_MS));
    currentStart = new Date(anchor);
    currentStart.setDate(anchor.getDate() + Math.floor(weeks / 4) * 28);
  } else {
    currentStart = new Date(thisMonday);
    currentStart.setDate(thisMonday.getDate() - 21);
  }

  const firstMs = workouts.length ? Math.min(...workouts.map((w) => Date.parse(w.startTime))) : now.getTime();
  const blocks: { start: Date; end: Date }[] = [];
  let start = currentStart;
  for (let i = 0; i < 26; i++) {
    const end = new Date(start);
    end.setDate(start.getDate() + 28);
    blocks.unshift({ start: new Date(start), end });
    if (start.getTime() <= firstMs) break;
    start = new Date(start);
    start.setDate(start.getDate() - 28);
  }
  return blocks;
}

function totalsFor(workouts: WorkoutSession[]): BlockTotals {
  const totals: BlockTotals = { sessions: workouts.length, sets: 0, volumeKg: 0, prs: 0 };
  for (const w of workouts) {
    for (const b of w.exercises) {
      for (const s of getWorkingSets(b.sets)) {
        totals.sets += 1;
        totals.volumeKg += s.weightKg * s.reps;
        if (s.prs && s.prs.length > 0) totals.prs += 1;
      }
    }
  }
  totals.volumeKg = Math.round(totals.volumeKg);
  return totals;
}

function bestE1RMByExercise(workouts: WorkoutSession[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const w of workouts) {
    for (const b of w.exercises) {
      for (const s of getWorkingSets(b.sets)) {
        const e1rm = calculateEstimated1RM(s.weightKg, s.reps);
        if (e1rm > (best.get(b.exerciseId) || 0)) best.set(b.exerciseId, e1rm);
      }
    }
  }
  return best;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildBlockReview(
  index: number,
  bounds: { start: Date; end: Date }[],
  workouts: WorkoutSession[],
  exercises: Exercise[],
  measurements: BodyMeasurementEntry[],
  programme: ActiveProgramme | null | undefined,
  now: Date = new Date()
): BlockReview {
  const { start, end } = bounds[index];
  const prevBounds = index > 0 ? bounds[index - 1] : null;
  const inRange = (w: WorkoutSession, s: Date, e: Date) => {
    const t = Date.parse(w.startTime);
    return t >= s.getTime() && t < e.getTime();
  };
  const blockWorkouts = workouts.filter((w) => inRange(w, start, end));
  const prevWorkouts = prevBounds ? workouts.filter((w) => inRange(w, prevBounds.start, prevBounds.end)) : [];
  const earlierWorkouts = workouts.filter((w) => Date.parse(w.startTime) < start.getTime());

  const totals = totalsFor(blockWorkouts);
  const previous = prevBounds ? totalsFor(prevWorkouts) : null;

  // Lifts: the most-trained ones this block, vs the best before it.
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const frequency = new Map<string, number>();
  for (const w of blockWorkouts) for (const b of w.exercises) {
    if (getWorkingSets(b.sets).length) frequency.set(b.exerciseId, (frequency.get(b.exerciseId) || 0) + 1);
  }
  const blockBest = bestE1RMByExercise(blockWorkouts);
  const earlierBest = bestE1RMByExercise(earlierWorkouts);
  const lifts: LiftChange[] = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => {
      const bestKg = blockBest.get(id) || 0;
      const previousBestKg = earlierBest.get(id) ?? null;
      return {
        exercise: exMap.get(id)!,
        bestKg,
        previousBestKg,
        changePct: previousBestKg ? Math.round(((bestKg - previousBestKg) / previousBestKg) * 1000) / 10 : null,
      };
    })
    .filter((l) => l.exercise);

  // Bodyweight: first vs last weigh-in in the block.
  const weighIns = measurements
    .filter((m) => {
      const d = parseLocalDate(m.date).getTime();
      return d >= start.getTime() && d < end.getTime();
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  let bodyweight: BodyweightChange | null = null;
  if (weighIns.length >= 2) {
    const first = weighIns[0];
    const last = weighIns[weighIns.length - 1];
    const days = Math.max(1, (parseLocalDate(last.date).getTime() - parseLocalDate(first.date).getTime()) / DAY_MS);
    const changeKg = Math.round((last.bodyweightKg - first.bodyweightKg) * 10) / 10;
    const weeklyPct = Math.round(((changeKg / first.bodyweightKg) * 100 * 7 * 100) / days) / 100;
    const midWeek = programmeWeekAt(programme, new Date(start.getTime() + 14 * DAY_MS));
    const targetPct = midWeek ? nutritionFor(midWeek).weeklyChangePct : null;
    bodyweight = {
      startKg: first.bodyweightKg,
      endKg: last.bodyweightKg,
      changeKg,
      weeklyPct,
      targetPct,
      verdict: bodyweightVerdict(weeklyPct, targetPct),
    };
  }

  const status = getProgrammeStatus(programme, now);
  const inProgress = end.getTime() > now.getTime();
  const label = status && start >= status.startMonday
    ? `Weeks ${Math.round((start.getTime() - status.startMonday.getTime()) / (7 * DAY_MS)) + 1}–${Math.round((start.getTime() - status.startMonday.getTime()) / (7 * DAY_MS)) + 4}`
    : `${fmtDate(start)} – ${fmtDate(new Date(end.getTime() - DAY_MS))}`;

  return {
    index,
    start,
    end,
    label,
    inProgress,
    totals,
    previous,
    lifts,
    bodyweight,
    highlights: buildHighlights(totals, previous, lifts, inProgress),
  };
}

function bodyweightVerdict(weeklyPct: number, target: [number, number] | null): string {
  if (!target) {
    return weeklyPct > 0.1 ? 'Trending up.' : weeklyPct < -0.1 ? 'Trending down.' : 'Holding steady.';
  }
  const [lo, hi] = target;
  if (lo === 0 && hi === 0) {
    return Math.abs(weeklyPct) <= 0.2 ? 'Holding steady, as planned.' : 'Aim to hold steady this phase.';
  }
  if (weeklyPct > hi + 0.1) {
    return hi > 0
      ? 'Gaining faster than planned: trim about 100–200 kcal a day to limit fat gain.'
      : 'Losing slower than planned: cut about 100–200 kcal a day or add some daily walking.';
  }
  if (weeklyPct < lo - 0.1) {
    return lo < 0
      ? 'Losing faster than planned: add about 100–200 kcal a day to protect muscle.'
      : 'Gaining slower than planned: add about 100–200 kcal a day.';
  }
  return 'Right on target.';
}

function buildHighlights(
  totals: BlockTotals,
  previous: BlockTotals | null,
  lifts: LiftChange[],
  inProgress: boolean
): string[] {
  const out: string[] = [];
  if (totals.sessions === 0) return ['No workouts logged in this block.'];
  const up = lifts.filter((l) => (l.changePct ?? 0) >= 1);
  if (up.length > 0) {
    const best = [...up].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
    out.push(`${up.length} of ${lifts.length} main lifts set new bests. Top: ${best.exercise.name} +${best.changePct}%.`);
  } else if (lifts.some((l) => l.previousBestKg)) {
    out.push('No new bests on your main lifts this block.');
  }
  if (previous && previous.sessions > 0 && !inProgress) {
    const diff = totals.sessions - previous.sessions;
    if (diff !== 0) out.push(`${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} sessions than the previous block.`);
  }
  if (totals.prs > 0) out.push(`${totals.prs} PR set${totals.prs === 1 ? '' : 's'} logged.`);
  return out;
}

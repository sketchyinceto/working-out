import {
  ActiveProgramme,
  BodyMeasurementEntry,
  Exercise,
  ProgrammeWeekNote,
} from '../../types/workout';
import {
  NutritionGuide,
  ProgrammeTemplate,
  ProgrammeWeek,
  getProgramme,
  nutritionFor,
} from '../../data/programmes';
import { toLocalDateStr } from '../dates';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the Monday on or before `d`. */
export function mondayOf(d: Date): Date {
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  mid.setDate(mid.getDate() - ((mid.getDay() + 6) % 7));
  return mid;
}

/** Parse a YYYY-MM-DD string as local midnight. */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Whole weeks from one Monday to another (handles daylight-saving shifts). */
function weeksBetween(fromMonday: Date, toMonday: Date): number {
  return Math.round((toMonday.getTime() - fromMonday.getTime()) / (7 * DAY_MS));
}

export interface ProgrammeStatus {
  template: ProgrammeTemplate;
  /** The current week, or null once the programme has finished. */
  week: ProgrammeWeek | null;
  /** 1-based; may exceed the length once finished. */
  weekNumber: number;
  totalWeeks: number;
  finished: boolean;
  /** Chosen late in a week: week 1 begins next Monday. */
  notStarted: boolean;
  startMonday: Date;
}

export function getProgrammeStatus(
  programme: ActiveProgramme | null | undefined,
  now: Date = new Date()
): ProgrammeStatus | null {
  if (!programme) return null;
  const template = getProgramme(programme.templateId);
  if (!template) return null;
  const startMonday = mondayOf(parseLocalDate(programme.startDate));
  const notStarted = mondayOf(now) < startMonday;
  const weekNumber = Math.max(1, weeksBetween(startMonday, mondayOf(now)) + 1);
  const totalWeeks = template.weeks.length;
  const finished = weekNumber > totalWeeks;
  return {
    template,
    // Before the start date, week 1 is shown as a preview.
    week: finished ? null : template.weeks[weekNumber - 1],
    weekNumber,
    totalWeeks,
    finished,
    notStarted,
    startMonday,
  };
}

/** The programme week a past date fell in (null if outside the programme). */
export function programmeWeekAt(
  programme: ActiveProgramme | null | undefined,
  date: Date
): ProgrammeWeek | null {
  const status = getProgrammeStatus(programme, date);
  if (!status || status.finished || status.notStarted) return null;
  return status.week;
}

/**
 * Start date for a new programme: this week's Monday, or next Monday if it's
 * already Friday–Sunday (so week 1 isn't mostly over before it begins).
 */
export function programmeStartDate(now: Date = new Date()): string {
  const monday = mondayOf(now);
  if ((now.getDay() + 6) % 7 >= 4) monday.setDate(monday.getDate() + 7);
  return toLocalDateStr(monday);
}

const COMPOUND_NAME =
  /\b(press|row|squat|deadlift|rdl|pull-?up|chin-?up|pulldown|dips?|lunge|split squat|thrust|leg press|step-?up)\b/i;
const ISOLATION_NAME = /\b(fly|flye|raise|curl|extension|pushdown|kickback|crunch|shrug|pec deck)\b/i;

/** Multi-joint lifts get the heavier "compound" rep range. */
export function isCompound(ex: Exercise): boolean {
  if (ISOLATION_NAME.test(ex.name)) return false;
  if (ex.equipment === 'barbell' || ex.equipment === 'smith_machine') return true;
  return COMPOUND_NAME.test(ex.name);
}

export function repRangeFor(ex: Exercise, week: ProgrammeWeek): [number, number] {
  return isCompound(ex) ? week.compoundReps : week.isolationReps;
}

export function describeRir([lo, hi]: [number, number]): string {
  if (hi === 0) return 'Take sets to failure';
  if (lo === hi) return `Stop ${lo} rep${lo === 1 ? '' : 's'} short of failure`;
  return `Stop ${lo}–${hi} reps short of failure`;
}

export function weekNote(week: ProgrammeWeek, totalWeeks: number): ProgrammeWeekNote {
  const [cLo, cHi] = week.compoundReps;
  const [iLo, iHi] = week.isolationReps;
  return {
    week: week.week,
    totalWeeks,
    block: week.block,
    kind: week.kind,
    repsNote: `Compounds ${cLo}–${cHi} reps · isolation ${iLo}–${iHi}`,
    rirNote: describeRir(week.rir),
    compoundReps: week.compoundReps,
    isolationReps: week.isolationReps,
  };
}

export const WEEK_KIND_LABEL: Record<ProgrammeWeek['kind'], string> = {
  build: 'Build week',
  deload: 'Deload week',
  transition: 'Transition week',
  test: 'Test week',
};

/** Latest bodyweight entry, if any. */
export function latestBodyweightKg(measurements: BodyMeasurementEntry[]): number | null {
  if (measurements.length === 0) return null;
  const newest = [...measurements].sort((a, b) => b.date.localeCompare(a.date))[0];
  return newest.bodyweightKg;
}

export interface NutritionTargets {
  guide: NutritionGuide;
  /** kg per week (null without a bodyweight). */
  weeklyChangeKg: [number, number] | null;
  proteinGrams: [number, number] | null;
}

export function nutritionTargets(
  week: ProgrammeWeek,
  bodyweightKg: number | null
): NutritionTargets {
  const guide = nutritionFor(week);
  if (!bodyweightKg) return { guide, weeklyChangeKg: null, proteinGrams: null };
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const round5 = (n: number) => Math.round(n / 5) * 5;
  return {
    guide,
    weeklyChangeKg: [
      round1((bodyweightKg * guide.weeklyChangePct[0]) / 100),
      round1((bodyweightKg * guide.weeklyChangePct[1]) / 100),
    ],
    proteinGrams: [
      round5(bodyweightKg * guide.proteinGPerKg[0]),
      round5(bodyweightKg * guide.proteinGPerKg[1]),
    ],
  };
}

/**
 * Repeats programme weeks that were mostly missed. For every finished week
 * not yet checked, if fewer than half the planned programme sessions were
 * done, the start date moves a week later, so the same week comes round
 * again. Deload, transition and test weeks are never repeated (missing a
 * light week costs nothing). Returns the updated programme, or null if
 * nothing changed.
 */
export function applyMissedWeekRepeats(
  programme: ActiveProgramme,
  workouts: { startTime: string; programmeWorkoutId?: string }[],
  plannedPerWeek: number,
  now: Date = new Date()
): ActiveProgramme | null {
  const thisMonday = mondayOf(now);
  const thisMondayStr = toLocalDateStr(thisMonday);
  if (programme.checkedThrough === thisMondayStr || plannedPerWeek <= 0) return null;

  let next: ActiveProgramme = { ...programme };
  const startMonday = mondayOf(parseLocalDate(programme.startDate));
  // First week not yet checked.
  let weekStart = programme.checkedThrough
    ? mondayOf(parseLocalDate(programme.checkedThrough))
    : startMonday;
  if (weekStart < startMonday) weekStart = startMonday;

  const needed = Math.ceil(plannedPerWeek / 2);
  // Before any programme workout has been logged (e.g. history from before
  // programme workouts existed), count every session so nothing is unfairly
  // repeated.
  const countsAll = !workouts.some((w) => w.programmeWorkoutId);
  // Guard against a corrupted date producing a huge loop.
  for (let i = 0; i < 60 && weekStart < thisMonday; i++) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const status = getProgrammeStatus(next, weekStart);
    const week = status && !status.finished && !status.notStarted ? status.week : null;
    if (week && week.kind === 'build') {
      const done = workouts.filter((w) => {
        const t = Date.parse(w.startTime);
        return (countsAll || !!w.programmeWorkoutId) && t >= weekStart.getTime() && t < weekEnd.getTime();
      }).length;
      if (done < needed) {
        const start = mondayOf(parseLocalDate(next.startDate));
        start.setDate(start.getDate() + 7);
        next = {
          ...next,
          startDate: toLocalDateStr(start),
          lastRepeat: { on: thisMondayStr, week: week.week, done, planned: plannedPerWeek },
        };
      }
    }
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
  }
  next.checkedThrough = thisMondayStr;
  return next;
}

/** "Week 3 is repeating…" for the week a repeat took effect, else null. */
export function repeatNotice(programme: ActiveProgramme | null | undefined, now: Date = new Date()): string | null {
  const r = programme?.lastRepeat;
  if (!r || r.on !== toLocalDateStr(mondayOf(now))) return null;
  return `Week ${r.week} is repeating: only ${r.done} of ${r.planned} planned sessions were done last week. Use the week picker to move on instead.`;
}

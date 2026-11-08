import type { GoalType } from '../types/workout';

/**
 * Long-term training programmes.
 *
 * A programme doesn't replace your routines: it sits on top of them and, week
 * by week, sets how many sets to do (relative to each routine's own number),
 * which rep ranges to aim for, how close to failure to train, when to deload,
 * and what to eat. Numbers are drawn from the research listed in each
 * programme's `evidence`.
 */

export type ProgrammePhase = 'bulk' | 'cut' | 'maintain' | 'recomp' | 'strength';
export type WeekKind = 'build' | 'deload' | 'transition' | 'test';

export interface ProgrammeWeek {
  /** 1-based week number within the programme. */
  week: number;
  phase: ProgrammePhase;
  /** Block name shown to the user, e.g. "Hypertrophy I". */
  block: string;
  kind: WeekKind;
  /** Multiplies each routine exercise's target sets (1 = as written). */
  setsMultiplier: number;
  /** Multiplies starting weights (deloads use ~0.9). */
  loadMultiplier: number;
  compoundReps: [number, number];
  isolationReps: [number, number];
  /** Reps in reserve: how many more reps you could have done. */
  rir: [number, number];
  /** One-line focus for the week. */
  focus: string;
}

export interface NutritionGuide {
  label: string;
  /** Calories relative to maintenance, as a short phrase. */
  calories: string;
  /** Target bodyweight change per week, as % of bodyweight (negative = loss). */
  weeklyChangePct: [number, number];
  /** Protein, grams per kg of bodyweight per day. */
  proteinGPerKg: [number, number];
}


export interface ProgrammeTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Goals this programme is the best fit for (first = primary). */
  goals: GoalType[];
  weeks: ProgrammeWeek[];
  evidence: string[];
}

export const NUTRITION: Record<ProgrammePhase | 'diet_break', NutritionGuide> = {
  bulk: {
    label: 'Lean bulk',
    calories: 'About 5–10% above maintenance (roughly +200–300 kcal/day)',
    weeklyChangePct: [0.25, 0.5],
    proteinGPerKg: [1.6, 2.2],
  },
  maintain: {
    label: 'Maintenance',
    calories: 'At maintenance: weight should hold steady',
    weeklyChangePct: [0, 0],
    proteinGPerKg: [1.6, 2.2],
  },
  cut: {
    label: 'Cut',
    calories: 'About 300–500 kcal/day below maintenance',
    weeklyChangePct: [-1.0, -0.5],
    proteinGPerKg: [2.0, 2.6],
  },
  diet_break: {
    label: 'Diet break',
    calories: 'Back up to maintenance for this week to recover',
    weeklyChangePct: [0, 0],
    proteinGPerKg: [2.0, 2.6],
  },
  recomp: {
    label: 'Recomposition',
    calories: 'At maintenance or slightly below (up to −200 kcal/day)',
    weeklyChangePct: [-0.25, 0],
    proteinGPerKg: [2.0, 2.4],
  },
  strength: {
    label: 'Strength',
    calories: 'At or slightly above maintenance to fuel heavy training',
    weeklyChangePct: [0, 0.25],
    proteinGPerKg: [1.6, 2.2],
  },
};

// --- Block builders ----------------------------------------------------------

interface BlockSpec {
  block: string;
  phase: ProgrammePhase;
  compoundReps: [number, number];
  isolationReps: [number, number];
  /** One entry per building week. */
  setsRamp: number[];
  rirRamp: [number, number][];
  focus: string;
  /** Add a deload week at the end (default true). */
  deload?: boolean;
  deloadFocus?: string;
}

function block(spec: BlockSpec): Omit<ProgrammeWeek, 'week'>[] {
  const weeks: Omit<ProgrammeWeek, 'week'>[] = spec.setsRamp.map((mult, i) => ({
    phase: spec.phase,
    block: spec.block,
    kind: 'build',
    setsMultiplier: mult,
    loadMultiplier: 1,
    compoundReps: spec.compoundReps,
    isolationReps: spec.isolationReps,
    rir: spec.rirRamp[i] ?? spec.rirRamp[spec.rirRamp.length - 1],
    focus: spec.focus,
  }));
  if (spec.deload !== false) {
    weeks.push({
      phase: spec.phase,
      block: spec.block,
      kind: 'deload',
      setsMultiplier: 0.5,
      loadMultiplier: 0.9,
      compoundReps: spec.compoundReps,
      isolationReps: spec.isolationReps,
      rir: [3, 4],
      focus:
        spec.deloadFocus ??
        'Deload: half the sets and ~10% lighter. Let joints and fatigue recover so the next block starts fresh.',
    });
  }
  return weeks;
}

function single(week: Omit<ProgrammeWeek, 'week'>): Omit<ProgrammeWeek, 'week'>[] {
  return [week];
}

function numbered(...blocks: Omit<ProgrammeWeek, 'week'>[][]): ProgrammeWeek[] {
  return blocks.flat().map((w, i) => ({ ...w, week: i + 1 }));
}

const HYPERTROPHY_REPS = { compoundReps: [8, 12] as [number, number], isolationReps: [10, 15] as [number, number] };
const STRENGTH_HYP_REPS = { compoundReps: [5, 8] as [number, number], isolationReps: [8, 12] as [number, number] };
const STANDARD_RIR: [number, number][] = [
  [2, 3],
  [2, 3],
  [1, 2],
  [0, 1],
];

const BULK_HYP_FOCUS =
  'Build muscle: add a rep or a little weight each week while staying in the rep range. Sets ramp up across the block.';
const BULK_STR_FOCUS =
  'Get stronger in a lower rep range: heavier compounds, same isolation work. Strength gained here drives the next growth block.';
const CUT_FOCUS =
  'Keep the weights heavy and the volume moderate. In a calorie deficit the goal is to keep muscle: holding your strength is a win.';

// --- Programmes ----------------------------------------------------------------

const LEAN_BULK_THEN_CUT: ProgrammeTemplate = {
  id: 'prog-9m-bulk-cut',
  name: 'Lean & Muscular: 9-Month Bulk → Cut',
  tagline: '25-week lean bulk, a maintenance week, then a 12-week cut and a finishing week.',
  description:
    'Spend six months building muscle with a small calorie surplus, alternating muscle-building blocks (more sets, 8–12 reps) with strength blocks (5–8 reps), each ending in a deload. Then cut for 12 weeks: weights stay heavy, sets drop by about a third, and a diet-break week at maintenance keeps it sustainable. Finish at maintenance and re-test your lifts.',
  goals: ['lean_muscle', 'muscle'],
  weeks: numbered(
    block({ block: 'Foundation', phase: 'bulk', ...HYPERTROPHY_REPS, setsRamp: [0.8, 0.9, 1.0, 1.1], rirRamp: [[3, 3], [2, 3], [2, 2], [1, 2]], focus: 'Settle into the routines with good form and leave reps in reserve. Volume starts low and builds each week.' }),
    block({ block: 'Hypertrophy I', phase: 'bulk', ...HYPERTROPHY_REPS, setsRamp: [0.9, 1.0, 1.1, 1.2], rirRamp: STANDARD_RIR, focus: BULK_HYP_FOCUS }),
    block({ block: 'Strength-Hypertrophy I', phase: 'bulk', ...STRENGTH_HYP_REPS, setsRamp: [0.9, 1.0, 1.0, 1.1], rirRamp: STANDARD_RIR, focus: BULK_STR_FOCUS }),
    block({ block: 'Hypertrophy II', phase: 'bulk', ...HYPERTROPHY_REPS, setsRamp: [1.0, 1.1, 1.2, 1.3], rirRamp: STANDARD_RIR, focus: BULK_HYP_FOCUS }),
    block({ block: 'Strength-Hypertrophy II', phase: 'bulk', ...STRENGTH_HYP_REPS, setsRamp: [0.9, 1.0, 1.1, 1.1], rirRamp: STANDARD_RIR, focus: BULK_STR_FOCUS }),
    single({ phase: 'maintain', block: 'Transition', kind: 'transition', setsMultiplier: 0.8, loadMultiplier: 1, ...HYPERTROPHY_REPS, rir: [2, 3], focus: 'Bring calories back to maintenance for a week before the cut, and train comfortably.' }),
    block({ block: 'Cut I', phase: 'cut', ...STRENGTH_HYP_REPS, setsRamp: [0.8, 0.8, 0.75, 0.75], rirRamp: [[2, 2], [1, 2], [1, 2], [1, 2]], focus: CUT_FOCUS }),
    block({ block: 'Cut II', phase: 'cut', ...STRENGTH_HYP_REPS, setsRamp: [0.75, 0.7, 0.7, 0.7], rirRamp: [[1, 2]], focus: CUT_FOCUS, deloadFocus: 'Diet break + deload: eat at maintenance this week and train lighter, then finish the cut.' }),
    block({ block: 'Final Cut', phase: 'cut', ...STRENGTH_HYP_REPS, setsRamp: [0.7, 0.7], rirRamp: [[1, 2]], focus: CUT_FOCUS, deload: false }),
    single({ phase: 'maintain', block: 'Finish', kind: 'test', setsMultiplier: 0.8, loadMultiplier: 1, ...STRENGTH_HYP_REPS, rir: [0, 1], focus: 'Back to maintenance calories. Re-test your main lifts and compare with week 1. Take progress photos.' })
  ),
  evidence: [
    'More weekly sets build more muscle, up to roughly 10–20 hard sets per muscle per week (Schoenfeld, Ogborn & Krieger, 2017).',
    'Training each muscle about twice a week beats once a week for growth (Schoenfeld, Ogborn & Krieger, 2016).',
    'Bulk slowly, gaining about 0.25–0.5% of bodyweight per week, to limit fat gain (Iraki et al., 2019).',
    'Cut at about 0.5–1% of bodyweight per week with high protein to keep muscle (Helms, Aragon & Fitschen, 2014).',
    'About 1.6 g/kg of protein a day maxes out muscle gain, with benefit possible up to ~2.2 g/kg (Morton et al., 2018).',
    'Strength and muscle can be kept with about a third of the usual training volume if the weights stay heavy (Bickel et al., 2011).',
    'Lifters commonly deload every 4–6 weeks by cutting volume and effort (Bell et al., 2022).',
    'Breaking a diet with periods at maintenance helped fat loss and kept metabolism higher (Byrne et al., 2018).',
  ],
};

const LEAN_BULK_20: ProgrammeTemplate = {
  id: 'prog-lean-bulk-20',
  name: 'Lean Bulk (20 weeks)',
  tagline: 'Four 5-week blocks of growth and strength in a small surplus.',
  description:
    'The bulking half of the 9-month programme on its own: hypertrophy and strength-hypertrophy blocks, each with a deload, eating slightly above maintenance.',
  goals: ['muscle', 'lean_muscle'],
  weeks: numbered(
    block({ block: 'Hypertrophy I', phase: 'bulk', ...HYPERTROPHY_REPS, setsRamp: [0.8, 0.9, 1.0, 1.1], rirRamp: STANDARD_RIR, focus: BULK_HYP_FOCUS }),
    block({ block: 'Strength-Hypertrophy I', phase: 'bulk', ...STRENGTH_HYP_REPS, setsRamp: [0.9, 1.0, 1.0, 1.1], rirRamp: STANDARD_RIR, focus: BULK_STR_FOCUS }),
    block({ block: 'Hypertrophy II', phase: 'bulk', ...HYPERTROPHY_REPS, setsRamp: [1.0, 1.1, 1.2, 1.3], rirRamp: STANDARD_RIR, focus: BULK_HYP_FOCUS }),
    block({ block: 'Strength-Hypertrophy II', phase: 'bulk', ...STRENGTH_HYP_REPS, setsRamp: [0.9, 1.0, 1.1, 1.1], rirRamp: STANDARD_RIR, focus: BULK_STR_FOCUS })
  ),
  evidence: [
    'More weekly sets build more muscle, up to roughly 10–20 hard sets per muscle per week (Schoenfeld, Ogborn & Krieger, 2017).',
    'Bulk slowly, gaining about 0.25–0.5% of bodyweight per week, to limit fat gain (Iraki et al., 2019).',
    'Lifters commonly deload every 4–6 weeks by cutting volume and effort (Bell et al., 2022).',
  ],
};

const FAT_LOSS_12: ProgrammeTemplate = {
  id: 'prog-cut-12',
  name: 'Fat Loss Cut (12 weeks)',
  tagline: 'Lose fat while keeping muscle: heavy weights, moderate volume, a diet break.',
  description:
    'A 12-week cut. Weights stay heavy so your muscles keep a reason to stay, total sets come down to match lower recovery, and week 10 is a diet break at maintenance.',
  goals: ['fat_loss'],
  weeks: numbered(
    block({ block: 'Cut I', phase: 'cut', ...STRENGTH_HYP_REPS, setsRamp: [0.8, 0.8, 0.75, 0.75], rirRamp: [[2, 2], [1, 2], [1, 2], [1, 2]], focus: CUT_FOCUS }),
    block({ block: 'Cut II', phase: 'cut', ...STRENGTH_HYP_REPS, setsRamp: [0.75, 0.7, 0.7, 0.7], rirRamp: [[1, 2]], focus: CUT_FOCUS, deloadFocus: 'Diet break + deload: eat at maintenance this week and train lighter, then finish the cut.' }),
    block({ block: 'Final Cut', phase: 'cut', ...STRENGTH_HYP_REPS, setsRamp: [0.7, 0.7], rirRamp: [[1, 2]], focus: CUT_FOCUS, deload: false })
  ),
  evidence: [
    'Cut at about 0.5–1% of bodyweight per week with high protein to keep muscle (Helms, Aragon & Fitschen, 2014).',
    'Strength and muscle can be kept with about a third of the usual training volume if the weights stay heavy (Bickel et al., 2011).',
    'Breaking a diet with periods at maintenance helped fat loss and kept metabolism higher (Byrne et al., 2018).',
  ],
};

const RECOMP_16: ProgrammeTemplate = {
  id: 'prog-recomp-16',
  name: 'Body Recomposition (16 weeks)',
  tagline: 'Build muscle and lose a little fat at the same time, at maintenance calories.',
  description:
    'Works best if you are newer to lifting or returning after a break. Eat around maintenance with high protein and push progressive overload through three hypertrophy blocks, then re-test.',
  goals: ['recomp'],
  weeks: numbered(
    block({ block: 'Recomp I', phase: 'recomp', ...HYPERTROPHY_REPS, setsRamp: [0.8, 0.9, 1.0, 1.1], rirRamp: STANDARD_RIR, focus: BULK_HYP_FOCUS }),
    block({ block: 'Recomp II', phase: 'recomp', ...STRENGTH_HYP_REPS, setsRamp: [0.9, 1.0, 1.0, 1.1], rirRamp: STANDARD_RIR, focus: BULK_STR_FOCUS }),
    block({ block: 'Recomp III', phase: 'recomp', ...HYPERTROPHY_REPS, setsRamp: [1.0, 1.1, 1.2, 1.2], rirRamp: STANDARD_RIR, focus: BULK_HYP_FOCUS }),
    single({ phase: 'recomp', block: 'Finish', kind: 'test', setsMultiplier: 0.8, loadMultiplier: 1, ...STRENGTH_HYP_REPS, rir: [0, 1], focus: 'Re-test your main lifts, re-measure, and compare with week 1.' })
  ),
  evidence: [
    'Gaining muscle while losing fat is realistic for newer and returning lifters, especially with high protein (Barakat et al., 2020).',
    'About 1.6 g/kg of protein a day maxes out muscle gain, with benefit possible up to ~2.2 g/kg (Morton et al., 2018).',
    'More weekly sets build more muscle, up to roughly 10–20 hard sets per muscle per week (Schoenfeld, Ogborn & Krieger, 2017).',
  ],
};

const STRENGTH_12: ProgrammeTemplate = {
  id: 'prog-strength-12',
  name: 'Strength Focus (12 weeks)',
  tagline: 'Block periodisation: build a base, get heavy, then peak and test.',
  description:
    'Accumulation (6–10 reps) builds work capacity, intensification (4–6 reps) gets you used to heavy loads, and a short peak (2–4 reps) sets up a test week for new maxes.',
  goals: ['strength'],
  weeks: numbered(
    block({ block: 'Accumulation', phase: 'strength', compoundReps: [6, 10], isolationReps: [10, 12], setsRamp: [0.9, 1.0, 1.1, 1.1], rirRamp: STANDARD_RIR, focus: 'Build a base: moderate weights, more sets, crisp technique on the big lifts.' }),
    block({ block: 'Intensification', phase: 'strength', compoundReps: [4, 6], isolationReps: [8, 10], setsRamp: [0.9, 0.9, 1.0, 1.0], rirRamp: STANDARD_RIR, focus: 'Get heavy: fewer reps on the compounds, longer rests (3+ min).' }),
    block({ block: 'Peak', phase: 'strength', compoundReps: [2, 4], isolationReps: [8, 10], setsRamp: [0.7], rirRamp: [[1, 2]], focus: 'Heavy singles to triples on the main lifts; keep everything else light.', deload: false }),
    single({ phase: 'strength', block: 'Test', kind: 'test', setsMultiplier: 0.5, loadMultiplier: 1, compoundReps: [1, 3], isolationReps: [8, 10], rir: [0, 1], focus: 'Test week: work up to a heavy single or triple on your main lifts.' })
  ),
  evidence: [
    'Heavier loads produce bigger strength gains than light loads, while muscle growth is similar across loads (Schoenfeld et al., 2017).',
    'Block periodisation sequences accumulation, intensification and realisation phases to peak strength (Issurin, 2010).',
    'Lifters commonly deload every 4–6 weeks by cutting volume and effort (Bell et al., 2022).',
  ],
};

export const PROGRAMMES: ProgrammeTemplate[] = [
  LEAN_BULK_THEN_CUT,
  LEAN_BULK_20,
  FAT_LOSS_12,
  RECOMP_16,
  STRENGTH_12,
];

export function getProgramme(id: string): ProgrammeTemplate | undefined {
  return PROGRAMMES.find((p) => p.id === id);
}

/** The programme designed for a goal (each goal has exactly one). */
export function programmeForGoal(goal: GoalType): ProgrammeTemplate {
  return PROGRAMMES.find((p) => p.goals[0] === goal) ?? PROGRAMMES[0];
}

/** The nutrition guide for a week (deloads in a cut are diet breaks). */
export function nutritionFor(week: ProgrammeWeek): NutritionGuide {
  if (week.phase === 'cut' && week.kind === 'deload') return NUTRITION.diet_break;
  return NUTRITION[week.phase];
}

export const GOAL_LABELS: Record<GoalType, string> = {
  lean_muscle: 'Lean & muscular (bulk then cut)',
  muscle: 'Build muscle (bulk)',
  fat_loss: 'Lose fat (cut)',
  recomp: 'Recomposition',
  strength: 'Get stronger',
};

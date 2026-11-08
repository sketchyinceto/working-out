/**
 * Workouts used by the long-term programmes, in versions for 3–6 training
 * days a week. Every version trains each major muscle about twice a week
 * (Schoenfeld, Ogborn & Krieger, 2016) for roughly 10–20 weekly sets
 * (Schoenfeld, Ogborn & Krieger, 2017), counting a set for a muscle's helpers
 * as half. Exercises include stretch-focused options (e.g. overhead triceps
 * extensions, seated leg curls), which grew muscle more in studies by Maeo
 * et al. (2021, 2023).
 *
 * Rep ranges, effort and the week-by-week set count come from the programme
 * week; `sets` here is the baseline at 100%.
 */

import type { Routine } from '../types/workout';

export interface ProgrammeSlot {
  /** Stable id: targets and exercise swaps are stored against it. */
  id: string;
  exerciseId: string;
  sets: number;
  note?: string;
}

export interface ProgrammeWorkout {
  id: string;
  name: string;
  splitTag: Routine['splitTag'];
  slots: ProgrammeSlot[];
}

export interface ProgrammeSplit {
  id: string;
  name: string;
  daysPerWeek: number;
  description: string;
  workouts: ProgrammeWorkout[];
}

const slot = (id: string, exerciseId: string, sets: number, note?: string): ProgrammeSlot => ({
  id,
  exerciseId,
  sets,
  ...(note ? { note } : {}),
});

const UPPER_A: ProgrammeWorkout = {
  id: 'upper-a',
  name: 'Upper A — Horizontal Press & Row',
  splitTag: 'Upper',
  slots: [
    slot('ua-1', 'ex-bench-press', 3, 'Main lift. Controlled lowering, pause on the chest.'),
    slot('ua-2', 'ex-barbell-row', 3),
    slot('ua-3', 'ex-seated-db-shoulder-press', 2),
    slot('ua-4', 'ex-lat-pulldown', 4),
    slot('ua-5', 'ex-cable-fly', 2, 'Deep stretch at the start of each rep.'),
    slot('ua-6', 'ex-cable-lateral-raise', 4),
    slot('ua-7', 'ex-overhead-cable-extension', 3, 'Overhead position stretches the long head.'),
    slot('ua-8', 'ex-incline-db-curl', 2),
  ],
};

const UPPER_B: ProgrammeWorkout = {
  id: 'upper-b',
  name: 'Upper B — Incline & Vertical Pull',
  splitTag: 'Upper',
  slots: [
    slot('ub-1', 'ex-incline-db-press', 3, 'Main lift. 30° bench, deep stretch at the bottom.'),
    slot('ub-2', 'ex-weighted-pullup', 4, 'Use the lat pulldown if pull-ups are too hard.'),
    slot('ub-3', 'ex-chest-supported-row', 3),
    slot('ub-4', 'ex-machine-chest-press', 2),
    slot('ub-5', 'ex-db-lateral-raise', 4),
    slot('ub-6', 'ex-face-pull', 3),
    slot('ub-7', 'ex-triceps-pushdown', 3),
    slot('ub-8', 'ex-hammer-curl', 2),
  ],
};

const LOWER_A: ProgrammeWorkout = {
  id: 'lower-a',
  name: 'Lower A — Squat & Hinge',
  splitTag: 'Lower',
  slots: [
    slot('la-1', 'ex-barbell-squat', 3, 'Main lift. Full depth with an upright torso.'),
    slot('la-2', 'ex-rdl', 3, 'Slow lowering until the hamstrings are fully stretched.'),
    slot('la-3', 'ex-leg-extension', 2),
    slot('la-4', 'ex-seated-leg-curl', 3, 'Seated curls stretch the hamstrings more than lying ones.'),
    slot('la-5', 'ex-standing-calf-raise', 4, 'Pause 2 s at the bottom of every rep.'),
    slot('la-6', 'ex-cable-crunch', 2),
  ],
};

const LOWER_B: ProgrammeWorkout = {
  id: 'lower-b',
  name: 'Lower B — Machine Quads & Glutes',
  splitTag: 'Lower',
  slots: [
    slot('lb-1', 'ex-hack-squat', 3, 'Main lift. Feet low on the platform for deep knee bend.'),
    slot('lb-2', 'ex-hip-thrust', 4),
    slot('lb-3', 'ex-bulgarian-split-squat', 2),
    slot('lb-4', 'ex-lying-leg-curl', 3),
    slot('lb-5', 'ex-standing-calf-raise', 4),
    slot('lb-6', 'ex-hanging-leg-raise', 2),
  ],
};

const PUSH_A: ProgrammeWorkout = {
  id: 'push-a',
  name: 'Push A — Flat Press',
  splitTag: 'Push',
  slots: [
    slot('pa-1', 'ex-bench-press', 3, 'Main lift.'),
    slot('pa-2', 'ex-incline-db-press', 3),
    slot('pa-3', 'ex-seated-db-shoulder-press', 2),
    slot('pa-4', 'ex-cable-fly', 2),
    slot('pa-5', 'ex-cable-lateral-raise', 4),
    slot('pa-6', 'ex-overhead-cable-extension', 3),
  ],
};

const PUSH_B: ProgrammeWorkout = {
  id: 'push-b',
  name: 'Push B — Overhead & Incline',
  splitTag: 'Push',
  slots: [
    slot('pb-1', 'ex-ohp', 3, 'Main lift.'),
    slot('pb-2', 'ex-incline-bb-press', 3),
    slot('pb-3', 'ex-machine-chest-press', 2),
    slot('pb-4', 'ex-pec-deck', 2),
    slot('pb-5', 'ex-db-lateral-raise', 4),
    slot('pb-6', 'ex-triceps-pushdown', 3),
  ],
};

const PULL_A: ProgrammeWorkout = {
  id: 'pull-a',
  name: 'Pull A — Vertical Pull & Row',
  splitTag: 'Pull',
  slots: [
    slot('qa-1', 'ex-weighted-pullup', 3, 'Main lift. Use the lat pulldown if needed.'),
    slot('qa-2', 'ex-barbell-row', 3),
    slot('qa-3', 'ex-seated-cable-row', 2),
    slot('qa-4', 'ex-face-pull', 4),
    slot('qa-5', 'ex-incline-db-curl', 3),
  ],
};

const PULL_B: ProgrammeWorkout = {
  id: 'pull-b',
  name: 'Pull B — Lats & Upper Back',
  splitTag: 'Pull',
  slots: [
    slot('qb-1', 'ex-lat-pulldown', 3, 'Main lift.'),
    slot('qb-2', 'ex-chest-supported-row', 3),
    slot('qb-3', 'ex-single-arm-db-row', 2),
    slot('qb-4', 'ex-rear-delt-fly', 3),
    slot('qb-5', 'ex-hammer-curl', 2),
    slot('qb-6', 'ex-preacher-curl', 2),
  ],
};

const LEGS_A: ProgrammeWorkout = {
  ...LOWER_A,
  id: 'legs-a',
  name: 'Legs A — Squat & Hinge',
  splitTag: 'Legs',
  slots: [
    slot('ga-1', 'ex-barbell-squat', 3, 'Main lift.'),
    slot('ga-2', 'ex-rdl', 3),
    slot('ga-3', 'ex-leg-press', 2),
    slot('ga-4', 'ex-seated-leg-curl', 3),
    slot('ga-5', 'ex-standing-calf-raise', 4),
    slot('ga-6', 'ex-cable-crunch', 3),
  ],
};

const LEGS_B: ProgrammeWorkout = {
  id: 'legs-b',
  name: 'Legs B — Quads, Glutes & Hamstrings',
  splitTag: 'Legs',
  slots: [
    slot('gb-1', 'ex-hack-squat', 3, 'Main lift.'),
    slot('gb-2', 'ex-hip-thrust', 4),
    slot('gb-3', 'ex-bulgarian-split-squat', 2),
    slot('gb-4', 'ex-lying-leg-curl', 3),
    slot('gb-5', 'ex-leg-extension', 3),
    slot('gb-6', 'ex-standing-calf-raise', 4),
    slot('gb-7', 'ex-hanging-leg-raise', 3),
  ],
};

const FULL_A: ProgrammeWorkout = {
  id: 'full-a',
  name: 'Full Body A — Squat & Bench',
  splitTag: 'Full Body',
  slots: [
    slot('fa-1', 'ex-barbell-squat', 3, 'Main lift.'),
    slot('fa-2', 'ex-bench-press', 3, 'Main lift.'),
    slot('fa-3', 'ex-barbell-row', 3),
    slot('fa-4', 'ex-seated-leg-curl', 3),
    slot('fa-5', 'ex-cable-lateral-raise', 4),
    slot('fa-6', 'ex-incline-db-curl', 3),
    slot('fa-7', 'ex-overhead-cable-extension', 3),
    slot('fa-8', 'ex-standing-calf-raise', 3),
  ],
};

const FULL_B: ProgrammeWorkout = {
  id: 'full-b',
  name: 'Full Body B — Hinge & Overhead',
  splitTag: 'Full Body',
  slots: [
    slot('fb-1', 'ex-rdl', 3, 'Main lift.'),
    slot('fb-2', 'ex-ohp', 3, 'Main lift.'),
    slot('fb-3', 'ex-lat-pulldown', 4),
    slot('fb-4', 'ex-leg-press', 3),
    slot('fb-5', 'ex-cable-fly', 3),
    slot('fb-6', 'ex-face-pull', 3),
    slot('fb-7', 'ex-standing-calf-raise', 3),
  ],
};

const FULL_C: ProgrammeWorkout = {
  id: 'full-c',
  name: 'Full Body C — Machines & Incline',
  splitTag: 'Full Body',
  slots: [
    slot('fc-1', 'ex-hack-squat', 3, 'Main lift.'),
    slot('fc-2', 'ex-incline-db-press', 3),
    slot('fc-3', 'ex-chest-supported-row', 3),
    slot('fc-4', 'ex-lying-leg-curl', 3),
    slot('fc-5', 'ex-db-lateral-raise', 4),
    slot('fc-6', 'ex-hammer-curl', 3),
    slot('fc-7', 'ex-triceps-pushdown', 3),
    slot('fc-8', 'ex-seated-cable-row', 2),
  ],
};

export const PROGRAMME_SPLITS: ProgrammeSplit[] = [
  {
    id: 'full-3',
    name: 'Full Body ×3',
    daysPerWeek: 3,
    description: 'Three full-body sessions: every muscle trained three times a week.',
    workouts: [FULL_A, FULL_B, FULL_C],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower ×2',
    daysPerWeek: 4,
    description: 'Two upper and two lower sessions: every muscle trained twice a week.',
    workouts: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  },
  {
    id: 'ul-ppl-5',
    name: 'Upper / Lower + Push / Pull / Legs',
    daysPerWeek: 5,
    description: 'Upper and Lower early in the week, then Push, Pull and Legs.',
    workouts: [UPPER_A, LOWER_A, PUSH_B, PULL_B, LEGS_B],
  },
  {
    id: 'ppl-6',
    name: 'Push / Pull / Legs ×2',
    daysPerWeek: 6,
    description: 'Push, Pull and Legs twice a week with two versions of each.',
    workouts: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B],
  },
];

export function getSplit(id: string | undefined): ProgrammeSplit | undefined {
  return PROGRAMME_SPLITS.find((s) => s.id === id);
}

/** The version that fits a number of training days (3–6). */
export function splitForDays(days: number): ProgrammeSplit {
  const clamped = Math.min(6, Math.max(3, days || 4));
  return PROGRAMME_SPLITS.find((s) => s.daysPerWeek === clamped) ?? PROGRAMME_SPLITS[1];
}

import { Exercise, MuscleGroup } from '../types/workout';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  lats: 'Lats',
  upper_back: 'Upper Back & Traps',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs & Core',
  lower_back: 'Lower Back',
};

export const MUSCLE_CATEGORY_MAP: Record<MuscleGroup, 'Push' | 'Pull' | 'Legs' | 'Core'> = {
  chest: 'Push',
  front_delts: 'Push',
  side_delts: 'Push',
  triceps: 'Push',
  lats: 'Pull',
  upper_back: 'Pull',
  rear_delts: 'Pull',
  biceps: 'Pull',
  forearms: 'Pull',
  lower_back: 'Pull',
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  abs: 'Core',
};

export const SEED_EXERCISES: Exercise[] = [
  // ================= PUSH: CHEST =================
  {
    id: 'ex-bench-press',
    name: 'Barbell Bench Press',
    equipment: 'barbell',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'front_delts'],
    defaultRestSeconds: 180,
    barWeightKg: 20,
    targetRepRange: [5, 8],
    cues: 'Retract scapula, slight arch, touch lower chest, drive feet into floor.',
  },
  {
    id: 'ex-incline-db-press',
    name: 'Incline Dumbbell Press',
    equipment: 'dumbbell',
    primaryMuscle: 'chest',
    secondaryMuscles: ['front_delts', 'triceps'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: '30-degree bench angle. Deep stretch at the bottom, controlled eccentric.',
  },
  {
    id: 'ex-incline-bb-press',
    name: 'Incline Barbell Bench Press',
    equipment: 'barbell',
    primaryMuscle: 'chest',
    secondaryMuscles: ['front_delts', 'triceps'],
    defaultRestSeconds: 150,
    barWeightKg: 20,
    targetRepRange: [6, 10],
    cues: 'Lower bar to upper chest/clavicle line with forearms vertical.',
  },
  {
    id: 'ex-machine-chest-press',
    name: 'Converging Machine Chest Press',
    equipment: 'machine',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'front_delts'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Keep shoulders pinned back into pad as you press to near-lockout.',
  },
  {
    id: 'ex-cable-fly',
    name: 'Seated Cable Chest Fly',
    equipment: 'cable',
    primaryMuscle: 'chest',
    secondaryMuscles: ['front_delts'],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Think about bringing inner elbows together; pause 1s in peak contraction.',
  },
  {
    id: 'ex-pec-deck',
    name: 'Pec Deck Machine Fly',
    equipment: 'machine',
    primaryMuscle: 'chest',
    secondaryMuscles: ['front_delts'],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Chest up, slight bend in elbows, controlled stretch.',
  },
  {
    id: 'ex-weighted-dips',
    name: 'Weighted Chest Dips',
    equipment: 'bodyweight',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'front_delts'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Lean torso forward ~25 degrees to bias lower pecs.',
  },

  // ================= PUSH: SHOULDERS =================
  {
    id: 'ex-ohp',
    name: 'Overhead Barbell Press (OHP)',
    equipment: 'barbell',
    primaryMuscle: 'front_delts',
    secondaryMuscles: ['triceps', 'side_delts', 'upper_back'],
    defaultRestSeconds: 150,
    barWeightKg: 20,
    targetRepRange: [6, 10],
    cues: 'Squeeze glutes & core tight, press straight overhead and push head through.',
  },
  {
    id: 'ex-seated-db-shoulder-press',
    name: 'Seated Dumbbell Shoulder Press',
    equipment: 'dumbbell',
    primaryMuscle: 'front_delts',
    secondaryMuscles: ['triceps', 'side_delts'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Press in the scapular plane (elbows tucked ~30 degrees forward).',
  },
  {
    id: 'ex-db-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    equipment: 'dumbbell',
    primaryMuscle: 'side_delts',
    secondaryMuscles: ['upper_back'],
    defaultRestSeconds: 75,
    targetRepRange: [12, 16],
    cues: 'Lead with elbows slightly forward in the scapular plane, avoid shrugging.',
  },
  {
    id: 'ex-cable-lateral-raise',
    name: 'Behind-the-Back Cable Lateral Raise',
    equipment: 'cable',
    primaryMuscle: 'side_delts',
    secondaryMuscles: [],
    defaultRestSeconds: 75,
    targetRepRange: [12, 15],
    cues: 'Set pulley to wrist height for maximal tension in the stretched position.',
  },

  // ================= PUSH: TRICEPS =================
  {
    id: 'ex-triceps-pushdown',
    name: 'Cable Rope Triceps Pushdown',
    equipment: 'cable',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Lock elbows at sides, spread rope slightly at full extension.',
  },
  {
    id: 'ex-overhead-cable-extension',
    name: 'Overhead Cable Triceps Extension',
    equipment: 'cable',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Emphasize the deep overhead stretch to target the long head of the triceps.',
  },
  {
    id: 'ex-skullcrushers',
    name: 'EZ-Bar Skullcrushers',
    equipment: 'ez_bar',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['forearms'],
    defaultRestSeconds: 90,
    barWeightKg: 10,
    targetRepRange: [8, 12],
    cues: 'Lower bar slightly behind forehead to keep constant tension on long head.',
  },

  // ================= PULL: BACK & REAR DELTS =================
  {
    id: 'ex-weighted-pullup',
    name: 'Weighted Pull-Up',
    equipment: 'bodyweight',
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'upper_back', 'forearms'],
    defaultRestSeconds: 150,
    targetRepRange: [6, 10],
    cues: 'Depress scapula first, drive elbows down toward hips.',
  },
  {
    id: 'ex-lat-pulldown',
    name: 'Wide-Grip Lat Pulldown',
    equipment: 'cable',
    primaryMuscle: 'lats',
    secondaryMuscles: ['biceps', 'upper_back'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Slight lean back, pull bar to upper chest, full stretch at top.',
  },
  {
    id: 'ex-barbell-row',
    name: 'Pendlay / Barbell Bent-Over Row',
    equipment: 'barbell',
    primaryMuscle: 'upper_back',
    secondaryMuscles: ['lats', 'biceps', 'lower_back', 'rear_delts'],
    defaultRestSeconds: 150,
    barWeightKg: 20,
    targetRepRange: [6, 10],
    cues: 'Hinge to 45 degrees, brace core, row bar into lower sternum/upper abs.',
  },
  {
    id: 'ex-chest-supported-row',
    name: 'Chest-Supported T-Bar / Machine Row',
    equipment: 'machine',
    primaryMuscle: 'upper_back',
    secondaryMuscles: ['lats', 'rear_delts', 'biceps'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Let scapula protract fully at the bottom, squeeze shoulder blades together.',
  },
  {
    id: 'ex-seated-cable-row',
    name: 'Seated Neutral-Grip Cable Row',
    equipment: 'cable',
    primaryMuscle: 'lats',
    secondaryMuscles: ['upper_back', 'biceps'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Keep elbows tucked, drive back without excessive lower-back swing.',
  },
  {
    id: 'ex-single-arm-db-row',
    name: 'Single-Arm Dumbbell Row',
    equipment: 'dumbbell',
    primaryMuscle: 'lats',
    secondaryMuscles: ['upper_back', 'biceps', 'forearms'],
    defaultRestSeconds: 90,
    targetRepRange: [8, 12],
    cues: 'Pull dumbbell in an arc toward your hip pocket.',
  },
  {
    id: 'ex-face-pull',
    name: 'Cable Rope Face Pull',
    equipment: 'cable',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['upper_back'],
    defaultRestSeconds: 75,
    targetRepRange: [12, 18],
    cues: 'Pull rope toward forehead while externally rotating shoulders at the end.',
  },
  {
    id: 'ex-rear-delt-fly',
    name: 'Reverse Pec Deck (Rear Delt Fly)',
    equipment: 'machine',
    primaryMuscle: 'rear_delts',
    secondaryMuscles: ['upper_back'],
    defaultRestSeconds: 75,
    targetRepRange: [12, 16],
    cues: 'Push hands out wide rather than squeezing traps together.',
  },

  // ================= PULL: BICEPS =================
  {
    id: 'ex-incline-db-curl',
    name: 'Incline Dumbbell Curl',
    equipment: 'dumbbell',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    defaultRestSeconds: 90,
    targetRepRange: [8, 12],
    cues: 'Keep elbows pinned behind torso to stretch the long head of the biceps.',
  },
  {
    id: 'ex-ez-bar-curl',
    name: 'EZ-Bar Biceps Curl',
    equipment: 'ez_bar',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    defaultRestSeconds: 90,
    barWeightKg: 10,
    targetRepRange: [8, 12],
    cues: 'Strict posture, full supination and controlled lowering.',
  },
  {
    id: 'ex-hammer-curl',
    name: 'Dumbbell Hammer Curl',
    equipment: 'dumbbell',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    defaultRestSeconds: 75,
    targetRepRange: [10, 14],
    cues: 'Neutral grip targets brachialis and brachioradialis.',
  },
  {
    id: 'ex-preacher-curl',
    name: 'Machine / EZ-Bar Preacher Curl',
    equipment: 'machine',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    defaultRestSeconds: 90,
    targetRepRange: [10, 14],
    cues: 'Keep triceps glued to the pad; control the bottom 30 degrees.',
  },

  // ================= LEGS: QUADS, HAMS, GLUTES, CALVES =================
  {
    id: 'ex-barbell-squat',
    name: 'Barbell High-Bar Back Squat',
    equipment: 'barbell',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'lower_back', 'abs'],
    defaultRestSeconds: 180,
    barWeightKg: 20,
    targetRepRange: [5, 8],
    cues: 'Brace 360 degrees, knees track over toes, hit full depth with upright torso.',
  },
  {
    id: 'ex-hack-squat',
    name: 'Pendulum / Linear Hack Squat',
    equipment: 'machine',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    defaultRestSeconds: 150,
    targetRepRange: [8, 12],
    cues: 'Place feet lower on platform for maximal knee flexion; keep lower back flat.',
  },
  {
    id: 'ex-rdl',
    name: 'Barbell Romanian Deadlift (RDL)',
    equipment: 'barbell',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower_back', 'forearms'],
    defaultRestSeconds: 150,
    barWeightKg: 20,
    targetRepRange: [6, 10],
    cues: 'Push hips straight back like closing a car door; stop as soon as hips stop moving back.',
  },
  {
    id: 'ex-conventional-deadlift',
    name: 'Conventional Barbell Deadlift',
    equipment: 'barbell',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'lower_back', 'upper_back', 'forearms'],
    defaultRestSeconds: 180,
    barWeightKg: 20,
    targetRepRange: [3, 6],
    cues: 'Pull slack out of the bar, engage lats, push the floor away.',
  },
  {
    id: 'ex-leg-press',
    name: '45° Sled Leg Press',
    equipment: 'machine',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    defaultRestSeconds: 120,
    targetRepRange: [10, 15],
    cues: 'Control depth without rounding pelvis off the seat pad.',
  },
  {
    id: 'ex-bulgarian-split-squat',
    name: 'Dumbbell Bulgarian Split Squat',
    equipment: 'dumbbell',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'hamstrings'],
    defaultRestSeconds: 120,
    targetRepRange: [8, 12],
    cues: 'Drop back knee down and slightly back; keep weight over front midfoot.',
  },
  {
    id: 'ex-seated-leg-curl',
    name: 'Seated Hamstring Leg Curl',
    equipment: 'machine',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['calves'],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Lock lap pad down tightly for maximal hip-flexed hamstring stretch.',
  },
  {
    id: 'ex-lying-leg-curl',
    name: 'Lying Leg Curl',
    equipment: 'machine',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['calves'],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Keep hips pressed into the bench throughout the entire curl.',
  },
  {
    id: 'ex-leg-extension',
    name: 'Seated Leg Extension',
    equipment: 'machine',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    defaultRestSeconds: 90,
    targetRepRange: [10, 15],
    cues: 'Pause 1 full second at peak lockout; control the eccentric all the way back.',
  },
  {
    id: 'ex-hip-thrust',
    name: 'Barbell Glute Hip Thrust',
    equipment: 'barbell',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    defaultRestSeconds: 120,
    barWeightKg: 20,
    targetRepRange: [8, 12],
    cues: 'Tuck chin, posteriorly tilt pelvis at top lockout, shins vertical.',
  },
  {
    id: 'ex-standing-calf-raise',
    name: 'Standing Machine Calf Raise',
    equipment: 'machine',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    defaultRestSeconds: 75,
    targetRepRange: [10, 15],
    cues: '2-second pause in the deep bottom stretch on every rep; no bouncing.',
  },
  {
    id: 'ex-cable-crunch',
    name: 'Kneeling Cable Rope Crunch',
    equipment: 'cable',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    defaultRestSeconds: 75,
    targetRepRange: [12, 16],
    cues: 'Flex the spine by curling ribs toward pelvis rather than hinging at hips.',
  },
  {
    id: 'ex-hanging-leg-raise',
    name: 'Hanging Leg Raise',
    equipment: 'bodyweight',
    primaryMuscle: 'abs',
    secondaryMuscles: ['forearms'],
    defaultRestSeconds: 75,
    targetRepRange: [10, 15],
    cues: 'Curl pelvis upward to engage lower abs rather than just swinging legs.',
  },
];

const MUSCLE_SYNONYMS: Record<MuscleGroup, string> = {
  chest: 'pec pecs pectoral bench push',
  lats: 'back lat wings pull vertical',
  upper_back: 'back traps trapezius rhomboids row pull',
  front_delts: 'shoulder shoulders delt delts anterior press',
  side_delts: 'shoulder shoulders delt delts lateral medial side',
  rear_delts: 'shoulder shoulders delt delts posterior rear facepull',
  biceps: 'arm arms bi bis curl curls pull',
  triceps: 'arm arms tri tris pushdown extension pressdown',
  forearms: 'arm arms grip wrist forearm',
  quads: 'leg legs quad quadriceps squat thigh',
  hamstrings: 'leg legs ham hams hamstring rdl hinge',
  glutes: 'leg legs glute butt hip',
  calves: 'leg legs calf',
  abs: 'core ab abdominal stomach sixpack',
  lower_back: 'back erectors hinge spine',
};

const EQUIPMENT_SYNONYMS: Record<Exercise['equipment'], string> = {
  barbell: 'bb bar freeweight',
  dumbbell: 'db dbs dumbell freeweight',
  machine: 'mach plate selectorized',
  cable: 'cables pulley rope',
  bodyweight: 'bw calisthenics dip pullup',
  ez_bar: 'ez curlbar bar',
  smith_machine: 'smith machine bar',
};

function buildExerciseSearchCorpus(ex: Exercise): string {
  const nameNorm = ex.name.toLowerCase().replace(/[-()/]/g, ' ');
  const compactName = ex.name.toLowerCase().replace(/[\s-()/]/g, '');
  const primaryLabel = MUSCLE_LABELS[ex.primaryMuscle].toLowerCase();
  const secondaryLabels = ex.secondaryMuscles
    .map((m) => `${MUSCLE_LABELS[m].toLowerCase()} ${MUSCLE_SYNONYMS[m] || ''}`)
    .join(' ');
  const splitCategory = MUSCLE_CATEGORY_MAP[ex.primaryMuscle].toLowerCase();
  const equip = ex.equipment.replace('_', ' ').toLowerCase();
  const equipSyn = EQUIPMENT_SYNONYMS[ex.equipment] || '';
  const muscleSyn = MUSCLE_SYNONYMS[ex.primaryMuscle] || '';
  const flySyn = nameNorm.includes('fly') ? 'flye flyes flies' : '';

  return [
    nameNorm,
    compactName,
    primaryLabel,
    ex.primaryMuscle.replace('_', ' '),
    splitCategory,
    equip,
    equipSyn,
    muscleSyn,
    secondaryLabels,
    flySyn,
  ].join(' ');
}

export function searchExercises(allExercises: Exercise[], query: string): Exercise[] {
  // Exercises the user removed stay in the data (old workouts reference them)
  // but are never offered in lists or pickers.
  const exercises = allExercises.filter((ex) => !ex.isArchived);
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return exercises;

  const tokens = trimmed
    .replace(/[-()/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return exercises;

  const scored: { ex: Exercise; score: number }[] = [];

  for (const ex of exercises) {
    const corpus = buildExerciseSearchCorpus(ex);
    const nameLower = ex.name.toLowerCase();
    const nameClean = nameLower.replace(/[-()/]/g, ' ');

    // Every word in the search query must match somewhere in the exercise's name, muscle, equipment, or synonyms
    const allMatch = tokens.every((tok) => corpus.includes(tok));
    if (!allMatch) continue;

    // Score higher when tokens match directly in the exercise name
    let score = 0;
    if (nameClean.includes(trimmed)) score += 100;
    for (const tok of tokens) {
      if (nameClean.includes(tok)) {
        score += 25;
      } else if (MUSCLE_LABELS[ex.primaryMuscle].toLowerCase().includes(tok)) {
        score += 10;
      } else {
        score += 3;
      }
    }

    scored.push({ ex, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.ex);
}


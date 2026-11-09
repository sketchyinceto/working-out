export type WeightUnit = 'kg' | 'lbs';

export type MuscleGroup =
  | 'chest'
  | 'lats'
  | 'upper_back'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'lower_back';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'ez_bar'
  | 'smith_machine';

export type SetType = 'working' | 'warmup' | 'dropset' | 'failure';

export type PRType = 'weight' | '1rm' | 'volume';

export interface Exercise {
  id: string;
  name: string;
  equipment: EquipmentType;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  defaultRestSeconds: number;
  barWeightKg?: number; // e.g., 20 for standard barbell, 10 for EZ bar
  cues?: string;
  targetRepRange: [number, number]; // e.g., [6, 10] or [8, 12]
  isCustom?: boolean;
  /** Removed by the user but kept so old workouts that used it still display. */
  isArchived?: boolean;
}

export interface WorkoutSet {
  id: string;
  setNumber: number;
  type: SetType;
  weightKg: number; // Always stored canonically in kg
  reps: number;
  rpe?: number;
  completed: boolean;
  completedAt?: string;
  prs?: PRType[];
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  /** Programme workouts: which programme slot this block fills. */
  slotId?: string;
  supersetGroup?: 'A' | 'B' | 'C';
  notes?: string;
  restSeconds: number;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  routineId?: string;
  splitTag?: 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Lower' | 'Full Body' | 'Custom';
  startTime: string; // ISO string
  endTime: string;   // ISO string
  durationMinutes: number;
  notes?: string;
  exercises: WorkoutExercise[];
  /** Set when the session was a programme workout. */
  programmeWorkoutId?: string;
}

export interface RoutineExerciseTemplate {
  id: string;
  exerciseId: string;
  targetSets: number;
  targetRepRange: [number, number];
  restSeconds: number;
  supersetGroup?: 'A' | 'B' | 'C';
  notes?: string;
}

export interface Routine {
  id: string;
  name: string;
  folder: 'Push / Pull / Legs' | 'Upper / Lower' | 'Full Body' | 'Custom';
  splitTag: 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Lower' | 'Full Body' | 'Custom';
  description: string;
  accentColor: string;
  exercises: RoutineExerciseTemplate[];
  lastPerformedAt?: string;
}

export interface BodyMeasurementEntry {
  id: string;
  date: string; // YYYY-MM-DD
  bodyweightKg: number;
}

export interface ActiveWorkoutDraft {
  id: string;
  name: string;
  routineId?: string;
  splitTag?: 'Push' | 'Pull' | 'Legs' | 'Upper' | 'Lower' | 'Full Body' | 'Custom';
  startTime: string;
  notes: string;
  exercises: WorkoutExercise[];
  isMinimized: boolean;
  programmeWeek?: ProgrammeWeekNote;
  programmeWorkoutId?: string;
}

export interface RestTimerState {
  isActive: boolean;
  targetEndTimeMs: number;
  totalDurationSeconds: number;
  exerciseName: string;
}

export type GoalType = 'lean_muscle' | 'muscle' | 'fat_loss' | 'recomp' | 'strength';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Goal & schedule settings from the Trainer tab. */
export interface TrainingProfile {
  goal: GoalType;
  experience: ExperienceLevel;
  /** Days you plan to train, 0 = Monday … 6 = Sunday. */
  trainingDays: number[];
  /** Routines to rotate through, in order. */
  rotationRoutineIds: string[];
}

/** What to do next time for one exercise slot, worked out after each session. */
export interface ProgrammeTarget {
  exerciseId: string;
  weightKg: number;
  reps: number;
  /** Sets added (+) or removed (−) vs the programme's baseline for the slot. */
  setDelta: number;
  restSeconds?: number;
  /** Rep range the target was set for; a new range means re-estimating. */
  range: [number, number];
  reason: string;
  updatedAt: string;
  /** Suggested replacement exercise after a stall (needs your OK). */
  swapSuggestion?: string;
  /** Sessions in a row where every set reached the top of the range. */
  topStreak?: number;
}

/** The long-term programme being followed. */
export interface ActiveProgramme {
  templateId: string;
  /** YYYY-MM-DD of the Monday the programme started (local time). */
  startDate: string;
  /** Bodyweight when it started, for the end-of-programme comparison. */
  startBodyweightKg?: number;
  /** Which weekly layout (3–6 days) of the programme's workouts to follow. */
  splitId?: string;
  /** Slot id → exercise id, for exercises you've swapped. */
  exerciseOverrides?: Record<string, string>;
  /** Slot id → next-session target. */
  targets?: Record<string, ProgrammeTarget>;
  /** Monday (YYYY-MM-DD) of the latest week already checked for missed sessions. */
  checkedThrough?: string;
  /** The most recent automatic week repeat, for the notice. */
  lastRepeat?: {
    /** Monday the repeat took effect. */
    on: string;
    week: number;
    done: number;
    planned: number;
  };
}

/** Programme guidance attached to a workout started during a programme. */
export interface ProgrammeWeekNote {
  week: number;
  totalWeeks: number;
  block: string;
  kind: 'build' | 'deload' | 'transition' | 'test';
  repsNote: string;
  rirNote: string;
  compoundReps: [number, number];
  isolationReps: [number, number];
}

export interface AppDatabaseState {
  unit: WeightUnit;
  exercises: Exercise[];
  routines: Routine[];
  workouts: WorkoutSession[];
  measurements: BodyMeasurementEntry[];
  activeWorkout: ActiveWorkoutDraft | null;
  isDemoData: boolean;
  /** Starter routines the user deleted, so they aren't re-added on the next load. */
  deletedStarterRoutineIds?: string[];
  trainingProfile?: TrainingProfile;
  programme?: ActiveProgramme | null;
}

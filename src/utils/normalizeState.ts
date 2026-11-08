import {
  ActiveWorkoutDraft,
  AppDatabaseState,
  BodyMeasurementEntry,
  Exercise,
  Routine,
  TrainingProfile,
  WorkoutExercise,
  WorkoutSession,
} from '../types/workout';
import { SEED_EXERCISES } from '../data/seedExercises';
import { STARTER_ROUTINES } from '../data/starterRoutines';

/**
 * Firebase Realtime Database silently drops empty arrays and null values, and
 * can hand arrays back as plain objects. Anything loaded from the cloud (or
 * from an older local copy) goes through here so every list the UI iterates
 * over is guaranteed to be a real array.
 */
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((v) => v != null) as T[];
  if (value && typeof value === 'object') {
    return Object.values(value).filter((v) => v != null) as T[];
  }
  return [];
}

function normalizeBlock(block: WorkoutExercise): WorkoutExercise {
  return { ...block, sets: asArray(block.sets) };
}

function normalizeWorkout(w: WorkoutSession): WorkoutSession {
  return { ...w, exercises: asArray<WorkoutExercise>(w.exercises).map(normalizeBlock) };
}

function normalizeExercise(e: Exercise): Exercise {
  const range = asArray<number>(e.targetRepRange);
  return {
    ...e,
    secondaryMuscles: asArray(e.secondaryMuscles),
    targetRepRange:
      range.length === 2 ? [range[0], range[1]] : [8, 12],
  };
}

function normalizeRoutine(r: Routine): Routine {
  return {
    ...r,
    exercises: asArray<Routine['exercises'][number]>(r.exercises).map((item) => {
      const range = asArray<number>(item.targetRepRange);
      return {
        ...item,
        targetRepRange: range.length === 2 ? [range[0], range[1]] : [8, 12],
      };
    }),
  };
}

function normalizeActiveWorkout(raw: unknown): ActiveWorkoutDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const draft = raw as ActiveWorkoutDraft;
  return {
    ...draft,
    notes: draft.notes ?? '',
    isMinimized: !!draft.isMinimized,
    exercises: asArray<WorkoutExercise>(draft.exercises).map(normalizeBlock),
  };
}

function normalizeProfile(raw: unknown): TrainingProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as TrainingProfile;
  return {
    goal: p.goal || 'lean_muscle',
    experience: p.experience || 'intermediate',
    trainingDays: asArray<number>(p.trainingDays).filter((d) => d >= 0 && d <= 6),
    rotationRoutineIds: asArray<string>(p.rotationRoutineIds),
  };
}

export function ensureSeedExercises(existing: Exercise[]): Exercise[] {
  const existingIds = new Set(existing.map((e) => e.id));
  const missingSeeds = SEED_EXERCISES.filter((e) => !existingIds.has(e.id));
  return [...existing, ...missingSeeds];
}

/** Adds any starter routine the user hasn't deliberately deleted. */
export function ensureStarterRoutines(
  existing: Routine[],
  deletedStarterIds: string[] = []
): Routine[] {
  const skip = new Set([...existing.map((r) => r.id), ...deletedStarterIds]);
  const missingStarters = STARTER_ROUTINES.filter((r) => !skip.has(r.id));
  return [...missingStarters, ...existing];
}

export function isStarterRoutineId(id: string): boolean {
  return STARTER_ROUTINES.some((r) => r.id === id);
}

function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const ids = new Set(primary.map((x) => x.id));
  return [...primary, ...secondary.filter((x) => !ids.has(x.id))];
}

/**
 * Combines this device's unsynced copy with the cloud copy so neither side's
 * new workouts are lost. Where both have the same item, this device wins.
 */
export function mergeStates(
  local: AppDatabaseState,
  server: AppDatabaseState
): AppDatabaseState {
  return normalizeState({
    ...local,
    workouts: unionById(local.workouts, server.workouts).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    ),
    measurements: unionById(local.measurements, server.measurements),
    routines: unionById(local.routines, server.routines),
    exercises: unionById(local.exercises, server.exercises),
    activeWorkout: local.activeWorkout ?? server.activeWorkout,
    trainingProfile: local.trainingProfile ?? server.trainingProfile,
    programme: local.programme ?? server.programme,
    deletedStarterRoutineIds: [
      ...new Set([
        ...(local.deletedStarterRoutineIds || []),
        ...(server.deletedStarterRoutineIds || []),
      ]),
    ],
  });
}

export function normalizeState(raw: unknown): AppDatabaseState {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppDatabaseState>;
  const deletedStarterRoutineIds = asArray<string>(data.deletedStarterRoutineIds);

  return {
    unit: 'kg',
    exercises: ensureSeedExercises(asArray<Exercise>(data.exercises).map(normalizeExercise)),
    routines: ensureStarterRoutines(
      asArray<Routine>(data.routines).map(normalizeRoutine),
      deletedStarterRoutineIds
    ),
    workouts: asArray<WorkoutSession>(data.workouts).map(normalizeWorkout),
    measurements: asArray<BodyMeasurementEntry>(data.measurements),
    activeWorkout: normalizeActiveWorkout(data.activeWorkout),
    isDemoData: !!data.isDemoData,
    deletedStarterRoutineIds,
    trainingProfile: normalizeProfile(data.trainingProfile),
    programme:
      data.programme && typeof data.programme === 'object' && data.programme.templateId
        ? data.programme
        : null,
  };
}

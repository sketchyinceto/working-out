import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Cloud,
  Dumbbell,
  History,
  Play,
  Sparkles,
  User,
} from 'lucide-react';
import {
  ActiveWorkoutDraft,
  AppDatabaseState,
  Exercise,
  RestTimerState,
  Routine,
  WorkoutExercise,
  WorkoutSession,
} from './types/workout';
import { SEED_EXERCISES } from './data/seedExercises';
import { STARTER_ROUTINES } from './data/starterRoutines';
import {
  generateDemoMeasurements,
  generateDemoWorkouts,
} from './data/demoHistory';
import {
  evaluateSetPRs,
  getLastPerformedExerciseBlock,
} from './utils/analytics';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { HistoryView } from './components/history/HistoryView';
import { ActiveWorkoutView } from './components/logger/ActiveWorkoutView';
import { RestTimerHUD } from './components/logger/RestTimerHUD';
import { RoutinesView } from './components/routines/RoutinesView';
import { ExerciseExplorerView } from './components/exercises/ExerciseExplorerView';
import { ExerciseDetailModal } from './components/exercises/ExerciseDetailModal';
import { TrainerView } from './components/trainer/TrainerView';
import { ExercisePrescription } from './utils/trainerEngine';

type NavTab =
  | 'analytics'
  | 'trainer'
  | 'routines'
  | 'logger'
  | 'history'
  | 'exercises';

const LOCAL_STORAGE_KEY = 'apex_lift_tracker_v2';
const CURRENT_USER_KEY = 'yk_lifts_current_user';
const CLOUD_URL_KEY = 'yk_lifts_cloud_db_url';

// Paste your Google Cloud / Firebase Realtime Database URL here (e.g. "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app")
const DEFAULT_CLOUD_DB_URL = 'https://yk-lifts-6416e-default-rtdb.asia-southeast1.firebasedatabase.app';

function normalizeUserKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
}

function getUserStorageKey(userName: string): string {
  const key = normalizeUserKey(userName);
  return key ? `${LOCAL_STORAGE_KEY}_${key}` : LOCAL_STORAGE_KEY;
}

function loadLocalUserState(userName: string): AppDatabaseState {
  try {
    const userStorageKey = getUserStorageKey(userName);
    const cached =
      localStorage.getItem(userStorageKey) ||
      localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as AppDatabaseState;
      return {
        ...parsed,
        unit: 'kg',
        exercises: ensureSeedExercises(parsed.exercises || SEED_EXERCISES),
        routines: ensureStarterRoutines(parsed.routines || []),
      };
    }
  } catch {
    // Fallback
  }
  return buildInitialState(false);
}

function buildInitialState(withDemo = false): AppDatabaseState {
  return {
    unit: 'kg',
    exercises: SEED_EXERCISES,
    routines: STARTER_ROUTINES,
    workouts: withDemo ? generateDemoWorkouts() : [],
    measurements: withDemo ? generateDemoMeasurements() : [],
    activeWorkout: null,
    isDemoData: withDemo,
  };
}

function ensureStarterRoutines(existing: Routine[]): Routine[] {
  const existingIds = new Set(existing.map((r) => r.id));
  const missingStarters = STARTER_ROUTINES.filter((r) => !existingIds.has(r.id));
  return [...missingStarters, ...existing];
}

function ensureSeedExercises(existing: Exercise[]): Exercise[] {
  const existingIds = new Set(existing.map((e) => e.id));
  const missingSeeds = SEED_EXERCISES.filter((e) => !existingIds.has(e.id));
  return [...existing, ...missingSeeds];
}

export const App: React.FC = () => {
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem(CURRENT_USER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [cloudDbUrl, setCloudDbUrl] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(CLOUD_URL_KEY)?.trim();
      return (stored || DEFAULT_CLOUD_DB_URL).replace(/\/+$/, '');
    } catch {
      return DEFAULT_CLOUD_DB_URL.replace(/\/+$/, '');
    }
  });
  const [showProfileModal, setShowProfileModal] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(CURRENT_USER_KEY);
    } catch {
      return true;
    }
  });
  const [nameInput, setNameInput] = useState<string>(userName);
  const [cloudUrlInput, setCloudUrlInput] = useState<string>(cloudDbUrl);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const [state, setState] = useState<AppDatabaseState>(() =>
    loadLocalUserState(userName)
  );

  const [activeTab, setActiveTab] = useState<NavTab>('analytics');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    isActive: false,
    targetEndTimeMs: 0,
    totalDurationSeconds: 120,
    exerciseName: '',
  });
  const isHydratingRef = React.useRef(true);
  const lastSavedJsonRef = React.useRef<string>('');

  // Hydrate data whenever userName or cloudDbUrl changes
  useEffect(() => {
    const userKey = normalizeUserKey(userName);
    isHydratingRef.current = true;
    const localState = loadLocalUserState(userName);
    setState(localState);

    if (!userKey) {
      isHydratingRef.current = false;
      return;
    }

    const endpoint = cloudDbUrl
      ? `${cloudDbUrl}/users/${userKey}.json`
      : `/api/store?user=${encodeURIComponent(userKey)}`;

    if (cloudDbUrl) setSyncStatus('syncing');

    fetch(endpoint)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((serverData) => {
        if (serverData && typeof serverData === 'object' && !serverData.empty) {
          const hydrated: AppDatabaseState = {
            ...localState,
            ...serverData,
            unit: 'kg',
            workouts: Array.isArray(serverData.workouts)
              ? serverData.workouts
              : localState.workouts,
            measurements: Array.isArray(serverData.measurements)
              ? serverData.measurements
              : localState.measurements,
            exercises: ensureSeedExercises(serverData.exercises || SEED_EXERCISES),
            routines: ensureStarterRoutines(serverData.routines || []),
          };
          lastSavedJsonRef.current = JSON.stringify(hydrated);
          setState(hydrated);
          if (cloudDbUrl) setSyncStatus('synced');
        } else if (cloudDbUrl) {
          // User doesn't exist in cloud yet — push existing local data up to cloud
          const initialPayload = JSON.stringify(localState);
          lastSavedJsonRef.current = initialPayload;
          fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: initialPayload,
          })
            .then((r) => setSyncStatus(r.ok ? 'synced' : 'error'))
            .catch(() => setSyncStatus('error'));
        }
      })
      .catch(() => {
        if (cloudDbUrl) setSyncStatus('error');
      })
      .finally(() => {
        isHydratingRef.current = false;
      });
  }, [userName, cloudDbUrl]);

  // Save data locally and to Google Cloud / Firebase whenever state changes
  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      const storageKey = getUserStorageKey(userName);
      localStorage.setItem(storageKey, serialized);
      localStorage.setItem(LOCAL_STORAGE_KEY, serialized);

      if (isHydratingRef.current || serialized === lastSavedJsonRef.current) {
        return;
      }
      lastSavedJsonRef.current = serialized;

      const userKey = normalizeUserKey(userName);
      if (cloudDbUrl && userKey) {
        setSyncStatus('syncing');
        fetch(`${cloudDbUrl}/users/${userKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        })
          .then((r) => setSyncStatus(r.ok ? 'synced' : 'error'))
          .catch(() => setSyncStatus('error'));
      } else {
        fetch(`/api/store?user=${encodeURIComponent(userKey || 'default')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        }).catch(() => {});
      }
    } catch {
      // Ignore quota errors
    }
  }, [state, userName, cloudDbUrl]);

  const handleStartRoutine = (routine: Routine) => {
    const exMap = new Map(state.exercises.map((e) => [e.id, e]));

    const workoutExercises: WorkoutExercise[] = routine.exercises.map((tmpl, idx) => {
      const meta = exMap.get(tmpl.exerciseId);
      const lastBlock = getLastPerformedExerciseBlock(tmpl.exerciseId, state.workouts);
      const prevWorking = lastBlock
        ? lastBlock.exerciseBlock.sets.filter((s) => s.type !== 'warmup')
        : [];

      const sets = Array.from({ length: tmpl.targetSets }).map((_, sIdx) => {
        const prev = prevWorking[sIdx] || prevWorking[prevWorking.length - 1];
        return {
          id: `set-${Date.now()}-${idx}-${sIdx}`,
          setNumber: sIdx + 1,
          type: 'working' as const,
          weightKg: prev ? prev.weightKg : meta?.barWeightKg || 20,
          reps: prev ? prev.reps : tmpl.targetRepRange[0],
          completed: false,
        };
      });

      return {
        id: `we-${Date.now()}-${idx}`,
        exerciseId: tmpl.exerciseId,
        supersetGroup: tmpl.supersetGroup,
        notes: tmpl.notes,
        restSeconds: tmpl.restSeconds || meta?.defaultRestSeconds || 120,
        sets,
      };
    });

    const draft: ActiveWorkoutDraft = {
      id: `draft-${Date.now()}`,
      name: routine.name,
      routineId: routine.id,
      splitTag: routine.splitTag,
      startTime: new Date().toISOString(),
      notes: '',
      exercises: workoutExercises,
      isMinimized: false,
    };

    setState((prev) => ({ ...prev, activeWorkout: draft }));
    setActiveTab('logger');
  };

  const handleStartCoachedRoutine = (
    routine: Routine,
    prescriptions: ExercisePrescription[]
  ) => {
    const exMap = new Map(state.exercises.map((e) => [e.id, e]));
    const prescMap = new Map(prescriptions.map((p) => [p.exercise.id, p]));

    const workoutExercises: WorkoutExercise[] = routine.exercises.map(
      (tmpl, idx) => {
        const meta = exMap.get(tmpl.exerciseId);
        const presc = prescMap.get(tmpl.exerciseId);
        const lastBlock = getLastPerformedExerciseBlock(
          tmpl.exerciseId,
          state.workouts
        );
        const prevWorking = lastBlock
          ? lastBlock.exerciseBlock.sets.filter((s) => s.type !== 'warmup')
          : [];

        const useStatisticalTarget =
          presc &&
          presc.hasMeaningfulInsight &&
          (presc.status === 'overload_weight' ||
            presc.status === 'pr_momentum' ||
            presc.status === 'regression');

        const sets = Array.from({ length: tmpl.targetSets }).map((_, sIdx) => {
          const prev = prevWorking[sIdx] || prevWorking[prevWorking.length - 1];
          return {
            id: `set-${Date.now()}-${idx}-${sIdx}`,
            setNumber: sIdx + 1,
            type: 'working' as const,
            weightKg: useStatisticalTarget
              ? presc.recommendedWeightKg
              : prev
              ? prev.weightKg
              : meta?.barWeightKg || 20,
            reps: useStatisticalTarget
              ? presc.recommendedReps
              : prev
              ? prev.reps
              : tmpl.targetRepRange[0],
            completed: false,
          };
        });

        return {
          id: `we-${Date.now()}-${idx}`,
          exerciseId: tmpl.exerciseId,
          supersetGroup: tmpl.supersetGroup,
          notes: tmpl.notes,
          restSeconds: tmpl.restSeconds || meta?.defaultRestSeconds || 120,
          sets,
        };
      }
    );

    const draft: ActiveWorkoutDraft = {
      id: `draft-${Date.now()}`,
      name: routine.name,
      routineId: routine.id,
      splitTag: routine.splitTag,
      startTime: new Date().toISOString(),
      notes: '',
      exercises: workoutExercises,
      isMinimized: false,
    };

    setState((prev) => ({ ...prev, activeWorkout: draft }));
    setActiveTab('logger');
  };

  const handleAddExerciseToRoutine = (routineId: string, exercise: Exercise) => {
    setState((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => {
        if (r.id !== routineId) return r;
        if (r.exercises.some((e) => e.exerciseId === exercise.id)) return r;
        return {
          ...r,
          exercises: [
            ...r.exercises,
            {
              id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              exerciseId: exercise.id,
              targetSets: 3,
              targetRepRange: [
                exercise.targetRepRange[0],
                exercise.targetRepRange[1],
              ],
              restSeconds: exercise.defaultRestSeconds,
            },
          ],
        };
      }),
    }));
  };

  const handleSwapExerciseInRoutine = (
    routineId: string,
    oldExerciseId: string,
    newExercise: Exercise
  ) => {
    setState((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          exercises: r.exercises.map((item) =>
            item.exerciseId === oldExerciseId
              ? {
                  ...item,
                  exerciseId: newExercise.id,
                  targetRepRange: [
                    newExercise.targetRepRange[0],
                    newExercise.targetRepRange[1],
                  ],
                  restSeconds: newExercise.defaultRestSeconds,
                }
              : item
          ),
        };
      }),
    }));
  };

  const handleStartEmptyWorkout = () => {
    const defaultBench = state.exercises[0];
    const draft: ActiveWorkoutDraft = {
      id: `draft-${Date.now()}`,
      name: 'Custom Workout',
      splitTag: 'Custom',
      startTime: new Date().toISOString(),
      notes: '',
      exercises: defaultBench
        ? [
            {
              id: `we-${Date.now()}-0`,
              exerciseId: defaultBench.id,
              restSeconds: defaultBench.defaultRestSeconds,
              sets: [
                {
                  id: `set-${Date.now()}-1`,
                  setNumber: 1,
                  type: 'working',
                  weightKg: 60,
                  reps: 8,
                  completed: false,
                },
              ],
            },
          ]
        : [],
      isMinimized: false,
    };
    setState((prev) => ({ ...prev, activeWorkout: draft }));
    setActiveTab('logger');
  };

  const handleFinishWorkout = () => {
    const draft = state.activeWorkout;
    if (!draft) return;

    const endTime = new Date().toISOString();
    const runningBlocks: WorkoutExercise[] = [];

    const finalizedExercises: WorkoutExercise[] = draft.exercises
      .map((ex) => {
        const rawSets = ex.sets.filter((s) => s.completed);

        const evaluatedSets: WorkoutExercise['sets'] = [];
        for (const s of rawSets) {
          const priorHistory: WorkoutSession[] =
            evaluatedSets.length > 0 || runningBlocks.length > 0
              ? [
                  {
                    id: 'in-progress-session',
                    name: draft.name,
                    splitTag: draft.splitTag,
                    startTime: draft.startTime,
                    endTime,
                    durationMinutes: 1,
                    exercises: [
                      ...runningBlocks,
                      { ...ex, sets: evaluatedSets },
                    ],
                  },
                  ...state.workouts,
                ]
              : state.workouts;

          const prs =
            s.type !== 'warmup'
              ? evaluateSetPRs(ex.exerciseId, s, priorHistory)
              : [];
          evaluatedSets.push({
            ...s,
            completed: true,
            prs: prs.length > 0 ? prs : undefined,
          });
        }

        const finalizedBlock: WorkoutExercise = { ...ex, sets: evaluatedSets };
        if (evaluatedSets.length > 0) {
          runningBlocks.push(finalizedBlock);
        }
        return finalizedBlock;
      })
      .filter((ex) => ex.sets.length > 0);

    if (finalizedExercises.length === 0) {
      return;
    }

    const durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(endTime).getTime() - new Date(draft.startTime).getTime()) / 60000
      )
    );

    const completedSession: WorkoutSession = {
      id: `wk-${Date.now()}`,
      name: draft.name || 'Workout Session',
      routineId: draft.routineId,
      splitTag: draft.splitTag,
      startTime: draft.startTime,
      endTime,
      durationMinutes,
      notes: draft.notes || undefined,
      exercises: finalizedExercises,
    };

    setState((prev) => ({
      ...prev,
      workouts: [completedSession, ...prev.workouts],
      activeWorkout: null,
    }));
    setRestTimer((prev) => ({ ...prev, isActive: false }));
    setActiveTab('history');
  };

  const handleDiscardWorkout = () => {
    setState((prev) => ({ ...prev, activeWorkout: null }));
    setRestTimer((prev) => ({ ...prev, isActive: false }));
    setActiveTab('routines');
  };

  const handleStartRestTimer = (durationSeconds: number, exerciseName: string) => {
    setRestTimer({
      isActive: true,
      targetEndTimeMs: Date.now() + durationSeconds * 1000,
      totalDurationSeconds: durationSeconds,
      exerciseName,
    });
  };

  const handleAdjustRestTimer = (deltaSeconds: number) => {
    setRestTimer((prev) => ({
      ...prev,
      targetEndTimeMs: Math.max(
        Date.now() + 1000,
        prev.targetEndTimeMs + deltaSeconds * 1000
      ),
      totalDurationSeconds: Math.max(15, prev.totalDurationSeconds + deltaSeconds),
    }));
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yk-lifts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenExerciseDetail = (exId: string) => {
    setSelectedExerciseId(exId);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;
    const trimmedUrl = cloudUrlInput.trim().replace(/\/+$/, '');
    try {
      localStorage.setItem(CURRENT_USER_KEY, trimmedName);
      if (trimmedUrl) {
        localStorage.setItem(CLOUD_URL_KEY, trimmedUrl);
      } else {
        localStorage.removeItem(CLOUD_URL_KEY);
      }
    } catch {
      // Ignore
    }
    setUserName(trimmedName);
    setCloudDbUrl(trimmedUrl || DEFAULT_CLOUD_DB_URL.replace(/\/+$/, ''));
    setShowProfileModal(false);
  };

  const selectedExercise = state.exercises.find((e) => e.id === selectedExerciseId) || null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Apple Fitness Translucent Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 h-13 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-white">
              YK <span className="text-[#a4ff00]">LIFTS</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setNameInput(userName);
              setCloudUrlInput(cloudDbUrl);
              setShowProfileModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.08] text-xs font-semibold text-white transition"
            title="Switch User Profile & Cloud Sync"
          >
            <User className="w-3.5 h-3.5 text-[#a4ff00]" />
            <span className="max-w-[110px] truncate">
              {userName || 'Set Name'}
            </span>
            {cloudDbUrl && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-[#a4ff00]'
                    : syncStatus === 'syncing'
                    ? 'bg-[#ffe620] animate-pulse'
                    : syncStatus === 'error'
                    ? 'bg-[#fa114f]'
                    : 'bg-[#8e8e93]'
                }`}
                title={
                  syncStatus === 'synced'
                    ? 'Cloud Synced'
                    : syncStatus === 'syncing'
                    ? 'Syncing...'
                    : 'Cloud Sync Error'
                }
              />
            )}
          </button>
        </div>
      </header>

      {/* First-Time Name Prompt & Cross-Platform Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-sm bg-[#1c1c1e] border border-white/10 rounded-[26px] p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {userName ? 'Athlete Profile & Sync' : 'Welcome to YK LIFTS'}
                </h2>
                <p className="text-xs text-[#8e8e93]">
                  Enter your name to save & load your workouts across devices.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Keven"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-[#2c2c2e] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white placeholder-[#636366] focus:outline-none focus:border-[#a4ff00]"
                />
              </div>

              {!DEFAULT_CLOUD_DB_URL && (
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1">
                    <Cloud className="w-3 h-3 text-[#00f5ea]" /> Google Cloud / Firebase DB URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://your-project-default-rtdb.firebasedatabase.app"
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    className="w-full bg-[#2c2c2e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#636366] focus:outline-none focus:border-[#00f5ea]"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {userName && (
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 rounded-full bg-[#2c2c2e] text-white font-semibold text-xs"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="flex-1 py-2.5 rounded-full bg-[#a4ff00] disabled:opacity-40 text-black font-extrabold text-xs"
              >
                {userName ? 'Save Profile' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Workout Resume Banner */}
      {state.activeWorkout && activeTab !== 'logger' && (
        <div className="bg-[#1c1c1e] border-b border-[#a4ff00]/30 px-4 py-2.5">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#a4ff00] animate-ping shrink-0" />
              <span className="font-bold text-white truncate">
                {state.activeWorkout.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('logger')}
              className="px-3 py-1 rounded-full bg-[#a4ff00] text-black font-extrabold text-xs shrink-0"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 pb-24">
        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            workouts={state.workouts}
            exercises={state.exercises}
            measurements={state.measurements}
            unit={state.unit}
            onOpenExerciseDetail={handleOpenExerciseDetail}
            onAddBodyweight={(entry) =>
              setState((prev) => {
                const existingIdx = prev.measurements.findIndex(
                  (m) => m.date === entry.date
                );
                if (existingIdx >= 0) {
                  const updated = [...prev.measurements];
                  updated[existingIdx] = {
                    ...updated[existingIdx],
                    bodyweightKg: entry.bodyweightKg,
                  };
                  return { ...prev, measurements: updated };
                }
                return {
                  ...prev,
                  measurements: [
                    { ...entry, id: `bw-${Date.now()}` },
                    ...prev.measurements,
                  ],
                };
              })
            }
          />
        )}

        {activeTab === 'trainer' && (
          <TrainerView
            workouts={state.workouts}
            exercises={state.exercises}
            routines={state.routines}
            unit={state.unit}
            onStartCoachedRoutine={handleStartCoachedRoutine}
            onAddExerciseToRoutine={handleAddExerciseToRoutine}
            onSwapExerciseInRoutine={handleSwapExerciseInRoutine}
            onOpenExerciseDetail={handleOpenExerciseDetail}
          />
        )}

        {activeTab === 'routines' && (
          <RoutinesView
            routines={state.routines}
            exercises={state.exercises}
            workouts={state.workouts}
            unit={state.unit}
            onStartRoutine={handleStartRoutine}
            onStartEmptyWorkout={handleStartEmptyWorkout}
            onCreateRoutine={(newR) =>
              setState((prev) => ({
                ...prev,
                routines: [newR, ...prev.routines],
              }))
            }
            onUpdateRoutine={(updatedR) =>
              setState((prev) => ({
                ...prev,
                routines: prev.routines.map((r) =>
                  r.id === updatedR.id ? updatedR : r
                ),
              }))
            }
            onDeleteRoutine={(id) =>
              setState((prev) => ({
                ...prev,
                routines: prev.routines.filter((r) => r.id !== id),
              }))
            }
          />
        )}

        {activeTab === 'logger' && (
          state.activeWorkout ? (
            <ActiveWorkoutView
              draft={state.activeWorkout}
              exercises={state.exercises}
              workouts={state.workouts}
              unit={state.unit}
              onUpdateDraft={(updated) =>
                setState((prev) => ({ ...prev, activeWorkout: updated }))
              }
              onFinishWorkout={handleFinishWorkout}
              onDiscardWorkout={handleDiscardWorkout}
              onStartRestTimer={handleStartRestTimer}
              onOpenExerciseDetail={handleOpenExerciseDetail}
            />
          ) : (
            <div className="af-card p-6 text-center max-w-sm mx-auto my-8 space-y-3.5">
              <div className="w-12 h-12 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center mx-auto">
                <Dumbbell className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-white">
                Start a Workout
              </h2>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('routines')}
                  className="w-full py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs inline-flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Choose PPL Routine
                </button>
                <button
                  type="button"
                  onClick={handleStartEmptyWorkout}
                  className="w-full py-2.5 rounded-full bg-[#2c2c2e] text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Empty Session
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'history' && (
          <HistoryView
            workouts={state.workouts}
            exercises={state.exercises}
            routines={state.routines}
            unit={state.unit}
            onOpenExerciseDetail={handleOpenExerciseDetail}
            onUpdateWorkout={(updatedWorkout) =>
              setState((prev) => ({
                ...prev,
                workouts: prev.workouts.map((w) =>
                  w.id === updatedWorkout.id ? updatedWorkout : w
                ),
              }))
            }
            onDeleteWorkout={(id) =>
              setState((prev) => ({
                ...prev,
                workouts: prev.workouts.filter((w) => w.id !== id),
              }))
            }
            onStartWorkout={() => setActiveTab('routines')}
            onExportJson={handleExportJson}
          />
        )}

        {activeTab === 'exercises' && (
          <ExerciseExplorerView
            exercises={state.exercises}
            workouts={state.workouts}
            unit={state.unit}
            onSelectExerciseId={setSelectedExerciseId}
            onAddCustomExercise={(ex: Exercise) =>
              setState((prev) => ({
                ...prev,
                exercises: [ex, ...prev.exercises],
              }))
            }
          />
        )}
      </main>

      {/* Global Exercise Detail Modal Overlay (stays on current page when closed) */}
      {selectedExercise && (
        <ExerciseDetailModal
          exercise={selectedExercise}
          workouts={state.workouts}
          unit={state.unit}
          onClose={() => setSelectedExerciseId(null)}
        />
      )}

      {/* Wall-Clock Floating Rest Timer HUD */}
      <RestTimerHUD
        timer={restTimer}
        onAdjustSeconds={handleAdjustRestTimer}
        onDismiss={() => setRestTimer((prev) => ({ ...prev, isActive: false }))}
      />

      {/* Apple Fitness Frosted Bottom Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#121214]/90 backdrop-blur-2xl border-t border-white/[0.08]">
        <div className="max-w-md mx-auto grid grid-cols-5 h-15 px-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'analytics'
                ? 'text-[#a4ff00] font-semibold'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px]">Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trainer')}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'trainer'
                ? 'text-[#a4ff00] font-semibold'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px]">Trainer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('routines')}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'routines' || activeTab === 'logger'
                ? 'text-[#a4ff00] font-semibold'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[10px]">Routines</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'history'
                ? 'text-[#a4ff00] font-semibold'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px]">History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exercises')}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'exercises'
                ? 'text-[#a4ff00] font-semibold'
                : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px]">Exercises</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
export default App;

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  isStarterRoutineId,
  mergeStates,
  normalizeState,
} from './utils/normalizeState';
import { primeAudio } from './utils/sound';

type NavTab =
  | 'analytics'
  | 'trainer'
  | 'routines'
  | 'logger'
  | 'history'
  | 'exercises';

// Older versions kept everyone's data under this one key (and mirrored the
// active user's data into it). It is now only read once, to migrate it.
const LEGACY_STORAGE_KEY = 'apex_lift_tracker_v2';
const CURRENT_USER_KEY = 'yk_lifts_current_user';
const CLOUD_URL_KEY = 'yk_lifts_cloud_db_url';
// Set while this device has changes the cloud hasn't confirmed yet.
const PENDING_SYNC_PREFIX = 'yk_lifts_pending_sync_';
const CLOUD_SAVE_DEBOUNCE_MS = 800;
const CLOUD_RETRY_INTERVAL_MS = 30_000;

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
  return key ? `${LEGACY_STORAGE_KEY}_${key}` : LEGACY_STORAGE_KEY;
}

function isSyncPending(userKey: string): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_PREFIX + userKey) === '1';
  } catch {
    return false;
  }
}

function setSyncPending(userKey: string, pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_SYNC_PREFIX + userKey, '1');
    else localStorage.removeItem(PENDING_SYNC_PREFIX + userKey);
  } catch {
    // Ignore
  }
}

function loadLocalUserState(userName: string): AppDatabaseState {
  try {
    const userKey = normalizeUserKey(userName);
    const own = localStorage.getItem(getUserStorageKey(userName));
    const legacy = userKey ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    if (legacy && userKey) {
      // Hand the legacy copy to this user only if they have nothing of their
      // own, then retire it so it can't leak into another profile.
      if (!own) localStorage.setItem(getUserStorageKey(userName), legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const cached = own || legacy;
    if (cached) return normalizeState(JSON.parse(cached));
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
  // Which profile `state` currently belongs to. While switching users there is
  // one render where userName is new but state is still the old user's.
  const [stateOwner, setStateOwner] = useState<string>(userName);

  const [activeTab, setActiveTab] = useState<NavTab>('analytics');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    isActive: false,
    targetEndTimeMs: 0,
    totalDurationSeconds: 120,
    exerciseName: '',
  });

  // --- Cloud sync bookkeeping ---
  const isHydratingRef = useRef(true);
  // True once the cloud copy for the current profile has been read. Until then
  // nothing is uploaded, so a device that starts offline can't overwrite
  // newer data from another device with its stale copy.
  const cloudReadOkRef = useRef(false);
  const pullsInFlightRef = useRef(0);
  const currentUserKeyRef = useRef(normalizeUserKey(userName));
  const lastQueuedJsonRef = useRef<string>('');
  const latestStateRef = useRef<AppDatabaseState>(state);
  const saveTimerRef = useRef<{ id: number; userKey: string } | null>(null);
  const inFlightRef = useRef(false);
  const queuedSavesRef = useRef(new Map<string, AppDatabaseState>());

  const remoteEndpoint = useCallback(
    (userKey: string) =>
      cloudDbUrl
        ? `${cloudDbUrl}/users/${userKey}.json`
        : `/api/store?user=${encodeURIComponent(userKey)}`,
    [cloudDbUrl]
  );

  // Upload one snapshot. Requests never overlap, so an older save can't land
  // after a newer one; saves requested mid-flight are sent next.
  const pushToCloud = useCallback(
    (userKey: string, snapshot: AppDatabaseState) => {
      if (!userKey) return;
      if (inFlightRef.current) {
        queuedSavesRef.current.set(userKey, snapshot);
        return;
      }
      inFlightRef.current = true;
      const body = JSON.stringify(snapshot);
      setSyncStatus('syncing');
      fetch(remoteEndpoint(userKey), {
        method: cloudDbUrl ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        // Lets a save finish even if the page is being closed (64 KB limit).
        keepalive: body.length < 60_000,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          // Only clear the flag if nothing newer is waiting to be sent.
          if (!queuedSavesRef.current.has(userKey)) setSyncPending(userKey, false);
          setSyncStatus('synced');
        })
        .catch(() => setSyncStatus('error'))
        .finally(() => {
          inFlightRef.current = false;
          const next = queuedSavesRef.current.entries().next();
          if (!next.done) {
            const [nextKey, nextSnapshot] = next.value;
            queuedSavesRef.current.delete(nextKey);
            pushToCloud(nextKey, nextSnapshot);
          }
        });
    },
    [cloudDbUrl, remoteEndpoint]
  );

  // Read the cloud copy and reconcile it with this device's copy.
  const pullFromCloud = useCallback(
    (userKey: string, isCancelled: () => boolean) => {
      pullsInFlightRef.current += 1;
      setSyncStatus('syncing');
      return fetch(remoteEndpoint(userKey))
        .then((res) => {
          // The local dev store answers 404 for a brand-new user.
          if (res.status === 404 && !cloudDbUrl) return null;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((serverData) => {
          if (isCancelled()) return;
          cloudReadOkRef.current = true;
          const hasServerData =
            serverData && typeof serverData === 'object' && !serverData.empty;

          if (!hasServerData) {
            // Nothing in the cloud for this user yet: upload this device's copy.
            setSyncPending(userKey, true);
            pushToCloud(userKey, latestStateRef.current);
            return;
          }

          const server = normalizeState(serverData);
          const next = isSyncPending(userKey)
            ? // This device has changes that never reached the cloud (e.g.
              // logged with no signal): keep both sides' new data.
              mergeStates(latestStateRef.current, server)
            : server;
          lastQueuedJsonRef.current = JSON.stringify(next);
          latestStateRef.current = next;
          setState(next);
          if (isSyncPending(userKey)) pushToCloud(userKey, next);
          else setSyncStatus('synced');
        })
        .catch(() => {
          // Couldn't read the cloud: keep using the local copy. Retried below.
          if (!isCancelled()) setSyncStatus('error');
        })
        .finally(() => {
          pullsInFlightRef.current -= 1;
        });
    },
    [cloudDbUrl, remoteEndpoint, pushToCloud]
  );

  const flushScheduledSave = useCallback(() => {
    const scheduled = saveTimerRef.current;
    if (!scheduled) return;
    window.clearTimeout(scheduled.id);
    saveTimerRef.current = null;
    if (cloudReadOkRef.current) pushToCloud(scheduled.userKey, latestStateRef.current);
  }, [pushToCloud]);

  // Load the profile: local copy first (instant), then the cloud copy.
  useEffect(() => {
    // Anything still waiting to be saved belongs to the previous profile.
    flushScheduledSave();

    const userKey = normalizeUserKey(userName);
    currentUserKeyRef.current = userKey;
    let cancelled = false;
    isHydratingRef.current = true;
    cloudReadOkRef.current = false;
    const localState = loadLocalUserState(userName);
    lastQueuedJsonRef.current = JSON.stringify(localState);
    latestStateRef.current = localState;
    setState(localState);
    setStateOwner(userName);

    if (!userKey) {
      isHydratingRef.current = false;
      return;
    }

    pullFromCloud(userKey, () => cancelled).finally(() => {
      if (!cancelled) isHydratingRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [userName, cloudDbUrl, pullFromCloud, flushScheduledSave]);

  // Save locally on every change, and to the cloud shortly after changes stop.
  useEffect(() => {
    if (stateOwner !== userName) return;
    latestStateRef.current = state;
    const userKey = normalizeUserKey(userName);
    const serialized = JSON.stringify(state);
    try {
      localStorage.setItem(getUserStorageKey(userName), serialized);
    } catch {
      // Ignore quota errors
    }

    if (serialized === lastQueuedJsonRef.current) return;
    lastQueuedJsonRef.current = serialized;
    if (!userKey) return;
    setSyncPending(userKey, true);
    // Until the cloud copy has been read, changes wait behind the pending
    // flag and are merged in once it arrives.
    if (isHydratingRef.current || !cloudReadOkRef.current) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current.id);
    saveTimerRef.current = {
      userKey,
      id: window.setTimeout(() => {
        saveTimerRef.current = null;
        pushToCloud(userKey, latestStateRef.current);
      }, CLOUD_SAVE_DEBOUNCE_MS),
    };
  }, [state, stateOwner, userName, pushToCloud]);

  // Don't lose the last few seconds of changes when the app is closed or
  // backgrounded, and keep retrying when the cloud couldn't be reached.
  useEffect(() => {
    const retry = () => {
      const userKey = normalizeUserKey(userName);
      if (!userKey || isHydratingRef.current || saveTimerRef.current) return;
      if (!cloudReadOkRef.current) {
        if (pullsInFlightRef.current > 0) return;
        pullFromCloud(userKey, () => currentUserKeyRef.current !== userKey);
      } else if (isSyncPending(userKey)) {
        pushToCloud(userKey, latestStateRef.current);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushScheduledSave();
      else retry();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushScheduledSave);
    window.addEventListener('online', retry);
    const retryId = window.setInterval(retry, CLOUD_RETRY_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushScheduledSave);
      window.removeEventListener('online', retry);
      window.clearInterval(retryId);
    };
  }, [userName, pushToCloud, pullFromCloud, flushScheduledSave]);

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
    if (
      !window.confirm(
        'Discard this workout? Everything logged in this session will be lost.'
      )
    ) {
      return;
    }
    setState((prev) => ({ ...prev, activeWorkout: null }));
    setRestTimer((prev) => ({ ...prev, isActive: false }));
    setActiveTab('routines');
  };

  const handleStartRestTimer = (durationSeconds: number, exerciseName: string) => {
    // Runs inside the "set done" tap, which is what lets iPhones play the chime.
    primeAudio();
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
    const now = new Date();
    a.download = `yk-lifts-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;
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
      // Only remember a URL that differs from the built-in one, so changing
      // DEFAULT_CLOUD_DB_URL in code reaches everyone.
      if (trimmedUrl && trimmedUrl !== DEFAULT_CLOUD_DB_URL.replace(/\/+$/, '')) {
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
                // Remember deleted starter routines so they don't come back.
                deletedStarterRoutineIds: isStarterRoutineId(id)
                  ? [...new Set([...(prev.deletedStarterRoutineIds || []), id])]
                  : prev.deletedStarterRoutineIds,
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

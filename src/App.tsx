import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Download,
  Dumbbell,
  History,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
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

function buildInitialState(withDemo = true): AppDatabaseState {
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
  const [state, setState] = useState<AppDatabaseState>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
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
    return buildInitialState(true);
  });

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

  useEffect(() => {
    fetch('/api/store')
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((serverData) => {
        if (serverData && Array.isArray(serverData.workouts)) {
          const hydrated: AppDatabaseState = {
            ...serverData,
            unit: 'kg',
            exercises: ensureSeedExercises(serverData.exercises || SEED_EXERCISES),
            routines: ensureStarterRoutines(serverData.routines || []),
          };
          lastSavedJsonRef.current = JSON.stringify(hydrated);
          setState(hydrated);
        }
      })
      .catch(() => {})
      .finally(() => {
        isHydratingRef.current = false;
      });
  }, []);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
      if (isHydratingRef.current || serialized === lastSavedJsonRef.current) {
        return;
      }
      lastSavedJsonRef.current = serialized;
      fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
      }).catch(() => {});
    } catch {
      // Ignore quota errors
    }
  }, [state]);

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

  const handleClearDemoData = () => {
    setState(buildInitialState(false));
  };

  const handleRestoreDemoData = () => {
    setState(buildInitialState(true));
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

          <div className="flex items-center gap-1.5">
            {state.isDemoData && state.workouts.length > 0 ? (
              <button
                type="button"
                onClick={handleClearDemoData}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#8e8e93] hover:text-white text-[11px] font-semibold transition"
                title="Clear sample history"
              >
                <Trash2 className="w-3 h-3" /> Clear Demo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreDemoData}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#a4ff00] hover:text-white text-[11px] font-semibold transition"
                title="Restore 10-week sample workout history"
              >
                <RotateCcw className="w-3 h-3" /> Load Demo
              </button>
            )}

            <button
              type="button"
              onClick={handleExportJson}
              className="p-1.5 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#8e8e93] hover:text-white transition"
              title="Backup JSON"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

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

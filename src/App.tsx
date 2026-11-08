import React, { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { Dumbbell, Play, Sparkles } from 'lucide-react';
import {
  ActiveProgramme,
  Exercise,
  RestTimerState,
  Routine,
  WorkoutSession,
} from './types/workout';
import { getProgrammeStatus, programmeStartDate, latestBodyweightKg } from './utils/coach/programme';
import {
  PROGRAMME_ROUTINE_PREFIX,
  activeSplit,
  buildProgrammeDraft,
  findProgrammeWorkout,
} from './utils/coach/programmeWorkouts';
import { analyzeProgrammeSession, SessionAnalysis } from './utils/coach/analysis';
import { defaultProfile } from './utils/coach/schedule';
import { splitForDays } from './data/programmeSplits';
import type { ProgrammeTemplate } from './data/programmes';
import { useCloudSync } from './hooks/useCloudSync';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { RestTimerHUD } from './components/logger/RestTimerHUD';
import { AppHeader } from './components/layout/AppHeader';
import { BottomNav, NavTab } from './components/layout/BottomNav';
import { ProfileModal } from './components/layout/ProfileModal';
import { isStarterRoutineId } from './utils/normalizeState';
import { primeAudio } from './utils/sound';
import { toLocalDateStr } from './utils/dates';
import {
  buildDraftFromRoutine,
  buildEmptyDraft,
  finalizeWorkout,
} from './utils/workoutBuilders';

// Summary is the start screen, so it ships in the main bundle. Everything else
// downloads the first time it's opened, which keeps the first load small.
// Every lazily loaded screen, so they can all be fetched in the background.
const screenLoaders: (() => Promise<unknown>)[] = [];

function named<M, K extends keyof M>(load: () => Promise<M>, key: K) {
  screenLoaders.push(load);
  return lazy(async () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (await load())[key] as Extract<M[K], React.ComponentType<any>>,
  }));
}

const TrainerView = named(() => import('./components/trainer/TrainerView'), 'TrainerView');
const RoutinesView = named(() => import('./components/routines/RoutinesView'), 'RoutinesView');
const ActiveWorkoutView = named(
  () => import('./components/logger/ActiveWorkoutView'),
  'ActiveWorkoutView'
);
const HistoryView = named(() => import('./components/history/HistoryView'), 'HistoryView');
const ExerciseExplorerView = named(
  () => import('./components/exercises/ExerciseExplorerView'),
  'ExerciseExplorerView'
);
const ExerciseDetailModal = named(
  () => import('./components/exercises/ExerciseDetailModal'),
  'ExerciseDetailModal'
);
const CustomExerciseForm = named(
  () => import('./components/exercises/CustomExerciseForm'),
  'CustomExerciseForm'
);
const ProgrammeWorkoutsView = named(
  () => import('./components/routines/ProgrammeWorkoutsView'),
  'ProgrammeWorkoutsView'
);
const ProgrammePicker = named(() => import('./components/trainer/ProgrammePicker'), 'ProgrammePicker');
const WorkoutCompleteModal = named(
  () => import('./components/logger/WorkoutCompleteModal'),
  'WorkoutCompleteModal'
);

const ScreenLoading = () => (
  <div className="flex justify-center py-16" aria-label="Loading">
    <div className="w-6 h-6 rounded-full border-2 border-[#a4ff00]/30 border-t-[#a4ff00] animate-spin" />
  </div>
);

export const App: React.FC = () => {
  const { userName, state, setState, syncStatus, switchProfile } = useCloudSync();
  const [showProfileModal, setShowProfileModal] = useState(() => !userName);
  const [activeTab, setActiveTabNow] = useState<NavTab>('analytics');
  // Switching tabs as a transition keeps the current screen on show until
  // the next one is ready, instead of flashing a loading spinner.
  const setActiveTab = (tab: NavTab) => startTransition(() => setActiveTabNow(tab));

  // Once the app has started, quietly download the other screens so opening
  // them later is instant (each is fetched once and then cached).
  useEffect(() => {
    const prefetch = () => {
      for (const load of screenLoaders) load().catch(() => {});
    };
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) {
      const id = idle(prefetch);
      return () =>
        (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(prefetch, 1200);
    return () => window.clearTimeout(id);
  }, []);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  // null = closed; { exercise: null } = creating; { exercise } = editing.
  const [exerciseForm, setExerciseForm] = useState<{ exercise: Exercise | null } | null>(
    null
  );
  const [justCompleted, setJustCompleted] = useState<WorkoutSession | null>(null);
  const [justCompletedAnalysis, setJustCompletedAnalysis] = useState<SessionAnalysis | null>(null);
  const [showProgrammePicker, setShowProgrammePicker] = useState(false);
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    isActive: false,
    targetEndTimeMs: 0,
    totalDurationSeconds: 120,
    exerciseName: '',
  });

  // --- Workouts ---

  const profile = state.trainingProfile ?? defaultProfile(state.routines);
  const programmeStatus = getProgrammeStatus(state.programme);

  const startProgrammeWorkout = (workoutId: string) => {
    const programme = state.programme;
    if (!programme || !programmeStatus?.week || programmeStatus.notStarted) return;
    const workout = findProgrammeWorkout(activeSplit(programme, profile), workoutId);
    if (!workout) return;
    const draft = buildProgrammeDraft(workout, programmeStatus, programme, state.exercises, state.workouts);
    setState((prev) => ({ ...prev, activeWorkout: draft }));
    setActiveTab('logger');
  };

  /** Your own routines run as written; programme workouts are built by the programme. */
  const startDraft = (routine: Routine) => {
    if (routine.id.startsWith(PROGRAMME_ROUTINE_PREFIX)) {
      startProgrammeWorkout(routine.id);
      return;
    }
    const draft = buildDraftFromRoutine(routine, state.exercises, state.workouts);
    setState((prev) => ({ ...prev, activeWorkout: draft }));
    setActiveTab('logger');
  };

  const handleStartEmptyWorkout = () => {
    const draft = buildEmptyDraft(state.exercises);
    setState((prev) => ({ ...prev, activeWorkout: draft }));
    setActiveTab('logger');
  };

  const handleFinishWorkout = () => {
    if (!state.activeWorkout) return;
    const session = finalizeWorkout(state.activeWorkout, state.workouts);
    if (!session) return;

    // Programme workouts: review each exercise and set next session's targets.
    let analysis: SessionAnalysis | null = null;
    const programme = state.programme;
    if (session.programmeWorkoutId && programme && programmeStatus?.week) {
      analysis = analyzeProgrammeSession(session, programme, programmeStatus.week, state.exercises, [
        session,
        ...state.workouts,
      ]);
    }

    setState((prev) => ({
      ...prev,
      workouts: [session, ...prev.workouts],
      activeWorkout: null,
      ...(analysis && prev.programme
        ? {
            programme: {
              ...prev.programme,
              targets: { ...(prev.programme.targets || {}), ...analysis.targets },
            },
          }
        : {}),
    }));
    setRestTimer((prev) => ({ ...prev, isActive: false }));
    setActiveTab('history');
    setJustCompleted(session);
    setJustCompletedAnalysis(analysis);
  };

  // --- Programme ---

  const updateProgramme = (update: (p: ActiveProgramme) => ActiveProgramme) =>
    setState((prev) => (prev.programme ? { ...prev, programme: update(prev.programme) } : prev));

  const handleStartProgramme = (template: ProgrammeTemplate) => {
    const bodyweight = latestBodyweightKg(state.measurements);
    setState((prev) => ({
      ...prev,
      programme: {
        templateId: template.id,
        startDate: programmeStartDate(),
        splitId: splitForDays(profile.trainingDays.length).id,
        ...(bodyweight ? { startBodyweightKg: bodyweight } : {}),
      },
    }));
    setShowProgrammePicker(false);
  };

  const handleAcceptSwap = (slotId: string, exerciseId: string) =>
    updateProgramme((p) => {
      const targets = { ...(p.targets || {}) };
      // The new exercise starts fresh (estimated from its own history).
      delete targets[slotId];
      return { ...p, exerciseOverrides: { ...(p.exerciseOverrides || {}), [slotId]: exerciseId }, targets };
    });

  const handleDismissSwap = (slotId: string) =>
    updateProgramme((p) => {
      const current = p.targets?.[slotId];
      if (!current) return p;
      const { swapSuggestion: _ignored, ...rest } = current;
      return { ...p, targets: { ...(p.targets || {}), [slotId]: rest } };
    });

  const handleDiscardWorkout = () => {
    if (!window.confirm('Discard this workout? Everything logged in this session will be lost.')) {
      return;
    }
    setState((prev) => ({ ...prev, activeWorkout: null }));
    setRestTimer((prev) => ({ ...prev, isActive: false }));
    setActiveTab('routines');
  };

  // --- Rest timer ---

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
      targetEndTimeMs: Math.max(Date.now() + 1000, prev.targetEndTimeMs + deltaSeconds * 1000),
      totalDurationSeconds: Math.max(15, prev.totalDurationSeconds + deltaSeconds),
    }));
  };

  // --- Routines ---

  const updateRoutine = (routineId: string, update: (r: Routine) => Routine) =>
    setState((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => (r.id === routineId ? update(r) : r)),
    }));

  /** Swap one exercise for another in the given routines (from stall alerts). */
  const handleSwapExerciseInRoutines = (
    oldExerciseId: string,
    newExercise: Exercise,
    routineIds: string[]
  ) =>
    setState((prev) => ({
      ...prev,
      routines: prev.routines.map((r) =>
        routineIds.includes(r.id)
          ? {
              ...r,
              exercises: r.exercises.map((item) =>
                item.exerciseId === oldExerciseId
                  ? {
                      ...item,
                      exerciseId: newExercise.id,
                      targetRepRange: [newExercise.targetRepRange[0], newExercise.targetRepRange[1]],
                      restSeconds: newExercise.defaultRestSeconds,
                    }
                  : item
              ),
            }
          : r
      ),
    }));

  const handleDeleteRoutine = (id: string) =>
    setState((prev) => ({
      ...prev,
      // Remember deleted starter routines so they don't come back.
      deletedStarterRoutineIds: isStarterRoutineId(id)
        ? [...new Set([...(prev.deletedStarterRoutineIds || []), id])]
        : prev.deletedStarterRoutineIds,
      routines: prev.routines.filter((r) => r.id !== id),
    }));

  // --- Custom exercises ---

  const timesLogged = (exerciseId: string) =>
    state.workouts.filter((w) => w.exercises.some((b) => b.exerciseId === exerciseId)).length;

  const handleSaveExercise = (exercise: Exercise) => {
    const isNew = !state.exercises.some((e) => e.id === exercise.id);
    setState((prev) => ({
      ...prev,
      exercises: isNew
        ? [exercise, ...prev.exercises]
        : prev.exercises.map((e) => (e.id === exercise.id ? exercise : e)),
    }));
    setExerciseForm(null);
    setSelectedExerciseId(exercise.id);
  };

  const handleDeleteExercise = (exercise: Exercise) => {
    setState((prev) => {
      const inUse =
        prev.workouts.some((w) => w.exercises.some((b) => b.exerciseId === exercise.id)) ||
        !!prev.activeWorkout?.exercises.some((b) => b.exerciseId === exercise.id);
      return {
        ...prev,
        // Keep it (hidden) if old workouts point to it, so they still display.
        exercises: inUse
          ? prev.exercises.map((e) => (e.id === exercise.id ? { ...e, isArchived: true } : e))
          : prev.exercises.filter((e) => e.id !== exercise.id),
        routines: prev.routines.map((r) => ({
          ...r,
          exercises: r.exercises.filter((item) => item.exerciseId !== exercise.id),
        })),
      };
    });
    setExerciseForm(null);
    setSelectedExerciseId(null);
  };

  // --- Misc ---

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yk-lifts-backup-${toLocalDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedExercise = state.exercises.find((e) => e.id === selectedExerciseId) || null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <AppHeader
        userName={userName}
        syncStatus={syncStatus}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {showProfileModal && (
        <ProfileModal
          currentName={userName}
          onSave={(name) => {
            switchProfile(name);
            setShowProfileModal(false);
          }}
          onCancel={() => setShowProfileModal(false)}
        />
      )}

      {/* Resume banner while a workout is in progress */}
      {state.activeWorkout && activeTab !== 'logger' && (
        <div className="bg-[#1c1c1e] border-b border-[#a4ff00]/30 px-4 py-2.5">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#a4ff00] animate-ping shrink-0" />
              <span className="font-bold text-white truncate">{state.activeWorkout.name}</span>
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

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-4 safe-main">
        <Suspense fallback={<ScreenLoading />}>
          {activeTab === 'analytics' && (
            <AnalyticsDashboard
              workouts={state.workouts}
              exercises={state.exercises}
              measurements={state.measurements}
              unit={state.unit}
              onOpenExerciseDetail={setSelectedExerciseId}
              onAddBodyweight={(entry) =>
                setState((prev) => {
                  const existingIdx = prev.measurements.findIndex((m) => m.date === entry.date);
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
                    measurements: [{ ...entry, id: `bw-${Date.now()}` }, ...prev.measurements],
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
              measurements={state.measurements}
              unit={state.unit}
              profile={state.trainingProfile}
              programme={state.programme}
              onSaveProfile={(trainingProfile) => setState((prev) => ({ ...prev, trainingProfile }))}
              onSetProgramme={(programme) => setState((prev) => ({ ...prev, programme }))}
              onChooseProgramme={() => setShowProgrammePicker(true)}
              onStartRoutine={startDraft}
              onSwapExercise={handleSwapExerciseInRoutines}
              onOpenExerciseDetail={setSelectedExerciseId}
            />
          )}

          {activeTab === 'routines' && (
            <RoutinesView
              routines={state.routines}
              exercises={state.exercises}
              workouts={state.workouts}
              unit={state.unit}
              onStartRoutine={(routine: Routine) => startDraft(routine)}
              onStartEmptyWorkout={handleStartEmptyWorkout}
              onCreateRoutine={(newR: Routine) =>
                setState((prev) => ({ ...prev, routines: [newR, ...prev.routines] }))
              }
              onUpdateRoutine={(updatedR: Routine) => updateRoutine(updatedR.id, () => updatedR)}
              onDeleteRoutine={handleDeleteRoutine}
              preferProgramme={!!state.programme}
              programmeView={
                <ProgrammeWorkoutsView
                  programme={state.programme}
                  status={programmeStatus}
                  profile={profile}
                  exercises={state.exercises}
                  workouts={state.workouts}
                  unit={state.unit}
                  onChooseProgramme={() => setShowProgrammePicker(true)}
                  onSetSplit={(splitId) => updateProgramme((p) => ({ ...p, splitId }))}
                  onStartWorkout={startProgrammeWorkout}
                  onAcceptSwap={handleAcceptSwap}
                  onDismissSwap={handleDismissSwap}
                />
              }
            />
          )}

          {activeTab === 'logger' &&
            (state.activeWorkout ? (
              <ActiveWorkoutView
                draft={state.activeWorkout}
                exercises={state.exercises}
                workouts={state.workouts}
                unit={state.unit}
                onUpdateDraft={(updated: typeof state.activeWorkout) =>
                  setState((prev) => ({ ...prev, activeWorkout: updated }))
                }
                onFinishWorkout={handleFinishWorkout}
                onDiscardWorkout={handleDiscardWorkout}
                onStartRestTimer={handleStartRestTimer}
                onOpenExerciseDetail={setSelectedExerciseId}
              />
            ) : (
              <div className="af-card p-6 text-center max-w-sm mx-auto my-8 space-y-3.5">
                <div className="w-12 h-12 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center mx-auto">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white">Start a Workout</h2>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('routines')}
                    className="w-full py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Choose a Routine
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
            ))}

          {activeTab === 'history' && (
            <HistoryView
              workouts={state.workouts}
              exercises={state.exercises}
              routines={state.routines}
              unit={state.unit}
              onOpenExerciseDetail={setSelectedExerciseId}
              onUpdateWorkout={(updated: WorkoutSession) =>
                setState((prev) => ({
                  ...prev,
                  workouts: prev.workouts.map((w) => (w.id === updated.id ? updated : w)),
                }))
              }
              onDeleteWorkout={(id: string) =>
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
              onCreateCustomExercise={() => setExerciseForm({ exercise: null })}
            />
          )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {selectedExercise && (
          <ExerciseDetailModal
            exercise={selectedExercise}
            workouts={state.workouts}
            unit={state.unit}
            onClose={() => setSelectedExerciseId(null)}
            onEdit={(exercise: Exercise) => setExerciseForm({ exercise })}
          />
        )}

        {exerciseForm && (
          <CustomExerciseForm
            exercise={exerciseForm.exercise}
            timesLogged={exerciseForm.exercise ? timesLogged(exerciseForm.exercise.id) : 0}
            onSave={handleSaveExercise}
            onDelete={handleDeleteExercise}
            onClose={() => setExerciseForm(null)}
          />
        )}

        {showProgrammePicker && (
          <ProgrammePicker
            goal={profile.goal}
            currentId={programmeStatus && !programmeStatus.finished ? programmeStatus.template.id : undefined}
            onStart={handleStartProgramme}
            onClose={() => setShowProgrammePicker(false)}
          />
        )}

        {justCompleted && (
          <WorkoutCompleteModal
            session={justCompleted}
            analysis={justCompletedAnalysis}
            workouts={state.workouts}
            exercises={state.exercises}
            unit={state.unit}
            onClose={() => setJustCompleted(null)}
          />
        )}
      </Suspense>

      <RestTimerHUD
        timer={restTimer}
        onAdjustSeconds={handleAdjustRestTimer}
        onDismiss={() => setRestTimer((prev) => ({ ...prev, isActive: false }))}
      />

      <BottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </div>
  );
};

export default App;

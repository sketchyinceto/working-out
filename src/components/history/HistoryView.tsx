import React, { useMemo, useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Minus,
  Moon,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  Exercise,
  MuscleGroup,
  Routine,
  SetType,
  WeightUnit,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../types/workout';
import { MUSCLE_LABELS, searchExercises } from '../../data/seedExercises';
import { evaluateSetPRs, getWorkingSets } from '../../utils/analytics';
import {
  calculateEstimated1RM,
  displayToKg,
  formatVolume,
  kgToDisplay,
} from '../../utils/calculators';
import { getMusclePalette, getSplitPalette } from '../../utils/splitTheme';
import { StreakAndRestCard } from '../analytics/StreakAndRestCard';

interface HistoryViewProps {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  routines?: Routine[];
  unit: WeightUnit;
  onOpenExerciseDetail: (exerciseId: string) => void;
  onUpdateWorkout: (updated: WorkoutSession) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onStartWorkout: () => void;
}

const SET_TYPE_ORDER: SetType[] = ['working', 'warmup', 'dropset', 'failure'];

function toLocalDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatActivityDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) return `Today • ${timeStr}`;
  if (isYesterday) return `Yesterday • ${timeStr}`;

  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr} • ${timeStr}`;
}

function formatDurationStr(minutes: number): string {
  if (minutes < 60) return `${minutes}MIN`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}H ${m}M` : `${h}H`;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  workouts,
  exercises,
  routines = [],
  unit,
  onOpenExerciseDetail,
  onUpdateWorkout,
  onDeleteWorkout,
  onStartWorkout,
}) => {
  const [splitFilter, setSplitFilter] = useState<
    'All' | WorkoutSession['splitTag']
  >('All');
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [expandedAllSetsMap, setExpandedAllSetsMap] = useState<Record<string, boolean>>({});
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const recordedSplits = useMemo(() => {
    const s = new Set<string>();
    for (const r of routines) {
      if (r.splitTag) s.add(r.splitTag);
    }
    for (const w of workouts) {
      if (w.splitTag) s.add(w.splitTag);
    }
    return s;
  }, [routines, workouts]);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const openEditWorkout = (session: WorkoutSession) => {
    setEditingWorkout(JSON.parse(JSON.stringify(session)) as WorkoutSession);
    setExerciseSearch('');
  };

  const handleSaveEditedWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkout) return;

    const priorWorkouts = workouts.filter(
      (w) =>
        w.id !== editingWorkout.id &&
        new Date(w.startTime).getTime() < new Date(editingWorkout.startTime).getTime()
    );

    const runningBlocks: WorkoutExercise[] = [];
    const cleanedExercises: WorkoutExercise[] = editingWorkout.exercises
      .map((block) => {
        const evaluatedSets: WorkoutSet[] = [];
        for (const s of block.sets) {
          const historyUpToSet: WorkoutSession[] =
            evaluatedSets.length > 0 || runningBlocks.length > 0
              ? [
                  {
                    ...editingWorkout,
                    exercises: [
                      ...runningBlocks,
                      { ...block, sets: evaluatedSets },
                    ],
                  },
                  ...priorWorkouts,
                ]
              : priorWorkouts;

          const prs =
            s.type !== 'warmup'
              ? evaluateSetPRs(
                  block.exerciseId,
                  { ...s, completed: true },
                  historyUpToSet
                )
              : [];
          evaluatedSets.push({
            ...s,
            completed: true,
            prs: prs.length > 0 ? prs : undefined,
          });
        }
        const finalizedBlock: WorkoutExercise = {
          ...block,
          sets: evaluatedSets,
        };
        if (evaluatedSets.length > 0) {
          runningBlocks.push(finalizedBlock);
        }
        return finalizedBlock;
      })
      .filter((b) => b.sets.length > 0);

    onUpdateWorkout({
      ...editingWorkout,
      name: editingWorkout.name.trim() || 'Workout Session',
      durationMinutes: Math.max(1, editingWorkout.durationMinutes || 1),
      exercises: cleanedExercises,
    });
    setEditingWorkout(null);
  };

  const handleUpdateEditSet = (
    blockId: string,
    setId: string,
    updater: (s: WorkoutSet) => WorkoutSet
  ) => {
    if (!editingWorkout) return;
    setEditingWorkout({
      ...editingWorkout,
      exercises: editingWorkout.exercises.map((b) =>
        b.id === blockId
          ? { ...b, sets: b.sets.map((s) => (s.id === setId ? updater(s) : s)) }
          : b
      ),
    });
  };

  const handleAddSetToEditBlock = (blockId: string) => {
    if (!editingWorkout) return;
    setEditingWorkout({
      ...editingWorkout,
      exercises: editingWorkout.exercises.map((b) => {
        if (b.id !== blockId) return b;
        const lastSet = b.sets[b.sets.length - 1];
        const newSet: WorkoutSet = {
          id: `set-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          setNumber: b.sets.length + 1,
          type: 'working',
          weightKg: lastSet ? lastSet.weightKg : 20,
          reps: lastSet ? lastSet.reps : 10,
          completed: true,
        };
        return { ...b, sets: [...b.sets, newSet] };
      }),
    });
  };

  const handleRemoveLastSetFromEditBlock = (blockId: string) => {
    if (!editingWorkout) return;
    setEditingWorkout({
      ...editingWorkout,
      exercises: editingWorkout.exercises.map((b) =>
        b.id === blockId && b.sets.length > 1
          ? { ...b, sets: b.sets.slice(0, -1) }
          : b
      ),
    });
  };

  const handleRemoveEditBlock = (blockId: string) => {
    if (!editingWorkout) return;
    setEditingWorkout({
      ...editingWorkout,
      exercises: editingWorkout.exercises.filter((b) => b.id !== blockId),
    });
  };

  const handleAddExerciseToEditWorkout = (ex: Exercise) => {
    if (!editingWorkout) return;
    const newBlock: WorkoutExercise = {
      id: `we-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: ex.id,
      restSeconds: ex.defaultRestSeconds,
      sets: [
        {
          id: `set-edit-${Date.now()}-1`,
          setNumber: 1,
          type: 'working',
          weightKg: ex.barWeightKg || 20,
          reps: ex.targetRepRange[0],
          completed: true,
        },
      ],
    };
    setEditingWorkout({
      ...editingWorkout,
      exercises: [...editingWorkout.exercises, newBlock],
    });
  };

  const filteredLibrary = useMemo(
    () => searchExercises(exercises, exerciseSearch),
    [exercises, exerciseSearch]
  );

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      if (selectedDateStr) {
        return toLocalDateStr(new Date(w.startTime)) === selectedDateStr;
      }
      if (splitFilter !== 'All') {
        return w.splitTag === splitFilter;
      }
      return true;
    });
  }, [workouts, splitFilter, selectedDateStr]);

  const toggleExpandSessionSets = (sessionId: string) => {
    setExpandedAllSetsMap((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Page Title */}
      <div className="px-0.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Workouts
        </h1>
      </div>

      {/* Top Streak Counter & Interactive Monthly Calendar */}
      <StreakAndRestCard
        workouts={workouts}
        selectedDateStr={selectedDateStr}
        onSelectDateStr={setSelectedDateStr}
        recordedSplits={recordedSplits}
      />

      {/* Feed Filter Bar */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white">
            {selectedDateStr ? `Session on ${selectedDateStr}` : 'Recent Workouts'}
          </h2>
          {selectedDateStr && (
            <button
              type="button"
              onClick={() => setSelectedDateStr(null)}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#a4ff00]"
            >
              Show All <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!selectedDateStr && (
          <div className="flex items-center bg-[#1c1c1e] p-1 rounded-[10px] text-[11px] gap-1 overflow-x-auto max-w-full">
            {(
              [
                'All',
                'Push',
                'Pull',
                'Legs',
                'Upper',
                'Lower',
                'Full Body',
                'Custom',
              ] as const
            )
              .filter((tag) => tag === 'All' || recordedSplits.has(tag))
              .map((tag) => {
                const isActive = splitFilter === tag;
                const activeClass =
                  tag === 'All'
                    ? 'bg-[#3a3a3c] text-white font-bold'
                    : getSplitPalette(tag).solidPillClass;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSplitFilter(tag)}
                    className={`px-2.5 py-1 rounded-[8px] font-semibold whitespace-nowrap transition ${
                      isActive ? activeClass : 'text-[#8e8e93] hover:text-white'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {filteredWorkouts.length === 0 ? (
        <div className="af-card p-8 text-center max-w-sm mx-auto space-y-3">
          <Dumbbell className="w-7 h-7 text-[#a4ff00] mx-auto" />
          <h3 className="text-sm font-bold text-white">No Workouts Found</h3>
          <button
            type="button"
            onClick={onStartWorkout}
            className="px-4 py-2 rounded-full bg-[#a4ff00] text-black font-bold text-xs"
          >
            Start Workout
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((session, idx) => {
            const isExpandedSets =
              !!expandedAllSetsMap[session.id] || !!selectedDateStr;

            const prevSessionAbove = idx > 0 ? filteredWorkouts[idx - 1] : null;
            let restDaysBetween = 0;
            if (prevSessionAbove && !selectedDateStr) {
              const d1 = new Date(prevSessionAbove.startTime);
              const d2 = new Date(session.startTime);
              const m1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
              const m2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
              const diffDays = Math.round(
                (m1.getTime() - m2.getTime()) / (24 * 60 * 60 * 1000)
              );
              restDaysBetween = Math.max(0, diffDays - 1);
            }

            let totalVolumeKg = 0;
            let totalWorkingSets = 0;
            let totalReps = 0;
            let prCount = 0;
            const muscleSetCounts: Partial<Record<MuscleGroup, number>> = {};

            for (const block of session.exercises) {
              const meta = exerciseMap.get(block.exerciseId);
              const working = getWorkingSets(block.sets);
              totalWorkingSets += working.length;

              if (meta && working.length > 0) {
                muscleSetCounts[meta.primaryMuscle] =
                  (muscleSetCounts[meta.primaryMuscle] || 0) + working.length;
              }

              for (const s of working) {
                totalVolumeKg += s.weightKg * s.reps;
                totalReps += s.reps;
                if (s.prs && s.prs.length > 0) prCount += 1;
              }
            }

            const muscleBreakdown = (
              Object.entries(muscleSetCounts) as [MuscleGroup, number][]
            )
              .sort((a, b) => b[1] - a[1])
              .map(([muscle, count]) => ({
                muscle,
                label: MUSCLE_LABELS[muscle]
                  .replace(' & Traps', '')
                  .replace(' & Core', ''),
                sets: count,
                pct: Math.round((count / Math.max(1, totalWorkingSets)) * 100),
              }));

            const palette = getSplitPalette(session.splitTag);
            const muscleBarShades = palette.barShades;

            return (
              <React.Fragment key={session.id}>
                {restDaysBetween > 0 && (
                  <div className="flex items-center justify-center gap-2 py-0.5">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#8e8e93] bg-[#1c1c1e] px-3 py-0.5 rounded-full">
                      <Moon className="w-3 h-3" />
                      {restDaysBetween} {restDaysBetween === 1 ? 'Rest Day' : 'Rest Days'}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )}

                <article
                  style={palette.cardGlowStyle}
                  className={`af-card border ${palette.cardBorderClass} overflow-hidden`}
                >
                  <div className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Split-Themed Circular Workout Badge */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${palette.badgeClass}`}
                        >
                          <Dumbbell className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${palette.badgeClass}`}
                            >
                              {session.splitTag}
                            </span>
                            <span className="text-[11px] text-[#8e8e93] font-medium">
                              {formatActivityDateTime(session.startTime)}
                            </span>
                          </div>
                          <h2 className="text-base font-bold text-white truncate mt-0.5">
                            {session.name}
                          </h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {prCount > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${palette.badgeClass}`}
                          >
                            <Trophy className="w-3.5 h-3.5" /> {prCount}{' '}
                            {prCount === 1 ? 'PR' : 'PRs'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditWorkout(session)}
                          className="p-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93] hover:text-white transition"
                          title="Edit workout"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {session.notes && (
                      <p className="text-xs text-[#d1d1d6] bg-[#2c2c2e] rounded-xl px-3 py-2 mt-2.5">
                        {session.notes}
                      </p>
                    )}

                    {/* Clean White Workout Metrics */}
                    <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-white/[0.06]">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8e8e93] font-semibold">
                          Total Volume
                        </div>
                        <div className="text-sm sm:text-base font-bold font-mono-num text-white mt-0.5">
                          {formatVolume(totalVolumeKg, unit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8e8e93] font-semibold">
                          Duration
                        </div>
                        <div className="text-sm sm:text-base font-bold font-mono-num text-white mt-0.5">
                          {formatDurationStr(session.durationMinutes)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8e8e93] font-semibold">
                          Sets
                        </div>
                        <div className="text-sm sm:text-base font-bold font-mono-num text-white mt-0.5">
                          {totalWorkingSets}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8e8e93] font-semibold">
                          Reps
                        </div>
                        <div className="text-sm sm:text-base font-bold font-mono-num text-white mt-0.5">
                          {totalReps}
                        </div>
                      </div>
                    </div>

                    {/* Muscle Focus Distribution Bar (graduated shades of green for adjacent muscles) */}
                    {muscleBreakdown.length > 0 && (
                      <div className="mt-3">
                        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-[#2c2c2e] gap-0.5">
                          {muscleBreakdown.map((m, mIdx) => (
                            <div
                              key={m.muscle}
                              style={{ width: `${m.pct}%` }}
                              className={
                                muscleBarShades[
                                  mIdx % muscleBarShades.length
                                ]
                              }
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-[#8e8e93]">
                          {muscleBreakdown.map((m, mIdx) => (
                            <span
                              key={m.muscle}
                              className="inline-flex items-center gap-1"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  muscleBarShades[
                                    mIdx % muscleBarShades.length
                                  ]
                                }`}
                              />
                              <strong className="text-white">{m.label}</strong>{' '}
                              {m.pct}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exercise & Set Breakdown List */}
                  <div className="px-4 pb-3.5 pt-2.5 bg-black/35 border-t border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
                      <span>Exercises</span>
                      <span>Top Set</span>
                    </div>

                    <div className="space-y-1.5">
                      {session.exercises.map((block) => {
                        const meta = exerciseMap.get(block.exerciseId);
                        const working = getWorkingSets(block.sets);
                        if (!meta || working.length === 0) return null;

                        const bestSet = working.reduce((best, cur) =>
                          calculateEstimated1RM(cur.weightKg, cur.reps) >
                          calculateEstimated1RM(best.weightKg, best.reps)
                            ? cur
                            : best
                        , working[0]);

                        const best1RM = calculateEstimated1RM(
                          bestSet.weightKg,
                          bestSet.reps
                        );
                        const blockHasPR = working.some(
                          (s) => s.prs && s.prs.length > 0
                        );

                        const exPalette = getMusclePalette(meta.primaryMuscle);

                        return (
                          <div
                            key={block.id}
                            className="rounded-[14px] bg-[#2c2c2e]/75 p-2.5"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => onOpenExerciseDetail(meta.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onOpenExerciseDetail(meta.id);
                              }}
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-full font-mono-num font-bold text-xs flex items-center justify-center shrink-0 ${exPalette.badgeClass}`}
                                >
                                  {working.length}×
                                </span>
                                <span className="text-xs sm:text-sm font-semibold text-white hover:underline truncate">
                                  {meta.name}
                                </span>
                                {blockHasPR && (
                                  <Award
                                    className={`w-3.5 h-3.5 ${exPalette.textClass} shrink-0`}
                                  />
                                )}
                              </div>

                              <div className="text-right font-mono-num shrink-0">
                                <span className="text-xs font-bold text-white">
                                  {kgToDisplay(bestSet.weightKg, unit)} {unit} ×{' '}
                                  {bestSet.reps}
                                </span>
                                <span className="text-[10px] text-[#8e8e93] ml-1.5 hidden sm:inline">
                                  (1RM {kgToDisplay(best1RM, unit)})
                                </span>
                              </div>
                            </div>

                            {isExpandedSets && (
                              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
                                {(() => {
                                  let workingIdx = 0;
                                  return block.sets
                                    .filter((s) => s.completed)
                                    .map((s) => {
                                      const isWarmup = s.type === 'warmup';
                                      if (!isWarmup) workingIdx += 1;
                                      const badgeLabel =
                                        s.type === 'warmup'
                                          ? 'W'
                                          : s.type === 'dropset'
                                          ? 'D'
                                          : s.type === 'failure'
                                          ? 'F'
                                          : String(workingIdx);
                                      const isPR = s.prs && s.prs.length > 0;
                                      return (
                                        <span
                                          key={s.id}
                                          className={`text-[11px] font-mono-num px-2.5 py-0.5 rounded-full ${
                                            isPR
                                              ? 'bg-[#a4ff00]/15 text-[#a4ff00] font-bold'
                                              : isWarmup
                                              ? 'bg-black/40 text-[#8e8e93]'
                                              : 'bg-black/60 text-white'
                                          }`}
                                        >
                                          <span className="text-[#8e8e93] mr-1">
                                            {badgeLabel}:
                                          </span>
                                          {kgToDisplay(s.weightKg, unit)}
                                          {unit} × {s.reps}
                                        </span>
                                      );
                                    });
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!selectedDateStr && (
                      <button
                        type="button"
                        onClick={() => toggleExpandSessionSets(session.id)}
                        className={`w-full pt-1 text-[11px] font-semibold ${palette.textClass} flex items-center justify-center gap-1`}
                      >
                        {isExpandedSets ? (
                          <>
                            Hide Individual Sets <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            Show All {totalWorkingSets} Sets{' '}
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </article>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Edit Workout Modal (includes Delete Workout action inside) */}
      {editingWorkout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <form
            onSubmit={handleSaveEditedWorkout}
            className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Edit Workout</h3>
                <p className="text-[11px] text-[#8e8e93]">
                  {formatActivityDateTime(editingWorkout.startTime)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorkout(null)}
                className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Workout Name
                </label>
                <input
                  type="text"
                  required
                  value={editingWorkout.name}
                  onChange={(e) =>
                    setEditingWorkout({
                      ...editingWorkout,
                      name: e.target.value,
                    })
                  }
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Split
                </label>
                <select
                  value={editingWorkout.splitTag}
                  onChange={(e) =>
                    setEditingWorkout({
                      ...editingWorkout,
                      splitTag: e.target.value as WorkoutSession['splitTag'],
                    })
                  }
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="Push">Push</option>
                  <option value="Pull">Pull</option>
                  <option value="Legs">Legs</option>
                  <option value="Upper">Upper</option>
                  <option value="Lower">Lower</option>
                  <option value="Full Body">Full Body</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={editingWorkout.durationMinutes}
                  onChange={(e) =>
                    setEditingWorkout({
                      ...editingWorkout,
                      durationMinutes: Math.max(
                        1,
                        parseInt(e.target.value, 10) || 1
                      ),
                    })
                  }
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm font-mono-num text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Session Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional workout notes..."
                  value={editingWorkout.notes || ''}
                  onChange={(e) =>
                    setEditingWorkout({
                      ...editingWorkout,
                      notes: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                />
              </div>
            </div>

            {/* Editable Exercises & Sets */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
              {editingWorkout.exercises.map((block) => {
                const meta = exerciseMap.get(block.exerciseId);
                if (!meta) return null;
                const exPalette = getMusclePalette(meta.primaryMuscle);
                let workingNum = 0;

                return (
                  <div
                    key={block.id}
                    className={`bg-[#2c2c2e]/75 border ${exPalette.cardBorderClass} rounded-2xl p-3 space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${exPalette.badgeClass}`}
                        >
                          {MUSCLE_LABELS[meta.primaryMuscle]}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {meta.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditBlock(block.id)}
                        className="p-1 rounded-full text-[#8e8e93] hover:text-[#fa114f]"
                        title="Remove exercise"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {block.sets.map((s) => {
                        if (s.type !== 'warmup') workingNum += 1;
                        const setBadge =
                          s.type === 'warmup'
                            ? 'W'
                            : s.type === 'dropset'
                            ? 'D'
                            : s.type === 'failure'
                            ? 'F'
                            : String(workingNum);
                        const nextType =
                          SET_TYPE_ORDER[
                            (SET_TYPE_ORDER.indexOf(s.type) + 1) %
                              SET_TYPE_ORDER.length
                          ];

                        return (
                          <div
                            key={s.id}
                            className="grid grid-cols-12 gap-2 items-center text-xs font-mono-num"
                          >
                            <div className="col-span-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateEditSet(block.id, s.id, (cur) => ({
                                    ...cur,
                                    type: nextType,
                                  }))
                                }
                                title="Tap to cycle set type (Working / Warmup / Dropset / Failure)"
                                className="w-7 h-7 rounded-lg bg-[#1c1c1e] text-white font-bold text-[11px] flex items-center justify-center"
                              >
                                {setBadge}
                              </button>
                            </div>

                            <div className="col-span-5 flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={kgToDisplay(s.weightKg, unit)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleUpdateEditSet(block.id, s.id, (cur) => ({
                                    ...cur,
                                    weightKg: isNaN(val)
                                      ? 0
                                      : displayToKg(Math.max(0, val), unit),
                                  }));
                                }}
                                className="w-full bg-[#1c1c1e] rounded-lg px-2 py-1 text-center font-bold text-white"
                              />
                              <span className="text-[10px] text-[#8e8e93] uppercase">
                                {unit}
                              </span>
                            </div>

                            <div className="col-span-5 flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={s.reps}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  handleUpdateEditSet(block.id, s.id, (cur) => ({
                                    ...cur,
                                    reps: isNaN(val) ? 0 : Math.max(0, val),
                                  }));
                                }}
                                className="w-full bg-[#1c1c1e] rounded-lg px-2 py-1 text-center font-bold text-white"
                              />
                              <span className="text-[10px] text-[#8e8e93]">
                                reps
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddSetToEditBlock(block.id)}
                        className="flex-1 py-1 rounded-lg bg-[#1c1c1e] hover:bg-black text-[11px] font-bold text-[#a4ff00] inline-flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Set
                      </button>
                      {block.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveLastSetFromEditBlock(block.id)
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#1c1c1e] hover:bg-black text-[11px] text-[#8e8e93] hover:text-white inline-flex items-center gap-1"
                        >
                          <Minus className="w-3 h-3" /> Set
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Exercise Picker */}
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <input
                  type="text"
                  placeholder="Add an exercise to this workout..."
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
                {exerciseSearch.trim().length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {filteredLibrary.slice(0, 8).map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => {
                          handleAddExerciseToEditWorkout(ex);
                          setExerciseSearch('');
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#2c2c2e]/60 hover:bg-[#2c2c2e] text-xs text-left"
                      >
                        <span className="text-white font-medium truncate">
                          {ex.name}
                        </span>
                        <span className="text-[#a4ff00] font-bold text-[10px]">
                          + Add
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Delete Workout on Left and Cancel/Save on Right */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  onDeleteWorkout(editingWorkout.id);
                  setEditingWorkout(null);
                }}
                className="px-3.5 py-2 rounded-full bg-[#fa114f]/15 hover:bg-[#fa114f]/25 text-[#fa114f] text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Workout
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingWorkout(null)}
                  className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full bg-[#a4ff00] text-black text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

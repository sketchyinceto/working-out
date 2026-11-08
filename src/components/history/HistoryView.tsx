import React, { useMemo, useState } from 'react';
import { Download, Dumbbell, Moon, X } from 'lucide-react';
import { Exercise, Routine, WeightUnit, WorkoutSession } from '../../types/workout';
import { getSplitPalette } from '../../utils/splitTheme';
import { toLocalDateStr } from '../../utils/dates';
import { pluralize } from '../../utils/text';
import { StreakAndRestCard } from '../analytics/StreakAndRestCard';
import { EditWorkoutModal } from './EditWorkoutModal';
import { WorkoutCard } from './WorkoutCard';

interface HistoryViewProps {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  routines?: Routine[];
  unit: WeightUnit;
  onOpenExerciseDetail: (exerciseId: string) => void;
  onUpdateWorkout: (updated: WorkoutSession) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onStartWorkout: () => void;
  onExportJson?: () => void;
}

// Drawing every card at once gets slow after months of training.
const PAGE_SIZE = 20;

const SPLIT_FILTERS = ['All', 'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Custom'] as const;
type SplitFilter = (typeof SPLIT_FILTERS)[number];

/** Whole calendar days between two timestamps, ignoring the time of day. */
function calendarDaysBetween(laterIso: string, earlierIso: string): number {
  const a = new Date(laterIso);
  const b = new Date(earlierIso);
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMid - bMid) / (24 * 60 * 60 * 1000));
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
  onExportJson,
}) => {
  const [splitFilter, setSplitFilter] = useState<SplitFilter>('All');
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const recordedSplits = useMemo(() => {
    const s = new Set<string>();
    for (const r of routines) if (r.splitTag) s.add(r.splitTag);
    for (const w of workouts) if (w.splitTag) s.add(w.splitTag);
    return s;
  }, [routines, workouts]);

  const filteredWorkouts = useMemo(() => {
    const newestFirst = [...workouts].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    return newestFirst.filter((w) => {
      if (selectedDateStr) return toLocalDateStr(new Date(w.startTime)) === selectedDateStr;
      if (splitFilter !== 'All') return w.splitTag === splitFilter;
      return true;
    });
  }, [workouts, splitFilter, selectedDateStr]);

  return (
    <div className="space-y-4 pb-6">
      <div className="px-0.5 flex items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Workouts</h1>
        {onExportJson && (
          <button
            type="button"
            onClick={onExportJson}
            className="p-2 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#8e8e93] hover:text-white transition"
            title="Download a backup of your workout history"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      <StreakAndRestCard
        workouts={workouts}
        selectedDateStr={selectedDateStr}
        onSelectDateStr={setSelectedDateStr}
        recordedSplits={recordedSplits}
      />

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
            {SPLIT_FILTERS.filter((tag) => tag === 'All' || recordedSplits.has(tag)).map((tag) => {
              const activeClass =
                tag === 'All' ? 'bg-[#3a3a3c] text-white font-bold' : getSplitPalette(tag).solidPillClass;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSplitFilter(tag);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`px-2.5 py-1 rounded-[8px] font-semibold whitespace-nowrap transition ${
                    splitFilter === tag ? activeClass : 'text-[#8e8e93] hover:text-white'
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
          {filteredWorkouts.slice(0, visibleCount).map((session, idx) => {
            const above = idx > 0 ? filteredWorkouts[idx - 1] : null;
            const restDays =
              above && !selectedDateStr
                ? Math.max(0, calendarDaysBetween(above.startTime, session.startTime) - 1)
                : 0;

            return (
              <React.Fragment key={session.id}>
                {restDays > 0 && (
                  <div className="flex items-center justify-center gap-2 py-0.5">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#8e8e93] bg-[#1c1c1e] px-3 py-0.5 rounded-full">
                      <Moon className="w-3 h-3" />
                      {pluralize(restDays, 'Rest Day')}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )}
                <WorkoutCard
                  session={session}
                  exerciseMap={exerciseMap}
                  unit={unit}
                  showAllSets={!!expandedSets[session.id] || !!selectedDateStr}
                  canToggleSets={!selectedDateStr}
                  onToggleSets={() =>
                    setExpandedSets((prev) => ({ ...prev, [session.id]: !prev[session.id] }))
                  }
                  onEdit={() => setEditingWorkout(session)}
                  onOpenExerciseDetail={onOpenExerciseDetail}
                />
              </React.Fragment>
            );
          })}
          {filteredWorkouts.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="w-full py-3 rounded-[18px] bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.06] text-[#a4ff00] font-bold text-xs transition"
            >
              Show Older Workouts ({filteredWorkouts.length - visibleCount} more)
            </button>
          )}
        </div>
      )}

      {editingWorkout && (
        <EditWorkoutModal
          workout={editingWorkout}
          allWorkouts={workouts}
          exercises={exercises}
          onSave={(updated) => {
            onUpdateWorkout(updated);
            setEditingWorkout(null);
          }}
          onDelete={(id) => {
            onDeleteWorkout(id);
            setEditingWorkout(null);
          }}
          onClose={() => setEditingWorkout(null)}
        />
      )}
    </div>
  );
};

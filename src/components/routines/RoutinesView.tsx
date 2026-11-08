import React, { useMemo, useState } from 'react';
import { Dumbbell, Pencil, Play, Plus, Sparkles } from 'lucide-react';
import { Exercise, Routine, WeightUnit, WorkoutSession } from '../../types/workout';
import { formatShortDate } from '../../utils/analytics';
import { getSplitPalette } from '../../utils/splitTheme';
import { pluralize } from '../../utils/text';
import { RoutineEditorModal } from './RoutineEditorModal';

interface RoutinesViewProps {
  routines: Routine[];
  exercises: Exercise[];
  workouts: WorkoutSession[];
  unit: WeightUnit;
  onStartRoutine: (routine: Routine) => void;
  onStartEmptyWorkout: () => void;
  onCreateRoutine: (routine: Routine) => void;
  onUpdateRoutine: (routine: Routine) => void;
  onDeleteRoutine: (routineId: string) => void;
  /** The Programme tab's content. */
  programmeView: React.ReactNode;
  /** Open on the Programme tab (e.g. while following a programme). */
  preferProgramme: boolean;
}

export const RoutinesView: React.FC<RoutinesViewProps> = ({
  routines,
  exercises,
  workouts,
  onStartRoutine,
  onStartEmptyWorkout,
  onCreateRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  programmeView,
  preferProgramme,
}) => {
  const [mode, setMode] = useState<'routines' | 'programme'>(() => {
    try {
      const saved = localStorage.getItem('yk_lifts_routines_tab');
      if (saved === 'routines' || saved === 'programme') return saved;
    } catch {
      // Ignore
    }
    return preferProgramme ? 'programme' : 'routines';
  });
  const switchMode = (next: 'routines' | 'programme') => {
    setMode(next);
    try {
      localStorage.setItem('yk_lifts_routines_tab', next);
    } catch {
      // Ignore
    }
  };
  // null = closed; { routine: undefined } = creating; { routine } = editing.
  const [editor, setEditor] = useState<{ routine?: Routine } | null>(null);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const newestFirst = useMemo(
    () =>
      [...workouts].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    [workouts]
  );

  // Simple Push → Pull → Legs rotation based on the last workout.
  const lastSplit = newestFirst[0]?.splitTag;
  const recommendedSplit: 'Push' | 'Pull' | 'Legs' =
    lastSplit === 'Push' ? 'Pull' : lastSplit === 'Pull' ? 'Legs' : 'Push';
  const recommendedPalette = getSplitPalette(recommendedSplit);

  const modeSwitch = (
    <div className="grid grid-cols-2 bg-[#1c1c1e] p-1 rounded-[12px] text-xs" role="tablist">
      {(
        [
          ['routines', 'My Routines'],
          ['programme', 'Programme'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={mode === key}
          onClick={() => switchMode(key)}
          className={`py-2 rounded-[9px] font-bold transition ${
            mode === key ? 'bg-[#3a3a3c] text-white' : 'text-[#8e8e93] hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (mode === 'programme') {
    return (
      <div className="space-y-4 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white px-0.5">Routines</h1>
        {modeSwitch}
        {programmeView}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-end justify-between gap-2 px-0.5">
        <div>
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${recommendedPalette.textClass}`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Up Next: {recommendedSplit} Day
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Routines</h1>
        </div>
        <button
          type="button"
          onClick={onStartEmptyWorkout}
          className="px-3.5 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#a4ff00] font-bold text-xs inline-flex items-center gap-1.5 transition"
        >
          <Dumbbell className="w-3.5 h-3.5" /> Quick Start
        </button>
      </div>

      {modeSwitch}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {routines.map((routine) => {
          const isRecommended =
            routine.splitTag === recommendedSplit &&
            routine.id === `routine-ppl-${recommendedSplit.toLowerCase()}`;
          const palette = getSplitPalette(routine.splitTag);
          const lastSession = newestFirst.find((w) => w.routineId === routine.id);

          return (
            <div
              key={routine.id}
              style={palette.cardGlowStyle}
              className={`af-card border ${palette.cardBorderClass} p-4 space-y-3.5 transition-all`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.badgeClass}`}>
                      {routine.splitTag}
                    </span>
                    {isRecommended && (
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.solidPillClass}`}>
                        Up Next
                      </span>
                    )}
                    <span className="text-[11px] text-[#8e8e93]">
                      • {pluralize(routine.exercises.length, 'exercise')}
                    </span>
                    {lastSession && (
                      <span className="text-[11px] text-[#8e8e93]">
                        • {formatShortDate(lastSession.startTime)}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white truncate">{routine.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditor({ routine })}
                  className="p-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93] hover:text-white shrink-0 transition"
                  title="Edit routine"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {routine.exercises.slice(0, 4).map((item) => (
                  <span
                    key={item.id}
                    className="text-[11px] text-[#d1d1d6] bg-[#2c2c2e]/75 px-2.5 py-1 rounded-full truncate max-w-[180px]"
                  >
                    <span className={`font-mono-num font-bold mr-1 ${palette.textClass}`}>
                      {item.targetSets}×
                    </span>
                    {exerciseMap.get(item.exerciseId)?.name || item.exerciseId}
                  </span>
                ))}
                {routine.exercises.length > 4 && (
                  <span className="text-[11px] text-[#8e8e93] bg-[#2c2c2e]/50 px-2.5 py-1 rounded-full font-mono-num">
                    +{routine.exercises.length - 4} more
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onStartRoutine(routine)}
                disabled={routine.exercises.length === 0}
                className={`w-full py-2.5 rounded-full active:scale-[0.99] disabled:opacity-40 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all ${palette.buttonClass}`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start {routine.splitTag}
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setEditor({})}
        className="w-full py-3.5 rounded-[18px] bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.06] text-[#a4ff00] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition"
      >
        <Plus className="w-4 h-4" /> New Routine
      </button>

      {editor && (
        <RoutineEditorModal
          routine={editor.routine}
          exercises={exercises}
          onSave={(saved) => {
            if (editor.routine) onUpdateRoutine(saved);
            else onCreateRoutine(saved);
            setEditor(null);
          }}
          onAddPreset={onCreateRoutine}
          onDelete={(id) => {
            onDeleteRoutine(id);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
};

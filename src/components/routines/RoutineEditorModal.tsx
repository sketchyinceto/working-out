import React, { useMemo, useState } from 'react';
import { Compass, Pencil, X } from 'lucide-react';
import { Exercise, Routine } from '../../types/workout';
import { ScientificRoutinePreset } from '../../data/starterRoutines';
import { ProvenRoutinesBrowser } from './ProvenRoutinesBrowser';
import { RoutineBuilderForm, RoutineBuilderSeed } from './RoutineBuilderForm';

interface RoutineEditorModalProps {
  /** The routine being edited, or undefined to create a new one. */
  routine?: Routine;
  exercises: Exercise[];
  onSave: (routine: Routine) => void;
  onAddPreset: (routine: Routine) => void;
  onDelete: (routineId: string) => void;
  onClose: () => void;
}

const copyItems = (items: Routine['exercises']) =>
  items.map((item, idx) => ({
    ...item,
    id: `rt-${Date.now()}-${idx}`,
    targetRepRange: [item.targetRepRange[0], item.targetRepRange[1]] as [number, number],
  }));

function presetToRoutine(preset: ScientificRoutinePreset): Routine {
  return {
    id: `routine-sci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: preset.name,
    folder: preset.folder,
    splitTag: preset.splitTag,
    description: preset.description,
    accentColor: preset.accentColor,
    exercises: copyItems(preset.exercises),
  };
}

const NEW_ROUTINE_SEED = (): RoutineBuilderSeed => ({
  name: '',
  splitTag: 'Push',
  items: [
    {
      id: `rt-${Date.now()}-1`,
      exerciseId: 'ex-bench-press',
      targetSets: 3,
      targetRepRange: [5, 8],
      restSeconds: 180,
    },
    {
      id: `rt-${Date.now()}-2`,
      exerciseId: 'ex-incline-db-press',
      targetSets: 3,
      targetRepRange: [8, 12],
      restSeconds: 120,
    },
  ],
});

/** Create/edit a routine, or (when creating) browse proven routines. */
export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  routine,
  exercises,
  onSave,
  onAddPreset,
  onDelete,
  onClose,
}) => {
  const [mode, setMode] = useState<'custom' | 'explore'>('custom');
  const [seed, setSeed] = useState<RoutineBuilderSeed>(() =>
    routine
      ? { name: routine.name, splitTag: routine.splitTag, items: copyItems(routine.exercises) }
      : NEW_ROUTINE_SEED()
  );
  // Remount the builder when a preset is loaded into it.
  const [builderKey, setBuilderKey] = useState(0);
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const tabClass = (active: boolean) =>
    `py-1.5 px-3 rounded-[9px] font-semibold inline-flex items-center justify-center gap-1.5 transition ${
      active ? 'bg-[#636366] text-white' : 'text-[#8e8e93] hover:text-white'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">{routine ? 'Edit Routine' : 'New Routine'}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!routine && (
          <div className="grid grid-cols-2 bg-[#2c2c2e] p-1 rounded-[12px] text-xs">
            <button type="button" onClick={() => setMode('custom')} className={tabClass(mode === 'custom')}>
              <Pencil className="w-3.5 h-3.5" /> Custom Builder
            </button>
            <button type="button" onClick={() => setMode('explore')} className={tabClass(mode === 'explore')}>
              <Compass className="w-3.5 h-3.5 text-[#a4ff00]" /> Explore Proven
            </button>
          </div>
        )}

        {mode === 'explore' && !routine ? (
          <ProvenRoutinesBrowser
            exerciseMap={exerciseMap}
            onCustomize={(preset) => {
              setSeed({ name: preset.name, splitTag: preset.splitTag, items: copyItems(preset.exercises) });
              setBuilderKey((k) => k + 1);
              setMode('custom');
            }}
            onQuickAdd={(preset) => onAddPreset(presetToRoutine(preset))}
            onDone={onClose}
          />
        ) : (
          <RoutineBuilderForm
            key={builderKey}
            existing={routine}
            seed={seed}
            exercises={exercises}
            onSave={onSave}
            onDelete={
              routine
                ? () => {
                    if (window.confirm(`Delete the routine "${routine.name}"?`)) onDelete(routine.id);
                  }
                : undefined
            }
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
};

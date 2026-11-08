import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Exercise } from '../../types/workout';
import { MUSCLE_LABELS, searchExercises } from '../../data/seedExercises';

interface ExercisePickerModalProps {
  title: string;
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Bottom sheet for adding or swapping an exercise during a workout. */
export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  title,
  exercises,
  onPick,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const results = useMemo(() => searchExercises(exercises, search), [exercises, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-3.5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search exercise or muscle (e.g. pec fly)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#2c2c2e] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
        />

        <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
          {results.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => onPick(ex)}
              className="w-full text-left p-3 rounded-2xl bg-[#2c2c2e]/75 hover:bg-[#2c2c2e] flex items-center justify-between transition"
            >
              <div>
                <div className="text-sm font-bold text-white">{ex.name}</div>
                <div className="text-xs text-[#8e8e93]">
                  {MUSCLE_LABELS[ex.primaryMuscle]} • {ex.equipment.replace('_', ' ')}
                </div>
              </div>
              <span className="text-xs font-bold text-black px-3 py-1 rounded-full bg-[#a4ff00]">
                Add
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import {
  Exercise,
  WeightUnit,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../types/workout';
import { MUSCLE_LABELS, searchExercises } from '../../data/seedExercises';
import { evaluateSetPRs } from '../../utils/analytics';
import { displayToKg, kgToDisplay } from '../../utils/calculators';
import { getMusclePalette } from '../../utils/splitTheme';
import { nextSetType, setBadgeLabel } from '../../utils/setTypes';
import { NumericInput } from '../common/NumericInput';
import { formatActivityDateTime } from './WorkoutCard';

const SPLITS: NonNullable<WorkoutSession['splitTag']>[] = [
  'Push',
  'Pull',
  'Legs',
  'Upper',
  'Lower',
  'Full Body',
  'Custom',
];

interface EditWorkoutModalProps {
  workout: WorkoutSession;
  allWorkouts: WorkoutSession[];
  exercises: Exercise[];
  onSave: (updated: WorkoutSession) => void;
  onDelete: (workoutId: string) => void;
  onClose: () => void;
}

/**
 * Re-checks PRs for an edited workout against everything before it, set by
 * set, so earlier sets in the same session count too.
 */
function reevaluatePRs(workout: WorkoutSession, allWorkouts: WorkoutSession[]): WorkoutExercise[] {
  const startMs = new Date(workout.startTime).getTime();
  const prior = allWorkouts.filter(
    (w) => w.id !== workout.id && new Date(w.startTime).getTime() < startMs
  );
  const doneBlocks: WorkoutExercise[] = [];
  for (const block of workout.exercises) {
    const sets: WorkoutSet[] = [];
    for (const s of block.sets) {
      const soFar = { ...workout, exercises: [...doneBlocks, { ...block, sets }] };
      const prs =
        s.type !== 'warmup'
          ? evaluateSetPRs(block.exerciseId, { ...s, completed: true }, [soFar, ...prior])
          : [];
      sets.push({ ...s, completed: true, prs: prs.length > 0 ? prs : undefined });
    }
    if (sets.length > 0) doneBlocks.push({ ...block, sets });
  }
  return doneBlocks;
}

export const EditWorkoutModal: React.FC<EditWorkoutModalProps> = ({
  workout,
  allWorkouts,
  exercises,
  onSave,
  onDelete,
  onClose,
}) => {
  const [draft, setDraft] = useState<WorkoutSession>(
    () => JSON.parse(JSON.stringify(workout)) as WorkoutSession
  );
  const [inputUnit, setInputUnit] = useState<WeightUnit>('kg');
  const [search, setSearch] = useState('');

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const searchResults = useMemo(() => searchExercises(exercises, search), [exercises, search]);

  const updateBlock = (blockId: string, update: (b: WorkoutExercise) => WorkoutExercise) =>
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((b) => (b.id === blockId ? update(b) : b)),
    }));

  const updateSet = (blockId: string, setId: string, update: (s: WorkoutSet) => WorkoutSet) =>
    updateBlock(blockId, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.id === setId ? update(s) : s)),
    }));

  const addSet = (blockId: string) =>
    updateBlock(blockId, (b) => {
      const last = b.sets[b.sets.length - 1];
      return {
        ...b,
        sets: [
          ...b.sets,
          {
            id: `set-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            setNumber: b.sets.length + 1,
            type: 'working',
            weightKg: last ? last.weightKg : 20,
            reps: last ? last.reps : 10,
            completed: true,
          },
        ],
      };
    });

  const addExercise = (ex: Exercise) => {
    const now = Date.now();
    setDraft((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          id: `we-edit-${now}-${Math.random().toString(36).slice(2, 6)}`,
          exerciseId: ex.id,
          restSeconds: ex.defaultRestSeconds,
          sets: [
            {
              id: `set-edit-${now}-1`,
              setNumber: 1,
              type: 'working',
              weightKg: ex.barWeightKg || 20,
              reps: ex.targetRepRange[0],
              completed: true,
            },
          ],
        },
      ],
    }));
    setSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...draft,
      name: draft.name.trim() || 'Workout Session',
      durationMinutes: Math.max(1, draft.durationMinutes || 1),
      exercises: reevaluatePRs(draft, allWorkouts),
    });
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${workout.name}"? This can't be undone.`)) {
      onDelete(workout.id);
    }
  };

  const label = 'block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Edit Workout</h3>
            <p className="text-[11px] text-[#8e8e93]">{formatActivityDateTime(draft.startTime)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="edit-name">
              Workout Name
            </label>
            <input
              id="edit-name"
              type="text"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
            />
          </div>
          <div>
            <label className={label} htmlFor="edit-split">
              Split
            </label>
            <select
              id="edit-split"
              value={draft.splitTag}
              onChange={(e) =>
                setDraft({ ...draft, splitTag: e.target.value as WorkoutSession['splitTag'] })
              }
              className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white"
            >
              {SPLITS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className={label} htmlFor="edit-duration">
              Duration (min)
            </label>
            <NumericInput
              id="edit-duration"
              placeholder="45"
              value={draft.durationMinutes}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, durationMinutes: v }))}
              className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm font-mono-num text-white placeholder-[#636366] focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
            />
          </div>
          <div className="col-span-2">
            <label className={label} htmlFor="edit-notes">
              Session Notes
            </label>
            <input
              id="edit-notes"
              type="text"
              placeholder="Optional workout notes..."
              value={draft.notes || ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value || undefined })}
              className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
          {draft.exercises.map((block) => {
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
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${exPalette.badgeClass}`}>
                      {MUSCLE_LABELS[meta.primaryMuscle]}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{meta.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        exercises: prev.exercises.filter((b) => b.id !== block.id),
                      }))
                    }
                    className="p-1 rounded-full text-[#8e8e93] hover:text-[#fa114f]"
                    title="Remove exercise"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {block.sets.map((s) => {
                    if (s.type !== 'warmup') workingNum += 1;
                    return (
                      <div key={s.id} className="grid grid-cols-12 gap-2 items-center text-xs font-mono-num">
                        <div className="col-span-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateSet(block.id, s.id, (cur) => ({ ...cur, type: nextSetType(cur.type) }))
                            }
                            title="Tap to change set type (working, warm-up, drop set, failure)"
                            className="w-7 h-7 rounded-lg bg-[#1c1c1e] text-white font-bold text-[11px] flex items-center justify-center"
                          >
                            {setBadgeLabel(s.type, workingNum)}
                          </button>
                        </div>

                        <div className="col-span-5 flex items-center gap-1">
                          <NumericInput
                            decimal
                            aria-label="Weight"
                            placeholder="0"
                            value={kgToDisplay(s.weightKg, inputUnit)}
                            onValueChange={(v) =>
                              updateSet(block.id, s.id, (cur) => ({
                                ...cur,
                                weightKg: displayToKg(v, inputUnit),
                              }))
                            }
                            className="w-full bg-[#1c1c1e] rounded-lg px-2 py-1 text-center font-bold text-white placeholder-[#636366]"
                          />
                          <button
                            type="button"
                            onClick={() => setInputUnit((u) => (u === 'kg' ? 'lbs' : 'kg'))}
                            title="Switch between KG and LB"
                            className="text-[10px] font-bold text-[#a4ff00] uppercase px-1.5 py-0.5 rounded bg-[#1c1c1e] hover:bg-black shrink-0"
                          >
                            {inputUnit}
                          </button>
                        </div>

                        <div className="col-span-5 flex items-center gap-1">
                          <NumericInput
                            aria-label="Reps"
                            placeholder="0"
                            value={s.reps}
                            onValueChange={(v) => updateSet(block.id, s.id, (cur) => ({ ...cur, reps: v }))}
                            className="w-full bg-[#1c1c1e] rounded-lg px-2 py-1 text-center font-bold text-white placeholder-[#636366]"
                          />
                          <span className="text-[10px] text-[#8e8e93]">reps</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => addSet(block.id)}
                    className="flex-1 py-1 rounded-lg bg-[#1c1c1e] hover:bg-black text-[11px] font-bold text-[#a4ff00] inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Set
                  </button>
                  {block.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateBlock(block.id, (b) => ({ ...b, sets: b.sets.slice(0, -1) }))}
                      className="px-2.5 py-1 rounded-lg bg-[#1c1c1e] hover:bg-black text-[11px] text-[#8e8e93] hover:text-white inline-flex items-center gap-1"
                    >
                      <Minus className="w-3 h-3" /> Set
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <input
              type="text"
              placeholder="Add an exercise to this workout..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#2c2c2e] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            />
            {search.trim().length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1">
                {searchResults.slice(0, 8).map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => addExercise(ex)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#2c2c2e]/60 hover:bg-[#2c2c2e] text-xs text-left"
                  >
                    <span className="text-white font-medium truncate">{ex.name}</span>
                    <span className="text-[#a4ff00] font-bold text-[10px]">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleDelete}
            className="px-3.5 py-2 rounded-full bg-[#fa114f]/15 hover:bg-[#fa114f]/25 text-[#fa114f] text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Workout
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-full bg-[#a4ff00] text-black text-xs font-bold">
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

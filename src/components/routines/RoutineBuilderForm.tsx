import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Exercise, Routine, RoutineExerciseTemplate } from '../../types/workout';
import { MUSCLE_LABELS, searchExercises } from '../../data/seedExercises';
import { NumericInput } from '../common/NumericInput';

const SPLITS: Routine['splitTag'][] = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Custom'];

export interface RoutineBuilderSeed {
  name: string;
  splitTag: Routine['splitTag'];
  items: RoutineExerciseTemplate[];
}

interface RoutineBuilderFormProps {
  /** The routine being edited, or undefined when creating one. */
  existing?: Routine;
  seed: RoutineBuilderSeed;
  exercises: Exercise[];
  onSave: (routine: Routine) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

function folderFor(split: Routine['splitTag']): Routine['folder'] {
  if (split === 'Push' || split === 'Pull' || split === 'Legs') return 'Push / Pull / Legs';
  if (split === 'Upper' || split === 'Lower') return 'Upper / Lower';
  return 'Custom';
}

function accentFor(split: Routine['splitTag']): string {
  if (split === 'Push') return 'emerald';
  if (split === 'Pull') return 'sky';
  return 'violet';
}

export const RoutineBuilderForm: React.FC<RoutineBuilderFormProps> = ({
  existing,
  seed,
  exercises,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [name, setName] = useState(seed.name);
  const [split, setSplit] = useState<Routine['splitTag']>(seed.splitTag);
  const [items, setItems] = useState<RoutineExerciseTemplate[]>(seed.items);
  const [search, setSearch] = useState('');

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const library = useMemo(() => searchExercises(exercises, search), [exercises, search]);

  const updateItem = (id: string, update: (cur: RoutineExerciseTemplate) => RoutineExerciseTemplate) =>
    setItems((prev) => prev.map((it) => (it.id === id ? update(it) : it)));

  const moveItem = (idx: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(next, 0, moved);
      return copy;
    });

  const addExercise = (ex: Exercise) =>
    setItems((prev) => [
      ...prev,
      {
        id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: ex.id,
        targetSets: 3,
        targetRepRange: [ex.targetRepRange[0], ex.targetRepRange[1]],
        restSeconds: ex.defaultRestSeconds,
      },
    ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || items.length === 0) return;

    // Fix half-edited fields (blank sets, min reps above max, etc.).
    const cleaned: RoutineExerciseTemplate[] = items.map((item) => {
      const minReps = Math.max(1, item.targetRepRange[0] || 8);
      const maxReps = Math.max(minReps, item.targetRepRange[1] || minReps);
      return {
        ...item,
        targetSets: Math.max(1, item.targetSets || 3),
        targetRepRange: [minReps, maxReps],
        restSeconds: item.restSeconds >= 15 ? item.restSeconds : 90,
      };
    });

    onSave({
      id: existing?.id ?? `routine-custom-${Date.now()}`,
      name: name.trim(),
      folder: folderFor(split),
      splitTag: split,
      description: existing?.description || '',
      // Keep a routine's own colour unless its split changed.
      accentColor:
        existing && existing.splitTag === split ? existing.accentColor : accentFor(split),
      exercises: cleaned,
    });
  };

  const label = 'block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1';
  const smallInput =
    'w-full bg-[#1c1c1e] rounded-lg px-1.5 py-1 text-center font-mono-num font-bold text-white placeholder-[#636366]';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 flex-1 min-h-0 flex flex-col">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="col-span-2">
          <label className={label} htmlFor="routine-name">
            Routine Name
          </label>
          <input
            id="routine-name"
            type="text"
            required
            placeholder="e.g. Push A — Chest & Delts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
          />
        </div>
        <div>
          <label className={label} htmlFor="routine-split">
            Split
          </label>
          <select
            id="routine-split"
            value={split}
            onChange={(e) => setSplit(e.target.value as Routine['splitTag'])}
            className="w-full bg-[#2c2c2e] rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none"
          >
            {SPLITS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
          <span>Exercises in Routine ({items.length})</span>
          <span>Sets / Reps / Rest</span>
        </div>

        {items.length === 0 ? (
          <div className="text-xs text-[#8e8e93] text-center py-4 bg-black/30 rounded-xl">
            Tap an exercise below to add it to this routine.
          </div>
        ) : (
          items.map((item, idx) => {
            const meta = exerciseMap.get(item.exerciseId);
            if (!meta) return null;
            return (
              <div key={item.id} className="bg-[#2c2c2e] rounded-2xl p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-black/50 text-[#a4ff00] font-mono-num font-bold text-[11px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{meta.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, -1)}
                      className="p-1 rounded-lg bg-black/40 text-[#8e8e93] hover:text-white disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(idx, 1)}
                      className="p-1 rounded-lg bg-black/40 text-[#8e8e93] hover:text-white disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                      className="p-1 rounded-lg bg-black/40 text-[#8e8e93] hover:text-[#fa114f]"
                      title="Remove exercise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] text-[#8e8e93] mb-0.5">Target Sets</span>
                    <NumericInput
                      aria-label={`${meta.name} target sets`}
                      placeholder="3"
                      value={item.targetSets}
                      onValueChange={(v) => updateItem(item.id, (cur) => ({ ...cur, targetSets: v }))}
                      className={smallInput}
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#8e8e93] mb-0.5">Min–Max Reps</span>
                    <div className="flex items-center gap-1">
                      <NumericInput
                        aria-label={`${meta.name} minimum reps`}
                        placeholder="8"
                        value={item.targetRepRange[0]}
                        onValueChange={(v) =>
                          updateItem(item.id, (cur) => ({
                            ...cur,
                            targetRepRange: [v, cur.targetRepRange[1]],
                          }))
                        }
                        className={smallInput}
                      />
                      <span className="text-[#8e8e93]">–</span>
                      <NumericInput
                        aria-label={`${meta.name} maximum reps`}
                        placeholder="12"
                        value={item.targetRepRange[1]}
                        onValueChange={(v) =>
                          updateItem(item.id, (cur) => ({
                            ...cur,
                            targetRepRange: [cur.targetRepRange[0], v],
                          }))
                        }
                        className={smallInput}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[#8e8e93] mb-0.5">Rest (sec)</span>
                    <NumericInput
                      aria-label={`${meta.name} rest seconds`}
                      placeholder="90"
                      value={item.restSeconds}
                      onValueChange={(v) => updateItem(item.id, (cur) => ({ ...cur, restSeconds: v }))}
                      className={smallInput}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-white/[0.08] flex-1 min-h-0 flex flex-col">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
          Add Exercise to Routine
        </div>
        <input
          type="text"
          placeholder="Search exercise (e.g. pec fly, db press)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#2c2c2e] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
        />
        <div className="overflow-y-auto max-h-32 space-y-1 pr-1">
          {library.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => addExercise(ex)}
              className="w-full text-left px-3 py-2 rounded-xl bg-[#2c2c2e]/70 hover:bg-[#2c2c2e] flex items-center justify-between text-xs transition"
            >
              <div className="truncate pr-2">
                <span className="font-semibold text-white">{ex.name}</span>
                <span className="text-[#8e8e93] ml-1.5 text-[11px]">
                  • {MUSCLE_LABELS[ex.primaryMuscle]}
                </span>
              </div>
              <span className="text-[#a4ff00] font-bold text-[11px] shrink-0">+ Add</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#fa114f]/15 hover:bg-[#fa114f]/25 text-[#fa114f] text-xs font-bold"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Routine
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || items.length === 0}
            className="px-4 py-2 rounded-full bg-[#a4ff00] disabled:opacity-40 text-black text-xs font-bold"
          >
            {existing ? 'Save Changes' : 'Create Routine'}
          </button>
        </div>
      </div>
    </form>
  );
};

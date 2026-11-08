import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { EquipmentType, Exercise, MuscleGroup } from '../../types/workout';
import { MUSCLE_LABELS } from '../../data/seedExercises';

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  smith_machine: 'Smith Machine',
  ez_bar: 'EZ-Bar',
  bodyweight: 'Bodyweight',
};

// Typical empty-bar weight, used as the starting weight for new sets.
const DEFAULT_BAR_WEIGHT_KG: Partial<Record<EquipmentType, number>> = {
  barbell: 20,
  ez_bar: 10,
  smith_machine: 15,
};

const MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleGroup[];

interface CustomExerciseFormProps {
  /** The custom exercise being edited, or null to create a new one. */
  exercise: Exercise | null;
  /** How many saved workouts use this exercise (shown before deleting). */
  timesLogged: number;
  onSave: (exercise: Exercise) => void;
  onDelete: (exercise: Exercise) => void;
  onClose: () => void;
}

const parseWhole = (raw: string) => {
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

export const CustomExerciseForm: React.FC<CustomExerciseFormProps> = ({
  exercise,
  timesLogged,
  onSave,
  onDelete,
  onClose,
}) => {
  const isEdit = !!exercise;
  const [name, setName] = useState(exercise?.name ?? '');
  const [primary, setPrimary] = useState<MuscleGroup>(exercise?.primaryMuscle ?? 'chest');
  const [secondary, setSecondary] = useState<MuscleGroup[]>(
    exercise?.secondaryMuscles ?? []
  );
  const [equipment, setEquipment] = useState<EquipmentType>(
    exercise?.equipment ?? 'dumbbell'
  );
  const [minReps, setMinReps] = useState(String(exercise?.targetRepRange[0] ?? 8));
  const [maxReps, setMaxReps] = useState(String(exercise?.targetRepRange[1] ?? 12));
  const [restSeconds, setRestSeconds] = useState(
    String(exercise?.defaultRestSeconds ?? 90)
  );
  const [cues, setCues] = useState(exercise?.cues ?? '');

  const toggleSecondary = (m: MuscleGroup) =>
    setSecondary((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const min = Math.max(1, parseWhole(minReps) || 8);
    const max = Math.max(min, parseWhole(maxReps) || min);
    const rest = parseWhole(restSeconds);
    const barWeightKg =
      equipment === exercise?.equipment
        ? exercise?.barWeightKg
        : DEFAULT_BAR_WEIGHT_KG[equipment];

    const saved: Exercise = {
      ...(exercise ?? {}),
      id: exercise?.id ?? `ex-custom-${Date.now()}`,
      name: trimmedName,
      primaryMuscle: primary,
      secondaryMuscles: secondary.filter((m) => m !== primary),
      equipment,
      defaultRestSeconds: rest >= 15 ? rest : 90,
      targetRepRange: [min, max],
      cues: cues.trim() || undefined,
      isCustom: true,
    };
    if (barWeightKg) saved.barWeightKg = barWeightKg;
    else delete saved.barWeightKg;
    onSave(saved);
  };

  const handleDelete = () => {
    if (!exercise) return;
    const message =
      timesLogged > 0
        ? `Remove "${exercise.name}"? It will disappear from the exercise list and your routines, but ${timesLogged === 1 ? 'the workout where you logged it is' : `the ${timesLogged} workouts where you logged it are`} kept.`
        : `Delete "${exercise.name}"?`;
    if (window.confirm(message)) onDelete(exercise);
  };

  const label = 'block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1';
  const field =
    'w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] safe-sheet sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {isEdit ? 'Edit Exercise' : 'Add Custom Exercise'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className={label} htmlFor="cx-name">
            Name
          </label>
          <input
            id="cx-name"
            type="text"
            required
            placeholder="e.g. Bayesian Cable Curl"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={label} htmlFor="cx-primary">
              Main Muscle
            </label>
            <select
              id="cx-primary"
              value={primary}
              onChange={(e) => {
                const next = e.target.value as MuscleGroup;
                setPrimary(next);
                setSecondary((prev) => prev.filter((m) => m !== next));
              }}
              className={field}
            >
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="cx-equipment">
              Equipment
            </label>
            <select
              id="cx-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value as EquipmentType)}
              className={field}
            >
              {(Object.keys(EQUIPMENT_LABELS) as EquipmentType[]).map((eq) => (
                <option key={eq} value={eq}>
                  {EQUIPMENT_LABELS[eq]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className={label}>Also Works (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== primary).map((m) => {
              const on = secondary.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSecondary(m)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition ${
                    on
                      ? 'bg-[#a4ff00] text-black'
                      : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
                  }`}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className={label} htmlFor="cx-min">
              Min Reps
            </label>
            <input
              id="cx-min"
              inputMode="numeric"
              value={minReps}
              onChange={(e) => setMinReps(e.target.value.replace(/[^0-9]/g, ''))}
              className={`${field} text-center font-mono-num`}
            />
          </div>
          <div>
            <label className={label} htmlFor="cx-max">
              Max Reps
            </label>
            <input
              id="cx-max"
              inputMode="numeric"
              value={maxReps}
              onChange={(e) => setMaxReps(e.target.value.replace(/[^0-9]/g, ''))}
              className={`${field} text-center font-mono-num`}
            />
          </div>
          <div>
            <label className={label} htmlFor="cx-rest">
              Rest (sec)
            </label>
            <input
              id="cx-rest"
              inputMode="numeric"
              value={restSeconds}
              onChange={(e) => setRestSeconds(e.target.value.replace(/[^0-9]/g, ''))}
              className={`${field} text-center font-mono-num`}
            />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="cx-cues">
            Form Cues (optional)
          </label>
          <textarea
            id="cx-cues"
            rows={2}
            placeholder="e.g. Elbows slightly behind the torso, slow lowering"
            value={cues}
            onChange={(e) => setCues(e.target.value)}
            className={`${field} resize-none`}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#fa114f]/15 hover:bg-[#fa114f]/25 text-[#fa114f] text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-full bg-[#a4ff00] disabled:opacity-40 text-black text-xs font-bold"
            >
              {isEdit ? 'Save Changes' : 'Add Exercise'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  EquipmentType,
  Exercise,
  MuscleGroup,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import {
  MUSCLE_CATEGORY_MAP,
  MUSCLE_LABELS,
  searchExercises,
} from '../../data/seedExercises';
import { getExerciseProgressionSeries } from '../../utils/analytics';
import { kgToDisplay } from '../../utils/calculators';
import { getMusclePalette, getSplitPalette } from '../../utils/splitTheme';
import { ExerciseDiagram } from './ExerciseDiagram';

interface ExerciseExplorerViewProps {
  exercises: Exercise[];
  workouts: WorkoutSession[];
  unit: WeightUnit;
  onSelectExerciseId: (id: string | null) => void;
  onAddCustomExercise: (ex: Exercise) => void;
}

// Checks run from most specific to least specific, because many keywords
// contain each other ("lateral delt" contains "lat", "forearm" contains "arm",
// "lower back" contains "back").
function parseMuscleInput(input: string): MuscleGroup {
  const s = input.trim().toLowerCase();
  if (s.includes('chest') || s.includes('pec')) return 'chest';
  if (s.includes('lower back') || s.includes('erector') || s.includes('lumbar'))
    return 'lower_back';
  if (s.includes('front delt') || s.includes('anterior delt')) return 'front_delts';
  if (s.includes('rear delt') || s.includes('posterior delt')) return 'rear_delts';
  if (
    s.includes('side delt') ||
    s.includes('lateral delt') ||
    s.includes('shoulder') ||
    s.includes('delt')
  )
    return 'side_delts';
  if (s.includes('forearm') || s.includes('wrist') || s.includes('grip'))
    return 'forearms';
  if (s.includes('lat') || s.includes('wing')) return 'lats';
  if (
    s.includes('trap') ||
    s.includes('upper back') ||
    s.includes('rhomboid') ||
    s.includes('back')
  )
    return 'upper_back';
  // Before triceps: "hamstrings" contains "tri".
  if (s.includes('quad') || s.includes('thigh')) return 'quads';
  if (s.includes('hamstring') || s.includes('ham')) return 'hamstrings';
  if (s.includes('glute') || s.includes('butt') || s.includes('hip')) return 'glutes';
  if (s.includes('calf') || s.includes('calves')) return 'calves';
  if (s.includes('tricep') || s.includes('tri')) return 'triceps';
  if (s.includes('bicep') || s.includes('arm')) return 'biceps';
  if (s.includes('ab') || s.includes('core') || s.includes('oblique')) return 'abs';
  return 'chest';
}

function parseEquipInput(input: string): EquipmentType {
  const s = input.trim().toLowerCase();
  if (s.includes('smith')) return 'smith_machine';
  if (s.includes('ez')) return 'ez_bar';
  // Before barbell: "dumbbell" contains "bb".
  if (s.includes('dumbbell') || s.includes('db')) return 'dumbbell';
  if (s.includes('barbell') || s.includes('bb') || s.includes('bar')) return 'barbell';
  if (s.includes('cable') || s.includes('pulley')) return 'cable';
  if (s.includes('machine') || s.includes('lever') || s.includes('plate loaded'))
    return 'machine';
  if (
    s.includes('bodyweight') ||
    s.includes('calisthenic') ||
    s.includes('bw') ||
    s.includes('body')
  )
    return 'bodyweight';
  return 'dumbbell';
}

export const ExerciseExplorerView: React.FC<ExerciseExplorerViewProps> = ({
  exercises,
  workouts,
  unit,
  onSelectExerciseId,
  onAddCustomExercise,
}) => {
  const [search, setSearch] = useState('');
  const [splitFilter, setSplitFilter] = useState<'All' | 'Push' | 'Pull' | 'Legs'>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [customName, setCustomName] = useState('');
  const [customMuscleInput, setCustomMuscleInput] = useState('Chest');
  const [customEquipInput, setCustomEquipInput] = useState('Dumbbell');

  const filtered = useMemo(() => {
    const splitFiltered = exercises.filter(
      (ex) =>
        splitFilter === 'All' || MUSCLE_CATEGORY_MAP[ex.primaryMuscle] === splitFilter
    );
    return searchExercises(splitFiltered, search);
  }, [exercises, search, splitFilter]);

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const resolvedMuscle = parseMuscleInput(customMuscleInput);
    const resolvedEquip = parseEquipInput(customEquipInput);

    const newEx: Exercise = {
      id: `ex-custom-${Date.now()}`,
      name: customName.trim(),
      primaryMuscle: resolvedMuscle,
      secondaryMuscles: [],
      equipment: resolvedEquip,
      defaultRestSeconds: 120,
      targetRepRange: [8, 12],
      isCustom: true,
      cues: `${customMuscleInput.trim()} targeted movement using ${customEquipInput.trim()}.`,
    };
    onAddCustomExercise(newEx);
    setCustomName('');
    setCustomMuscleInput('Chest');
    setCustomEquipInput('Dumbbell');
    setShowCreateModal(false);
    onSelectExerciseId(newEx.id);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Page Title */}
      <div className="flex items-end justify-between gap-2 px-0.5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Exercises
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full bg-[#a4ff00] hover:bg-[#b5ff2b] text-black font-bold text-xs transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {/* iOS Search & Segmented Split Filter Row */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exercise or muscle (e.g. pec fly)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1c1c1e] rounded-[14px] pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-[#8e8e93] focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
          />
        </div>
        <div className="grid grid-cols-4 bg-[#1c1c1e] p-1 rounded-[12px] text-xs gap-1">
          {(['All', 'Push', 'Pull', 'Legs'] as const).map((cat) => {
            const isActive = splitFilter === cat;
            const activeClass =
              cat === 'All'
                ? 'bg-[#3a3a3c] text-white font-bold'
                : getSplitPalette(cat).solidPillClass;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSplitFilter(cat)}
                className={`py-1.5 px-3 rounded-[9px] font-semibold transition ${
                  isActive ? activeClass : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Apple Fitness Exercise List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {filtered.map((ex) => {
          const series = getExerciseProgressionSeries(ex.id, workouts, null);
          const latestPoint = series[series.length - 1];
          const palette = getMusclePalette(ex.primaryMuscle);

          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onSelectExerciseId(ex.id)}
              style={palette.cardGlowStyle}
              className={`text-left p-3 af-card border ${palette.cardBorderClass} hover:bg-[#2c2c2e]/70 flex items-center justify-between gap-3 transition-all group`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ExerciseDiagram exercise={ex} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {ex.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#8e8e93] mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: palette.hex }}
                    />
                    <span className={palette.textClass}>
                      {MUSCLE_LABELS[ex.primaryMuscle]}
                    </span>
                    <span>•</span>
                    <span className="capitalize">
                      {ex.equipment.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {latestPoint ? (
                  <div className="text-right font-mono-num">
                    <div className={`text-xs font-bold ${palette.textClass}`}>
                      1RM {kgToDisplay(latestPoint.bestE1RMKg, unit)} {unit}
                    </div>
                    <div className="text-[10px] text-[#8e8e93]">
                      {kgToDisplay(latestPoint.heaviestWeightKg, unit)}×{latestPoint.bestWeightReps}
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono-num text-[#8e8e93]">
                    {ex.targetRepRange[0]}–{ex.targetRepRange[1]}r
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-white" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Create Custom Exercise Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <form
            onSubmit={handleCreateCustom}
            className="w-full max-w-md bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] sm:rounded-[26px] p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Add Custom Exercise
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Bayesian Cable Curl"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Primary Muscle (Type or Pick)
                </label>
                <input
                  type="text"
                  required
                  list="muscle-suggestions"
                  placeholder="e.g. Upper Chest, Lats, Quads"
                  value={customMuscleInput}
                  onChange={(e) => setCustomMuscleInput(e.target.value)}
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                />
                <datalist id="muscle-suggestions">
                  {(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((m) => (
                    <option key={m} value={MUSCLE_LABELS[m]} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Chest', 'Back', 'Quads', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCustomMuscleInput(m)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 hover:bg-black text-[#8e8e93] hover:text-white transition"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                  Equipment (Type or Pick)
                </label>
                <input
                  type="text"
                  required
                  list="equip-suggestions"
                  placeholder="e.g. Dumbbell, Cable, Machine"
                  value={customEquipInput}
                  onChange={(e) => setCustomEquipInput(e.target.value)}
                  className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                />
                <datalist id="equip-suggestions">
                  <option value="Barbell" />
                  <option value="Dumbbell" />
                  <option value="Cable" />
                  <option value="Machine" />
                  <option value="Smith Machine" />
                  <option value="Bodyweight" />
                  <option value="EZ-Bar" />
                  <option value="Kettlebell" />
                </datalist>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Smith Machine', 'Bodyweight'].map((eq) => (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => setCustomEquipInput(eq)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 hover:bg-black text-[#8e8e93] hover:text-white transition"
                    >
                      {eq}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-[#a4ff00] text-black text-xs font-bold"
              >
                Add Exercise
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

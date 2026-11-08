import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Compass,
  Dumbbell,
  FlaskConical,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Exercise,
  Routine,
  RoutineExerciseTemplate,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import { MUSCLE_LABELS, searchExercises } from '../../data/seedExercises';
import {
  SCIENTIFIC_ROUTINES,
  ScientificRoutinePreset,
} from '../../data/starterRoutines';
import { formatShortDate } from '../../utils/analytics';
import { getSplitPalette } from '../../utils/splitTheme';

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
}) => {
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'custom' | 'explore'>('custom');
  const [exploreCategory, setExploreCategory] = useState<
    'All' | ScientificRoutinePreset['programCategory']
  >('All');
  const [addedPresetIds, setAddedPresetIds] = useState<Record<string, boolean>>({});

  const [formName, setFormName] = useState('');
  const [formSplit, setFormSplit] = useState<Routine['splitTag']>('Push');
  const [formItems, setFormItems] = useState<RoutineExerciseTemplate[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const sortedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  const lastWorkout = sortedWorkouts[0];
  const recommendedSplit: 'Push' | 'Pull' | 'Legs' =
    lastWorkout?.splitTag === 'Push'
      ? 'Pull'
      : lastWorkout?.splitTag === 'Pull'
      ? 'Legs'
      : 'Push';

  const openCreateModal = () => {
    setEditingRoutineId(null);
    setModalMode('custom');
    setFormName('');
    setFormSplit('Push');
    setFormItems([
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
    ]);
    setExerciseSearch('');
    setShowModal(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setModalMode('custom');
    setFormName(routine.name);
    setFormSplit(routine.splitTag);
    setFormItems(
      routine.exercises.map((ex) => ({
        ...ex,
        targetRepRange: [ex.targetRepRange[0], ex.targetRepRange[1]],
      }))
    );
    setExerciseSearch('');
    setShowModal(true);
  };

  const handleLoadPresetIntoBuilder = (preset: ScientificRoutinePreset) => {
    setFormName(preset.name);
    setFormSplit(preset.splitTag);
    setFormItems(
      preset.exercises.map((ex, idx) => ({
        ...ex,
        id: `rt-${Date.now()}-${idx}`,
        targetRepRange: [ex.targetRepRange[0], ex.targetRepRange[1]],
      }))
    );
    setModalMode('custom');
  };

  const handleQuickAddPreset = (preset: ScientificRoutinePreset) => {
    onCreateRoutine({
      id: `routine-sci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: preset.name,
      folder: preset.folder,
      splitTag: preset.splitTag,
      description: preset.description,
      accentColor: preset.accentColor,
      exercises: preset.exercises.map((ex, idx) => ({
        ...ex,
        id: `rt-${Date.now()}-${idx}`,
        targetRepRange: [ex.targetRepRange[0], ex.targetRepRange[1]],
      })),
    });
    setAddedPresetIds((prev) => ({ ...prev, [preset.id]: true }));
  };

  const handleAddExerciseToForm = (ex: Exercise) => {
    setFormItems((prev) => [
      ...prev,
      {
        id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        exerciseId: ex.id,
        targetSets: 3,
        targetRepRange: [ex.targetRepRange[0], ex.targetRepRange[1]],
        restSeconds: ex.defaultRestSeconds,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMoveItem = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= formItems.length) return;
    const copy = [...formItems];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    setFormItems(copy);
  };

  const handleUpdateItem = (
    id: string,
    updater: (cur: RoutineExerciseTemplate) => RoutineExerciseTemplate
  ) => {
    setFormItems((prev) => prev.map((it) => (it.id === id ? updater(it) : it)));
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formItems.length === 0) return;

    const folder: Routine['folder'] =
      formSplit === 'Push' || formSplit === 'Pull' || formSplit === 'Legs'
        ? 'Push / Pull / Legs'
        : formSplit === 'Upper' || formSplit === 'Lower'
        ? 'Upper / Lower'
        : 'Custom';
    const existing = editingRoutineId
      ? routines.find((r) => r.id === editingRoutineId)
      : undefined;
    // Keep a routine's own colour unless its split changed.
    const accentColor =
      existing && existing.splitTag === formSplit
        ? existing.accentColor
        : formSplit === 'Push'
        ? 'emerald'
        : formSplit === 'Pull'
        ? 'sky'
        : 'violet';

    // Fix half-edited fields (blank sets, min reps above max, etc.).
    const cleanedItems: RoutineExerciseTemplate[] = formItems.map((item) => {
      const minReps = Math.max(1, item.targetRepRange[0] || 8);
      const maxReps = Math.max(minReps, item.targetRepRange[1] || minReps);
      return {
        ...item,
        targetSets: Math.max(1, item.targetSets || 3),
        targetRepRange: [minReps, maxReps],
        restSeconds: item.restSeconds >= 15 ? item.restSeconds : 90,
      };
    });

    if (editingRoutineId) {
      onUpdateRoutine({
        id: editingRoutineId,
        name: formName.trim(),
        folder,
        splitTag: formSplit,
        description: existing?.description || '',
        accentColor,
        exercises: cleanedItems,
      });
    } else {
      onCreateRoutine({
        id: `routine-custom-${Date.now()}`,
        name: formName.trim(),
        folder,
        splitTag: formSplit,
        description: '',
        accentColor,
        exercises: cleanedItems,
      });
    }

    setShowModal(false);
  };

  const filteredLibrary = searchExercises(exercises, exerciseSearch);

  const filteredPresets = SCIENTIFIC_ROUTINES.filter(
    (p) => exploreCategory === 'All' || p.programCategory === exploreCategory
  );

  const recommendedPalette = getSplitPalette(recommendedSplit);

  return (
    <div className="space-y-4 pb-6">
      {/* Apple Fitness Page Title + Quick Empty Workout Action */}
      <div className="flex items-end justify-between gap-2 px-0.5">
        <div>
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${recommendedPalette.textClass}`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Up Next: {recommendedSplit} Day
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Routines
          </h1>
        </div>

        <button
          type="button"
          onClick={onStartEmptyWorkout}
          className="px-3.5 py-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#a4ff00] font-bold text-xs inline-flex items-center gap-1.5 transition"
        >
          <Dumbbell className="w-3.5 h-3.5" /> Quick Start
        </button>
      </div>

      {/* Routine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {routines.map((routine) => {
          const isRecommended =
            routine.splitTag === recommendedSplit &&
            routine.id === `routine-ppl-${recommendedSplit.toLowerCase()}`;
          const palette = getSplitPalette(routine.splitTag);
          const lastSessionForRoutine = sortedWorkouts.find(
            (w) => w.routineId === routine.id
          );

          return (
            <div
              key={routine.id}
              style={palette.cardGlowStyle}
              className={`af-card border ${palette.cardBorderClass} p-4 space-y-3.5 transition-all`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.badgeClass}`}
                    >
                      {routine.splitTag}
                    </span>
                    {isRecommended && (
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.solidPillClass}`}
                      >
                        Up Next
                      </span>
                    )}
                    <span className="text-[11px] text-[#8e8e93]">
                      • {routine.exercises.length} exercises
                    </span>
                    {lastSessionForRoutine && (
                      <span className="text-[11px] text-[#8e8e93]">
                        • {formatShortDate(lastSessionForRoutine.startTime)}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white truncate">
                    {routine.name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => openEditModal(routine)}
                  className="p-2 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93] hover:text-white shrink-0 transition"
                  title="Edit routine"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Exercise Preview Pills */}
              <div className="flex flex-wrap gap-1.5">
                {routine.exercises.slice(0, 4).map((item) => {
                  const meta = exerciseMap.get(item.exerciseId);
                  return (
                    <span
                      key={item.id}
                      className="text-[11px] text-[#d1d1d6] bg-[#2c2c2e]/75 px-2.5 py-1 rounded-full truncate max-w-[180px]"
                    >
                      <span className={`font-mono-num font-bold mr-1 ${palette.textClass}`}>
                        {item.targetSets}×
                      </span>
                      {meta?.name || item.exerciseId}
                    </span>
                  );
                })}
                {routine.exercises.length > 4 && (
                  <span className="text-[11px] text-[#8e8e93] bg-[#2c2c2e]/50 px-2.5 py-1 rounded-full font-mono-num">
                    +{routine.exercises.length - 4} more
                  </span>
                )}
              </div>

              {/* Split-Themed Start Button Bar */}
              <button
                type="button"
                onClick={() => onStartRoutine(routine)}
                className={`w-full py-2.5 rounded-full active:scale-[0.99] font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all ${palette.buttonClass}`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start {routine.splitTag}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom + New Routine Button */}
      <button
        type="button"
        onClick={openCreateModal}
        className="w-full py-3.5 rounded-[18px] bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.06] text-[#a4ff00] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition"
      >
        <Plus className="w-4 h-4" /> New Routine
      </button>

      {/* Create / Edit Routine Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#1c1c1e] border-t sm:border border-white/10 rounded-t-[26px] sm:rounded-[26px] p-4 sm:p-5 space-y-4 max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingRoutineId ? 'Edit Routine' : 'New Routine'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Toggle inside New Routine Maker: Build Custom vs Explore Proven */}
            {!editingRoutineId && (
              <div className="grid grid-cols-2 bg-[#2c2c2e] p-1 rounded-[12px] text-xs">
                <button
                  type="button"
                  onClick={() => setModalMode('custom')}
                  className={`py-1.5 px-3 rounded-[9px] font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                    modalMode === 'custom'
                      ? 'bg-[#636366] text-white'
                      : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" /> Custom Builder
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('explore')}
                  className={`py-1.5 px-3 rounded-[9px] font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                    modalMode === 'explore'
                      ? 'bg-[#636366] text-white'
                      : 'text-[#8e8e93] hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#a4ff00]" /> Explore Proven
                </button>
              </div>
            )}

            {modalMode === 'explore' && !editingRoutineId ? (
              <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                {/* Split Program Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                  {(
                    [
                      'All',
                      'Upper / Lower',
                      'PPL',
                      'Full Body',
                      'Arnold Split',
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExploreCategory(cat)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                        exploreCategory === cat
                          ? 'bg-[#a4ff00] text-black font-bold'
                          : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Scientifically Proven Routine Cards */}
                <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                  {filteredPresets.map((preset) => {
                    const isAdded = !!addedPresetIds[preset.id];
                    const presetPalette = getSplitPalette(preset.splitTag);
                    return (
                      <div
                        key={preset.id}
                        style={presetPalette.cardGlowStyle}
                        className={`bg-[#2c2c2e]/85 rounded-2xl p-3.5 space-y-2.5 border ${presetPalette.cardBorderClass}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${presetPalette.badgeClass}`}
                              >
                                {preset.splitTag}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/50 text-[#8e8e93]">
                                {preset.programCategory}
                              </span>
                              <span className="text-[11px] text-[#8e8e93]">
                                • {preset.exercises.length} exercises
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white">
                              {preset.name}
                            </h4>
                          </div>
                        </div>

                        {/* Evidence-Based Science Note */}
                        <div className="flex items-start gap-1.5 text-[11px] text-[#d1d1d6] bg-black/40 rounded-xl px-2.5 py-2">
                          <FlaskConical
                            className={`w-3.5 h-3.5 ${presetPalette.textClass} shrink-0 mt-0.5`}
                          />
                          <span>{preset.evidenceNote}</span>
                        </div>

                        {/* Exercise Preview Pills */}
                        <div className="flex flex-wrap gap-1">
                          {preset.exercises.map((item) => {
                            const exMeta = exerciseMap.get(item.exerciseId);
                            if (!exMeta) return null;
                            return (
                              <span
                                key={item.id}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-[#8e8e93]"
                              >
                                <strong className="text-white font-mono-num">
                                  {item.targetSets}×
                                </strong>{' '}
                                {exMeta.name}
                              </span>
                            );
                          })}
                        </div>

                        {/* Actions: Customize in Builder or 1-Tap Add */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleLoadPresetIntoBuilder(preset)}
                            className="flex-1 py-2 rounded-full bg-black/50 hover:bg-black/80 text-white font-semibold text-xs transition"
                          >
                            Customize
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAddPreset(preset)}
                            className={`flex-1 py-2 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1 transition ${presetPalette.buttonClass}`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" /> Add Routine
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSaveRoutine}
                className="space-y-4 flex-1 min-h-0 flex flex-col"
              >
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                      Routine Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Push A — Chest & Delts"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-[#2c2c2e] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#8e8e93] mb-1">
                      Split
                    </label>
                    <select
                      value={formSplit}
                      onChange={(e) =>
                        setFormSplit(e.target.value as Routine['splitTag'])
                      }
                      className="w-full bg-[#2c2c2e] rounded-xl px-2.5 py-2 text-sm text-white focus:outline-none"
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

                {/* Current Routine Exercises List */}
                <div className="space-y-2 overflow-y-auto max-h-52 pr-1">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
                    <span>Exercises in Routine ({formItems.length})</span>
                    <span>Sets / Reps / Rest</span>
                  </div>

                  {formItems.length === 0 ? (
                    <div className="text-xs text-[#8e8e93] text-center py-4 bg-black/30 rounded-xl">
                      Tap an exercise below to add it to this routine.
                    </div>
                  ) : (
                    formItems.map((item, idx) => {
                      const meta = exerciseMap.get(item.exerciseId);
                      if (!meta) return null;

                      return (
                        <div
                          key={item.id}
                          className="bg-[#2c2c2e] rounded-2xl p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-black/50 text-[#a4ff00] font-mono-num font-bold text-[11px] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-white truncate">
                                {meta.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveItem(idx, -1)}
                                className="p-1 rounded-lg bg-black/40 text-[#8e8e93] hover:text-white disabled:opacity-30"
                                title="Move up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === formItems.length - 1}
                                onClick={() => handleMoveItem(idx, 1)}
                                className="p-1 rounded-lg bg-black/40 text-[#8e8e93] hover:text-white disabled:opacity-30"
                                title="Move down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 rounded-lg bg-black/40 text-[#8e8e93] hover:text-[#fa114f]"
                                title="Remove exercise"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <label className="block text-[10px] text-[#8e8e93] mb-0.5">
                                Target Sets
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="3"
                                value={item.targetSets === 0 ? '' : String(item.targetSets)}
                                onBlur={() => {
                                  if (!item.targetSets || item.targetSets < 1) {
                                    handleUpdateItem(item.id, (cur) => ({
                                      ...cur,
                                      targetSets: 3,
                                    }));
                                  }
                                }}
                                onChange={(e) => {
                                  const cleaned = e.target.value
                                    .replace(/[^0-9]/g, '')
                                    .replace(/^0+(?=\d)/, '');
                                  const raw = parseInt(cleaned, 10);
                                  handleUpdateItem(item.id, (cur) => ({
                                    ...cur,
                                    targetSets: isNaN(raw) ? 0 : Math.max(0, raw),
                                  }));
                                }}
                                className="w-full bg-[#1c1c1e] rounded-lg px-2 py-1 text-center font-mono-num font-bold text-white placeholder-[#636366]"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-[#8e8e93] mb-0.5">
                                Min–Max Reps
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="8"
                                  value={
                                    item.targetRepRange[0] === 0
                                      ? ''
                                      : String(item.targetRepRange[0])
                                  }
                                  onBlur={() => {
                                    if (!item.targetRepRange[0] || item.targetRepRange[0] < 1) {
                                      handleUpdateItem(item.id, (cur) => ({
                                        ...cur,
                                        targetRepRange: [8, Math.max(8, cur.targetRepRange[1] || 12)],
                                      }));
                                    }
                                  }}
                                  onChange={(e) => {
                                    const cleaned = e.target.value
                                      .replace(/[^0-9]/g, '')
                                      .replace(/^0+(?=\d)/, '');
                                    const raw = parseInt(cleaned, 10);
                                    const minR = isNaN(raw) ? 0 : Math.max(0, raw);
                                    handleUpdateItem(item.id, (cur) => ({
                                      ...cur,
                                      targetRepRange: [minR, cur.targetRepRange[1]],
                                    }));
                                  }}
                                  className="w-full bg-[#1c1c1e] rounded-lg px-1.5 py-1 text-center font-mono-num font-bold text-white placeholder-[#636366]"
                                />
                                <span className="text-[#8e8e93]">–</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="12"
                                  value={
                                    item.targetRepRange[1] === 0
                                      ? ''
                                      : String(item.targetRepRange[1])
                                  }
                                  onBlur={() => {
                                    const minVal = Math.max(1, item.targetRepRange[0] || 8);
                                    const maxVal = Math.max(minVal, item.targetRepRange[1] || 12);
                                    handleUpdateItem(item.id, (cur) => ({
                                      ...cur,
                                      targetRepRange: [minVal, maxVal],
                                    }));
                                  }}
                                  onChange={(e) => {
                                    const cleaned = e.target.value
                                      .replace(/[^0-9]/g, '')
                                      .replace(/^0+(?=\d)/, '');
                                    const raw = parseInt(cleaned, 10);
                                    const maxR = isNaN(raw) ? 0 : Math.max(0, raw);
                                    handleUpdateItem(item.id, (cur) => ({
                                      ...cur,
                                      targetRepRange: [cur.targetRepRange[0], maxR],
                                    }));
                                  }}
                                  className="w-full bg-[#1c1c1e] rounded-lg px-1.5 py-1 text-center font-mono-num font-bold text-white placeholder-[#636366]"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-[#8e8e93] mb-0.5">
                                Rest (sec)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="90"
                                value={item.restSeconds === 0 ? '' : String(item.restSeconds)}
                                onBlur={() => {
                                  if (!item.restSeconds || item.restSeconds < 15) {
                                    handleUpdateItem(item.id, (cur) => ({
                                      ...cur,
                                      restSeconds: 90,
                                    }));
                                  }
                                }}
                                onChange={(e) => {
                                  const cleaned = e.target.value
                                    .replace(/[^0-9]/g, '')
                                    .replace(/^0+(?=\d)/, '');
                                  const raw = parseInt(cleaned, 10);
                                  handleUpdateItem(item.id, (cur) => ({
                                    ...cur,
                                    restSeconds: isNaN(raw) ? 0 : Math.max(0, raw),
                                  }));
                                }}
                                className="w-full bg-[#1c1c1e] rounded-lg px-2 py-1 text-center font-mono-num font-bold text-white placeholder-[#636366]"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Exercise Library Picker */}
                <div className="space-y-2 pt-2 border-t border-white/[0.08] flex-1 min-h-0 flex flex-col">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
                    Add Exercise to Routine
                  </div>
                  <input
                    type="text"
                    placeholder="Search exercise (e.g. pec fly, db press)..."
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    className="w-full bg-[#2c2c2e] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
                  />
                  <div className="overflow-y-auto max-h-32 space-y-1 pr-1">
                    {filteredLibrary.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleAddExerciseToForm(ex)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-[#2c2c2e]/70 hover:bg-[#2c2c2e] flex items-center justify-between text-xs transition"
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-white">{ex.name}</span>
                          <span className="text-[#8e8e93] ml-1.5 text-[11px]">
                            • {MUSCLE_LABELS[ex.primaryMuscle]}
                          </span>
                        </div>
                        <span className="text-[#a4ff00] font-bold text-[11px] shrink-0">
                          + Add
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
                  {editingRoutineId ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete the routine "${formName}"?`)) {
                          return;
                        }
                        onDeleteRoutine(editingRoutineId);
                        setShowModal(false);
                      }}
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
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-full bg-[#a4ff00] text-black text-xs font-bold"
                    >
                      {editingRoutineId ? 'Save Changes' : 'Create Routine'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { Exercise, WeightUnit, WorkoutSession } from '../../types/workout';
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
  onCreateCustomExercise: () => void;
}

export const ExerciseExplorerView: React.FC<ExerciseExplorerViewProps> = ({
  exercises,
  workouts,
  unit,
  onSelectExerciseId,
  onCreateCustomExercise,
}) => {
  const [search, setSearch] = useState('');
  const [splitFilter, setSplitFilter] = useState<'All' | 'Push' | 'Pull' | 'Legs'>('All');
  const filtered = useMemo(() => {
    const splitFiltered = exercises.filter(
      (ex) =>
        splitFilter === 'All' || MUSCLE_CATEGORY_MAP[ex.primaryMuscle] === splitFilter
    );
    return searchExercises(splitFiltered, search);
  }, [exercises, search, splitFilter]);

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
          onClick={onCreateCustomExercise}
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
                    {ex.isCustom && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-px rounded-full bg-[#2c2c2e] text-[#8e8e93]">
                        Custom
                      </span>
                    )}
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

    </div>
  );
};

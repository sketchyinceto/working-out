import React, { useState, useMemo } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Scale,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  BodyMeasurementEntry,
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
import {
  computeWeeklyMuscleVolumes,
  formatShortDate,
  getExerciseProgressionSeries,
} from '../../utils/analytics';
import {
  displayToKg,
  formatWeight,
  kgToDisplay,
} from '../../utils/calculators';
import { getMusclePalette, getSplitPalette } from '../../utils/splitTheme';
import { evaluateExercisePrescription } from '../../utils/trainerEngine';
import { ProgressionChart } from './ProgressionChart';
import { MuscleHeatmap } from './MuscleHeatmap';

interface AnalyticsDashboardProps {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  measurements: BodyMeasurementEntry[];
  unit: WeightUnit;
  onOpenExerciseDetail: (exerciseId: string) => void;
  onAddBodyweight: (entry: Omit<BodyMeasurementEntry, 'id'>) => void;
}

const KEY_LIFTS = [
  { id: 'ex-bench-press', short: 'Bench Press' },
  { id: 'ex-incline-db-press', short: 'Incline DB' },
  { id: 'ex-barbell-row', short: 'Barbell Row' },
  { id: 'ex-lat-pulldown', short: 'Lat Pulldown' },
  { id: 'ex-barbell-squat', short: 'Back Squat' },
  { id: 'ex-rdl', short: 'RDL' },
];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  workouts,
  exercises,
  measurements,
  unit,
  onOpenExerciseDetail,
  onAddBodyweight,
}) => {
  const [spotlightExId, setSpotlightExId] = useState<string>('ex-bench-press');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [pickerSplitFilter, setPickerSplitFilter] = useState<
    'Logged' | 'All' | 'Push' | 'Pull' | 'Legs'
  >('Logged');
  const [daysFilter, setDaysFilter] = useState<number | null>(90);
  const [heatmapWindowDays, setHeatmapWindowDays] = useState<7 | 28>(7);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [showWeighIn, setShowWeighIn] = useState(false);
  const [bwInputUnit, setBwInputUnit] = useState<WeightUnit>('kg');

  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const spotlightExercise =
    exerciseMap.get(spotlightExId) || exercises[0];
  const spotlightPalette = getMusclePalette(spotlightExercise.primaryMuscle);

  const progressionSeries = useMemo(
    () => getExerciseProgressionSeries(spotlightExercise.id, workouts, daysFilter),
    [spotlightExercise.id, workouts, daysFilter]
  );

  const statDiag = useMemo(
    () =>
      evaluateExercisePrescription(
        spotlightExercise,
        workouts,
        exercises,
        unit
      ),
    [spotlightExercise, workouts, exercises, unit]
  );

  const exerciseSessionCounts = useMemo(() => {
    const counts = new Map<string, { sessions: number; best1RMKg: number }>();
    for (const ex of exercises) {
      const s = getExerciseProgressionSeries(ex.id, workouts, null);
      if (s.length > 0) {
        const best1RMKg = Math.max(...s.map((pt) => pt.bestE1RMKg));
        counts.set(ex.id, { sessions: s.length, best1RMKg });
      }
    }
    return counts;
  }, [exercises, workouts]);

  const filteredPickerExercises = useMemo(() => {
    const byText = searchExercises(exercises, exerciseSearchQuery);
    return byText.filter((ex) => {
      if (pickerSplitFilter === 'Logged') {
        return exerciseSessionCounts.has(ex.id);
      }
      if (pickerSplitFilter === 'All') return true;
      return MUSCLE_CATEGORY_MAP[ex.primaryMuscle] === pickerSplitFilter;
    });
  }, [exercises, exerciseSearchQuery, pickerSplitFilter, exerciseSessionCounts]);

  const muscleVolumes = useMemo(
    () => computeWeeklyMuscleVolumes(workouts, exercises, heatmapWindowDays),
    [workouts, exercises, heatmapWindowDays]
  );

  const chronologicalBW = useMemo(
    () =>
      [...measurements].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [measurements]
  );

  const latestBW = chronologicalBW[chronologicalBW.length - 1];
  const [bwInput, setBwInput] = useState<string>(() =>
    latestBW
      ? String(kgToDisplay(latestBW.bodyweightKg, bwInputUnit))
      : bwInputUnit === 'kg'
      ? '78.0'
      : '172.0'
  );

  React.useEffect(() => {
    setBwInput(
      latestBW
        ? String(kgToDisplay(latestBW.bodyweightKg, bwInputUnit))
        : bwInputUnit === 'kg'
        ? '78.0'
        : '172.0'
    );
  }, [bwInputUnit, latestBW?.bodyweightKg]);

  const weightSeries = useMemo(() => {
    const alpha = 2 / (7 + 1);
    let emaKg = chronologicalBW[0]?.bodyweightKg ?? 0;

    return chronologicalBW.map((entry, idx) => {
      if (idx === 0) {
        emaKg = entry.bodyweightKg;
      } else {
        emaKg = entry.bodyweightKg * alpha + emaKg * (1 - alpha);
      }
      return {
        id: entry.id,
        date: entry.date,
        shortDate: formatShortDate(entry.date),
        scaleVal: kgToDisplay(entry.bodyweightKg, unit),
        trendVal: kgToDisplay(emaKg, unit),
      };
    });
  }, [chronologicalBW, unit]);

  const handleSaveWeighIn = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(bwInput);
    if (isNaN(val) || val <= 0) return;
    onAddBodyweight({
      date: new Date().toISOString().slice(0, 10),
      bodyweightKg: displayToKg(val, bwInputUnit),
    });
    setShowWeighIn(false);
  };

  const svgW = 360;
  const svgH = 150;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const allWeights = weightSeries.flatMap((d) => [d.scaleVal, d.trendVal]);
  const minW = allWeights.length ? Math.min(...allWeights) - 0.5 : 60;
  const maxW = allWeights.length ? Math.max(...allWeights) + 0.5 : 85;

  const bwCoords = weightSeries.map((d, i) => {
    const x =
      weightSeries.length <= 1
        ? padL + plotW / 2
        : padL + (i / (weightSeries.length - 1)) * plotW;
    const yScale = padT + plotH - ((d.scaleVal - minW) / Math.max(0.1, maxW - minW)) * plotH;
    const yTrend = padT + plotH - ((d.trendVal - minW) / Math.max(0.1, maxW - minW)) * plotH;
    return { x, yScale, yTrend, ...d };
  });

  const trendPolyline = bwCoords.map((c) => `${c.x.toFixed(1)},${c.yTrend.toFixed(1)}`).join(' ');
  const latestTrend = bwCoords[bwCoords.length - 1]?.trendVal ?? 0;
  const firstTrend = bwCoords[0]?.trendVal ?? 0;
  const trendDelta = Number((latestTrend - firstTrend).toFixed(1));

  return (
    <div className="space-y-4 pb-6">
      {/* Page Title */}
      <div className="px-0.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Summary
        </h1>
      </div>

      {/* Lift Progression Card (Dynamically themed by Exercise Split: Push Red, Pull Teal, Legs Purple) */}
      <div
        className={`af-card p-4 sm:p-5 space-y-3.5 transition-all ${spotlightPalette.cardBorderClass}`}
        style={spotlightPalette.cardGlowStyle}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Custom Exercise Selector Trigger Button */}
          <button
            type="button"
            onClick={() => setShowExercisePicker((v) => !v)}
            className="flex items-center gap-2 min-w-0 bg-[#2c2c2e]/85 hover:bg-[#3a3a3c] border border-white/[0.08] rounded-xl px-3 py-1.5 transition text-left group"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${spotlightPalette.hex}22` }}
            >
              <TrendingUp
                className="w-3.5 h-3.5"
                style={{ color: spotlightPalette.hex }}
              />
            </div>
            <span className="text-sm sm:text-base font-bold text-white truncate">
              {spotlightExercise.name}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#8e8e93] group-hover:text-white shrink-0 transition-transform ${
                showExercisePicker ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>

          <div className="flex items-center bg-[#2c2c2e] p-0.5 rounded-[10px] text-[11px] shrink-0">
            {[
              { label: '1M', days: 30 },
              { label: '3M', days: 90 },
              { label: '6M', days: 180 },
              { label: 'ALL', days: null },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setDaysFilter(item.days)}
                className={`px-2 py-1 rounded-[8px] font-semibold transition ${
                  daysFilter === item.days
                    ? 'bg-[#636366] text-white'
                    : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Searchable Exercise Picker Panel */}
        {showExercisePicker && (
          <div className="bg-black/75 border border-white/10 rounded-2xl p-3 space-y-2.5 shadow-2xl">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search exercise, muscle, or equipment..."
                  value={exerciseSearchQuery}
                  onChange={(e) => setExerciseSearchQuery(e.target.value)}
                  className="w-full bg-[#1c1c1e] border border-white/10 rounded-xl pl-8 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-[#a4ff00]"
                />
                {exerciseSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setExerciseSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center bg-[#1c1c1e] p-0.5 rounded-xl text-[11px] gap-0.5 shrink-0 overflow-x-auto">
                {(['Logged', 'All', 'Push', 'Pull', 'Legs'] as const).map((cat) => {
                  const isActive = pickerSplitFilter === cat;
                  const activeCls =
                    cat === 'Logged'
                      ? 'bg-[#a4ff00] text-black font-bold'
                      : cat === 'All'
                      ? 'bg-[#3a3a3c] text-white font-bold'
                      : getSplitPalette(cat).solidPillClass;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPickerSplitFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition ${
                        isActive ? activeCls : 'text-[#8e8e93] hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {filteredPickerExercises.length === 0 ? (
                <div className="text-xs text-[#8e8e93] text-center py-4 space-y-1.5">
                  <div>
                    {pickerSplitFilter === 'Logged' && !exerciseSearchQuery
                      ? 'No logged exercises yet'
                      : `No exercises match "${exerciseSearchQuery}"`}
                  </div>
                  {pickerSplitFilter === 'Logged' && (
                    <button
                      type="button"
                      onClick={() => setPickerSplitFilter('All')}
                      className="text-[11px] font-bold text-[#a4ff00] hover:underline"
                    >
                      Show All Exercises
                    </button>
                  )}
                </div>
              ) : (
                filteredPickerExercises.map((ex) => {
                  const isSelected = ex.id === spotlightExercise.id;
                  const exPal = getMusclePalette(ex.primaryMuscle);
                  const stats = exerciseSessionCounts.get(ex.id);

                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => {
                        setSpotlightExId(ex.id);
                        setShowExercisePicker(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition ${
                        isSelected
                          ? 'bg-[#2c2c2e] ring-1 ring-white/25'
                          : 'hover:bg-[#1c1c1e]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: exPal.hex }}
                        />
                        <span className="text-xs font-bold text-white truncate">
                          {ex.name}
                        </span>
                        <span className="text-[10px] text-[#8e8e93] capitalize hidden sm:inline">
                          • {ex.equipment.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono-num">
                        {stats ? (
                          <span className="text-[10px] text-[#8e8e93]">
                            1RM{' '}
                            <strong className="text-white">
                              {kgToDisplay(stats.best1RMKg, unit)} {unit}
                            </strong>{' '}
                            ({stats.sessions})
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#48484a]">
                            No logs
                          </span>
                        )}
                        {isSelected && (
                          <Check
                            className="w-3.5 h-3.5"
                            style={{ color: exPal.hex }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Quick Key Lift Chips colored by Split + Search Trigger */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setShowExercisePicker((v) => !v)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all inline-flex items-center gap-1 ${
              showExercisePicker
                ? 'bg-white text-black font-bold'
                : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
            }`}
          >
            <Search className="w-3 h-3" /> Search ({exercises.length})
          </button>

          {KEY_LIFTS.map((item) => {
            const active = spotlightExercise.id === item.id;
            const exObj = exerciseMap.get(item.id);
            const chipPalette = exObj
              ? getMusclePalette(exObj.primaryMuscle)
              : spotlightPalette;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSpotlightExId(item.id);
                  setShowExercisePicker(false);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  active
                    ? chipPalette.solidPillClass
                    : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
                }`}
              >
                {!active && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: chipPalette.hex }}
                  />
                )}
                {item.short}
              </button>
            );
          })}
        </div>

        {/* Main Interactive Spline Chart */}
        <ProgressionChart
          data={progressionSeries}
          unit={unit}
          splitKey={spotlightPalette.key}
          height={175}
        />

        {/* Footer Bar: Shows Statistical Target only when warranted by multi-session stats */}
        <div className="flex items-center justify-between gap-2 bg-[#2c2c2e]/70 rounded-[14px] px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {statDiag.hasMeaningfulInsight &&
            (statDiag.status === 'overload_weight' ||
              statDiag.status === 'pr_momentum') ? (
              <>
                <Sparkles
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: spotlightPalette.hex }}
                />
                <span className="text-xs text-[#8e8e93] truncate">
                  Suggested Target ({statDiag.statBadge}):{' '}
                  <strong className="text-white font-mono-num">
                    {formatWeight(statDiag.recommendedWeightKg, unit)} ×{' '}
                    {statDiag.recommendedReps}
                  </strong>
                </span>
              </>
            ) : (
              <span className="text-xs text-[#8e8e93] truncate">
                Target Range:{' '}
                <strong className="text-white font-mono-num">
                  {spotlightExercise.targetRepRange[0]}–
                  {spotlightExercise.targetRepRange[1]} reps
                </strong>
                {statDiag.lastWeightKg !== null && (
                  <>
                    {' • '}Last:{' '}
                    <strong className="text-white font-mono-num">
                      {formatWeight(statDiag.lastWeightKg, unit)} ×{' '}
                      {statDiag.lastReps}
                    </strong>
                  </>
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenExerciseDetail(spotlightExercise.id)}
            className={`inline-flex items-center gap-0.5 text-xs font-semibold shrink-0 ${spotlightPalette.textClass}`}
          >
            Show More <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Muscle Group Hypertrophy Heatmap */}
      <div className="af-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            Muscle Volume
          </h2>

          <div className="flex items-center bg-[#2c2c2e] p-0.5 rounded-[10px] text-[11px]">
            <button
              type="button"
              onClick={() => setHeatmapWindowDays(7)}
              className={`px-2.5 py-1 rounded-[8px] font-semibold transition ${
                heatmapWindowDays === 7
                  ? 'bg-[#636366] text-white'
                  : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setHeatmapWindowDays(28)}
              className={`px-2.5 py-1 rounded-[8px] font-semibold transition ${
                heatmapWindowDays === 28
                  ? 'bg-[#636366] text-white'
                  : 'text-[#8e8e93] hover:text-white'
              }`}
            >
              4w Avg
            </button>
          </div>
        </div>

        <MuscleHeatmap
          volumes={muscleVolumes}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={setSelectedMuscle}
        />
      </div>

      {/* Bodyweight Trend (7-Day EMA + Scale Weight) */}
      <div className="af-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <Scale className="w-4 h-4 text-[#a4ff00]" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Bodyweight Trend
              </h2>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-bold font-mono-num text-white leading-none">
                {latestTrend} <span className="text-xs font-semibold uppercase text-[#8e8e93]">{unit}</span>
              </span>
              {bwCoords.length > 1 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#a4ff00]/15 text-[#a4ff00]">
                  {trendDelta >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {trendDelta >= 0 ? `+${trendDelta}` : trendDelta} {unit}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWeighIn(!showWeighIn)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white font-semibold text-xs transition"
            >
              <Plus className="w-3.5 h-3.5 text-[#a4ff00]" /> Weigh-In
            </button>
          </div>
        </div>

        {showWeighIn && (
          <form
            onSubmit={handleSaveWeighIn}
            className="flex items-center gap-2 bg-[#2c2c2e] rounded-2xl p-2.5 flex-wrap"
          >
            <span className="text-xs font-semibold text-[#8e8e93] pl-1">
              Weight:
            </span>
            <input
              type="number"
              step="0.1"
              required
              value={bwInput}
              onChange={(e) => setBwInput(e.target.value)}
              className="w-24 bg-[#1c1c1e] rounded-xl px-3 py-1.5 text-sm font-mono-num font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#a4ff00]"
            />
            <div className="inline-flex items-center bg-[#1c1c1e] p-0.5 rounded-full text-[10px] font-mono-num font-bold">
              <button
                type="button"
                onClick={() => setBwInputUnit('kg')}
                className={`px-2 py-0.5 rounded-full transition ${
                  bwInputUnit === 'kg'
                    ? 'bg-[#a4ff00] text-black'
                    : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                KG
              </button>
              <button
                type="button"
                onClick={() => setBwInputUnit('lbs')}
                className={`px-2 py-0.5 rounded-full transition ${
                  bwInputUnit === 'lbs'
                    ? 'bg-[#a4ff00] text-black'
                    : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                LB
              </button>
            </div>
            <button
              type="submit"
              className="ml-auto px-4 py-1.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs"
            >
              Save
            </button>
          </form>
        )}

        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto overflow-visible">
          {[0, 0.5, 1].map((t, idx) => {
            const val = Number((minW + t * (maxW - minW)).toFixed(1));
            const y = padT + plotH - t * plotH;
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={y}
                  x2={svgW - padR}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray={idx === 0 ? undefined : '3 3'}
                />
                <text
                  x={padL - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#8e8e93] text-[9px] font-mono-num"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {bwCoords.map((c) => (
            <g key={c.id}>
              <line
                x1={c.x}
                y1={c.yScale}
                x2={c.x}
                y2={c.yTrend}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1"
              />
              <circle cx={c.x} cy={c.yScale} r="2.5" fill="#636366" />
            </g>
          ))}

          {bwCoords.length > 1 && (
            <polyline
              fill="none"
              stroke="#a4ff00"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={trendPolyline}
            />
          )}

          {bwCoords.map((c, idx) => {
            const showDate =
              idx === 0 ||
              idx === bwCoords.length - 1 ||
              idx === Math.floor(bwCoords.length / 2);
            return (
              <g key={`lbl-${c.id}`}>
                <circle
                  cx={c.x}
                  cy={c.yTrend}
                  r={idx === bwCoords.length - 1 ? 4 : 2.2}
                  fill="#a4ff00"
                />
                {showDate && (
                  <text
                    x={c.x}
                    y={svgH - 4}
                    textAnchor={
                      idx === 0 ? 'start' : idx === bwCoords.length - 1 ? 'end' : 'middle'
                    }
                    className="fill-[#8e8e93] text-[9px]"
                  >
                    {c.shortDate}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

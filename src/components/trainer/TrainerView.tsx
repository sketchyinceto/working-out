import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  Flame,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Exercise,
  Routine,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import { MUSCLE_CATEGORY_MAP, MUSCLE_LABELS } from '../../data/seedExercises';
import { kgToDisplay } from '../../utils/calculators';
import { getMusclePalette, getSplitPalette } from '../../utils/splitTheme';
import {
  ExercisePrescription,
  generateTrainerEvaluation,
  ProgressionStatus,
} from '../../utils/trainerEngine';

interface TrainerViewProps {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  routines: Routine[];
  unit: WeightUnit;
  onStartCoachedRoutine: (
    routine: Routine,
    prescriptions: ExercisePrescription[]
  ) => void;
  onAddExerciseToRoutine: (routineId: string, exercise: Exercise) => void;
  onSwapExerciseInRoutine: (
    routineId: string,
    oldExerciseId: string,
    newExercise: Exercise
  ) => void;
  onOpenExerciseDetail: (exerciseId: string) => void;
}

export const TrainerView: React.FC<TrainerViewProps> = ({
  workouts,
  exercises,
  routines,
  unit,
  onStartCoachedRoutine,
  onAddExerciseToRoutine,
  onSwapExerciseInRoutine,
  onOpenExerciseDetail,
}) => {
  const [splitFilter, setSplitFilter] = useState<'All' | 'Push' | 'Pull' | 'Legs'>(
    'All'
  );
  const [appliedActionIds, setAppliedActionIds] = useState<Record<string, boolean>>(
    {}
  );
  const [selectedTimeIdx, setSelectedTimeIdx] = useState<number | null>(null);
  const [focusedSeriesKey, setFocusedSeriesKey] = useState<string | null>(null);

  const report = useMemo(
    () => generateTrainerEvaluation(workouts, exercises, routines, unit),
    [workouts, exercises, routines, unit]
  );

  const filteredDiagnostics = useMemo(() => {
    return report.exerciseDiagnostics.filter(
      (d) =>
        d.hasMeaningfulInsight &&
        (d.status === 'regression' ||
          d.status === 'plateau' ||
          d.status === 'fatigue_dropoff' ||
          d.status === 'overload_weight' ||
          d.status === 'pr_momentum') &&
        (splitFilter === 'All' ||
          MUSCLE_CATEGORY_MAP[d.exercise.primaryMuscle] === splitFilter)
    );
  }, [report.exerciseDiagnostics, splitFilter]);

  const getStatusBadge = (status: ProgressionStatus) => {
    switch (status) {
      case 'regression':
        return {
          label: '1RM Dip',
          className: 'bg-[#fa114f]/20 text-[#ff375f] border border-[#fa114f]/40',
        };
      case 'plateau':
        return {
          label: 'Plateau',
          className: 'bg-[#fa114f]/20 text-[#ff375f] border border-[#fa114f]/40',
        };
      case 'fatigue_dropoff':
        return {
          label: 'Set Fatigue Drop',
          className: 'bg-[#ffe620]/20 text-[#ffe620] border border-[#ffe620]/40',
        };
      case 'overload_weight':
        return {
          label: 'Ceiling Cleared',
          className: 'bg-[#a4ff00]/20 text-[#a4ff00] border border-[#a4ff00]/40',
        };
      case 'pr_momentum':
        return {
          label: 'Breakout Trend',
          className: 'bg-[#00f5ea]/20 text-[#00f5ea] border border-[#00f5ea]/40',
        };
      case 'build_reps':
        return {
          label: 'Steady',
          className: 'bg-white/10 text-[#8e8e93] border border-white/10',
        };
      case 'baseline':
        return {
          label: 'Baseline',
          className: 'bg-[#2c2c2e] text-[#8e8e93]',
        };
    }
  };

  // Ring SVG math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (report.overallScore / 100) * circumference;

  const history = report.scoreHistory;
  const activeTimeIndex =
    selectedTimeIdx !== null && selectedTimeIdx < history.length
      ? selectedTimeIdx
      : Math.max(0, history.length - 1);
  const activeTimePoint = history[activeTimeIndex];

  const seriesConfig = [
    {
      key: 'overloadScore' as const,
      label: 'Overload Rate',
      shortLabel: 'Overload',
      color: '#a4ff00',
    },
    {
      key: 'consistencyScore' as const,
      label: 'Consistency',
      shortLabel: 'Consistency',
      color: '#00f5ea',
    },
    {
      key: 'balanceScore' as const,
      label: 'Muscle Balance',
      shortLabel: 'Balance',
      color: '#bf5af2',
    },
    {
      key: 'strengthScore' as const,
      label: 'Strength Score',
      shortLabel: 'Strength',
      color: '#fa114f',
    },
  ];

  // Unified 4-Line Time-Series Spline Graph (0-100 across time)
  const chartW = 380;
  const chartH = 185;
  const padL = 30;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const getPointX = (idx: number) =>
    history.length <= 1
      ? padL + plotW / 2
      : padL + (idx / (history.length - 1)) * plotW;

  const getScoreY = (score: number) =>
    padT + plotH - (Math.max(0, Math.min(100, score)) / 100) * plotH;

  const buildSmoothSpline = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2)
      return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      let cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      let cp2y = p2.y - (p3.y - p1.y) / 6;

      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      cp1y = Math.max(minY, Math.min(maxY, cp1y));
      cp2y = Math.max(minY, Math.min(maxY, cp2y));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1
      )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const seriesPaths = seriesConfig.map((s) => {
    const coords = history.map((pt, idx) => ({
      x: getPointX(idx),
      y: getScoreY(pt[s.key]),
      val: pt[s.key],
    }));
    const linePath = buildSmoothSpline(coords);
    const areaPath =
      coords.length > 1
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(
            padT + plotH
          ).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(
            1
          )} Z`
        : '';
    return { ...s, coords, linePath, areaPath };
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Page Header */}
      <div className="px-0.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Trainer
        </h1>
      </div>

      {/* 1. Performance Evaluation Scorecard + 4-Line Time-Series Graph (0-100) */}
      <div
        style={{
          backgroundImage:
            'radial-gradient(120% 95% at 0% 0%, rgba(164, 255, 0, 0.14) 0%, rgba(28, 28, 30, 0) 65%)',
        }}
        className="af-card border border-[#a4ff00]/25 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Apple Fitness Performance Ring */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="#2c2c2e"
                  strokeWidth="8"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  stroke="#a4ff00"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold font-mono-num text-white leading-none">
                  {report.overallScore}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-[#a4ff00] mt-0.5">
                  / 100
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8e8e93]">
                  Overall Score
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#a4ff00]/15 text-[#a4ff00]">
                  {report.gradeLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">
                {report.coachSummary}
              </p>
            </div>
          </div>
        </div>

        {/* 4-Line Time-Series Spline Graph: Overload Rate, Consistency, Muscle Balance, Strength Score */}
        <div className="bg-black/55 border border-white/[0.06] rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8e8e93]">
            <span>Performance Trends (0–100)</span>
            <span className="text-white font-mono-num">
              Week: {activeTimePoint?.weekLabel || 'Now'}
            </span>
          </div>

          {/* Interactive 4-Metric Legend Pills showing live /100 scores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {seriesConfig.map((s) => {
              const val = activeTimePoint ? activeTimePoint[s.key] : 0;
              const isFocused = focusedSeriesKey === s.key;
              const isDimmed =
                focusedSeriesKey !== null && focusedSeriesKey !== s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() =>
                    setFocusedSeriesKey(isFocused ? null : s.key)
                  }
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#1c1c1e] border transition text-left ${
                    isFocused
                      ? 'border-white/50 ring-1 ring-white/30'
                      : 'border-white/[0.06] hover:border-white/20'
                  } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-[11px] font-semibold text-[#d1d1d6] truncate">
                      {s.shortLabel}
                    </span>
                  </span>
                  <span
                    className="text-xs font-extrabold font-mono-num ml-1.5 shrink-0"
                    style={{ color: s.color }}
                  >
                    {val}
                    <span className="text-[9px] text-[#8e8e93] font-normal">
                      /100
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              {seriesPaths.map((s) => (
                <linearGradient
                  key={`area-${s.key}`}
                  id={`area-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal Y-Axis Gridlines (0, 25, 50, 75, 100) */}
            {[0, 25, 50, 75, 100].map((val) => {
              const y = getScoreY(val);
              return (
                <g key={val}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={chartW - padR}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.07)"
                    strokeDasharray={val === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[#8e8e93] text-[9px] font-mono-num"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Vertical Cursor Line for Selected Week */}
            {history.length > 0 && (
              <line
                x1={getPointX(activeTimeIndex)}
                y1={padT}
                x2={getPointX(activeTimeIndex)}
                y2={padT + plotH}
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )}

            {/* Optional subtle area fill when a single metric is focused */}
            {seriesPaths.map((s) =>
              focusedSeriesKey === s.key && s.areaPath ? (
                <path
                  key={`fill-${s.key}`}
                  d={s.areaPath}
                  fill={`url(#area-${s.key})`}
                />
              ) : null
            )}

            {/* 4 Smooth Spline Curves Across Time */}
            {seriesPaths.map((s) => {
              const isDimmed =
                focusedSeriesKey !== null && focusedSeriesKey !== s.key;
              const isFocused = focusedSeriesKey === s.key;
              return (
                <g
                  key={s.key}
                  style={{ opacity: isDimmed ? 0.22 : 1 }}
                  className="transition-opacity duration-200"
                >
                  <path
                    d={s.linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={isFocused ? 3.2 : 2.35}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {s.coords.map((pt, idx) => {
                    const isSelectedPt = idx === activeTimeIndex;
                    return (
                      <circle
                        key={`${s.key}-${idx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelectedPt ? 4 : 2.3}
                        fill={isSelectedPt ? '#ffffff' : s.color}
                        stroke={s.color}
                        strokeWidth={isSelectedPt ? 2.2 : 1}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* X-Axis Date Labels & Interactive Hit Columns */}
            {history.map((pt, idx) => {
              const x = getPointX(idx);
              const showLabel =
                idx === 0 ||
                idx === history.length - 1 ||
                idx % 2 === 0 ||
                idx === activeTimeIndex;
              const colW = plotW / Math.max(1, history.length);
              return (
                <g key={pt.weekStartISO}>
                  {showLabel && (
                    <text
                      x={x}
                      y={chartH - 6}
                      textAnchor={
                        idx === 0
                          ? 'start'
                          : idx === history.length - 1
                          ? 'end'
                          : 'middle'
                      }
                      className={`text-[9px] font-mono-num ${
                        idx === activeTimeIndex
                          ? 'fill-white font-bold'
                          : 'fill-[#8e8e93]'
                      }`}
                    >
                      {pt.weekLabel}
                    </text>
                  )}
                  <rect
                    x={x - colW / 2}
                    y={padT}
                    width={colW}
                    height={plotH + 20}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setSelectedTimeIdx(idx)}
                    onClick={() => setSelectedTimeIdx(idx)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Key Coach Insights Strip */}
        {report.coachingTips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            {report.coachingTips.map((tip) => {
              const tipPalette = getSplitPalette(tip.splitKey);
              return (
                <div
                  key={tip.id}
                  style={tipPalette.cardGlowStyle}
                  className={`rounded-2xl bg-black/55 border ${tipPalette.cardBorderClass} p-3 space-y-1.5`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tipPalette.badgeClass}`}
                    >
                      {tip.splitKey === 'Neutral' ? 'Recovery' : tip.splitKey}
                    </span>
                    <span className="text-[11px] font-mono-num font-bold text-white">
                      {tip.metricBadge}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">{tip.title}</div>
                  <p className="text-[11px] text-[#8e8e93] leading-snug">
                    {tip.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Statistical Lift Trends & Split Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <div className="inline-flex items-center gap-1.5 px-1 text-sm font-bold text-white">
          <TrendingUp className="w-4 h-4 text-[#a4ff00]" />
          <span>Lift Trends ({filteredDiagnostics.length})</span>
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
                className={`py-1 px-2.5 rounded-[8px] font-semibold transition ${
                  isActive ? activeClass : 'text-[#8e8e93] hover:text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Statistical Lift Insights (Only meaningful trends) */}
      {filteredDiagnostics.length === 0 ? (
          <div className="af-card border border-white/[0.06] p-6 text-center space-y-2">
            <div className="text-sm font-bold text-white">
              No Statistical Anomalies Detected
            </div>
            <p className="text-xs text-[#8e8e93] max-w-md mx-auto leading-relaxed">
              Coach insights only appear when multi-session data (≥3 sessions) reveals a statistically significant trend — such as a 1RM plateau, intra-session set fatigue drop-off, strength regression, or full rep-ceiling graduation.
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredDiagnostics.map((diag) => {
            const exPalette = getMusclePalette(diag.exercise.primaryMuscle);
            const badge = getStatusBadge(diag.status);
            const targetRoutine = routines.find(
              (r) =>
                r.splitTag === MUSCLE_CATEGORY_MAP[diag.exercise.primaryMuscle] &&
                r.exercises.some((e) => e.exerciseId === diag.exercise.id)
            );
            const swapKey = `swap-${diag.exercise.id}`;
            const isSwapped = !!appliedActionIds[swapKey];

            return (
              <div
                key={diag.exercise.id}
                style={exPalette.cardGlowStyle}
                className={`af-card border ${exPalette.cardBorderClass} p-4 space-y-3 flex flex-col justify-between`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${exPalette.badgeClass}`}
                        >
                          {MUSCLE_LABELS[diag.exercise.primaryMuscle]}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-[10px] font-mono-num text-[#8e8e93] bg-black/45 px-2 py-0.5 rounded-full">
                          {diag.statBadge}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenExerciseDetail(diag.exercise.id)}
                        className="text-sm font-bold text-white hover:underline mt-1 text-left truncate block w-full"
                      >
                        {diag.exercise.name}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenExerciseDetail(diag.exercise.id)}
                      className="p-1.5 rounded-full bg-[#2c2c2e] text-[#8e8e93] hover:text-white shrink-0"
                      title="View chart"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Last Performance & Statistical Target (only shown when statistically justified) */}
                  {diag.status === 'overload_weight' ||
                  diag.status === 'pr_momentum' ||
                  diag.status === 'regression' ? (
                    <div className="grid grid-cols-2 gap-2 bg-black/45 rounded-xl p-2.5 font-mono-num">
                      <div>
                        <div className="text-[10px] uppercase text-[#8e8e93]">
                          Last ({diag.lastDateStr})
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                          {diag.lastWeightKg !== null
                            ? `${kgToDisplay(diag.lastWeightKg, unit)} ${unit} × ${diag.lastReps}`
                            : 'No history'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[#8e8e93]">
                          Statistical Target
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-bold ${exPalette.textClass} mt-0.5`}
                        >
                          {kgToDisplay(diag.recommendedWeightKg, unit)} {unit} ×{' '}
                          {diag.recommendedReps}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-black/45 rounded-xl px-3 py-2 font-mono-num text-xs">
                      <span className="text-[10px] uppercase text-[#8e8e93]">
                        Last Logged ({diag.lastDateStr})
                      </span>
                      <span className="font-bold text-white">
                        {diag.lastWeightKg !== null
                          ? `${kgToDisplay(diag.lastWeightKg, unit)} ${unit} × ${diag.lastReps}`
                          : 'No history'}
                      </span>
                    </div>
                  )}

                  {/* Statistical Headline + Coach Insight */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">
                      {diag.headline}
                    </div>
                    <p className="text-xs text-[#d1d1d6] leading-relaxed">
                      {diag.coachTip}
                    </p>
                  </div>
                </div>

                {/* Alternative Exercise Suggestion (only shown for Plateaus or Regressions) */}
                {diag.suggestedSwapExercise &&
                  (diag.status === 'plateau' || diag.status === 'regression') && (
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="text-[11px] text-[#8e8e93] truncate">
                      Alt Variation:{' '}
                      <strong className="text-white">
                        {diag.suggestedSwapExercise.name}
                      </strong>
                    </div>
                    {targetRoutine && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!diag.suggestedSwapExercise) return;
                          onSwapExerciseInRoutine(
                            targetRoutine.id,
                            diag.exercise.id,
                            diag.suggestedSwapExercise
                          );
                          setAppliedActionIds((prev) => ({
                            ...prev,
                            [swapKey]: true,
                          }));
                        }}
                        className="px-2.5 py-1 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[10px] font-bold text-white inline-flex items-center gap-1 shrink-0 transition"
                      >
                        {isSwapped ? (
                          <>
                            <Check className="w-3 h-3 text-[#a4ff00]" /> Swapped
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" /> Swap in Routine
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

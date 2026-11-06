import React, { useState, useMemo } from 'react';
import { Award, TrendingUp, Calendar } from 'lucide-react';
import { ExerciseSessionDataPoint } from '../../utils/analytics';
import { WeightUnit } from '../../types/workout';
import { kgToDisplay } from '../../utils/calculators';
import { SPLIT_PALETTES, SplitPaletteKey } from '../../utils/splitTheme';

export type ChartMetric = 'e1rm' | 'weight' | 'volume';

interface ProgressionChartProps {
  data: ExerciseSessionDataPoint[];
  unit: WeightUnit;
  splitKey?: SplitPaletteKey;
  height?: number;
}

function buildSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const ctrlX1 = curr.x + (next.x - curr.x) * 0.45;
    const ctrlY1 = curr.y;
    const ctrlX2 = curr.x + (next.x - curr.x) * 0.55;
    const ctrlY2 = next.y;
    d += ` C ${ctrlX1.toFixed(1)} ${ctrlY1.toFixed(1)}, ${ctrlX2.toFixed(1)} ${ctrlY2.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return d;
}

export const ProgressionChart: React.FC<ProgressionChartProps> = ({
  data,
  unit,
  splitKey = 'Neutral',
  height = 175,
}) => {
  const [metric, setMetric] = useState<ChartMetric>('e1rm');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const palette = SPLIT_PALETTES[splitKey];

  const values = useMemo(() => {
    return data.map((d) => {
      if (metric === 'e1rm') return kgToDisplay(d.bestE1RMKg, unit);
      if (metric === 'weight') return kgToDisplay(d.heaviestWeightKg, unit);
      return kgToDisplay(d.totalSessionVolumeKg, unit);
    });
  }, [data, metric, unit]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-2xl bg-black/40 border border-white/[0.06] text-[#8e8e93] text-xs">
        <Calendar className="w-5 h-5 mb-1.5 text-[#8e8e93]" />
        No logged sets for this timeframe
      </div>
    );
  }

  const activeIdx =
    selectedIndex !== null && selectedIndex < data.length
      ? selectedIndex
      : data.length - 1;
  const activePoint = data[activeIdx];
  const activeValue = values[activeIdx];

  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const deltaVal = Number((lastVal - firstVal).toFixed(1));
  const deltaPct =
    firstVal > 0 ? Number(((deltaVal / firstVal) * 100).toFixed(1)) : 0;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const spread = Math.max(maxVal - minVal, maxVal * 0.08, 5);
  const yMin = Math.max(0, minVal - spread * 0.25);
  const yMax = maxVal + spread * 0.2;

  const svgWidth = 360;
  const svgHeight = height;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 24;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const coords = values.map((val, i) => {
    const x =
      data.length === 1
        ? padLeft + plotW / 2
        : padLeft + (i / (data.length - 1)) * plotW;
    const normY = yMax === yMin ? 0.5 : (val - yMin) / (yMax - yMin);
    const y = padTop + plotH - normY * plotH;
    return { x, y, val, raw: data[i] };
  });

  const linePath = buildSmoothSvgPath(coords);
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.5, 1].map((t) => {
    const val = yMin + t * (yMax - yMin);
    const y = padTop + plotH - t * plotH;
    return {
      val: metric === 'volume' ? Math.round(val) : Number(val.toFixed(1)),
      y,
    };
  });

  const gradientId = `prog-grad-${splitKey}-${metric}`;

  return (
    <div className="space-y-2.5">
      {/* Apple Fitness Style Readout Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-bold font-mono-num text-white leading-none">
              {activeValue.toLocaleString()}{' '}
              <span className="text-xs font-semibold uppercase text-[#8e8e93]">{unit}</span>
            </span>
            {data.length > 1 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  deltaVal >= 0
                    ? palette.badgeClass
                    : 'bg-[#2c2c2e] text-[#8e8e93]'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                {deltaVal >= 0 ? `+${deltaVal}` : deltaVal} ({deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] mt-1 truncate">
            <span>{activePoint.shortDate}</span>
            <span>•</span>
            <span className="text-white font-mono-num font-semibold">
              {kgToDisplay(activePoint.heaviestWeightKg, unit)}
              {unit} × {activePoint.bestWeightReps}
            </span>
            {activePoint.hasPR && (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${palette.textClass}`}>
                <Award className="w-3 h-3" /> PR
              </span>
            )}
          </div>
        </div>

        {/* iOS Segmented Control */}
        <div className="flex items-center bg-[#2c2c2e] p-0.5 rounded-[10px] text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => setMetric('e1rm')}
            className={`px-2.5 py-1 rounded-[8px] transition-all ${
              metric === 'e1rm' ? 'bg-[#636366] text-white font-semibold' : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            1RM
          </button>
          <button
            type="button"
            onClick={() => setMetric('weight')}
            className={`px-2.5 py-1 rounded-[8px] transition-all ${
              metric === 'weight' ? 'bg-[#636366] text-white font-semibold' : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Weight
          </button>
          <button
            type="button"
            onClick={() => setMetric('volume')}
            className={`px-2.5 py-1 rounded-[8px] transition-all ${
              metric === 'volume' ? 'bg-[#636366] text-white font-semibold' : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            Vol
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setSelectedIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.fillStart} />
              <stop offset="100%" stopColor={palette.fillEnd} />
            </linearGradient>
          </defs>

          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={svgWidth - padRight}
                y2={tick.y}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeDasharray={idx === 0 ? undefined : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-[#8e8e93] text-[9px] font-mono-num"
              >
                {tick.val >= 1000 ? `${(tick.val / 1000).toFixed(1)}k` : tick.val}
              </text>
            </g>
          ))}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          <path
            d={linePath}
            fill="none"
            stroke={palette.hex}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords[activeIdx] && (
            <line
              x1={coords[activeIdx].x}
              y1={padTop}
              x2={coords[activeIdx].x}
              y2={padTop + plotH}
              stroke="rgba(255, 255, 255, 0.22)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {coords.map((pt, idx) => {
            const isSelected = idx === activeIdx;
            const isPR = pt.raw.hasPR;
            const showDateLabel =
              idx === 0 ||
              idx === coords.length - 1 ||
              idx === Math.floor(coords.length / 2);

            return (
              <g
                key={pt.raw.sessionId}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => setSelectedIndex(idx)}
              >
                <rect
                  x={pt.x - Math.max(12, plotW / coords.length / 2)}
                  y={padTop}
                  width={Math.max(24, plotW / coords.length)}
                  height={plotH}
                  fill="transparent"
                />

                {(isSelected || isPR) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 7.5 : 5.5}
                    fill={palette.fillStart}
                  />
                )}

                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 4.5 : isPR ? 4 : 3}
                  fill={isPR ? palette.hex : '#000000'}
                  stroke={palette.hex}
                  strokeWidth={isSelected ? 2.2 : 1.75}
                />

                {showDateLabel && (
                  <text
                    x={pt.x}
                    y={svgHeight - 5}
                    textAnchor={
                      idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle'
                    }
                    className="fill-[#8e8e93] text-[9px] font-medium"
                  >
                    {pt.raw.shortDate}
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

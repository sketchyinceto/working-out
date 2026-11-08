import React from 'react';
import { ScoreHistoryPoint } from '../../utils/coach/scoring';

const SERIES = [
  { key: 'consistency', label: 'Consistency', color: '#00f5ea' },
  { key: 'progression', label: 'Progression', color: '#a4ff00' },
  { key: 'strength', label: 'Strength', color: '#ffe620' },
] as const;

const W = 320;
const H = 120;
const PAD_L = 22;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 18;

/** Weekly trend of three score parts (0–100) over the last few weeks. */
export const ScoreTrendChart: React.FC<{ points: ScoreHistoryPoint[] }> = ({ points }) => {
  if (points.length < 2) return null;
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / 100) * (H - PAD_T - PAD_B);

  const pathFor = (key: (typeof SERIES)[number]['key']) => {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = p[key];
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  const latest = points[points.length - 1];
  const summary = SERIES.map((s) => `${s.label} ${latest[s.key] ?? 'not enough data'}`).join(', ');

  return (
    <figure className="space-y-1.5">
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8e8e93]">
        <span className="font-bold uppercase tracking-wider">8-week trend</span>
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Score trend over the last ${points.length} weeks. Latest: ${summary}.`}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="#2c2c2e" strokeDasharray={v === 0 ? undefined : '3 3'} />
            <text x={PAD_L - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="#636366">
              {v}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || i % 2 === 1 ? (
            <text key={p.label} x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#636366">
              {p.label}
            </text>
          ) : null
        )}
        {SERIES.map((s) => (
          <g key={s.key}>
            <path d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              p[s.key] !== null ? (
                <circle key={i} cx={x(i)} cy={y(p[s.key] as number)} r={i === points.length - 1 ? 3 : 1.8} fill={s.color} />
              ) : null
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
};

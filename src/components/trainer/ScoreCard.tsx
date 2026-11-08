import React from 'react';
import { TrainerScore } from '../../utils/coach/scoring';

const GRADE_STYLE: Record<TrainerScore['grade'], string> = {
  Elite: 'bg-[#a4ff00]/15 text-[#a4ff00]',
  'On Track': 'bg-[#00f5ea]/15 text-[#00f5ea]',
  Building: 'bg-[#ffe620]/15 text-[#ffe620]',
  'Needs Work': 'bg-[#fa114f]/15 text-[#fa114f]',
  'Getting Started': 'bg-[#2c2c2e] text-[#8e8e93]',
};

const barColor = (score: number) =>
  score >= 85 ? 'bg-[#a4ff00]' : score >= 70 ? 'bg-[#00f5ea]' : score >= 50 ? 'bg-[#ffe620]' : 'bg-[#fa114f]';

interface ScoreCardProps {
  score: TrainerScore;
  children?: React.ReactNode;
}

/** Overall score ring, the four parts behind it, and (as children) the review. */
export const ScoreCard: React.FC<ScoreCardProps> = ({ score, children }) => {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const value = score.overall ?? 0;

  return (
    <section className="af-card p-4 space-y-4" aria-labelledby="score-title">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="#2c2c2e" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#a4ff00"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (value / 100) * circumference}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold font-mono-num text-white leading-none">
              {score.overall ?? '–'}
            </span>
            <span className="text-[9px] text-[#8e8e93]">/ 100</span>
          </div>
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h2 id="score-title" className="text-[11px] font-bold uppercase tracking-wider text-[#8e8e93]">
              Overall Score
            </h2>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${GRADE_STYLE[score.grade]}`}>
              {score.grade}
            </span>
          </div>
          <p className="text-xs text-[#d1d1d6] leading-snug">{score.summary}</p>
        </div>
      </div>

      {score.subscores.length > 0 && (
        <div className="space-y-2.5">
          {score.subscores.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  {s.label}
                  <span className="text-[#636366] font-normal"> · {Math.round(s.weight * 100)}%</span>
                </span>
                <span className="font-mono-num font-bold text-white">{s.score ?? '–'}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#2c2c2e] overflow-hidden mt-1">
                {s.score !== null && (
                  <div className={`h-full rounded-full ${barColor(s.score)}`} style={{ width: `${s.score}%` }} />
                )}
              </div>
              <p className="text-[11px] text-[#8e8e93] mt-1 leading-snug">{s.detail}</p>
            </div>
          ))}
        </div>
      )}

      {children}
    </section>
  );
};

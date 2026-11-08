import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react';
import { Exercise, WeightUnit } from '../../types/workout';
import { StallAlert } from '../../utils/coach/stalls';
import { kgToDisplay } from '../../utils/calculators';

interface StallAlertsProps {
  alerts: StallAlert[];
  unit: WeightUnit;
  onSwap: (alert: StallAlert, replacement: Exercise) => void;
  onOpenExerciseDetail: (exerciseId: string) => void;
}

/** Lifts that stopped progressing, each with concrete next steps. */
export const StallAlerts: React.FC<StallAlertsProps> = ({ alerts, unit, onSwap, onOpenExerciseDetail }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="af-card p-4 space-y-3" aria-labelledby="stall-title">
      <div>
        <h2 id="stall-title" className="text-sm font-bold text-white">
          Stall Alerts
        </h2>
        <p className="text-[11px] text-[#8e8e93]">
          Lifts with no progress in their last 3 sessions. Deload and test weeks are ignored.
        </p>
      </div>

      {alerts.length === 0 ? (
        <p className="text-xs text-[#d1d1d6] bg-black/40 rounded-xl px-3 py-2.5">
          Nothing stalled. Every lift you're training is still moving.
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const isOpen = openId === a.exercise.id;
            const Icon = a.kind === 'regression' ? TrendingDown : AlertTriangle;
            const color = a.kind === 'regression' ? 'text-[#fa114f]' : 'text-[#ffe620]';
            return (
              <div key={a.exercise.id} className="bg-black/40 rounded-xl p-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : a.exercise.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start gap-2 text-left"
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white leading-snug">{a.headline}</div>
                    <div className="text-[11px] text-[#8e8e93] font-mono-num">
                      Best est. 1RM {kgToDisplay(a.previousBestKg, unit)} {unit} · recent{' '}
                      {kgToDisplay(a.recentBestKg, unit)} {unit}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#8e8e93] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8e8e93] shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-2 pl-6">
                    {a.fixes.map((f, i) => (
                      <div key={f.title}>
                        <div className="text-xs font-semibold text-white">
                          {i + 1}. {f.title}
                        </div>
                        <div className="text-[11px] text-[#d1d1d6] leading-snug">{f.detail}</div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenExerciseDetail(a.exercise.id)}
                        className="px-3 py-1.5 rounded-full bg-[#2c2c2e] text-[11px] font-semibold text-white"
                      >
                        View history
                      </button>
                      {a.alternative && a.routineIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Replace ${a.exercise.name} with ${a.alternative!.name} in ${a.routineIds.length === 1 ? 'the routine that uses it' : `${a.routineIds.length} routines`}?`
                              )
                            ) {
                              onSwap(a, a.alternative!);
                            }
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#a4ff00] text-black text-[11px] font-bold"
                        >
                          Swap for {a.alternative.name}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

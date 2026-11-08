import React from 'react';
import { X } from 'lucide-react';
import { WeightUnit } from '../../types/workout';

interface QuickStepBarProps {
  field: 'weight' | 'reps';
  inputUnit: WeightUnit;
  onToggleUnit: () => void;
  onStep: (delta: number) => void;
  onClose: () => void;
}

const WEIGHT_STEPS: Record<WeightUnit, number[]> = {
  kg: [-2.5, -1.25, 1.25, 2.5, 5],
  lbs: [-5, -2.5, 2.5, 5, 10],
};
const REP_STEPS = [-2, -1, 1, 2];

/**
 * Thumb-reach +/- buttons shown while a weight or reps box is focused.
 * Buttons use onMouseDown + preventDefault so the input keeps focus.
 */
export const QuickStepBar: React.FC<QuickStepBarProps> = ({
  field,
  inputUnit,
  onToggleUnit,
  onStep,
  onClose,
}) => {
  const steps = field === 'weight' ? WEIGHT_STEPS[inputUnit] : REP_STEPS;
  return (
    <div className="fixed safe-above-nav inset-x-0 z-30 px-3 pb-2 pointer-events-none">
      <div className="max-w-md mx-auto bg-[#1c1c1e]/95 backdrop-blur-2xl border border-[#a4ff00]/40 rounded-full px-3.5 py-2 flex items-center justify-between gap-2 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#a4ff00]">
            {field === 'weight' ? inputUnit.toUpperCase() : 'Reps'}
          </span>
          {field === 'weight' && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onToggleUnit();
              }}
              className="px-2 py-0.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[9px] font-bold text-white transition"
            >
              {inputUnit === 'kg' ? 'Switch to LB' : 'Switch to KG'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {steps.map((step) => (
            <button
              key={step}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onStep(step);
              }}
              className="px-2.5 py-1 rounded-full bg-[#2c2c2e] active:bg-[#a4ff00] active:text-black text-xs font-mono-num font-bold text-white"
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide quick steps"
            className="p-1 text-[#8e8e93] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

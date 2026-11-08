import React, { useState } from 'react';
import { Check, FlaskConical, Plus } from 'lucide-react';
import { Exercise } from '../../types/workout';
import { SCIENTIFIC_ROUTINES, ScientificRoutinePreset } from '../../data/starterRoutines';
import { getSplitPalette } from '../../utils/splitTheme';
import { pluralize } from '../../utils/text';

const CATEGORIES = ['All', 'Upper / Lower', 'PPL', 'Full Body', 'Arnold Split'] as const;

interface ProvenRoutinesBrowserProps {
  exerciseMap: Map<string, Exercise>;
  onCustomize: (preset: ScientificRoutinePreset) => void;
  onQuickAdd: (preset: ScientificRoutinePreset) => void;
  onDone: () => void;
}

/** "Explore Proven" tab: evidence-based routines to add or customise. */
export const ProvenRoutinesBrowser: React.FC<ProvenRoutinesBrowserProps> = ({
  exerciseMap,
  onCustomize,
  onQuickAdd,
  onDone,
}) => {
  const [category, setCategory] = useState<'All' | ScientificRoutinePreset['programCategory']>('All');
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const presets = SCIENTIFIC_ROUTINES.filter(
    (p) => category === 'All' || p.programCategory === category
  );

  return (
    <div className="space-y-3 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
              category === cat
                ? 'bg-[#a4ff00] text-black font-bold'
                : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
        {presets.map((preset) => {
          const palette = getSplitPalette(preset.splitTag);
          return (
            <div
              key={preset.id}
              style={palette.cardGlowStyle}
              className={`bg-[#2c2c2e]/85 rounded-2xl p-3.5 space-y-2.5 border ${palette.cardBorderClass}`}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${palette.badgeClass}`}>
                    {preset.splitTag}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/50 text-[#8e8e93]">
                    {preset.programCategory}
                  </span>
                  <span className="text-[11px] text-[#8e8e93]">
                    • {pluralize(preset.exercises.length, 'exercise')}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{preset.name}</h4>
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-[#d1d1d6] bg-black/40 rounded-xl px-2.5 py-2">
                <FlaskConical className={`w-3.5 h-3.5 ${palette.textClass} shrink-0 mt-0.5`} />
                <span>{preset.evidenceNote}</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {preset.exercises.map((item) => {
                  const meta = exerciseMap.get(item.exerciseId);
                  if (!meta) return null;
                  return (
                    <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-[#8e8e93]">
                      <strong className="text-white font-mono-num">{item.targetSets}×</strong> {meta.name}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCustomize(preset)}
                  className="flex-1 py-2 rounded-full bg-black/50 hover:bg-black/80 text-white font-semibold text-xs transition"
                >
                  Customize
                </button>
                <button
                  type="button"
                  disabled={added[preset.id]}
                  onClick={() => {
                    onQuickAdd(preset);
                    setAdded((prev) => ({ ...prev, [preset.id]: true }));
                  }}
                  className={`flex-1 py-2 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1 transition ${palette.buttonClass}`}
                >
                  {added[preset.id] ? (
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
          onClick={onDone}
          className="px-4 py-2 rounded-full bg-[#2c2c2e] text-white text-xs font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
};

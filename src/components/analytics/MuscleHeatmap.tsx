import React from 'react';
import { MuscleGroup } from '../../types/workout';
import { MUSCLE_LABELS } from '../../data/seedExercises';
import { getMusclePalette, getMuscleVolumeShade } from '../../utils/splitTheme';

interface MuscleHeatmapProps {
  volumes: Record<MuscleGroup, number>;
  selectedMuscle: MuscleGroup | null;
  onSelectMuscle: (muscle: MuscleGroup | null) => void;
}

export const MuscleHeatmap: React.FC<MuscleHeatmapProps> = ({
  volumes,
  selectedMuscle,
  onSelectMuscle,
}) => {
  const sortedMuscles = (Object.keys(volumes) as MuscleGroup[])
    .filter((m) => m !== 'forearms' && m !== 'lower_back')
    .sort((a, b) => volumes[b] - volumes[a]);

  const toggleMuscle = (m: MuscleGroup) => {
    onSelectMuscle(selectedMuscle === m ? null : m);
  };

  const muscleColor = (m: MuscleGroup) =>
    getMuscleVolumeShade(m, volumes[m] || 0, selectedMuscle === m);

  const muscleStroke = (m: MuscleGroup) =>
    selectedMuscle === m ? '#ffffff' : '#0b0b0d';

  const muscleStrokeWidth = (m: MuscleGroup) =>
    selectedMuscle === m ? 1.8 : 1.25;

  const selectedPalette = selectedMuscle ? getMusclePalette(selectedMuscle) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
      {/* Anatomical Front & Back Body Diagrams */}
      <div className="lg:col-span-5 flex flex-col items-center bg-black/55 border border-white/[0.07] rounded-[20px] p-3.5 relative overflow-hidden">
        {/* Selected Muscle Floating Pill */}
        {selectedMuscle && selectedPalette && (
          <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 rounded-full bg-[#1c1c1e] border border-white/10 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedPalette.hex }}
              />
              {MUSCLE_LABELS[selectedMuscle]}
            </span>
            <span className={`font-mono-num font-bold ${selectedPalette.textClass}`}>
              {volumes[selectedMuscle]} sets
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 w-full place-items-center">
          {/* ==================== ANTERIOR (FRONT) ==================== */}
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 200 420"
              className="w-34 sm:w-40 h-auto select-none overflow-visible"
            >
              <defs>
                <radialGradient id="bodyAuraFront" cx="50%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
              </defs>
              <ellipse cx="100" cy="200" rx="85" ry="185" fill="url(#bodyAuraFront)" />

              {/* Base Anatomical Silhouette (Head, Neck, Hands, Knees, Feet) */}
              <g fill="#1c1c1e" stroke="rgba(255,255,255,0.12)" strokeWidth="1.1">
                {/* Head & Jawline */}
                <path d="M100 14 C86 14, 80 25, 81 39 C82 50, 88 59, 100 61 C112 59, 118 50, 119 39 C120 25, 114 14, 100 14 Z" />
                {/* Neck / Sternocleidomastoid */}
                <path d="M90 58 L90 73 L110 73 L110 58 Z" />
                {/* Hands */}
                <path d="M23 212 C18 220, 17 232, 22 237 C27 240, 33 234, 34 225 L32 212 Z" />
                <path d="M177 212 C182 220, 183 232, 178 237 C173 240, 167 234, 166 225 L168 212 Z" />
                {/* Knees & Lower Shins / Ankles / Feet */}
                <path d="M64 286 L88 286 L86 304 L65 304 Z" />
                <path d="M136 286 L112 286 L114 304 L135 304 Z" />
                <path d="M67 374 L82 374 L85 398 C85 403, 62 404, 61 398 Z" />
                <path d="M133 374 L118 374 L115 398 C115 403, 138 404, 139 398 Z" />
              </g>

              {/* Upper Traps (Anterior Collar Sweep) */}
              <g
                fill={muscleColor('upper_back')}
                stroke={muscleStroke('upper_back')}
                strokeWidth={muscleStrokeWidth('upper_back')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('upper_back')}
              >
                <path d="M89 65 L64 76 L88 79 Z" />
                <path d="M111 65 L136 76 L112 79 Z" />
              </g>

              {/* Pectoralis Major (Chest - Left & Right Sculpted Pecs) */}
              <g
                fill={muscleColor('chest')}
                stroke={muscleStroke('chest')}
                strokeWidth={muscleStrokeWidth('chest')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('chest')}
              >
                <path d="M62 79 L98 79 L98 122 C84 125, 67 121, 60 109 C58 98, 59 87, 62 79 Z" />
                <path d="M138 79 L102 79 L102 122 C116 125, 133 121, 140 109 C142 98, 141 87, 138 79 Z" />
              </g>

              {/* Anterior Deltoids (Front Delts) */}
              <g
                fill={muscleColor('front_delts')}
                stroke={muscleStroke('front_delts')}
                strokeWidth={muscleStrokeWidth('front_delts')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('front_delts')}
              >
                <path d="M62 77 C53 82, 49 95, 52 109 L60 107 C61 95, 61 85, 62 77 Z" />
                <path d="M138 77 C147 82, 151 95, 148 109 L140 107 C139 95, 139 85, 138 77 Z" />
              </g>

              {/* Lateral Deltoids (Side Delts - Outer 3D Cap) */}
              <g
                fill={muscleColor('side_delts')}
                stroke={muscleStroke('side_delts')}
                strokeWidth={muscleStrokeWidth('side_delts')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('side_delts')}
              >
                <path d="M58 76 C44 80, 38 96, 42 114 L52 109 C49 95, 52 82, 58 76 Z" />
                <path d="M142 76 C156 80, 162 96, 158 114 L148 109 C151 95, 148 82, 142 76 Z" />
              </g>

              {/* Biceps Brachii */}
              <g
                fill={muscleColor('biceps')}
                stroke={muscleStroke('biceps')}
                strokeWidth={muscleStrokeWidth('biceps')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('biceps')}
              >
                <path d="M41 115 L55 110 C57 125, 55 142, 50 156 L36 153 C35 138, 37 125, 41 115 Z" />
                <path d="M159 115 L145 110 C143 125, 145 142, 150 156 L164 153 C165 138, 163 125, 159 115 Z" />
              </g>

              {/* Forearms (Brachioradialis & Flexors) */}
              <g
                fill={muscleColor('forearms')}
                stroke={muscleStroke('forearms')}
                strokeWidth={muscleStrokeWidth('forearms')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('biceps')}
              >
                <path d="M35 156 L50 158 C48 178, 41 198, 34 212 L24 210 C25 192, 29 172, 35 156 Z" />
                <path d="M165 156 L150 158 C152 178, 159 198, 166 212 L176 210 C175 192, 171 172, 165 156 Z" />
              </g>

              {/* Anterior Lats Flare (Serratus / Lat Wings visible from front) */}
              <g
                fill={muscleColor('lats')}
                stroke={muscleStroke('lats')}
                strokeWidth={muscleStrokeWidth('lats')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('lats')}
              >
                <path d="M60 110 L68 122 L69 152 C62 142, 58 126, 60 110 Z" />
                <path d="M140 110 L132 122 L131 152 C138 142, 142 126, 140 110 Z" />
              </g>

              {/* Rectus Abdominis & Obliques (Sculpted 6-Pack + Tapered Waist) */}
              <g
                fill={muscleColor('abs')}
                stroke={muscleStroke('abs')}
                strokeWidth={muscleStrokeWidth('abs')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('abs')}
              >
                {/* Upper Abs */}
                <path d="M79 124 L98 124 L98 142 L77 142 C76 135, 77 129, 79 124 Z" />
                <path d="M121 124 L102 124 L102 142 L123 142 C124 135, 123 129, 121 124 Z" />
                {/* Mid Abs */}
                <path d="M77 145 L98 145 L98 164 L78 164 Z" />
                <path d="M123 145 L102 145 L102 164 L122 164 Z" />
                {/* Lower Abs & V-Taper */}
                <path d="M78 167 L98 167 L98 194 L83 190 Z" />
                <path d="M122 167 L102 167 L102 194 L117 190 Z" />
                {/* External Obliques */}
                <path d="M69 125 L76 126 L77 184 L68 176 C66 158, 66 140, 69 125 Z" />
                <path d="M131 125 L124 126 L123 184 L132 176 C134 158, 134 140, 131 125 Z" />
              </g>

              {/* Quadriceps (Vastus Lateralis Outer Sweep + Teardrop VMO) */}
              <g
                fill={muscleColor('quads')}
                stroke={muscleStroke('quads')}
                strokeWidth={muscleStrokeWidth('quads')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('quads')}
              >
                {/* Left Quad Complex */}
                <path d="M67 182 L84 194 L82 284 L62 282 C54 248, 55 212, 67 182 Z" />
                <path d="M85 195 L97 198 L92 284 L83 284 Z" />
                {/* Right Quad Complex */}
                <path d="M133 182 L116 194 L118 284 L138 282 C146 248, 145 212, 133 182 Z" />
                <path d="M115 195 L103 198 L108 284 L117 284 Z" />
              </g>

              {/* Calves (Gastrocnemius Medial & Tibialis Anterior) */}
              <g
                fill={muscleColor('calves')}
                stroke={muscleStroke('calves')}
                strokeWidth={muscleStrokeWidth('calves')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('calves')}
              >
                <path d="M64 306 L88 306 C91 328, 88 352, 83 374 L67 374 C60 350, 59 326, 64 306 Z" />
                <path d="M136 306 L112 306 C109 328, 112 352, 117 374 L133 374 C140 350, 141 326, 136 306 Z" />
              </g>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mt-0.5">
              Anterior
            </span>
          </div>

          {/* ==================== POSTERIOR (BACK) ==================== */}
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 200 420"
              className="w-34 sm:w-40 h-auto select-none overflow-visible"
            >
              <defs>
                <radialGradient id="bodyAuraBack" cx="50%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
              </defs>
              <ellipse cx="100" cy="200" rx="85" ry="185" fill="url(#bodyAuraBack)" />

              {/* Base Anatomical Silhouette */}
              <g fill="#1c1c1e" stroke="rgba(255,255,255,0.12)" strokeWidth="1.1">
                {/* Back of Head & Neck */}
                <path d="M100 14 C86 14, 80 25, 81 39 C82 50, 88 58, 100 60 C112 58, 118 50, 119 39 C120 25, 114 14, 100 14 Z" />
                <path d="M89 56 L89 68 L111 68 L111 56 Z" />
                {/* Forearms & Hands */}
                <path d="M35 156 L50 158 C48 178, 41 198, 34 212 L24 210 C25 192, 29 172, 35 156 Z" />
                <path d="M165 156 L150 158 C152 178, 159 198, 166 212 L176 210 C175 192, 171 172, 165 156 Z" />
                <path d="M23 212 C18 220, 17 232, 22 237 C27 240, 33 234, 34 225 L32 212 Z" />
                <path d="M177 212 C182 220, 183 232, 178 237 C173 240, 167 234, 166 225 L168 212 Z" />
                {/* Back of Knees & Feet */}
                <path d="M64 288 L89 288 L87 304 L65 304 Z" />
                <path d="M136 288 L111 288 L113 304 L135 304 Z" />
                <path d="M67 374 L82 374 L85 398 C85 403, 62 404, 61 398 Z" />
                <path d="M133 374 L118 374 L115 398 C115 403, 138 404, 139 398 Z" />
              </g>

              {/* Trapezius & Rhomboids (Diamond Upper/Mid Back) */}
              <g
                fill={muscleColor('upper_back')}
                stroke={muscleStroke('upper_back')}
                strokeWidth={muscleStrokeWidth('upper_back')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('upper_back')}
              >
                <path d="M89 62 L60 76 L74 106 L98 134 L98 62 Z" />
                <path d="M111 62 L140 76 L126 106 L102 134 L102 62 Z" />
              </g>

              {/* Posterior Deltoids (Rear Delts) */}
              <g
                fill={muscleColor('rear_delts')}
                stroke={muscleStroke('rear_delts')}
                strokeWidth={muscleStrokeWidth('rear_delts')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('rear_delts')}
              >
                <path d="M59 77 C44 81, 39 95, 43 111 L59 104 L71 96 Z" />
                <path d="M141 77 C156 81, 161 95, 157 111 L141 104 L129 96 Z" />
              </g>

              {/* Latissimus Dorsi & Teres Major (Wide V-Taper Wings) */}
              <g
                fill={muscleColor('lats')}
                stroke={muscleStroke('lats')}
                strokeWidth={muscleStrokeWidth('lats')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('lats')}
              >
                <path d="M58 106 L74 108 L90 138 L84 168 L69 162 C59 144, 55 124, 58 106 Z" />
                <path d="M142 106 L126 108 L110 138 L116 168 L131 162 C141 144, 145 124, 142 106 Z" />
              </g>

              {/* Triceps Brachii (Horseshoe Lateral & Long Heads) */}
              <g
                fill={muscleColor('triceps')}
                stroke={muscleStroke('triceps')}
                strokeWidth={muscleStrokeWidth('triceps')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('triceps')}
              >
                <path d="M42 112 L56 107 C58 124, 55 142, 50 156 L36 154 C35 138, 37 123, 42 112 Z" />
                <path d="M158 112 L144 107 C142 124, 145 142, 150 156 L164 154 C165 138, 163 123, 158 112 Z" />
              </g>

              {/* Erector Spinae / Thoracolumbar Fascia */}
              <g
                fill={muscleColor('lower_back')}
                stroke={muscleStroke('lower_back')}
                strokeWidth={muscleStrokeWidth('lower_back')}
              >
                <path d="M90 136 L99 136 L99 178 L84 174 Z" />
                <path d="M110 136 L101 136 L101 178 L116 174 Z" />
              </g>

              {/* Gluteus Medius & Maximus */}
              <g
                fill={muscleColor('glutes')}
                stroke={muscleStroke('glutes')}
                strokeWidth={muscleStrokeWidth('glutes')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('glutes')}
              >
                <path d="M68 172 L98 178 L98 224 C81 228, 63 220, 59 204 C57 191, 61 180, 68 172 Z" />
                <path d="M132 172 L102 178 L102 224 C119 228, 137 220, 141 204 C143 191, 139 180, 132 172 Z" />
              </g>

              {/* Hamstrings (Biceps Femoris & Semitendinosus) */}
              <g
                fill={muscleColor('hamstrings')}
                stroke={muscleStroke('hamstrings')}
                strokeWidth={muscleStrokeWidth('hamstrings')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('hamstrings')}
              >
                <path d="M61 220 L80 226 L78 286 L64 286 C57 264, 57 240, 61 220 Z" />
                <path d="M81 226 L96 226 L91 286 L79 286 Z" />
                <path d="M139 220 L120 226 L122 286 L136 286 C143 264, 143 240, 139 220 Z" />
                <path d="M119 226 L104 226 L109 286 L121 286 Z" />
              </g>

              {/* Calves (Diamond Gastrocnemius Medial/Lateral Heads & Soleus) */}
              <g
                fill={muscleColor('calves')}
                stroke={muscleStroke('calves')}
                strokeWidth={muscleStrokeWidth('calves')}
                className="cursor-pointer transition-colors"
                onClick={() => toggleMuscle('calves')}
              >
                <path d="M64 306 L88 306 C92 326, 89 350, 82 374 L67 374 C59 350, 58 326, 64 306 Z" />
                <path d="M136 306 L112 306 C108 326, 111 350, 118 374 L133 374 C141 350, 142 326, 136 306 Z" />
              </g>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mt-0.5">
              Posterior
            </span>
          </div>
        </div>

        {/* Split-Mapped Legend */}
        <div className="flex items-center justify-center gap-3.5 mt-2.5 pt-2 border-t border-white/[0.06] text-[10px] text-[#8e8e93] w-full">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#fa114f]" /> Push
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00f5ea]" /> Pull
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#bf5af2]" /> Legs & Core
          </span>
        </div>
      </div>

      {/* Compact 2-Column Muscle Set Bars colored by their Split */}
      <div className="lg:col-span-7 grid grid-cols-2 gap-2">
        {sortedMuscles.map((muscle) => {
          const sets = volumes[muscle];
          const pct = Math.min(100, (sets / 18) * 100);
          const isSelected = selectedMuscle === muscle;
          const mPalette = getMusclePalette(muscle);

          return (
            <button
              key={muscle}
              type="button"
              onClick={() => toggleMuscle(muscle)}
              className={`text-left p-2.5 rounded-[14px] transition-all ${
                isSelected
                  ? 'bg-[#2c2c2e] ring-1.5 ring-white'
                  : 'bg-[#2c2c2e]/60 hover:bg-[#2c2c2e]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5 gap-1">
                <span className="font-semibold text-white truncate flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: mPalette.hex }}
                  />
                  {MUSCLE_LABELS[muscle].replace(' & Traps', '').replace(' & Core', '')}
                </span>
                <span className="font-mono-num font-bold text-white shrink-0">
                  {sets}<span className="text-[10px] text-[#8e8e93] font-normal ml-0.5">s</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getMuscleVolumeShade(muscle, sets, isSelected),
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

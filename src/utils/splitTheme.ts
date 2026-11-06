import { MuscleGroup, Routine } from '../types/workout';
import { MUSCLE_CATEGORY_MAP } from '../data/seedExercises';

export type SplitPaletteKey =
  | 'Push'
  | 'Pull'
  | 'Legs'
  | 'Upper'
  | 'Lower'
  | 'Full Body'
  | 'Custom'
  | 'Neutral';

export interface SplitPalette {
  key: SplitPaletteKey;
  hex: string;
  secondaryHex: string;
  dimHex: string;
  fillStart: string;
  fillEnd: string;
  textClass: string;
  badgeClass: string;
  solidPillClass: string;
  buttonClass: string;
  cardBorderClass: string;
  cardGlowStyle: React.CSSProperties;
  ringClass: string;
  barShades: string[];
}

export const SPLIT_PALETTES: Record<SplitPaletteKey, SplitPalette> = {
  Push: {
    key: 'Push',
    hex: '#fa114f',
    secondaryHex: '#ff375f',
    dimHex: '#881337',
    fillStart: 'rgba(250, 17, 79, 0.34)',
    fillEnd: 'rgba(250, 17, 79, 0.0)',
    textClass: 'text-[#ff375f]',
    badgeClass: 'bg-[#fa114f]/18 text-[#ff375f] border border-[#fa114f]/35',
    solidPillClass: 'bg-[#fa114f] text-white font-bold shadow-sm shadow-[#fa114f]/30',
    buttonClass:
      'bg-gradient-to-r from-[#fa114f] to-[#ff375f] hover:brightness-110 text-white shadow-lg shadow-[#fa114f]/20',
    cardBorderClass: 'border-[#fa114f]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(250, 17, 79, 0.14) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#fa114f] bg-[#fa114f]/20 text-[#ff375f]',
    barShades: ['bg-[#fa114f]', 'bg-[#ff375f]', 'bg-[#fb7185]'],
  },
  Pull: {
    key: 'Pull',
    hex: '#00f5ea',
    secondaryHex: '#06b6d4',
    dimHex: '#155e75',
    fillStart: 'rgba(0, 245, 234, 0.32)',
    fillEnd: 'rgba(0, 245, 234, 0.0)',
    textClass: 'text-[#00f5ea]',
    badgeClass: 'bg-[#00f5ea]/15 text-[#00f5ea] border border-[#00f5ea]/35',
    solidPillClass: 'bg-[#00f5ea] text-black font-bold shadow-sm shadow-[#00f5ea]/30',
    buttonClass:
      'bg-gradient-to-r from-[#00f5ea] to-[#06b6d4] hover:brightness-110 text-black shadow-lg shadow-[#00f5ea]/20',
    cardBorderClass: 'border-[#00f5ea]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(0, 245, 234, 0.13) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#00f5ea] bg-[#00f5ea]/18 text-[#00f5ea]',
    barShades: ['bg-[#00f5ea]', 'bg-[#06b6d4]', 'bg-[#38bdf8]'],
  },
  Legs: {
    key: 'Legs',
    hex: '#bf5af2',
    secondaryHex: '#a855f7',
    dimHex: '#581c87',
    fillStart: 'rgba(191, 90, 242, 0.34)',
    fillEnd: 'rgba(191, 90, 242, 0.0)',
    textClass: 'text-[#c084fc]',
    badgeClass: 'bg-[#bf5af2]/18 text-[#d8b4fe] border border-[#bf5af2]/35',
    solidPillClass: 'bg-[#bf5af2] text-white font-bold shadow-sm shadow-[#bf5af2]/30',
    buttonClass:
      'bg-gradient-to-r from-[#bf5af2] to-[#8b5cf6] hover:brightness-110 text-white shadow-lg shadow-[#bf5af2]/20',
    cardBorderClass: 'border-[#bf5af2]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(191, 90, 242, 0.15) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#bf5af2] bg-[#bf5af2]/20 text-[#d8b4fe]',
    barShades: ['bg-[#bf5af2]', 'bg-[#a855f7]', 'bg-[#818cf8]'],
  },
  Upper: {
    key: 'Upper',
    hex: '#ff9f0a',
    secondaryHex: '#f59e0b',
    dimHex: '#78350f',
    fillStart: 'rgba(255, 159, 10, 0.34)',
    fillEnd: 'rgba(255, 159, 10, 0.0)',
    textClass: 'text-[#ff9f0a]',
    badgeClass: 'bg-[#ff9f0a]/18 text-[#ffb340] border border-[#ff9f0a]/35',
    solidPillClass: 'bg-[#ff9f0a] text-black font-bold shadow-sm shadow-[#ff9f0a]/30',
    buttonClass:
      'bg-gradient-to-r from-[#ff9f0a] to-[#f59e0b] hover:brightness-110 text-black shadow-lg shadow-[#ff9f0a]/20',
    cardBorderClass: 'border-[#ff9f0a]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(255, 159, 10, 0.15) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#ff9f0a] bg-[#ff9f0a]/20 text-[#ffb340]',
    barShades: ['bg-[#ff9f0a]', 'bg-[#f59e0b]', 'bg-[#fbbf24]'],
  },
  Lower: {
    key: 'Lower',
    hex: '#5e5ce6',
    secondaryHex: '#6366f1',
    dimHex: '#312e81',
    fillStart: 'rgba(94, 92, 230, 0.34)',
    fillEnd: 'rgba(94, 92, 230, 0.0)',
    textClass: 'text-[#818cf8]',
    badgeClass: 'bg-[#5e5ce6]/20 text-[#a5b4fc] border border-[#5e5ce6]/40',
    solidPillClass: 'bg-[#5e5ce6] text-white font-bold shadow-sm shadow-[#5e5ce6]/30',
    buttonClass:
      'bg-gradient-to-r from-[#5e5ce6] to-[#6366f1] hover:brightness-110 text-white shadow-lg shadow-[#5e5ce6]/20',
    cardBorderClass: 'border-[#5e5ce6]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(94, 92, 230, 0.16) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#5e5ce6] bg-[#5e5ce6]/22 text-[#a5b4fc]',
    barShades: ['bg-[#5e5ce6]', 'bg-[#6366f1]', 'bg-[#818cf8]'],
  },
  'Full Body': {
    key: 'Full Body',
    hex: '#30d158',
    secondaryHex: '#10b981',
    dimHex: '#064e3b',
    fillStart: 'rgba(48, 209, 88, 0.34)',
    fillEnd: 'rgba(48, 209, 88, 0.0)',
    textClass: 'text-[#30d158]',
    badgeClass: 'bg-[#30d158]/18 text-[#4ade80] border border-[#30d158]/35',
    solidPillClass: 'bg-[#30d158] text-black font-bold shadow-sm shadow-[#30d158]/30',
    buttonClass:
      'bg-gradient-to-r from-[#30d158] to-[#10b981] hover:brightness-110 text-black shadow-lg shadow-[#30d158]/20',
    cardBorderClass: 'border-[#30d158]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(48, 209, 88, 0.15) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#30d158] bg-[#30d158]/20 text-[#4ade80]',
    barShades: ['bg-[#30d158]', 'bg-[#10b981]', 'bg-[#34d399]'],
  },
  Custom: {
    key: 'Custom',
    hex: '#ffd60a',
    secondaryHex: '#eab308',
    dimHex: '#713f12',
    fillStart: 'rgba(255, 214, 10, 0.32)',
    fillEnd: 'rgba(255, 214, 10, 0.0)',
    textClass: 'text-[#ffd60a]',
    badgeClass: 'bg-[#ffd60a]/18 text-[#fde047] border border-[#ffd60a]/35',
    solidPillClass: 'bg-[#ffd60a] text-black font-bold shadow-sm shadow-[#ffd60a]/30',
    buttonClass:
      'bg-gradient-to-r from-[#ffd60a] to-[#facc15] hover:brightness-110 text-black shadow-lg shadow-[#ffd60a]/20',
    cardBorderClass: 'border-[#ffd60a]/25',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(255, 214, 10, 0.14) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#ffd60a] bg-[#ffd60a]/20 text-[#fde047]',
    barShades: ['bg-[#ffd60a]', 'bg-[#eab308]', 'bg-[#ca8a04]'],
  },
  Neutral: {
    key: 'Neutral',
    hex: '#a4ff00',
    secondaryHex: '#84cc16',
    dimHex: '#3f6212',
    fillStart: 'rgba(164, 255, 0, 0.30)',
    fillEnd: 'rgba(164, 255, 0, 0.0)',
    textClass: 'text-[#a4ff00]',
    badgeClass: 'bg-[#a4ff00]/15 text-[#a4ff00] border border-[#a4ff00]/30',
    solidPillClass: 'bg-[#a4ff00] text-black font-bold',
    buttonClass:
      'bg-[#a4ff00] hover:bg-[#b5ff2b] text-black shadow-lg shadow-[#a4ff00]/15',
    cardBorderClass: 'border-white/[0.08]',
    cardGlowStyle: {
      backgroundImage:
        'radial-gradient(120% 90% at 0% 0%, rgba(164, 255, 0, 0.10) 0%, rgba(28, 28, 30, 0) 65%)',
    },
    ringClass: 'ring-1.5 ring-[#a4ff00] bg-[#a4ff00]/18 text-[#a4ff00]',
    barShades: ['bg-[#a4ff00]', 'bg-[#84cc16]', 'bg-[#4d7c0f]'],
  },
};

export function getSplitPalette(
  splitTag?: Routine['splitTag'] | string | null
): SplitPalette {
  if (splitTag === 'Push') return SPLIT_PALETTES.Push;
  if (splitTag === 'Pull') return SPLIT_PALETTES.Pull;
  if (splitTag === 'Legs') return SPLIT_PALETTES.Legs;
  if (splitTag === 'Upper') return SPLIT_PALETTES.Upper;
  if (splitTag === 'Lower') return SPLIT_PALETTES.Lower;
  if (splitTag === 'Full Body') return SPLIT_PALETTES['Full Body'];
  if (splitTag === 'Custom') return SPLIT_PALETTES.Custom;
  return SPLIT_PALETTES.Neutral;
}

export function getMusclePalette(muscle: MuscleGroup): SplitPalette {
  const cat = MUSCLE_CATEGORY_MAP[muscle];
  if (cat === 'Push') return SPLIT_PALETTES.Push;
  if (cat === 'Pull') return SPLIT_PALETTES.Pull;
  return SPLIT_PALETTES.Legs;
}

export function getMuscleVolumeShade(
  muscle: MuscleGroup,
  sets: number,
  isSelected: boolean
): string {
  if (isSelected) return '#ffffff';
  if (sets <= 0) return '#27272a';

  const cat = MUSCLE_CATEGORY_MAP[muscle];
  if (cat === 'Push') {
    if (sets < 6) return '#881337';
    if (sets < 12) return '#e11d48';
    return '#fa114f';
  }
  if (cat === 'Pull') {
    if (sets < 6) return '#155e75';
    if (sets < 12) return '#0891b2';
    return '#00f5ea';
  }
  // Legs & Core -> Purple palette
  if (sets < 6) return '#581c87';
  if (sets < 12) return '#9333ea';
  return '#bf5af2';
}

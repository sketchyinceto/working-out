import { WeightUnit } from '../types/workout';

const KG_TO_LBS = 2.2046226218;

export function kgToDisplay(weightKg: number, unit: WeightUnit): number {
  if (unit === 'kg') {
    return Number(weightKg.toFixed(2));
  }
  // Round to nearest 0.5 lbs for clean display
  return Math.round(weightKg * KG_TO_LBS * 2) / 2;
}

export function displayToKg(displayWeight: number, unit: WeightUnit): number {
  if (unit === 'kg') {
    return Number(displayWeight.toFixed(2));
  }
  return Number((displayWeight / KG_TO_LBS).toFixed(2));
}

export function formatWeight(weightKg: number, unit: WeightUnit, includeUnit = true): string {
  const val = kgToDisplay(weightKg, unit);
  const formatted = Number.isInteger(val) ? String(val) : val.toFixed(val % 1 === 0.5 ? 1 : 2).replace(/0+$/, '').replace(/\.$/, '');
  return includeUnit ? `${formatted} ${unit}` : formatted;
}

export function formatVolume(volumeKg: number, unit: WeightUnit): string {
  const converted = unit === 'kg' ? volumeKg : volumeKg * KG_TO_LBS;
  if (converted >= 10000) {
    return `${(converted / 1000).toFixed(1)}k ${unit}`;
  }
  return `${Math.round(converted).toLocaleString()} ${unit}`;
}

/**
 * Epley 1RM Formula: W * (1 + reps / 30)
 */
export function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Number((weightKg * (1 + reps / 30)).toFixed(1));
}

export interface PlateLoadout {
  plateWeight: number;
  countPerSide: number;
  color: string;
  heightClass: string;
}

const KG_PLATES = [
  { weight: 25, color: 'bg-rose-600 border-rose-400 text-white', heightClass: 'h-28' },
  { weight: 20, color: 'bg-blue-600 border-blue-400 text-white', heightClass: 'h-28' },
  { weight: 15, color: 'bg-amber-400 border-amber-200 text-zinc-950', heightClass: 'h-24' },
  { weight: 10, color: 'bg-emerald-600 border-emerald-400 text-white', heightClass: 'h-20' },
  { weight: 5, color: 'bg-zinc-100 border-zinc-300 text-zinc-950', heightClass: 'h-16' },
  { weight: 2.5, color: 'bg-zinc-800 border-zinc-500 text-zinc-100', heightClass: 'h-14' },
  { weight: 1.25, color: 'bg-zinc-400 border-zinc-200 text-zinc-950', heightClass: 'h-12' },
];

const LBS_PLATES = [
  { weight: 45, color: 'bg-blue-600 border-blue-400 text-white', heightClass: 'h-28' },
  { weight: 35, color: 'bg-amber-400 border-amber-200 text-zinc-950', heightClass: 'h-24' },
  { weight: 25, color: 'bg-emerald-600 border-emerald-400 text-white', heightClass: 'h-20' },
  { weight: 10, color: 'bg-zinc-100 border-zinc-300 text-zinc-950', heightClass: 'h-16' },
  { weight: 5, color: 'bg-rose-600 border-rose-400 text-white', heightClass: 'h-14' },
  { weight: 2.5, color: 'bg-zinc-400 border-zinc-200 text-zinc-950', heightClass: 'h-12' },
];

export function calculateBarbellPlates(
  targetDisplayWeight: number,
  barDisplayWeight: number,
  unit: WeightUnit
): {
  loadout: PlateLoadout[];
  achievedWeight: number;
  remainderPerSide: number;
} {
  const platesCatalog = unit === 'kg' ? KG_PLATES : LBS_PLATES;
  if (targetDisplayWeight <= barDisplayWeight) {
    return { loadout: [], achievedWeight: barDisplayWeight, remainderPerSide: 0 };
  }

  let remainingPerSide = (targetDisplayWeight - barDisplayWeight) / 2;
  const loadout: PlateLoadout[] = [];

  for (const plate of platesCatalog) {
    const count = Math.floor((remainingPerSide + 0.001) / plate.weight);
    if (count > 0) {
      loadout.push({
        plateWeight: plate.weight,
        countPerSide: count,
        color: plate.color,
        heightClass: plate.heightClass,
      });
      remainingPerSide -= count * plate.weight;
    }
  }

  const loadedSides = loadout.reduce((acc, p) => acc + p.plateWeight * p.countPerSide * 2, 0);
  return {
    loadout,
    achievedWeight: Number((barDisplayWeight + loadedSides).toFixed(2)),
    remainderPerSide: Number(Math.max(0, remainingPerSide).toFixed(2)),
  };
}

export interface WarmupRampStep {
  percentageLabel: string;
  weightKg: number;
  reps: number;
}

export function generateWarmupSets(workingWeightKg: number, barWeightKg = 20): WarmupRampStep[] {
  if (workingWeightKg <= barWeightKg + 5) {
    return [{ percentageLabel: 'Bar', weightKg: barWeightKg, reps: 10 }];
  }

  const roundToNearest2_5 = (w: number) => Math.max(barWeightKg, Math.round(w / 2.5) * 2.5);

  const steps: WarmupRampStep[] = [
    { percentageLabel: 'Empty Bar', weightKg: barWeightKg, reps: 10 },
    { percentageLabel: '55%', weightKg: roundToNearest2_5(workingWeightKg * 0.55), reps: 6 },
    { percentageLabel: '72%', weightKg: roundToNearest2_5(workingWeightKg * 0.72), reps: 4 },
    { percentageLabel: '85%', weightKg: roundToNearest2_5(workingWeightKg * 0.85), reps: 2 },
  ];

  // Deduplicate if working weight is modest
  const unique: WarmupRampStep[] = [];
  for (const s of steps) {
    if (s.weightKg < workingWeightKg && !unique.some((u) => u.weightKg === s.weightKg)) {
      unique.push(s);
    }
  }
  return unique;
}

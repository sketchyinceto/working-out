import { SetType } from '../types/workout';

const SET_TYPE_ORDER: SetType[] = ['working', 'warmup', 'dropset', 'failure'];

/** Working → Warm-up → Drop set → Failure → Working… */
export function nextSetType(type: SetType): SetType {
  return SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(type) + 1) % SET_TYPE_ORDER.length];
}

/** Badge text: the working-set number, or W / D / F. */
export function setBadgeLabel(type: SetType, workingNumber: number): string {
  if (type === 'warmup') return 'W';
  if (type === 'dropset') return 'D';
  if (type === 'failure') return 'F';
  return String(workingNumber);
}

export function setBadgeStyle(type: SetType): string {
  if (type === 'warmup') return 'bg-[#ffe620]/20 text-[#ffe620]';
  if (type === 'dropset') return 'bg-[#bf5af2]/20 text-[#bf5af2]';
  if (type === 'failure') return 'bg-[#fa114f]/20 text-[#fa114f]';
  return 'bg-[#2c2c2e] text-white';
}

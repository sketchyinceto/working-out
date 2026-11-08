import React, { useMemo } from 'react';
import { Award, Clock, Dumbbell, Flame, Trophy } from 'lucide-react';
import { Exercise, WeightUnit, WorkoutSession } from '../../types/workout';
import { computeStreakAndRestStats, getWorkingSets } from '../../utils/analytics';
import { formatVolume, kgToDisplay } from '../../utils/calculators';
import { getSplitPalette } from '../../utils/splitTheme';

interface WorkoutCompleteModalProps {
  session: WorkoutSession;
  /** All saved workouts, including this one. */
  workouts: WorkoutSession[];
  exercises: Exercise[];
  unit: WeightUnit;
  onClose: () => void;
}

const CONFETTI_COLORS = ['#a4ff00', '#fa114f', '#00f5ea', '#ffe620', '#bf5af2', '#ffffff'];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

export const WorkoutCompleteModal: React.FC<WorkoutCompleteModalProps> = ({
  session,
  workouts,
  exercises,
  unit,
  onClose,
}) => {
  const palette = getSplitPalette(session.splitTag);

  const summary = useMemo(() => {
    const exMap = new Map(exercises.map((e) => [e.id, e]));
    let sets = 0;
    let volumeKg = 0;
    let prSets = 0;
    const prHighlights: { name: string; weightKg: number; reps: number }[] = [];

    for (const block of session.exercises) {
      let bestPr: { weightKg: number; reps: number } | null = null;
      for (const s of getWorkingSets(block.sets)) {
        sets += 1;
        volumeKg += s.weightKg * s.reps;
        if (s.prs && s.prs.length > 0) {
          prSets += 1;
          if (!bestPr || s.weightKg * s.reps > bestPr.weightKg * bestPr.reps) {
            bestPr = { weightKg: s.weightKg, reps: s.reps };
          }
        }
      }
      if (bestPr) {
        prHighlights.push({
          name: exMap.get(block.exerciseId)?.name || 'Exercise',
          ...bestPr,
        });
      }
    }

    const streak = computeStreakAndRestStats(workouts).activeWeekStreak;
    return { sets, volumeKg, prSets, prHighlights, streak, total: workouts.length };
  }, [session, workouts, exercises]);

  const headline =
    summary.prSets > 0
      ? summary.prSets === 1
        ? 'New personal record!'
        : `${summary.prSets} new personal records!`
      : summary.total === 1
      ? 'First workout logged!'
      : 'Workout complete!';

  const subline =
    summary.total === 1
      ? 'Every journey starts with one session. Nice work.'
      : summary.streak > 1
      ? `That's your ${ordinal(summary.total)} workout, and ${summary.streak} weeks in a row. Keep it going!`
      : `That's your ${ordinal(summary.total)} workout. Great job showing up.`;

  // Fixed pseudo-random layout so the burst looks scattered but is stable.
  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        left: `${(i * 37) % 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${((i * 7) % 10) / 20}s`,
        duration: `${2.2 + ((i * 13) % 10) / 10}s`,
        drift: `${((i * 53) % 120) - 60}px`,
        spin: `${360 + ((i * 97) % 540)}deg`,
        round: i % 3 === 0,
      })),
    []
  );

  const stats = [
    { icon: Clock, label: 'Duration', value: formatDuration(session.durationMinutes) },
    { icon: Dumbbell, label: 'Sets', value: String(summary.sets) },
    { icon: Flame, label: 'Volume', value: formatVolume(summary.volumeKg, unit) },
    { icon: Award, label: 'PRs', value: String(summary.prSets) },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-complete-title"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="yk-confetti-piece"
            style={
              {
                left: c.left,
                backgroundColor: c.color,
                borderRadius: c.round ? '9999px' : undefined,
                width: c.round ? 9 : undefined,
                height: c.round ? 9 : undefined,
                '--yk-delay': c.delay,
                '--yk-duration': c.duration,
                '--yk-drift': c.drift,
                '--yk-spin': c.spin,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        style={palette.cardGlowStyle}
        className={`yk-pop-in relative w-full max-w-sm bg-[#1c1c1e] border ${palette.cardBorderClass} rounded-[28px] p-5 space-y-4 shadow-2xl text-center`}
      >
        <div
          className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${palette.badgeClass}`}
        >
          <Trophy className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 id="workout-complete-title" className="text-xl font-extrabold text-white">
            {headline}
          </h2>
          <p className="text-xs text-[#8e8e93] truncate">{session.name}</p>
          <p className="text-sm text-[#d1d1d6] pt-1">{subline}</p>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-black/40 rounded-2xl py-2.5 px-1">
              <Icon className={`w-4 h-4 mx-auto ${palette.textClass}`} />
              <div className="text-sm font-bold font-mono-num text-white mt-1 truncate">
                {value}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#8e8e93] font-semibold">
                {label}
              </div>
            </div>
          ))}
        </div>

        {summary.prHighlights.length > 0 && (
          <div className="bg-[#ffe620]/10 rounded-2xl p-3 space-y-1.5 text-left">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#ffe620]">
              Personal Records
            </div>
            {summary.prHighlights.slice(0, 4).map((pr) => (
              <div key={pr.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-white font-semibold truncate">{pr.name}</span>
                <span className="font-mono-num font-bold text-[#ffe620] shrink-0">
                  {kgToDisplay(pr.weightKg, unit)} {unit} × {pr.reps}
                </span>
              </div>
            ))}
            {summary.prHighlights.length > 4 && (
              <div className="text-[11px] text-[#8e8e93]">
                +{summary.prHighlights.length - 4} more
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          autoFocus
          onClick={onClose}
          className={`w-full py-3 rounded-full font-extrabold text-sm ${palette.buttonClass}`}
        >
          Done
        </button>
      </div>
    </div>
  );
};

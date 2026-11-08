import React, { useMemo, useState } from 'react';
import { CalendarRange, Play, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  ActiveProgramme,
  Exercise,
  TrainingProfile,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import { PROGRAMME_SPLITS } from '../../data/programmeSplits';
import { ProgrammeStatus, WEEK_KIND_LABEL, describeRir } from '../../utils/coach/programme';
import {
  PROGRAMME_ROUTINE_PREFIX,
  activeSplit,
  planProgrammeWorkout,
} from '../../utils/coach/programmeWorkouts';
import { kgToDisplay } from '../../utils/calculators';
import { getSplitPalette } from '../../utils/splitTheme';
import { workoutsNewestFirst } from '../../utils/analytics';

interface ProgrammeWorkoutsViewProps {
  programme: ActiveProgramme | null | undefined;
  status: ProgrammeStatus | null;
  profile: TrainingProfile;
  exercises: Exercise[];
  workouts: WorkoutSession[];
  unit: WeightUnit;
  onChooseProgramme: () => void;
  onSetSplit: (splitId: string) => void;
  onStartWorkout: (workoutId: string) => void;
  onAcceptSwap: (slotId: string, exerciseId: string) => void;
  onDismissSwap: (slotId: string) => void;
}

export const ProgrammeWorkoutsView: React.FC<ProgrammeWorkoutsViewProps> = ({
  programme,
  status,
  profile,
  exercises,
  workouts,
  unit,
  onChooseProgramme,
  onSetSplit,
  onStartWorkout,
  onAcceptSwap,
  onDismissSwap,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const split = programme ? activeSplit(programme, profile) : null;

  // Next workout = the one after the last programme workout you did.
  const nextWorkoutId = useMemo(() => {
    if (!split) return null;
    const last = workoutsNewestFirst(workouts).find((w) =>
      w.routineId?.startsWith(PROGRAMME_ROUTINE_PREFIX)
    );
    const lastIdx = last ? split.workouts.findIndex((w) => `${PROGRAMME_ROUTINE_PREFIX}${w.id}` === last.routineId) : -1;
    return split.workouts[(lastIdx + 1) % split.workouts.length].id;
  }, [split, workouts]);

  if (!programme || !status || !split) {
    return (
      <div className="af-card p-5 text-center space-y-3">
        <CalendarRange className="w-7 h-7 text-[#a4ff00] mx-auto" />
        <h2 className="text-base font-bold text-white">No programme yet</h2>
        <p className="text-xs text-[#d1d1d6]">
          Pick a programme and its workouts appear here. After each session the app reviews how
          every exercise went and sets the weight, reps and sets for next time.
        </p>
        <button
          type="button"
          onClick={onChooseProgramme}
          className="w-full py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs"
        >
          Choose a Programme
        </button>
      </div>
    );
  }

  if (status.finished || !status.week) {
    return (
      <div className="af-card p-5 text-center space-y-3">
        <h2 className="text-base font-bold text-white">{status.template.name} complete</h2>
        <button type="button" onClick={onChooseProgramme} className="w-full py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs">
          Choose Next Programme
        </button>
      </div>
    );
  }

  const week = status.week;

  return (
    <div className="space-y-3.5">
      <div className="af-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#a4ff00]">
              {status.notStarted ? 'Starts next Monday · week 1 preview' : `Week ${status.weekNumber} of ${status.totalWeeks} · ${WEEK_KIND_LABEL[week.kind]}`}
            </div>
            <h2 className="text-base font-bold text-white leading-tight">{week.block}</h2>
            <p className="text-[11px] text-[#8e8e93] truncate">{status.template.name}</p>
          </div>
          <button type="button" onClick={onChooseProgramme} className="px-3 py-1.5 rounded-full bg-[#2c2c2e] text-[11px] font-semibold text-white shrink-0">
            Change
          </button>
        </div>
        <p className="text-[11px] text-[#d1d1d6]">
          Compounds {week.compoundReps[0]}–{week.compoundReps[1]} reps · isolation {week.isolationReps[0]}–{week.isolationReps[1]} · {describeRir(week.rir)}
        </p>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1.5">Days per week</div>
          <div className="grid grid-cols-4 gap-1.5">
            {PROGRAMME_SPLITS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === split.id}
                onClick={() => onSetSplit(s.id)}
                className={`py-1.5 rounded-xl text-xs font-bold transition ${
                  s.id === split.id ? 'bg-[#a4ff00] text-black' : 'bg-[#2c2c2e] text-[#8e8e93] hover:text-white'
                }`}
              >
                {s.daysPerWeek} days
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#8e8e93] mt-1.5">
            {split.name}: {split.description}
          </p>
        </div>
      </div>

      {split.workouts.map((w) => {
        const plan = planProgrammeWorkout(w, programme, week, exercises, workouts);
        const palette = getSplitPalette(w.splitTag);
        const isNext = w.id === nextWorkoutId;
        const isOpen = openId === w.id || isNext;
        const totalSets = plan.reduce((a, p) => a + p.sets, 0);
        const swaps = plan.filter((p) => p.swapSuggestion);

        return (
          <div key={w.id} style={palette.cardGlowStyle} className={`af-card border ${palette.cardBorderClass} p-4 space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.badgeClass}`}>
                    {w.splitTag}
                  </span>
                  {isNext && (
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${palette.solidPillClass}`}>
                      Up Next
                    </span>
                  )}
                  <span className="text-[11px] text-[#8e8e93]">
                    • {plan.length} exercises · {totalSets} sets
                  </span>
                </div>
                <h3 className="text-base font-bold text-white truncate">{w.name}</h3>
              </div>
            </div>

            {swaps.map((p) => (
              <div key={p.slot.id} className="bg-[#ffe620]/10 rounded-xl px-3 py-2 text-[11px] space-y-1.5">
                <div className="text-[#ffe620] font-semibold inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> {p.exercise.name} has stalled
                </div>
                <div className="text-[#d1d1d6]">Swap to {p.swapSuggestion!.name} for a fresh stimulus?</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAcceptSwap(p.slot.id, p.swapSuggestion!.id)}
                    className="px-3 py-1 rounded-full bg-[#ffe620] text-black font-bold"
                  >
                    Swap
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissSwap(p.slot.id)}
                    className="px-3 py-1 rounded-full bg-[#2c2c2e] text-white font-semibold inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Keep
                  </button>
                </div>
              </div>
            ))}

            {isOpen ? (
              <div className="space-y-1.5">
                {plan.map((p) => (
                  <div key={p.slot.id} className="bg-black/35 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-white font-semibold truncate">{p.exercise.name}</span>
                      <span className="font-mono-num text-white shrink-0">
                        {p.sets} × {p.reps}
                        <span className="text-[#8e8e93]"> @ </span>
                        {kgToDisplay(p.weightKg, unit)} {unit}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8e8e93] mt-0.5">
                      Range {p.range[0]}–{p.range[1]} reps · rest {p.restSeconds}s
                    </div>
                    {p.reason && (
                      <div className="text-[10px] text-[#a4ff00] mt-0.5 flex gap-1">
                        <Sparkles className="w-3 h-3 shrink-0 mt-px" />
                        <span>{p.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenId(w.id)}
                className="text-[11px] font-semibold text-[#8e8e93] hover:text-white"
              >
                Show exercises & targets
              </button>
            )}

            <button
              type="button"
              disabled={status.notStarted}
              onClick={() => onStartWorkout(w.id)}
              className={`w-full py-2.5 rounded-full disabled:opacity-40 font-bold text-xs inline-flex items-center justify-center gap-1.5 ${palette.buttonClass}`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {status.notStarted ? 'Available from Monday' : `Start ${w.splitTag}`}
            </button>
          </div>
        );
      })}

      <p className="text-[11px] text-[#636366] px-1 leading-snug">
        After each programme workout, every exercise is reviewed: hit the top of the rep range on
        all sets and the weight goes up; land in range and you aim for one more rep; fall short and
        the weight drops ~5%. Sets and rest adjust too, and stalled lifts get a swap suggestion.
      </p>
    </div>
  );
};

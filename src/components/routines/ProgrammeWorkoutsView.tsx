import React, { useMemo, useState } from 'react';
import { CalendarRange, Check, ChevronDown, ChevronUp, Play, RefreshCw, Sparkles } from 'lucide-react';
import {
  ActiveProgramme,
  Exercise,
  TrainingProfile,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import { ProgrammeStatus, WEEK_KIND_LABEL, describeRir, repeatNotice } from '../../utils/coach/programme';
import {
  activeSplit,
  findProgrammeWorkout,
  planProgrammeWorkout,
  programmeWorkoutsAsRoutines,
} from '../../utils/coach/programmeWorkouts';
import { ScheduleDay, WEEKDAY_SHORT, buildWeekSchedule } from '../../utils/coach/schedule';
import { kgToDisplay } from '../../utils/calculators';
import { getSplitPalette } from '../../utils/splitTheme';
import { WeekPicker } from '../trainer/WeekPicker';

interface ProgrammeWorkoutsViewProps {
  programme: ActiveProgramme | null | undefined;
  status: ProgrammeStatus | null;
  profile: TrainingProfile;
  exercises: Exercise[];
  workouts: WorkoutSession[];
  unit: WeightUnit;
  onOpenBuilder: () => void;
  onRemoveProgramme: () => void;
  onSetWeek: (week: number) => void;
  onStartWorkout: (workoutId: string) => void;
  onAcceptSwap: (slotId: string, exerciseId: string) => void;
  onDismissSwap: (slotId: string) => void;
}

const STATUS_TEXT: Record<ScheduleDay['status'], string> = {
  done: 'Done',
  extra: 'Extra',
  today: 'Today',
  upcoming: 'Planned',
  missed: 'Missed',
  rest: 'Rest',
};

/** Programme tab: a short summary and this week's workout plan. */
export const ProgrammeWorkoutsView: React.FC<ProgrammeWorkoutsViewProps> = ({
  programme,
  status,
  profile,
  exercises,
  workouts,
  unit,
  onOpenBuilder,
  onRemoveProgramme,
  onSetWeek,
  onStartWorkout,
  onAcceptSwap,
  onDismissSwap,
}) => {
  const [openDate, setOpenDate] = useState<string | null>(null);

  const split = programme ? activeSplit(programme, profile) : null;
  const days = useMemo(() => {
    if (!programme || !split) return [];
    const routines = programmeWorkoutsAsRoutines(split, programme);
    return buildWeekSchedule(
      { ...profile, rotationRoutineIds: routines.map((r) => r.id) },
      routines,
      workouts
    ).filter((d) => d.isTrainingDay || d.workouts.length > 0);
  }, [programme, split, profile, workouts]);

  if (!programme || !status || !split || status.finished || !status.week) {
    return (
      <div className="af-card p-5 space-y-3 text-center">
        <CalendarRange className="w-7 h-7 text-[#a4ff00] mx-auto" />
        <h2 className="text-base font-bold text-white">
          {status?.finished ? `${status.template.name} complete` : 'No programme yet'}
        </h2>
        <p className="text-xs text-[#d1d1d6]">
          Set your goal, training days and experience, and your weekly workouts are planned for you.
        </p>
        <button type="button" onClick={onOpenBuilder} className="w-full py-2.5 rounded-full bg-[#a4ff00] text-black font-bold text-xs">
          Open Programme Builder
        </button>
      </div>
    );
  }

  const week = status.week;
  const notice = repeatNotice(programme);
  // The next session to do: today's, or the first one still planned.
  const nextDate = days.find((d) => d.status === 'today' || d.status === 'upcoming')?.dateStr;

  return (
    <div className="space-y-3">
      {/* Programme, briefly */}
      <div className="af-card p-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#a4ff00] flex items-center gap-1.5 flex-wrap">
              {status.notStarted ? (
                'Starts next Monday'
              ) : (
                <>
                  <WeekPicker template={status.template} weekNumber={status.weekNumber} color="#a4ff00" onSetWeek={onSetWeek} />
                  <span>· {WEEK_KIND_LABEL[week.kind]}</span>
                </>
              )}
            </div>
            <h2 className="text-base font-bold text-white leading-tight">{week.block}</h2>
            <p className="text-[11px] text-[#8e8e93] truncate">{status.template.name}</p>
          </div>
          <button type="button" onClick={onOpenBuilder} className="px-3 py-1.5 rounded-full bg-[#2c2c2e] text-[11px] font-semibold text-white shrink-0">
            Edit
          </button>
        </div>
        {notice && <p className="text-[11px] text-[#ffe620] bg-[#ffe620]/10 rounded-xl px-3 py-2 my-1">{notice}</p>}
        <p className="text-[11px] text-[#d1d1d6]">
          Compounds {week.compoundReps[0]}–{week.compoundReps[1]} · isolation {week.isolationReps[0]}–{week.isolationReps[1]} reps · {describeRir(week.rir)}
        </p>
      </div>

      {/* This week's plan */}
      <div className="af-card p-2 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] px-2 pt-1.5">This Week's Plan</div>
        {days.map((d) => {
          const doneWorkout = d.workouts[0];
          const workoutId = d.plannedRoutine?.id ?? doneWorkout?.routineId;
          const workout = workoutId ? findProgrammeWorkout(split, workoutId) : undefined;
          const name = doneWorkout?.name ?? d.plannedRoutine?.name ?? 'Rest';
          const tag = doneWorkout?.splitTag ?? d.plannedRoutine?.splitTag;
          const palette = getSplitPalette(tag);
          const isNext = d.dateStr === nextDate;
          const canExpand = !!workout && !doneWorkout;
          const isOpen = canExpand && (openDate === d.dateStr || (openDate === null && isNext));
          const plan = isOpen ? planProgrammeWorkout(workout!, programme, week, exercises, workouts, profile.experience) : [];
          const swaps = plan.filter((p) => p.swapSuggestion);
          const done = d.status === 'done' || d.status === 'extra';

          return (
            <div key={d.dateStr} className={`rounded-2xl ${isNext ? 'bg-[#2c2c2e]/70' : ''}`}>
              <button
                type="button"
                disabled={!canExpand}
                onClick={() => setOpenDate(isOpen ? '' : d.dateStr)}
                aria-expanded={canExpand ? isOpen : undefined}
                className="w-full flex items-center gap-2.5 px-2 py-2 text-left"
              >
                <span className="w-9 text-[11px] font-semibold text-[#8e8e93] shrink-0">{WEEKDAY_SHORT[d.weekday]}</span>
                <span className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: tag ? palette.hex : '#2c2c2e' }} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold truncate ${done ? 'text-[#8e8e93]' : 'text-white'}`}>{name}</span>
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      d.status === 'missed' ? 'text-[#fa114f]' : done ? 'text-[#a4ff00]' : d.status === 'today' ? 'text-white' : 'text-[#636366]'
                    }`}
                  >
                    {done && <Check className="w-3 h-3 inline -mt-0.5 mr-0.5" />}
                    {STATUS_TEXT[d.status]}
                  </span>
                </span>
                {canExpand &&
                  (isOpen ? <ChevronUp className="w-4 h-4 text-[#8e8e93]" /> : <ChevronDown className="w-4 h-4 text-[#8e8e93]" />)}
              </button>

              {isOpen && (
                <div className="px-2 pb-2.5 space-y-1.5">
                  {swaps.map((p) => (
                    <div key={p.slot.id} className="bg-[#ffe620]/10 rounded-xl px-3 py-2 text-[11px] flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-[#ffe620] shrink-0" />
                      <span className="flex-1 text-[#d1d1d6]">
                        {p.exercise.name} has stalled. Swap to {p.swapSuggestion!.name}?
                      </span>
                      <button type="button" onClick={() => onAcceptSwap(p.slot.id, p.swapSuggestion!.id)} className="px-2.5 py-1 rounded-full bg-[#ffe620] text-black font-bold">
                        Swap
                      </button>
                      <button type="button" onClick={() => onDismissSwap(p.slot.id)} className="px-2.5 py-1 rounded-full bg-[#2c2c2e] text-white font-semibold">
                        Keep
                      </button>
                    </div>
                  ))}
                  {plan.map((p) => (
                    <div key={p.slot.id} className="flex items-start justify-between gap-2 text-xs px-1">
                      <span className="min-w-0">
                        <span className="text-white block truncate">{p.exercise.name}</span>
                        {p.reason && (
                          <span className="text-[10px] text-[#a4ff00] flex gap-1">
                            <Sparkles className="w-3 h-3 shrink-0 mt-px" />
                            {p.reason}
                          </span>
                        )}
                      </span>
                      <span className="font-mono-num text-white shrink-0">
                        {p.sets}×{p.reps} @ {kgToDisplay(p.weightKg, unit)} {unit}
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={status.notStarted}
                    onClick={() => onStartWorkout(workout!.id)}
                    className={`w-full mt-1 py-2.5 rounded-full disabled:opacity-40 font-bold text-xs inline-flex items-center justify-center gap-1.5 ${palette.buttonClass}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {status.notStarted ? 'Available from Monday' : `Start ${workout!.name.split(' — ')[0]}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {days.length === 0 && (
          <p className="text-xs text-[#8e8e93] px-2 pb-2">No training days set. Open the builder to pick them.</p>
        )}
      </div>

      <button type="button" onClick={onRemoveProgramme} className="w-full text-[11px] font-semibold text-[#8e8e93] hover:text-[#fa114f] py-1">
        Remove programme
      </button>
    </div>
  );
};

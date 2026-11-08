import React, { useMemo, useState } from 'react';
import {
  ActiveProgramme,
  BodyMeasurementEntry,
  Exercise,
  Routine,
  TrainingProfile,
  WeightUnit,
  WorkoutSession,
} from '../../types/workout';
import { computeScoreHistory, computeTrainerScore } from '../../utils/coach/scoring';
import { findStalls, StallAlert } from '../../utils/coach/stalls';
import { buildWeekSchedule, defaultProfile } from '../../utils/coach/schedule';
import { getProgrammeStatus, latestBodyweightKg } from '../../utils/coach/programme';
import { activeSplit, programmeWorkoutsAsRoutines } from '../../utils/coach/programmeWorkouts';
import { ScoreCard } from './ScoreCard';
import { ProgressReview } from './ProgressReview';
import { ProgrammeCard } from './ProgrammeCard';
import { WeekSchedule } from './WeekSchedule';
import { StallAlerts } from './StallAlerts';
import { GoalSettings } from './GoalSettings';

interface TrainerViewProps {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  routines: Routine[];
  measurements: BodyMeasurementEntry[];
  unit: WeightUnit;
  profile?: TrainingProfile;
  programme?: ActiveProgramme | null;
  onSaveProfile: (profile: TrainingProfile) => void;
  onSetProgramme: (programme: ActiveProgramme | null) => void;
  onChooseProgramme: () => void;
  onStartRoutine: (routine: Routine) => void;
  onSwapExercise: (oldExerciseId: string, replacement: Exercise, routineIds: string[]) => void;
  onOpenExerciseDetail: (exerciseId: string) => void;
}

export const TrainerView: React.FC<TrainerViewProps> = ({
  workouts,
  exercises,
  routines,
  measurements,
  unit,
  profile: savedProfile,
  programme,
  onSaveProfile,
  onSetProgramme,
  onChooseProgramme,
  onStartRoutine,
  onSwapExercise,
  onOpenExerciseDetail,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const profile = useMemo(
    () => savedProfile ?? defaultProfile(routines),
    [savedProfile, routines]
  );
  const status = useMemo(() => getProgrammeStatus(programme), [programme]);
  const bodyweightKg = latestBodyweightKg(measurements);

  const score = useMemo(
    () => computeTrainerScore(workouts, exercises, measurements, profile, programme),
    [workouts, exercises, measurements, profile, programme]
  );
  const history = useMemo(
    () => computeScoreHistory(workouts, exercises, measurements, profile, programme),
    [workouts, exercises, measurements, profile, programme]
  );
  const stalls = useMemo(
    () => findStalls(workouts, exercises, routines, programme),
    [workouts, exercises, routines, programme]
  );
  // While following a programme, the week rotates through its workouts.
  const week = useMemo(() => {
    if (programme && status && !status.finished) {
      const programmeRoutines = programmeWorkoutsAsRoutines(activeSplit(programme, profile), programme);
      return buildWeekSchedule(
        { ...profile, rotationRoutineIds: programmeRoutines.map((r) => r.id) },
        programmeRoutines,
        workouts
      );
    }
    return buildWeekSchedule(profile, routines, workouts);
  }, [profile, routines, workouts, programme, status]);

  return (
    <div className="space-y-4 pb-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white px-0.5">Trainer</h1>

      <ScoreCard score={score} history={history}>
        {workouts.length > 0 && (
          <ProgressReview
            workouts={workouts}
            exercises={exercises}
            measurements={measurements}
            programme={programme}
            unit={unit}
          />
        )}
      </ScoreCard>

      <ProgrammeCard
        status={status}
        bodyweightKg={bodyweightKg}
        onChoose={onChooseProgramme}
        onEnd={() => onSetProgramme(null)}
      />

      <WeekSchedule
        days={week}
        profile={profile}
        isCustomised={!!savedProfile}
        onStartRoutine={onStartRoutine}
        onEditSettings={() => setShowSettings(true)}
      />

      <StallAlerts
        alerts={stalls}
        unit={unit}
        onSwap={(alert: StallAlert, replacement: Exercise) =>
          onSwapExercise(alert.exercise.id, replacement, alert.routineIds)
        }
        onOpenExerciseDetail={onOpenExerciseDetail}
      />

      {showSettings && (
        <GoalSettings
          profile={profile}
          routines={routines}
          onSave={(p) => {
            onSaveProfile(p);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

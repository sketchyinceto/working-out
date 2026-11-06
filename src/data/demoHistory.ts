import { BodyMeasurementEntry, WorkoutSession } from '../types/workout';

function daysAgoISO(daysAgo: number, hour = 18, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysAgoDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function generateDemoWorkouts(): WorkoutSession[] {
  // 10 weeks of consistent Push / Pull / Legs progression leading up to this week
  // Shows clear, realistic progressive overload in kg across Bench, Incline DB, Squat, RDL, Barbell Row, Lat Pulldown, OHP, etc.
  const weeks = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const sessions: WorkoutSession[] = [];

  weeks.forEach((wIdx, progressionStep) => {
    const baseDayOffset = wIdx * 7;

    // 1. PUSH SESSION (e.g. 6 days ago in that week)
    const pushDayOffset = baseDayOffset + 5;
    const benchWeight = 72.5 + Math.floor(progressionStep * 1.25 / 2.5) * 2.5 + (progressionStep >= 7 ? 2.5 : 0);
    const benchReps = progressionStep === 9 ? 8 : 6 + (progressionStep % 2);
    const inclineDbWeight = 26 + Math.floor(progressionStep / 4) * 2;
    // Seated DB Shoulder Press plateaus at 24kg x 9 over the last 4 sessions (steps 6, 7, 8, 9)
    const shoulderDbWeight = progressionStep >= 5 ? 24 : 20 + Math.floor(progressionStep / 3) * 2;
    const cableFlyWeight = 15 + Math.floor(progressionStep / 4) * 2.5;
    const latRaiseWeight = 10 + Math.floor(progressionStep / 4) * 2;
    const triExtWeight = 25;
    // Overhead cable extension peaks at step 6 (14 reps) and regresses to 10 reps at steps 8-9
    const triExtReps =
      progressionStep === 6
        ? 14
        : progressionStep === 7
        ? 12
        : progressionStep >= 8
        ? 10
        : 11 + (progressionStep % 2);

    const pushStart = daysAgoISO(pushDayOffset, 17, 30);
    const pushEnd = daysAgoISO(pushDayOffset, 18, 38);

    sessions.push({
      id: `demo-push-${wIdx}`,
      name: 'Push A — Chest, Delts & Triceps',
      routineId: 'routine-ppl-push',
      splitTag: 'Push',
      startTime: pushStart,
      endTime: pushEnd,
      durationMinutes: 68,
      notes: progressionStep === 9 ? 'Felt strong on bench press! Cleared 8 reps across all 3 working sets.' : undefined,
      exercises: [
        {
          id: `we-push-${wIdx}-1`,
          exerciseId: 'ex-bench-press',
          restSeconds: 180,
          sets: [
            {
              id: `s-push-${wIdx}-1-w`,
              setNumber: 1,
              type: 'warmup',
              weightKg: 60,
              reps: 8,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-1-1`,
              setNumber: 1,
              type: 'working',
              weightKg: benchWeight,
              reps: benchReps,
              completed: true,
              prs: progressionStep === 9 ? ['weight', '1rm'] : undefined,
            },
            {
              id: `s-push-${wIdx}-1-2`,
              setNumber: 2,
              type: 'working',
              weightKg: benchWeight,
              reps: progressionStep === 9 ? 8 : Math.max(5, benchReps - 1),
              completed: true,
            },
            {
              id: `s-push-${wIdx}-1-3`,
              setNumber: 3,
              type: 'working',
              weightKg: progressionStep === 9 ? benchWeight : benchWeight - 2.5,
              reps: benchReps,
              completed: true,
            },
          ],
        },
        {
          id: `we-push-${wIdx}-2`,
          exerciseId: 'ex-incline-db-press',
          restSeconds: 120,
          sets: [
            {
              id: `s-push-${wIdx}-2-1`,
              setNumber: 1,
              type: 'working',
              weightKg: inclineDbWeight,
              reps: 11,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-2-2`,
              setNumber: 2,
              type: 'working',
              weightKg: inclineDbWeight,
              reps: 9,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-2-3`,
              setNumber: 3,
              type: 'working',
              weightKg: inclineDbWeight,
              // Steep set-to-set fatigue drop-off (11 -> 7 = -36% drop)
              reps: 7,
              completed: true,
            },
          ],
        },
        {
          id: `we-push-${wIdx}-3`,
          exerciseId: 'ex-seated-db-shoulder-press',
          restSeconds: 120,
          sets: [
            {
              id: `s-push-${wIdx}-3-1`,
              setNumber: 1,
              type: 'working',
              weightKg: shoulderDbWeight,
              reps: 9,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-3-2`,
              setNumber: 2,
              type: 'working',
              weightKg: shoulderDbWeight,
              reps: 8,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-3-3`,
              setNumber: 3,
              type: 'working',
              weightKg: shoulderDbWeight,
              reps: 8,
              completed: true,
            },
          ],
        },
        {
          id: `we-push-${wIdx}-4`,
          exerciseId: 'ex-cable-fly',
          supersetGroup: 'A',
          restSeconds: 90,
          sets: [
            {
              id: `s-push-${wIdx}-4-1`,
              setNumber: 1,
              type: 'working',
              weightKg: cableFlyWeight,
              reps: 13,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-4-2`,
              setNumber: 2,
              type: 'working',
              weightKg: cableFlyWeight,
              reps: 12,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-4-3`,
              setNumber: 3,
              type: 'working',
              weightKg: cableFlyWeight,
              reps: 11,
              completed: true,
            },
          ],
        },
        {
          id: `we-push-${wIdx}-5`,
          exerciseId: 'ex-cable-lateral-raise',
          supersetGroup: 'A',
          restSeconds: 75,
          sets: [
            {
              id: `s-push-${wIdx}-5-1`,
              setNumber: 1,
              type: 'working',
              weightKg: latRaiseWeight,
              reps: 15,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-5-2`,
              setNumber: 2,
              type: 'working',
              weightKg: latRaiseWeight,
              reps: 14,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-5-3`,
              setNumber: 3,
              type: 'working',
              weightKg: latRaiseWeight,
              reps: 13,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-5-4`,
              setNumber: 4,
              type: 'dropset',
              weightKg: latRaiseWeight - 2,
              reps: 14,
              completed: true,
            },
          ],
        },
        {
          id: `we-push-${wIdx}-6`,
          exerciseId: 'ex-overhead-cable-extension',
          restSeconds: 90,
          sets: [
            {
              id: `s-push-${wIdx}-6-1`,
              setNumber: 1,
              type: 'working',
              weightKg: triExtWeight,
              reps: triExtReps,
              completed: true,
            },
            {
              id: `s-push-${wIdx}-6-2`,
              setNumber: 2,
              type: 'working',
              weightKg: triExtWeight,
              reps: Math.max(9, triExtReps - 1),
              completed: true,
            },
            {
              id: `s-push-${wIdx}-6-3`,
              setNumber: 3,
              type: 'working',
              weightKg: triExtWeight,
              reps: Math.max(8, triExtReps - 2),
              completed: true,
            },
          ],
        },
      ],
    });

    // 2. PULL SESSION
    const pullDayOffset = baseDayOffset + 3;
    const rowWeight = 70 + Math.floor(progressionStep / 2) * 2.5;
    const pulldownWeight = 55 + Math.floor(progressionStep / 2) * 2.5;
    const csRowWeight = 60 + Math.floor(progressionStep / 2) * 2.5;
    const curlWeight = 14 + Math.floor(progressionStep / 4) * 2;
    const facePullWeight = 22.5 + Math.floor(progressionStep / 3) * 2.5;

    sessions.push({
      id: `demo-pull-${wIdx}`,
      name: 'Pull A — Back Width, Thickness & Biceps',
      routineId: 'routine-ppl-pull',
      splitTag: 'Pull',
      startTime: daysAgoISO(pullDayOffset, 18, 0),
      endTime: daysAgoISO(pullDayOffset, 19, 4),
      durationMinutes: 64,
      exercises: [
        {
          id: `we-pull-${wIdx}-1`,
          exerciseId: 'ex-barbell-row',
          restSeconds: 150,
          sets: [
            {
              id: `s-pull-${wIdx}-1-1`,
              setNumber: 1,
              type: 'working',
              weightKg: rowWeight,
              reps: 8 + (progressionStep % 2),
              completed: true,
              prs: progressionStep === 9 ? ['1rm'] : undefined,
            },
            {
              id: `s-pull-${wIdx}-1-2`,
              setNumber: 2,
              type: 'working',
              weightKg: rowWeight,
              reps: 8,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-1-3`,
              setNumber: 3,
              type: 'working',
              weightKg: rowWeight,
              reps: 7,
              completed: true,
            },
          ],
        },
        {
          id: `we-pull-${wIdx}-2`,
          exerciseId: 'ex-lat-pulldown',
          restSeconds: 120,
          sets: [
            {
              id: `s-pull-${wIdx}-2-1`,
              setNumber: 1,
              type: 'working',
              weightKg: pulldownWeight,
              reps: 10 + (progressionStep % 3),
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-2-2`,
              setNumber: 2,
              type: 'working',
              weightKg: pulldownWeight,
              reps: 10,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-2-3`,
              setNumber: 3,
              type: 'working',
              weightKg: pulldownWeight,
              reps: 9,
              completed: true,
            },
          ],
        },
        {
          id: `we-pull-${wIdx}-3`,
          exerciseId: 'ex-chest-supported-row',
          restSeconds: 120,
          sets: [
            {
              id: `s-pull-${wIdx}-3-1`,
              setNumber: 1,
              type: 'working',
              weightKg: csRowWeight,
              reps: 11,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-3-2`,
              setNumber: 2,
              type: 'working',
              weightKg: csRowWeight,
              reps: 10,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-3-3`,
              setNumber: 3,
              type: 'working',
              weightKg: csRowWeight,
              reps: 9,
              completed: true,
            },
          ],
        },
        {
          id: `we-pull-${wIdx}-4`,
          exerciseId: 'ex-face-pull',
          restSeconds: 75,
          sets: [
            {
              id: `s-pull-${wIdx}-4-1`,
              setNumber: 1,
              type: 'working',
              weightKg: facePullWeight,
              reps: 15,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-4-2`,
              setNumber: 2,
              type: 'working',
              weightKg: facePullWeight,
              reps: 15,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-4-3`,
              setNumber: 3,
              type: 'working',
              weightKg: facePullWeight,
              reps: 14,
              completed: true,
            },
          ],
        },
        {
          id: `we-pull-${wIdx}-5`,
          exerciseId: 'ex-incline-db-curl',
          restSeconds: 90,
          sets: [
            {
              id: `s-pull-${wIdx}-5-1`,
              setNumber: 1,
              type: 'working',
              weightKg: curlWeight,
              reps: 10 + (progressionStep % 3),
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-5-2`,
              setNumber: 2,
              type: 'working',
              weightKg: curlWeight,
              reps: 10,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-5-3`,
              setNumber: 3,
              type: 'working',
              weightKg: curlWeight,
              reps: 9,
              completed: true,
            },
          ],
        },
        {
          id: `we-pull-${wIdx}-6`,
          exerciseId: 'ex-hammer-curl',
          restSeconds: 75,
          sets: [
            {
              id: `s-pull-${wIdx}-6-1`,
              setNumber: 1,
              type: 'working',
              weightKg: curlWeight + 2,
              reps: 12,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-6-2`,
              setNumber: 2,
              type: 'working',
              weightKg: curlWeight + 2,
              reps: 11,
              completed: true,
            },
            {
              id: `s-pull-${wIdx}-6-3`,
              setNumber: 3,
              type: 'working',
              weightKg: curlWeight + 2,
              reps: 10,
              completed: true,
            },
          ],
        },
      ],
    });

    // 3. LEGS SESSION
    const legsDayOffset = baseDayOffset + 1;
    const squatWeight = 95 + progressionStep * 2.5;
    const squatReps = 6 + (progressionStep % 2);
    const rdlWeight = 90 + progressionStep * 2.5;
    const legPressWeight = 160 + progressionStep * 5;
    const legCurlWeight = 50 + Math.floor(progressionStep / 2) * 2.5;
    const legExtWeight = 55 + Math.floor(progressionStep / 2) * 2.5;
    const calfWeight = 70 + Math.floor(progressionStep / 2) * 5;

    sessions.push({
      id: `demo-legs-${wIdx}`,
      name: 'Legs A — Quads, Hamstrings, Glutes & Calves',
      routineId: 'routine-ppl-legs',
      splitTag: 'Legs',
      startTime: daysAgoISO(legsDayOffset, 17, 45),
      endTime: daysAgoISO(legsDayOffset, 18, 57),
      durationMinutes: 72,
      notes: progressionStep === 9 ? 'Depth on squats was dialled in. New 117.5 kg working weight!' : undefined,
      exercises: [
        {
          id: `we-legs-${wIdx}-1`,
          exerciseId: 'ex-barbell-squat',
          restSeconds: 180,
          sets: [
            {
              id: `s-legs-${wIdx}-1-w`,
              setNumber: 1,
              type: 'warmup',
              weightKg: 70,
              reps: 6,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-1-1`,
              setNumber: 1,
              type: 'working',
              weightKg: squatWeight,
              reps: squatReps,
              completed: true,
              prs: progressionStep === 9 ? ['weight', '1rm', 'volume'] : undefined,
            },
            {
              id: `s-legs-${wIdx}-1-2`,
              setNumber: 2,
              type: 'working',
              weightKg: squatWeight,
              reps: squatReps,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-1-3`,
              setNumber: 3,
              type: 'working',
              weightKg: squatWeight - 5,
              reps: squatReps + 1,
              completed: true,
            },
          ],
        },
        {
          id: `we-legs-${wIdx}-2`,
          exerciseId: 'ex-rdl',
          restSeconds: 150,
          sets: [
            {
              id: `s-legs-${wIdx}-2-1`,
              setNumber: 1,
              type: 'working',
              weightKg: rdlWeight,
              reps: 8 + (progressionStep % 2),
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-2-2`,
              setNumber: 2,
              type: 'working',
              weightKg: rdlWeight,
              reps: 8,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-2-3`,
              setNumber: 3,
              type: 'working',
              weightKg: rdlWeight,
              reps: 8,
              completed: true,
            },
          ],
        },
        {
          id: `we-legs-${wIdx}-3`,
          exerciseId: 'ex-leg-press',
          restSeconds: 120,
          sets: [
            {
              id: `s-legs-${wIdx}-3-1`,
              setNumber: 1,
              type: 'working',
              weightKg: legPressWeight,
              reps: 12,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-3-2`,
              setNumber: 2,
              type: 'working',
              weightKg: legPressWeight,
              reps: 12,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-3-3`,
              setNumber: 3,
              type: 'working',
              weightKg: legPressWeight,
              reps: 11,
              completed: true,
            },
          ],
        },
        {
          id: `we-legs-${wIdx}-4`,
          exerciseId: 'ex-seated-leg-curl',
          supersetGroup: 'A',
          restSeconds: 90,
          sets: [
            {
              id: `s-legs-${wIdx}-4-1`,
              setNumber: 1,
              type: 'working',
              weightKg: legCurlWeight,
              reps: 13,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-4-2`,
              setNumber: 2,
              type: 'working',
              weightKg: legCurlWeight,
              reps: 12,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-4-3`,
              setNumber: 3,
              type: 'working',
              weightKg: legCurlWeight,
              reps: 11,
              completed: true,
            },
          ],
        },
        {
          id: `we-legs-${wIdx}-5`,
          exerciseId: 'ex-leg-extension',
          supersetGroup: 'A',
          restSeconds: 90,
          sets: [
            {
              id: `s-legs-${wIdx}-5-1`,
              setNumber: 1,
              type: 'working',
              weightKg: legExtWeight,
              reps: 14,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-5-2`,
              setNumber: 2,
              type: 'working',
              weightKg: legExtWeight,
              reps: 13,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-5-3`,
              setNumber: 3,
              type: 'working',
              weightKg: legExtWeight,
              reps: 12,
              completed: true,
            },
          ],
        },
        {
          id: `we-legs-${wIdx}-6`,
          exerciseId: 'ex-standing-calf-raise',
          restSeconds: 75,
          sets: [
            {
              id: `s-legs-${wIdx}-6-1`,
              setNumber: 1,
              type: 'working',
              weightKg: calfWeight,
              reps: 14,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-6-2`,
              setNumber: 2,
              type: 'working',
              weightKg: calfWeight,
              reps: 13,
              completed: true,
            },
            {
              id: `s-legs-${wIdx}-6-3`,
              setNumber: 3,
              type: 'working',
              weightKg: calfWeight,
              reps: 12,
              completed: true,
            },
          ],
        },
      ],
    });
  });

  // Sort newest first
  return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

export function generateDemoMeasurements(): BodyMeasurementEntry[] {
  const entries: BodyMeasurementEntry[] = [];
  for (let i = 20; i >= 0; i--) {
    const daysAgo = i * 3;
    const progress = (20 - i) / 20;
    const noise = Math.sin(i * 1.7) * 0.25;
    const bw = Number((76.2 + progress * 1.9 + noise).toFixed(1));
    entries.push({
      id: `demo-bw-${i}`,
      date: daysAgoDateStr(daysAgo),
      bodyweightKg: bw,
    });
  }
  return entries.reverse();
}

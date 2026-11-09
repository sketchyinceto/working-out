/**
 * Exports a workout summary for the claude.ai diet tracker.
 *
 *   npm run diet-sync -- training <profile>    Workout summary as JSON on stdout
 *
 * The diet tracker's storage can only be written by Claude, so a scheduled
 * Claude task runs this nightly and copies the result into the diet tracker.
 * Nothing is written back to this app.
 */
import { normalizeState } from '../src/utils/normalizeState';
import { normalizeUserKey } from '../src/hooks/useCloudSync';
import { getWorkingSets } from '../src/utils/analytics';
import { calculateEstimated1RM } from '../src/utils/calculators';
import { toLocalDateStr } from '../src/utils/dates';
import { getProgrammeStatus, latestBodyweightKg } from '../src/utils/coach/programme';
import { nutritionFor } from '../src/data/programmes';

import { findStalls } from '../src/utils/coach/stalls';
import { computeTrainerScore } from '../src/utils/coach/scoring';
import { defaultProfile } from '../src/utils/coach/schedule';
import type { WorkoutSession } from '../src/types/workout';

const CLOUD_DB_URL = 'https://yk-lifts-6416e-default-rtdb.asia-southeast1.firebasedatabase.app';

const DAY = 86_400_000;
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) fail(`Firebase read failed: HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- training

function sessionStats(w: WorkoutSession) {
  let sets = 0;
  let tonnage = 0;
  for (const b of w.exercises) {
    for (const s of getWorkingSets(b.sets)) {
      sets += 1;
      tonnage += s.weightKg * s.reps;
    }
  }
  return { sets, tonnage };
}

function windowStats(workouts: WorkoutSession[], from: number, to: number) {
  const inWin = workouts.filter((w) => {
    const t = new Date(w.startTime).getTime();
    return t >= from && t < to;
  });
  let sets = 0;
  let tonnage = 0;
  let minutes = 0;
  for (const w of inWin) {
    const s = sessionStats(w);
    sets += s.sets;
    tonnage += s.tonnage;
    minutes += w.durationMinutes || 0;
  }
  return { sessions: inWin.length, workingSets: sets, tonnageKg: r0(tonnage), minutes: r0(minutes) };
}

async function training(profileName: string) {
  const key = normalizeUserKey(profileName);
  if (!key) fail('Give the profile name you use in the workout tracker.');
  const raw = await getJson(`${CLOUD_DB_URL}/users/${key}.json`);
  if (!raw) fail(`No workout data found for profile "${key}".`);
  const state = normalizeState(raw);
  const now = new Date();
  const nowMs = now.getTime();
  const workouts = state.workouts.filter((w) => !Number.isNaN(new Date(w.startTime).getTime()));
  const exMap = new Map(state.exercises.map((e) => [e.id, e]));
  const profile = state.trainingProfile ?? defaultProfile(state.routines);
  const status = getProgrammeStatus(state.programme, now);
  const week = status?.week ?? null;

  const recent = [...workouts]
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 6)
    .map((w) => {
      const { sets, tonnage } = sessionStats(w);
      const lifts = w.exercises
        .map((b) => {
          const best = getWorkingSets(b.sets).sort(
            (x, y) => calculateEstimated1RM(y.weightKg, y.reps) - calculateEstimated1RM(x.weightKg, x.reps)
          )[0];
          if (!best) return null;
          return {
            exercise: exMap.get(b.exerciseId)?.name ?? 'Exercise',
            bestSet: `${r1(best.weightKg)} kg × ${best.reps}`,
            e1rmKg: r1(calculateEstimated1RM(best.weightKg, best.reps)),
          };
        })
        .filter(Boolean)
        .slice(0, 6);
      return {
        date: toLocalDateStr(new Date(w.startTime)),
        name: w.name,
        minutes: r0(w.durationMinutes || 0),
        workingSets: sets,
        tonnageKg: r0(tonnage),
        lifts,
      };
    });

  const score = computeTrainerScore(workouts, state.exercises, state.measurements, profile, state.programme, now);
  const stalls = findStalls(workouts, state.exercises, state.routines, state.programme, now).map((s) => ({
    exercise: s.exercise.name,
    kind: s.kind,
    headline: s.headline,
    sessions: s.sessions,
  }));
  const last28 = windowStats(workouts, nowMs - 28 * DAY, nowMs + DAY);
  const trainingDates = [...new Set(
    workouts
      .filter((w) => new Date(w.startTime).getTime() >= nowMs - 14 * DAY)
      .map((w) => toLocalDateStr(new Date(w.startTime)))
  )].sort();
  const bw = latestBodyweightKg(state.measurements);
  const bwEntry = [...state.measurements].sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    source: 'workout-tracker',
    syncedAt: now.toISOString(),
    profile: key,
    goal: profile.goal,
    experience: profile.experience,
    plannedDaysPerWeek: profile.trainingDays.length,
    programme: status
      ? {
          name: status.template.name,
          startDate: state.programme?.startDate ?? null,
          week: status.weekNumber,
          totalWeeks: status.totalWeeks,
          finished: status.finished,
          notStarted: status.notStarted,
          phase: week?.phase ?? null,
          block: week?.block ?? null,
          weekKind: week?.kind ?? null,
          focus: week?.focus ?? null,
          nutritionAdvice: week ? nutritionFor(week).calories : null,
        }
      : null,
    score: {
      overall: score.overall,
      grade: score.grade,
      summary: score.summary,
      parts: score.subscores.map((p) => ({ label: p.label, score: p.score, detail: p.detail })),
    },
    last7: windowStats(workouts, nowMs - 7 * DAY, nowMs + DAY),
    last28: { ...last28, sessionsPerWeek: r1(last28.sessions / 4) },
    trainingDates,
    recentSessions: recent,
    stalls,
    bodyweight: bw && bwEntry ? { date: bwEntry.date, kg: bw } : null,
  };
}

const [cmd, profile] = process.argv.slice(2);
if (cmd === 'training' && profile) console.log(JSON.stringify(await training(profile), null, 2));
else fail('Usage: diet-sync training <profile>');

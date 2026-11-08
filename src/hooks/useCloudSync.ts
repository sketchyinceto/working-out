import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppDatabaseState } from '../types/workout';
import { SEED_EXERCISES } from '../data/seedExercises';
import { STARTER_ROUTINES } from '../data/starterRoutines';
import { mergeStates, normalizeState } from '../utils/normalizeState';

// Older versions kept everyone's data under this one key (and mirrored the
// active user's data into it). It is now only read once, to migrate it.
const LEGACY_STORAGE_KEY = 'apex_lift_tracker_v2';
const CURRENT_USER_KEY = 'yk_lifts_current_user';
// Old versions let the database URL be overridden; no longer used.
const OBSOLETE_CLOUD_URL_KEY = 'yk_lifts_cloud_db_url';
// Set while this device has changes the cloud hasn't confirmed yet.
const PENDING_SYNC_PREFIX = 'yk_lifts_pending_sync_';
const CLOUD_SAVE_DEBOUNCE_MS = 800;
const CLOUD_RETRY_INTERVAL_MS = 30_000;

const CLOUD_DB_URL =
  'https://yk-lifts-6416e-default-rtdb.asia-southeast1.firebasedatabase.app';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export function normalizeUserKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
}

function cloudEndpoint(userKey: string): string {
  return `${CLOUD_DB_URL}/users/${userKey}.json`;
}

function getUserStorageKey(userName: string): string {
  const key = normalizeUserKey(userName);
  return key ? `${LEGACY_STORAGE_KEY}_${key}` : LEGACY_STORAGE_KEY;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isSyncPending(userKey: string): boolean {
  return readStorage(PENDING_SYNC_PREFIX + userKey) === '1';
}

function setSyncPending(userKey: string, pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_SYNC_PREFIX + userKey, '1');
    else localStorage.removeItem(PENDING_SYNC_PREFIX + userKey);
  } catch {
    // Ignore
  }
}

function buildInitialState(): AppDatabaseState {
  return {
    unit: 'kg',
    exercises: SEED_EXERCISES,
    routines: STARTER_ROUTINES,
    workouts: [],
    measurements: [],
    activeWorkout: null,
    isDemoData: false,
  };
}

function loadLocalUserState(userName: string): AppDatabaseState {
  try {
    const userKey = normalizeUserKey(userName);
    const own = localStorage.getItem(getUserStorageKey(userName));
    const legacy = userKey ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    if (legacy && userKey) {
      // Hand the legacy copy to this user only if they have nothing of their
      // own, then retire it so it can't leak into another profile.
      if (!own) localStorage.setItem(getUserStorageKey(userName), legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const cached = own || legacy;
    if (cached) return normalizeState(JSON.parse(cached));
  } catch {
    // Fallback
  }
  return buildInitialState();
}

/**
 * Owns the app's data: loads the current profile from this device and from
 * Firebase, saves every change locally at once and to the cloud shortly
 * after, and keeps unsynced changes safe while offline.
 */
export function useCloudSync() {
  const [userName, setUserName] = useState<string>(
    () => readStorage(CURRENT_USER_KEY) || ''
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [state, setState] = useState<AppDatabaseState>(() =>
    loadLocalUserState(userName)
  );
  // Which profile `state` currently belongs to. While switching users there is
  // one render where userName is new but state is still the old user's.
  const [stateOwner, setStateOwner] = useState<string>(userName);

  const isHydratingRef = useRef(true);
  // True once the cloud copy for the current profile has been read. Until then
  // nothing is uploaded, so a device that starts offline can't overwrite
  // newer data from another device with its stale copy.
  const cloudReadOkRef = useRef(false);
  const pullsInFlightRef = useRef(0);
  const currentUserKeyRef = useRef(normalizeUserKey(userName));
  const lastQueuedJsonRef = useRef<string>('');
  const latestStateRef = useRef<AppDatabaseState>(state);
  const saveTimerRef = useRef<{ id: number; userKey: string } | null>(null);
  const inFlightRef = useRef(false);
  const queuedSavesRef = useRef(new Map<string, AppDatabaseState>());

  // Upload one snapshot. Requests never overlap, so an older save can't land
  // after a newer one; saves requested mid-flight are sent next.
  const pushToCloud = useCallback((userKey: string, snapshot: AppDatabaseState) => {
    if (!userKey) return;
    if (inFlightRef.current) {
      queuedSavesRef.current.set(userKey, snapshot);
      return;
    }
    inFlightRef.current = true;
    const body = JSON.stringify(snapshot);
    setSyncStatus('syncing');
    fetch(cloudEndpoint(userKey), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      // Lets a save finish even if the page is being closed (64 KB limit).
      keepalive: body.length < 60_000,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // Only clear the flag if nothing newer is waiting to be sent.
        if (!queuedSavesRef.current.has(userKey)) setSyncPending(userKey, false);
        setSyncStatus('synced');
      })
      .catch(() => setSyncStatus('error'))
      .finally(() => {
        inFlightRef.current = false;
        const next = queuedSavesRef.current.entries().next();
        if (!next.done) {
          const [nextKey, nextSnapshot] = next.value;
          queuedSavesRef.current.delete(nextKey);
          pushToCloud(nextKey, nextSnapshot);
        }
      });
  }, []);

  // Read the cloud copy and reconcile it with this device's copy.
  const pullFromCloud = useCallback(
    (userKey: string, isCancelled: () => boolean) => {
      pullsInFlightRef.current += 1;
      setSyncStatus('syncing');
      return fetch(cloudEndpoint(userKey))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((serverData) => {
          if (isCancelled()) return;
          cloudReadOkRef.current = true;

          if (!serverData || typeof serverData !== 'object') {
            // Nothing in the cloud for this user yet: upload this device's copy.
            setSyncPending(userKey, true);
            pushToCloud(userKey, latestStateRef.current);
            return;
          }

          const server = normalizeState(serverData);
          const pending = isSyncPending(userKey);
          // If this device has changes that never reached the cloud (e.g.
          // logged with no signal), keep both sides' new data.
          const next = pending ? mergeStates(latestStateRef.current, server) : server;
          lastQueuedJsonRef.current = JSON.stringify(next);
          latestStateRef.current = next;
          setState(next);
          if (pending) pushToCloud(userKey, next);
          else setSyncStatus('synced');
        })
        .catch(() => {
          // Couldn't read the cloud: keep using the local copy. Retried below.
          if (!isCancelled()) setSyncStatus('error');
        })
        .finally(() => {
          pullsInFlightRef.current -= 1;
        });
    },
    [pushToCloud]
  );

  const flushScheduledSave = useCallback(() => {
    const scheduled = saveTimerRef.current;
    if (!scheduled) return;
    window.clearTimeout(scheduled.id);
    saveTimerRef.current = null;
    if (cloudReadOkRef.current) pushToCloud(scheduled.userKey, latestStateRef.current);
  }, [pushToCloud]);

  // Load the profile: local copy first (instant), then the cloud copy.
  useEffect(() => {
    // Anything still waiting to be saved belongs to the previous profile.
    flushScheduledSave();

    const userKey = normalizeUserKey(userName);
    currentUserKeyRef.current = userKey;
    let cancelled = false;
    isHydratingRef.current = true;
    cloudReadOkRef.current = false;
    const localState = loadLocalUserState(userName);
    lastQueuedJsonRef.current = JSON.stringify(localState);
    latestStateRef.current = localState;
    setState(localState);
    setStateOwner(userName);

    if (!userKey) {
      isHydratingRef.current = false;
      return;
    }

    pullFromCloud(userKey, () => cancelled).finally(() => {
      if (!cancelled) isHydratingRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [userName, pullFromCloud, flushScheduledSave]);

  // Save locally on every change, and to the cloud shortly after changes stop.
  useEffect(() => {
    if (stateOwner !== userName) return;
    latestStateRef.current = state;
    const userKey = normalizeUserKey(userName);
    const serialized = JSON.stringify(state);
    try {
      localStorage.setItem(getUserStorageKey(userName), serialized);
    } catch {
      // Ignore quota errors
    }

    if (serialized === lastQueuedJsonRef.current) return;
    lastQueuedJsonRef.current = serialized;
    if (!userKey) return;
    setSyncPending(userKey, true);
    // Until the cloud copy has been read, changes wait behind the pending
    // flag and are merged in once it arrives.
    if (isHydratingRef.current || !cloudReadOkRef.current) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current.id);
    saveTimerRef.current = {
      userKey,
      id: window.setTimeout(() => {
        saveTimerRef.current = null;
        pushToCloud(userKey, latestStateRef.current);
      }, CLOUD_SAVE_DEBOUNCE_MS),
    };
  }, [state, stateOwner, userName, pushToCloud]);

  // Don't lose the last few seconds of changes when the app is closed or
  // backgrounded, and keep retrying when the cloud couldn't be reached.
  useEffect(() => {
    const retry = () => {
      const userKey = normalizeUserKey(userName);
      if (!userKey || isHydratingRef.current || saveTimerRef.current) return;
      if (!cloudReadOkRef.current) {
        if (pullsInFlightRef.current > 0) return;
        pullFromCloud(userKey, () => currentUserKeyRef.current !== userKey);
      } else if (isSyncPending(userKey)) {
        pushToCloud(userKey, latestStateRef.current);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushScheduledSave();
      else retry();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushScheduledSave);
    window.addEventListener('online', retry);
    const retryId = window.setInterval(retry, CLOUD_RETRY_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushScheduledSave);
      window.removeEventListener('online', retry);
      window.clearInterval(retryId);
    };
  }, [userName, pushToCloud, pullFromCloud, flushScheduledSave]);

  const switchProfile = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(CURRENT_USER_KEY, trimmed);
      localStorage.removeItem(OBSOLETE_CLOUD_URL_KEY);
    } catch {
      // Ignore
    }
    setUserName(trimmed);
  }, []);

  return {
    userName,
    state,
    setState: setState as React.Dispatch<React.SetStateAction<AppDatabaseState>>,
    syncStatus,
    switchProfile,
  };
}

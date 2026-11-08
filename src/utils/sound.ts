// One shared AudioContext for the whole app. Browsers (Safari especially) cap
// how many can exist, and iOS only lets one play sound after it has been
// started from a tap, so it is created/resumed from a user gesture via
// primeAudio() and reused for every chime.
let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
  } catch {
    sharedCtx = null;
  }
  return sharedCtx;
}

/** Call from a tap/click handler so later chimes are allowed to play. */
export function primeAudio() {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function playCompletionChime() {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.15, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.36);
    });
  } catch {
    // Ignore audio restrictions
  }
}

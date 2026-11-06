import React, { useEffect, useState } from 'react';
import { Bell, SkipForward, Timer } from 'lucide-react';
import { RestTimerState } from '../../types/workout';

interface RestTimerHUDProps {
  timer: RestTimerState;
  onAdjustSeconds: (deltaSeconds: number) => void;
  onDismiss: () => void;
}

function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
    // Ignore audio context restriction if un-interacted
  }
}

export const RestTimerHUD: React.FC<RestTimerHUDProps> = ({
  timer,
  onAdjustSeconds,
  onDismiss,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    Math.max(0, Math.ceil((timer.targetEndTimeMs - Date.now()) / 1000))
  );
  const [hasChimed, setHasChimed] = useState(false);

  useEffect(() => {
    setHasChimed(false);
  }, [timer.targetEndTimeMs]);

  useEffect(() => {
    if (!timer.isActive) return;

    const tick = () => {
      const rem = Math.max(0, Math.ceil((timer.targetEndTimeMs - Date.now()) / 1000));
      setRemainingSeconds(rem);
      if (rem === 0 && !hasChimed) {
        setHasChimed(true);
        playCompletionChime();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timer.isActive, timer.targetEndTimeMs, hasChimed]);

  if (!timer.isActive) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formatted = `${mins}:${String(secs).padStart(2, '0')}`;
  const progressPct = Math.min(
    100,
    Math.max(0, (remainingSeconds / Math.max(1, timer.totalDurationSeconds)) * 100)
  );
  const isFinished = remainingSeconds === 0;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md">
      <div
        className={`rounded-[22px] border p-3 shadow-2xl backdrop-blur-2xl transition-all ${
          isFinished
            ? 'bg-[#1c1c1e]/95 border-[#a4ff00]'
            : 'bg-[#1c1c1e]/95 border-white/10'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                isFinished
                  ? 'bg-[#a4ff00] text-black animate-pulse'
                  : 'bg-[#a4ff00]/15 text-[#a4ff00]'
              }`}
            >
              {isFinished ? <Bell className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono-num text-white leading-none">
                  {isFinished ? 'READY!' : formatted}
                </span>
                <span className="text-[11px] text-[#8e8e93] truncate">
                  {timer.exerciseName}
                </span>
              </div>
              <div className="w-32 sm:w-40 h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-[#a4ff00] transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onAdjustSeconds(-15)}
              className="px-2.5 py-1.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs font-mono-num font-semibold text-white"
            >
              -15s
            </button>
            <button
              type="button"
              onClick={() => onAdjustSeconds(15)}
              className="px-2.5 py-1.5 rounded-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-xs font-mono-num font-semibold text-white"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-full bg-[#a4ff00] text-black text-xs font-bold inline-flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {isFinished ? 'Done' : 'Skip'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Dumbbell, User } from 'lucide-react';
import type { SyncStatus } from '../../hooks/useCloudSync';

const SYNC_DOT: Record<SyncStatus, { className: string; title: string }> = {
  synced: { className: 'bg-[#a4ff00]', title: 'Cloud synced' },
  syncing: { className: 'bg-[#ffe620] animate-pulse', title: 'Syncing…' },
  error: { className: 'bg-[#fa114f]', title: 'Not synced yet (offline?)' },
  idle: { className: 'bg-[#8e8e93]', title: 'Not synced yet' },
};

interface AppHeaderProps {
  userName: string;
  syncStatus: SyncStatus;
  onOpenProfile: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  userName,
  syncStatus,
  onOpenProfile,
}) => {
  const dot = SYNC_DOT[syncStatus];
  return (
    <header className="safe-header sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-white/[0.08]">
      <div className="max-w-3xl mx-auto px-4 h-13 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center shrink-0">
            <Dumbbell className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-white">
            YK <span className="text-[#a4ff00]">LIFTS</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/[0.08] text-xs font-semibold text-white transition"
          title="Switch profile"
        >
          <User className="w-3.5 h-3.5 text-[#a4ff00]" />
          <span className="max-w-[110px] truncate">{userName || 'Set Name'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${dot.className}`} title={dot.title} />
        </button>
      </div>
    </header>
  );
};

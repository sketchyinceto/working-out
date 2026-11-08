import React, { useState } from 'react';
import { User } from 'lucide-react';

interface ProfileModalProps {
  currentName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentName,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(currentName);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name);
        }}
        className="w-full max-w-sm bg-[#1c1c1e] border border-white/10 rounded-[26px] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#a4ff00]/15 text-[#a4ff00] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {currentName ? 'Athlete Profile' : 'Welcome to YK LIFTS'}
            </h2>
            <p className="text-xs text-[#8e8e93]">
              Enter your name to save & load your workouts across devices.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="profile-name"
            className="block text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-1"
          >
            Your Name
          </label>
          <input
            id="profile-name"
            type="text"
            autoFocus
            required
            placeholder="e.g. Keven"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#2c2c2e] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white placeholder-[#636366] focus:outline-none focus:border-[#a4ff00]"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {currentName && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-full bg-[#2c2c2e] text-white font-semibold text-xs"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-full bg-[#a4ff00] disabled:opacity-40 text-black font-extrabold text-xs"
          >
            {currentName ? 'Save Profile' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
};

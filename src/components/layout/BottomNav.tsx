import React from 'react';
import { BarChart3, BookOpen, Dumbbell, History, Sparkles } from 'lucide-react';

export type NavTab = 'analytics' | 'trainer' | 'routines' | 'logger' | 'history' | 'exercises';

const TABS: { tab: NavTab; label: string; icon: typeof BarChart3 }[] = [
  { tab: 'analytics', label: 'Summary', icon: BarChart3 },
  { tab: 'trainer', label: 'Trainer', icon: Sparkles },
  { tab: 'routines', label: 'Routines', icon: Dumbbell },
  { tab: 'history', label: 'History', icon: History },
  { tab: 'exercises', label: 'Exercises', icon: BookOpen },
];

interface BottomNavProps {
  activeTab: NavTab;
  onSelect: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelect }) => (
  <nav className="safe-nav fixed bottom-0 inset-x-0 z-40 bg-[#121214]/90 backdrop-blur-2xl border-t border-white/[0.08]">
    <div className="max-w-md mx-auto grid grid-cols-5 h-13 px-1.5">
      {TABS.map(({ tab, label, icon: Icon }) => {
        // The workout logger lives under the Routines tab.
        const isActive = activeTab === tab || (tab === 'routines' && activeTab === 'logger');
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 transition ${
              isActive ? 'text-[#a4ff00] font-semibold' : 'text-[#8e8e93] hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

import React from 'react';
import { Exercise } from '../../types/workout';
import { getMusclePalette } from '../../utils/splitTheme';

interface ExerciseDiagramProps {
  exercise: Exercise;
  size?: 'sm' | 'lg';
}

type MovementPattern =
  | 'bench_press'
  | 'incline_press'
  | 'chest_fly'
  | 'dips'
  | 'overhead_press'
  | 'lateral_raise'
  | 'triceps_pushdown'
  | 'overhead_triceps'
  | 'vertical_pull'
  | 'bent_row'
  | 'seated_row'
  | 'rear_delt'
  | 'biceps_curl'
  | 'squat'
  | 'hip_hinge'
  | 'leg_press'
  | 'split_squat'
  | 'leg_curl'
  | 'leg_extension'
  | 'hip_thrust'
  | 'calf_raise'
  | 'core';

function resolvePattern(ex: Exercise): MovementPattern {
  const id = ex.id;
  const name = (ex.name || '').toLowerCase();
  const muscle = (ex.primaryMuscle || 'chest').toLowerCase();
  const equip = (ex.equipment || 'barbell').toLowerCase();

  // 1. Direct ID matches for standard seed exercises
  if (id === 'ex-bench-press' || id === 'ex-machine-chest-press') return 'bench_press';
  if (id === 'ex-incline-db-press' || id === 'ex-incline-bb-press') return 'incline_press';
  if (id === 'ex-cable-fly' || id === 'ex-pec-deck') return 'chest_fly';
  if (id === 'ex-weighted-dips') return 'dips';
  if (id === 'ex-ohp' || id === 'ex-seated-db-shoulder-press') return 'overhead_press';
  if (id === 'ex-db-lateral-raise' || id === 'ex-cable-lateral-raise') return 'lateral_raise';
  if (id === 'ex-triceps-pushdown') return 'triceps_pushdown';
  if (id === 'ex-overhead-cable-extension' || id === 'ex-skullcrushers') return 'overhead_triceps';
  if (id === 'ex-weighted-pullup' || id === 'ex-lat-pulldown') return 'vertical_pull';
  if (id === 'ex-barbell-row' || id === 'ex-single-arm-db-row') return 'bent_row';
  if (id === 'ex-chest-supported-row' || id === 'ex-seated-cable-row') return 'seated_row';
  if (id === 'ex-face-pull' || id === 'ex-rear-delt-fly') return 'rear_delt';
  if (
    id === 'ex-incline-db-curl' ||
    id === 'ex-ez-bar-curl' ||
    id === 'ex-hammer-curl' ||
    id === 'ex-preacher-curl'
  )
    return 'biceps_curl';
  if (id === 'ex-barbell-squat' || id === 'ex-hack-squat') return 'squat';
  if (id === 'ex-rdl' || id === 'ex-conventional-deadlift') return 'hip_hinge';
  if (id === 'ex-leg-press') return 'leg_press';
  if (id === 'ex-bulgarian-split-squat') return 'split_squat';
  if (id === 'ex-seated-leg-curl' || id === 'ex-lying-leg-curl') return 'leg_curl';
  if (id === 'ex-leg-extension') return 'leg_extension';
  if (id === 'ex-hip-thrust') return 'hip_thrust';
  if (id === 'ex-standing-calf-raise') return 'calf_raise';
  if (id === 'ex-cable-crunch' || id === 'ex-hanging-leg-raise') return 'core';

  // 2. Intelligent pattern recognition from exercise name, targeted muscle & equipment
  if (name.includes('incline') && (name.includes('press') || name.includes('bench') || muscle.includes('chest'))) {
    return 'incline_press';
  }
  if (name.includes('fly') || name.includes('crossover') || name.includes('pec deck')) {
    return 'chest_fly';
  }
  if (name.includes('dip')) {
    return 'dips';
  }
  if (
    name.includes('overhead press') ||
    name.includes('shoulder press') ||
    name.includes('military') ||
    name.includes('arnold') ||
    (muscle.includes('front_delt') && name.includes('press'))
  ) {
    return 'overhead_press';
  }
  if (
    name.includes('lateral') ||
    name.includes('side delt') ||
    (muscle.includes('side_delt') && !name.includes('press'))
  ) {
    return 'lateral_raise';
  }
  if (name.includes('overhead') && (name.includes('tricep') || name.includes('extension') || name.includes('skull'))) {
    return 'overhead_triceps';
  }
  if (
    name.includes('pushdown') ||
    name.includes('kickback') ||
    (muscle.includes('tricep') && equip.includes('cable'))
  ) {
    return 'triceps_pushdown';
  }
  if (name.includes('pullup') || name.includes('chin') || name.includes('pulldown') || name.includes('pullover')) {
    return 'vertical_pull';
  }
  if (
    name.includes('seated row') ||
    name.includes('cable row') ||
    name.includes('chest supported') ||
    (muscle.includes('back') && equip.includes('cable'))
  ) {
    return 'seated_row';
  }
  if (name.includes('row') || muscle.includes('upper_back')) {
    return 'bent_row';
  }
  if (name.includes('face pull') || name.includes('rear delt') || muscle.includes('rear_delt')) {
    return 'rear_delt';
  }
  if (name.includes('curl') || muscle.includes('bicep') || muscle.includes('forearm')) {
    return 'biceps_curl';
  }
  if (
    name.includes('split squat') ||
    name.includes('lunge') ||
    name.includes('bulgarian') ||
    name.includes('step up')
  ) {
    return 'split_squat';
  }
  if (name.includes('leg press')) {
    return 'leg_press';
  }
  if (name.includes('leg extension') || name.includes('quad extension') || (muscle.includes('quad') && equip.includes('machine'))) {
    return 'leg_extension';
  }
  if (name.includes('leg curl') || name.includes('hamstring curl') || (muscle.includes('hamstring') && equip.includes('machine'))) {
    return 'leg_curl';
  }
  if (
    name.includes('deadlift') ||
    name.includes('rdl') ||
    name.includes('hinge') ||
    name.includes('good morning') ||
    muscle.includes('hamstring') ||
    muscle.includes('lower_back')
  ) {
    return 'hip_hinge';
  }
  if (name.includes('thrust') || name.includes('glute bridge') || muscle.includes('glute')) {
    return 'hip_thrust';
  }
  if (name.includes('calf') || name.includes('calves') || muscle.includes('calf')) {
    return 'calf_raise';
  }
  if (
    name.includes('crunch') ||
    name.includes('plank') ||
    name.includes('ab') ||
    name.includes('leg raise') ||
    muscle.includes('abs')
  ) {
    return 'core';
  }
  if (name.includes('squat') || muscle.includes('quad')) {
    return 'squat';
  }

  // 3. Robust Muscle Group + Equipment Fallbacks
  switch (ex.primaryMuscle) {
    case 'chest':
      return equip === 'cable' ? 'chest_fly' : 'bench_press';
    case 'front_delts':
      return 'overhead_press';
    case 'side_delts':
      return 'lateral_raise';
    case 'triceps':
      return equip === 'cable' ? 'triceps_pushdown' : 'overhead_triceps';
    case 'lats':
      return 'vertical_pull';
    case 'upper_back':
      return equip === 'cable' ? 'seated_row' : 'bent_row';
    case 'rear_delts':
      return 'rear_delt';
    case 'biceps':
    case 'forearms':
      return 'biceps_curl';
    case 'quads':
      return equip === 'machine' ? 'leg_extension' : 'squat';
    case 'hamstrings':
    case 'lower_back':
      return equip === 'machine' ? 'leg_curl' : 'hip_hinge';
    case 'glutes':
      return 'hip_thrust';
    case 'calves':
      return 'calf_raise';
    case 'abs':
      return 'core';
    default:
      return 'bench_press';
  }
}

export const ExerciseDiagram: React.FC<ExerciseDiagramProps> = ({
  exercise,
  size = 'sm',
}) => {
  const pattern = resolvePattern(exercise);
  const isLarge = size === 'lg';
  const palette = getMusclePalette(exercise.primaryMuscle);
  const primary = palette.hex;
  const secondary = palette.secondaryHex;

  const renderScene = () => {
    switch (pattern) {
      case 'bench_press':
        return (
          <g>
            {/* Flat Bench */}
            <rect x="20" y="68" width="68" height="6" rx="3" fill="#3f3f46" />
            <rect x="28" y="74" width="5" height="20" fill="#27272a" />
            <rect x="74" y="74" width="5" height="20" fill="#27272a" />
            {/* Lifter Body */}
            <circle cx="30" cy="60" r="6" fill="#a1a1aa" />
            <line x1="36" y1="63" x2="72" y2="63" stroke={primary} strokeWidth="6" strokeLinecap="round" />
            <polyline points="72,63 86,65 88,90" fill="none" stroke="#71717a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Ghost Start Position (Chest) */}
            <line x1="44" y1="62" x2="44" y2="50" stroke="#52525b" strokeWidth="3.5" strokeDasharray="2 2" />
            <circle cx="44" cy="48" r="5" fill="none" stroke="#52525b" strokeWidth="2" strokeDasharray="2 2" />
            {/* Active Lockout Position */}
            <line x1="44" y1="62" x2="44" y2="28" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <circle cx="44" cy="24" r="7" fill={primary} stroke="#ffffff" strokeWidth="1.5" />
            {/* Force Arrow */}
            <path d="M 60 54 L 60 24 M 56 29 L 60 23 L 64 29" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'incline_press':
        return (
          <g>
            {/* 30-deg Incline Bench */}
            <line x1="26" y1="44" x2="66" y2="74" stroke="#3f3f46" strokeWidth="6" strokeLinecap="round" />
            <line x1="66" y1="74" x2="80" y2="70" stroke="#3f3f46" strokeWidth="5" strokeLinecap="round" />
            <line x1="36" y1="52" x2="36" y2="92" stroke="#27272a" strokeWidth="4" />
            <line x1="66" y1="74" x2="66" y2="92" stroke="#27272a" strokeWidth="4" />
            {/* Lifter */}
            <circle cx="33" cy="36" r="6" fill="#a1a1aa" />
            <line x1="38" y1="42" x2="64" y2="66" stroke={primary} strokeWidth="6" strokeLinecap="round" />
            <polyline points="64,66 82,66 86,90" fill="none" stroke="#71717a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Pressing Arm + Dumbbell */}
            <line x1="46" y1="49" x2="46" y2="20" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <rect x="38" y="14" width="16" height="6" rx="2" fill={primary} stroke="#ffffff" strokeWidth="1.2" />
            {/* Force Arrow */}
            <path d="M 60 44 L 60 18 M 56 23 L 60 17 L 64 23" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'chest_fly':
        return (
          <g>
            {/* Top-down / Front Torso View */}
            <circle cx="60" cy="24" r="7" fill="#a1a1aa" />
            <rect x="46" y="34" width="28" height="36" rx="8" fill={primary} fillOpacity="0.25" stroke={primary} strokeWidth="2.5" />
            {/* Stretched Arms Out Wide (Dashed) */}
            <path d="M 46 42 Q 24 44 16 54" fill="none" stroke="#52525b" strokeWidth="3.5" strokeDasharray="3 2" strokeLinecap="round" />
            <path d="M 74 42 Q 96 44 104 54" fill="none" stroke="#52525b" strokeWidth="3.5" strokeDasharray="3 2" strokeLinecap="round" />
            {/* Contracted Arms Hugging Inward */}
            <path d="M 46 42 Q 44 62 56 66" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <path d="M 74 42 Q 76 62 64 66" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            {/* Arc Arrows */}
            <path d="M 22 58 Q 36 72 52 70 M 47 67 L 53 70 L 48 74" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 98 58 Q 84 72 68 70 M 73 67 L 67 70 L 72 74" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'dips':
        return (
          <g>
            {/* Dip Bars */}
            <line x1="26" y1="54" x2="94" y2="54" stroke="#3f3f46" strokeWidth="4" strokeLinecap="round" />
            <line x1="34" y1="54" x2="34" y2="94" stroke="#27272a" strokeWidth="4" />
            <line x1="86" y1="54" x2="86" y2="94" stroke="#27272a" strokeWidth="4" />
            {/* Leaning Torso */}
            <circle cx="52" cy="22" r="6" fill="#a1a1aa" />
            <line x1="54" y1="30" x2="64" y2="58" stroke={primary} strokeWidth="6" strokeLinecap="round" />
            {/* Arms on Bar */}
            <polyline points="56,36 46,44 50,54" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {/* Crossed Legs */}
            <polyline points="64,58 68,76 58,86" fill="none" stroke="#71717a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 80 62 L 80 28 M 76 33 L 80 27 L 84 33" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'overhead_press':
        return (
          <g>
            {/* Standing / Seated Lifter */}
            <circle cx="60" cy="40" r="6.5" fill="#a1a1aa" />
            <line x1="60" y1="48" x2="60" y2="76" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            <line x1="60" y1="76" x2="52" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            <line x1="60" y1="76" x2="68" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            {/* Ghost Start at Shoulders */}
            <polyline points="48,50 38,58 42,44" fill="none" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" />
            <polyline points="72,50 82,58 78,44" fill="none" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" />
            {/* Overhead Lockout Arms + Bar */}
            <polyline points="52,50 44,32 46,16" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="68,50 76,32 74,16" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="28" y1="16" x2="92" y2="16" stroke={primary} strokeWidth="4" strokeLinecap="round" />
            <rect x="30" y="10" width="5" height="12" rx="1.5" fill={secondary} />
            <rect x="85" y="10" width="5" height="12" rx="1.5" fill={secondary} />
            {/* Upward Arrow */}
            <path d="M 98 46 L 98 18 M 94 23 L 98 17 L 102 23" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'lateral_raise':
        return (
          <g>
            <circle cx="60" cy="26" r="6.5" fill="#a1a1aa" />
            <line x1="60" y1="35" x2="60" y2="70" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            <line x1="60" y1="70" x2="52" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            <line x1="60" y1="70" x2="68" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            {/* Highlight Side Delts */}
            <circle cx="50" cy="38" r="4.5" fill={primary} />
            <circle cx="70" cy="38" r="4.5" fill={primary} />
            {/* Arms Down (Dashed) */}
            <line x1="50" y1="38" x2="44" y2="66" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" strokeLinecap="round" />
            <line x1="70" y1="38" x2="76" y2="66" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Arms Raised to 90 deg */}
            <line x1="50" y1="38" x2="20" y2="36" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <line x1="70" y1="38" x2="100" y2="36" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <rect x="14" y="32" width="6" height="8" rx="1.5" fill={primary} />
            <rect x="100" y="32" width="6" height="8" rx="1.5" fill={primary} />
            {/* Sweep Arcs */}
            <path d="M 36 64 Q 22 54 22 42 M 19 46 L 22 41 L 26 46" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 84 64 Q 98 54 98 42 M 94 46 L 98 41 L 101 46" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'triceps_pushdown':
        return (
          <g>
            {/* High Cable Column */}
            <line x1="28" y1="10" x2="28" y2="94" stroke="#3f3f46" strokeWidth="4" />
            <circle cx="28" cy="14" r="4" fill="#52525b" />
            <line x1="28" y1="14" x2="52" y2="52" stroke="#71717a" strokeWidth="1.5" strokeDasharray="2 2" />
            {/* Lifter Side Profile */}
            <circle cx="68" cy="24" r="6.5" fill="#a1a1aa" />
            <line x1="68" y1="32" x2="70" y2="68" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            <line x1="70" y1="68" x2="66" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            {/* Upper Arm Pinned + Triceps Highlight */}
            <line x1="66" y1="36" x2="64" y2="54" stroke={primary} strokeWidth="5" strokeLinecap="round" />
            {/* Forearm Start (Flexed) */}
            <line x1="64" y1="54" x2="48" y2="44" stroke="#52525b" strokeWidth="3.5" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Forearm Finish (Extended Down) */}
            <line x1="64" y1="54" x2="58" y2="74" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            {/* Downward Arc Arrow */}
            <path d="M 44 48 Q 42 64 52 74 M 47 74 L 53 75 L 51 69" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'overhead_triceps':
        return (
          <g>
            <circle cx="62" cy="34" r="6.5" fill="#a1a1aa" />
            <line x1="62" y1="42" x2="62" y2="76" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            <line x1="62" y1="76" x2="58" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            {/* Upper Arm Angled High */}
            <line x1="62" y1="42" x2="54" y2="24" stroke={primary} strokeWidth="5" strokeLinecap="round" />
            {/* Stretched Forearm Behind Head (Dashed) */}
            <line x1="54" y1="24" x2="72" y2="36" stroke="#52525b" strokeWidth="3.5" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Extended Overhead Forearm */}
            <line x1="54" y1="24" x2="42" y2="10" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <path d="M 74 30 Q 64 12 48 10 M 53 7 L 47 10 L 52 14" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'vertical_pull':
        return (
          <g>
            {/* Overhead Bar */}
            <line x1="22" y1="14" x2="98" y2="14" stroke="#3f3f46" strokeWidth="4" strokeLinecap="round" />
            {/* Lifter Back View */}
            <circle cx="60" cy="40" r="6.5" fill="#a1a1aa" />
            {/* V-Taper Lats Highlight */}
            <polygon points="46,48 74,48 66,76 54,76" fill={primary} fillOpacity="0.3" stroke={primary} strokeWidth="2" />
            {/* Stretched Overhead Arms (Dashed) */}
            <line x1="48" y1="48" x2="34" y2="14" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" />
            <line x1="72" y1="48" x2="86" y2="14" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" />
            {/* Pulled Down Elbows */}
            <polyline points="48,50 32,60 36,36" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="72,50 88,60 84,36" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="26" y1="36" x2="94" y2="36" stroke={primary} strokeWidth="3.5" strokeLinecap="round" />
            {/* Downward Pull Arrows */}
            <path d="M 20 20 L 20 48 M 16 43 L 20 49 L 24 43" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 100 20 L 100 48 M 96 43 L 100 49 L 104 43" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'bent_row':
        return (
          <g>
            {/* Hinged Lifter */}
            <circle cx="34" cy="34" r="6.5" fill="#a1a1aa" />
            {/* 45-degree Back */}
            <line x1="40" y1="38" x2="74" y2="56" stroke={primary} strokeWidth="6" strokeLinecap="round" />
            {/* Hips -> Knees -> Ankles */}
            <polyline points="74,56 66,74 70,92" fill="none" stroke="#71717a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Hanging Arm (Dashed) */}
            <line x1="48" y1="44" x2="48" y2="76" stroke="#52525b" strokeWidth="3" strokeDasharray="2 2" />
            {/* Rowed Arm + Barbell at Sternum */}
            <polyline points="48,44 62,38 56,56" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="55" cy="58" r="7" fill={primary} stroke="#ffffff" strokeWidth="1.5" />
            {/* Pull Arrow */}
            <path d="M 36 78 L 46 56 M 41 58 L 46 55 L 48 61" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'seated_row':
        return (
          <g>
            {/* Cable Pulley + Bench */}
            <line x1="18" y1="24" x2="18" y2="84" stroke="#3f3f46" strokeWidth="4" />
            <line x1="22" y1="84" x2="88" y2="84" stroke="#3f3f46" strokeWidth="4" />
            {/* Upright Seated Lifter */}
            <circle cx="72" cy="28" r="6.5" fill="#a1a1aa" />
            <line x1="72" y1="36" x2="72" y2="68" stroke={primary} strokeWidth="6.5" strokeLinecap="round" />
            <polyline points="72,68 48,68 32,80" fill="none" stroke="#71717a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Cable Line + Pulled Arm */}
            <line x1="18" y1="52" x2="66" y2="52" stroke="#71717a" strokeWidth="2" strokeDasharray="3 2" />
            <polyline points="70,40 82,50 66,54" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {/* Horizontal Pull Arrow */}
            <path d="M 32 42 L 58 42 M 53 38 L 59 42 L 53 46" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'rear_delt':
        return (
          <g>
            <circle cx="60" cy="28" r="6.5" fill="#a1a1aa" />
            <rect x="46" y="38" width="28" height="34" rx="6" fill={primary} fillOpacity="0.2" stroke={primary} strokeWidth="2" />
            {/* Rear Delt Caps */}
            <circle cx="44" cy="42" r="5" fill={primary} />
            <circle cx="76" cy="42" r="5" fill={primary} />
            {/* Arms Sweeping Out & Back */}
            <polyline points="44,42 22,38 20,26" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="76,42 98,38 100,26" fill="none" stroke={secondary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 38 56 L 20 44 M 22 49 L 19 43 L 26 43" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 82 56 L 100 44 M 94 43 L 101 43 L 98 49" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'biceps_curl':
        return (
          <g>
            <circle cx="52" cy="22" r="6.5" fill="#a1a1aa" />
            <line x1="52" y1="30" x2="52" y2="68" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            <line x1="52" y1="68" x2="52" y2="94" stroke="#52525b" strokeWidth="5" strokeLinecap="round" />
            {/* Pinned Upper Arm + Biceps Peak */}
            <line x1="54" y1="34" x2="56" y2="56" stroke={primary} strokeWidth="5.5" strokeLinecap="round" />
            {/* Extended Bottom Forearm (Dashed) */}
            <line x1="56" y1="56" x2="64" y2="76" stroke="#52525b" strokeWidth="3.5" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Curled Top Forearm + Dumbbell */}
            <line x1="56" y1="56" x2="72" y2="38" stroke={secondary} strokeWidth="4" strokeLinecap="round" />
            <circle cx="74" cy="36" r="5" fill={primary} stroke="#ffffff" strokeWidth="1.5" />
            {/* Upward Curl Arc */}
            <path d="M 74 74 Q 88 56 80 38 M 77 43 L 80 37 L 85 41" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'squat':
        return (
          <g>
            {/* Ground Line */}
            <line x1="20" y1="92" x2="100" y2="92" stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" />
            {/* Lifter in Bottom Squat */}
            <circle cx="52" cy="26" r="6" fill="#a1a1aa" />
            {/* Barbell on Traps */}
            <circle cx="48" cy="34" r="6.5" fill={primary} stroke="#ffffff" strokeWidth="1.5" />
            {/* Torso */}
            <line x1="48" y1="34" x2="36" y2="62" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Quads & Glutes Highlighted */}
            <line x1="36" y1="62" x2="66" y2="64" stroke={primary} strokeWidth="6.5" strokeLinecap="round" />
            {/* Shins */}
            <line x1="66" y1="64" x2="56" y2="90" stroke="#71717a" strokeWidth="5" strokeLinecap="round" />
            {/* Drive Up Arrow */}
            <path d="M 84 74 L 84 26 M 80 31 L 84 25 L 88 31" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'hip_hinge':
        return (
          <g>
            <line x1="20" y1="92" x2="100" y2="92" stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" />
            {/* Hinged Torso & Hamstring Stretch */}
            <circle cx="72" cy="32" r="6" fill="#a1a1aa" />
            <line x1="66" y1="36" x2="36" y2="52" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Hamstrings & Glutes Highlight */}
            <line x1="36" y1="52" x2="46" y2="72" stroke={primary} strokeWidth="6.5" strokeLinecap="round" />
            <line x1="46" y1="72" x2="48" y2="90" stroke="#71717a" strokeWidth="5" strokeLinecap="round" />
            {/* Vertical Arms + Barbell Close to Shins */}
            <line x1="62" y1="39" x2="60" y2="68" stroke="#a1a1aa" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="60" cy="72" r="7.5" fill={primary} stroke="#ffffff" strokeWidth="1.5" />
            {/* Hip Hinge Arc Arrow */}
            <path d="M 24 52 Q 26 32 44 26 M 39 23 L 45 26 L 40 30" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'leg_press':
        return (
          <g>
            {/* 45-deg Sled Track & Seat */}
            <line x1="22" y1="26" x2="68" y2="72" stroke="#3f3f46" strokeWidth="4" strokeLinecap="round" />
            <polyline points="56,82 72,82 88,64" fill="none" stroke="#3f3f46" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Lifter in Seat */}
            <circle cx="84" cy="54" r="5.5" fill="#a1a1aa" />
            <line x1="80" y1="60" x2="68" y2="78" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Quads + Shins Pressing Platform */}
            <polyline points="68,78 62,56 42,44" fill="none" stroke={secondary} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Footplate */}
            <line x1="34" y1="52" x2="48" y2="36" stroke={primary} strokeWidth="5" strokeLinecap="round" />
            {/* Diagonal Press Arrow */}
            <path d="M 48 28 L 28 12 M 29 18 L 27 11 L 34 12" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'split_squat':
        return (
          <g>
            {/* Rear Foot Bench */}
            <rect x="76" y="66" width="22" height="6" rx="2" fill="#3f3f46" />
            <line x1="86" y1="72" x2="86" y2="92" stroke="#27272a" strokeWidth="4" />
            {/* Lifter */}
            <circle cx="48" cy="22" r="6" fill="#a1a1aa" />
            <line x1="48" y1="30" x2="48" y2="58" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Front Quad & Shin */}
            <polyline points="48,58 30,62 32,90" fill="none" stroke={primary} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Rear Elevated Leg */}
            <polyline points="48,58 64,78 82,66" fill="none" stroke="#52525b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 20 68 L 20 34 M 16 39 L 20 33 L 24 39" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'leg_curl':
        return (
          <g>
            {/* Seated Leg Curl Machine */}
            <polyline points="34,34 34,66 68,66" fill="none" stroke="#3f3f46" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="42" y1="66" x2="42" y2="92" stroke="#27272a" strokeWidth="4" />
            <circle cx="42" cy="26" r="6" fill="#a1a1aa" />
            <line x1="42" y1="34" x2="42" y2="62" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Thighs on Pad */}
            <line x1="42" y1="62" x2="72" y2="62" stroke={primary} strokeWidth="6" strokeLinecap="round" />
            {/* Extended Lower Leg (Dashed) */}
            <line x1="72" y1="62" x2="96" y2="62" stroke="#52525b" strokeWidth="4" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Curled Lower Leg Back & Down */}
            <line x1="72" y1="62" x2="66" y2="88" stroke={secondary} strokeWidth="5" strokeLinecap="round" />
            <path d="M 94 70 Q 88 86 72 88 M 77 85 L 71 88 L 76 92" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'leg_extension':
        return (
          <g>
            <polyline points="34,34 34,66 66,66" fill="none" stroke="#3f3f46" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="42" y1="66" x2="42" y2="92" stroke="#27272a" strokeWidth="4" />
            <circle cx="42" cy="26" r="6" fill="#a1a1aa" />
            <line x1="42" y1="34" x2="42" y2="62" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Quads Highlight */}
            <line x1="42" y1="60" x2="70" y2="60" stroke={primary} strokeWidth="6.5" strokeLinecap="round" />
            {/* Start Bent Knee (Dashed) */}
            <line x1="70" y1="60" x2="70" y2="88" stroke="#52525b" strokeWidth="4" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Extended Lockout Leg */}
            <line x1="70" y1="60" x2="98" y2="56" stroke={secondary} strokeWidth="5" strokeLinecap="round" />
            <path d="M 78 86 Q 94 78 96 62 M 92 67 L 96 61 L 100 67" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'hip_thrust':
        return (
          <g>
            {/* Bench for Upper Back */}
            <rect x="18" y="56" width="22" height="34" rx="3" fill="#3f3f46" />
            <circle cx="28" cy="46" r="6" fill="#a1a1aa" />
            {/* Horizontal Torso & Glute Bridge at Lockout */}
            <line x1="34" y1="54" x2="66" y2="54" stroke={primary} strokeWidth="7" strokeLinecap="round" />
            {/* Barbell on Hips */}
            <circle cx="58" cy="48" r="6.5" fill={primary} stroke="#ffffff" strokeWidth="1.5" />
            {/* Vertical Shins */}
            <polyline points="66,54 84,56 84,90" fill="none" stroke="#71717a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Upward Hip Drive Arrow */}
            <path d="M 58 84 L 58 62 M 54 67 L 58 61 L 62 67" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'calf_raise':
        return (
          <g>
            {/* Step Block */}
            <rect x="34" y="82" width="36" height="10" rx="2" fill="#3f3f46" />
            <circle cx="56" cy="18" r="5.5" fill="#a1a1aa" />
            <line x1="56" y1="25" x2="56" y2="52" stroke="#71717a" strokeWidth="6" strokeLinecap="round" />
            {/* Highlighted Calves */}
            <line x1="56" y1="52" x2="56" y2="74" stroke={primary} strokeWidth="6.5" strokeLinecap="round" />
            {/* Foot Raised on Toes */}
            <line x1="56" y1="74" x2="46" y2="82" stroke="#e4e4e7" strokeWidth="4" strokeLinecap="round" />
            <path d="M 76 80 L 76 48 M 72 53 L 76 47 L 80 53" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );

      case 'core':
        return (
          <g>
            {/* Pull-up / Cable Frame */}
            <line x1="40" y1="12" x2="80" y2="12" stroke="#3f3f46" strokeWidth="4" strokeLinecap="round" />
            <circle cx="56" cy="28" r="5.5" fill="#a1a1aa" />
            <line x1="56" y1="12" x2="56" y2="34" stroke="#71717a" strokeWidth="3.5" />
            {/* Core Highlight */}
            <line x1="56" y1="34" x2="56" y2="60" stroke={primary} strokeWidth="6.5" strokeLinecap="round" />
            {/* Hanging Legs (Dashed) */}
            <line x1="56" y1="60" x2="56" y2="88" stroke="#52525b" strokeWidth="4" strokeDasharray="2 2" strokeLinecap="round" />
            {/* Raised Legs */}
            <line x1="56" y1="60" x2="86" y2="48" stroke={secondary} strokeWidth="5" strokeLinecap="round" />
            <path d="M 70 86 Q 88 76 88 56 M 84 61 L 88 55 L 92 61" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
    }
  };

  return (
    <div
      style={palette.cardGlowStyle}
      className={`relative rounded-[18px] bg-black/65 border ${palette.cardBorderClass} flex items-center justify-center overflow-hidden shrink-0 ${
        isLarge ? 'w-full h-44 sm:h-48' : 'w-14 h-14'
      }`}
    >
      {/* Subtle Grid Backdrop */}
      <svg
        viewBox="0 0 120 104"
        className={isLarge ? 'w-48 h-40' : 'w-13 h-13'}
      >
        {isLarge && (
          <g stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.75">
            <line x1="0" y1="26" x2="120" y2="26" />
            <line x1="0" y1="52" x2="120" y2="52" />
            <line x1="0" y1="78" x2="120" y2="78" />
            <line x1="30" y1="0" x2="30" y2="104" />
            <line x1="60" y1="0" x2="60" y2="104" />
            <line x1="90" y1="0" x2="90" y2="104" />
          </g>
        )}
        {renderScene()}
      </svg>

      {isLarge && (
        <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[10px] text-[#8e8e93] pointer-events-none">
          <span className="inline-flex items-center gap-1 bg-[#1c1c1e]/90 px-2.5 py-0.5 rounded-full">
            <span className="w-2 h-0.5 bg-[#8e8e93] inline-block" /> Start
          </span>
          <span className="inline-flex items-center gap-1 bg-[#1c1c1e]/90 px-2.5 py-0.5 rounded-full text-white">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: primary }}
            />{' '}
            Peak Contraction
          </span>
          <span className="inline-flex items-center gap-1 bg-[#1c1c1e]/90 px-2.5 py-0.5 rounded-full text-[#ffe620]">
            ↑ Force Path
          </span>
        </div>
      )}
    </div>
  );
};

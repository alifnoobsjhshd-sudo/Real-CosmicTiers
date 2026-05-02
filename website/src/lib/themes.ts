export type ThemeId =
  | 'cosmic'
  | 'summer'
  | 'christmas'
  | 'winter'
  | 'raining'
  | 'cherry_blossom'
  | 'blossom'
  | 'moon'
  | 'april_fool'
  | 'halloween';

export type ParticleType =
  | 'stars'
  | 'snow'
  | 'blizzard'
  | 'rain'
  | 'petals'
  | 'sakura'
  | 'flowers'
  | 'fireflies'
  | 'confetti'
  | 'leaves'
  | 'bats'
  | 'sparkles';

export interface ParticleConfig {
  type: ParticleType;
  count: number;
  colors: string[];
  speedX: number;
  speedY: number;
  sizeMin: number;
  sizeMax: number;
  opacity: number;
  glow?: string;
  glowRadius?: number;
}

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  emoji: string;
  description: string;
  cssVars: {
    background: string;
    primary: string;
    primaryForeground: string;
    card: string;
    border: string;
    muted: string;
    mutedForeground: string;
    ring: string;
  };
  bgGradient: string;
  navTint: string;
  heroGradient: string;
  heroGridColor: string;
  shimmerGradient: string;
  glowColor: string;
  logoColor: string;
  particles: ParticleConfig | null;
  ambientNotes: number[];
  previewGradient: string;
  previewParticleColor: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  cosmic: {
    id: 'cosmic',
    label: 'Cosmic',
    emoji: '🌌',
    description: 'The default deep space theme with gold accents and floating stars.',
    cssVars: {
      background: '213 30% 9%',
      primary: '45 90% 55%',
      primaryForeground: '213 30% 9%',
      card: '213 27% 11%',
      border: '213 22% 18%',
      muted: '213 25% 15%',
      mutedForeground: '213 18% 52%',
      ring: '45 90% 55%',
    },
    bgGradient: 'radial-gradient(ellipse at 20% 50%, hsl(270 40% 12%) 0%, hsl(213 30% 7%) 50%, hsl(213 35% 5%) 100%)',
    navTint: 'rgba(10, 14, 22, 0.92)',
    heroGradient: 'linear-gradient(135deg, hsl(213 30% 7%) 0%, hsl(213 25% 10%) 40%, hsl(45 25% 9%) 75%, hsl(213 30% 7%) 100%)',
    heroGridColor: 'hsl(213 30% 20% / 0.12)',
    shimmerGradient: 'linear-gradient(90deg, hsl(45 90% 55%) 0%, hsl(45 100% 75%) 40%, hsl(45 90% 55%) 60%, hsl(45 70% 45%) 100%)',
    glowColor: 'rgba(255, 191, 0, 0.45)',
    logoColor: '#c084fc',
    particles: {
      type: 'stars',
      count: 80,
      colors: ['#ffffff', '#e0e8ff', '#ffeebb'],
      speedX: 0,
      speedY: 0,
      sizeMin: 0.8,
      sizeMax: 2.5,
      opacity: 0.7,
      glow: '#ffffff',
      glowRadius: 4,
    },
    ambientNotes: [130.81, 164.81, 196.00],
    previewGradient: 'radial-gradient(ellipse at 30% 60%, #2d1b5e 0%, #0d1117 60%, #0a0e16 100%)',
    previewParticleColor: '#ffffff',
  },

  summer: {
    id: 'summer',
    label: 'Summer',
    emoji: '☀️',
    description: 'Warm golden vibes with dancing fireflies on a tropical night.',
    cssVars: {
      background: '30 40% 7%',
      primary: '38 95% 55%',
      primaryForeground: '30 40% 7%',
      card: '30 35% 10%',
      border: '30 28% 18%',
      muted: '30 32% 13%',
      mutedForeground: '30 22% 50%',
      ring: '38 95% 55%',
    },
    bgGradient: 'radial-gradient(ellipse at 80% 20%, hsl(38 60% 12%) 0%, hsl(30 50% 7%) 50%, hsl(20 40% 5%) 100%)',
    navTint: 'rgba(30, 16, 4, 0.93)',
    heroGradient: 'linear-gradient(135deg, hsl(30 40% 6%) 0%, hsl(30 35% 9%) 40%, hsl(38 30% 8%) 75%, hsl(30 40% 6%) 100%)',
    heroGridColor: 'hsl(38 50% 30% / 0.10)',
    shimmerGradient: 'linear-gradient(90deg, hsl(38 95% 55%) 0%, hsl(45 100% 70%) 40%, hsl(38 95% 55%) 60%, hsl(30 85% 45%) 100%)',
    glowColor: 'rgba(255, 160, 0, 0.45)',
    logoColor: '#fb923c',
    particles: {
      type: 'fireflies',
      count: 30,
      colors: ['#fcd34d', '#fbbf24', '#f59e0b', '#fffbeb'],
      speedX: 0.8,
      speedY: 0.5,
      sizeMin: 2.5,
      sizeMax: 5,
      opacity: 0.85,
      glow: '#fcd34d',
      glowRadius: 14,
    },
    ambientNotes: [261.63, 329.63, 392.00, 523.25],
    previewGradient: 'radial-gradient(ellipse at 70% 20%, #3d1f06 0%, #1e0d02 60%, #120900 100%)',
    previewParticleColor: '#fcd34d',
  },

  christmas: {
    id: 'christmas',
    label: 'Christmas',
    emoji: '🎄',
    description: 'Festive red & green with magical snowfall and holiday cheer.',
    cssVars: {
      background: '355 38% 7%',
      primary: '0 78% 52%',
      primaryForeground: '0 0% 100%',
      card: '355 32% 10%',
      border: '355 25% 18%',
      muted: '355 28% 13%',
      mutedForeground: '355 18% 50%',
      ring: '0 78% 52%',
    },
    bgGradient: 'radial-gradient(ellipse at 50% 0%, hsl(142 40% 10%) 0%, hsl(355 38% 7%) 45%, hsl(355 45% 5%) 100%)',
    navTint: 'rgba(22, 6, 6, 0.93)',
    heroGradient: 'linear-gradient(135deg, hsl(355 38% 6%) 0%, hsl(355 32% 9%) 40%, hsl(142 25% 8%) 75%, hsl(355 38% 6%) 100%)',
    heroGridColor: 'hsl(0 60% 30% / 0.10)',
    shimmerGradient: 'linear-gradient(90deg, hsl(0 78% 52%) 0%, hsl(0 90% 70%) 40%, hsl(0 78% 52%) 60%, hsl(142 60% 40%) 100%)',
    glowColor: 'rgba(220, 38, 38, 0.45)',
    logoColor: '#4ade80',
    particles: {
      type: 'snow',
      count: 65,
      colors: ['#ffffff', '#f0f4ff', '#dbeafe'],
      speedX: 0.5,
      speedY: 1.2,
      sizeMin: 2,
      sizeMax: 5,
      opacity: 0.85,
      glow: '#ffffff',
      glowRadius: 5,
    },
    ambientNotes: [220.00, 261.63, 329.63, 440.00],
    previewGradient: 'radial-gradient(ellipse at 50% 0%, #0d2914 0%, #1c0505 50%, #120202 100%)',
    previewParticleColor: '#ffffff',
  },

  winter: {
    id: 'winter',
    label: 'Winter',
    emoji: '❄️',
    description: 'A freezing blizzard of ice blue and white in deep arctic night.',
    cssVars: {
      background: '210 50% 7%',
      primary: '200 90% 65%',
      primaryForeground: '210 50% 7%',
      card: '210 45% 10%',
      border: '210 35% 18%',
      muted: '210 40% 13%',
      mutedForeground: '210 25% 52%',
      ring: '200 90% 65%',
    },
    bgGradient: 'radial-gradient(ellipse at 50% 30%, hsl(210 55% 12%) 0%, hsl(210 50% 7%) 55%, hsl(220 60% 5%) 100%)',
    navTint: 'rgba(4, 12, 26, 0.94)',
    heroGradient: 'linear-gradient(135deg, hsl(210 50% 6%) 0%, hsl(210 45% 9%) 40%, hsl(200 40% 8%) 75%, hsl(210 50% 6%) 100%)',
    heroGridColor: 'hsl(200 70% 50% / 0.10)',
    shimmerGradient: 'linear-gradient(90deg, hsl(200 90% 65%) 0%, hsl(200 100% 85%) 40%, hsl(200 90% 65%) 60%, hsl(210 80% 55%) 100%)',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    logoColor: '#7dd3fc',
    particles: {
      type: 'blizzard',
      count: 110,
      colors: ['#ffffff', '#e0f2fe', '#bae6fd'],
      speedX: 2.5,
      speedY: 2.2,
      sizeMin: 1.5,
      sizeMax: 4,
      opacity: 0.75,
    },
    ambientNotes: [138.59, 164.81, 207.65],
    previewGradient: 'radial-gradient(ellipse at 50% 30%, #0c2040 0%, #040c1a 60%, #020810 100%)',
    previewParticleColor: '#bae6fd',
  },

  raining: {
    id: 'raining',
    label: 'Raining',
    emoji: '🌧️',
    description: 'A moody storm with driving rain and electric atmosphere.',
    cssVars: {
      background: '220 35% 7%',
      primary: '215 75% 58%',
      primaryForeground: '220 35% 7%',
      card: '220 30% 10%',
      border: '220 25% 17%',
      muted: '220 28% 13%',
      mutedForeground: '220 18% 50%',
      ring: '215 75% 58%',
    },
    bgGradient: 'linear-gradient(180deg, hsl(230 40% 8%) 0%, hsl(220 35% 7%) 60%, hsl(215 40% 6%) 100%)',
    navTint: 'rgba(6, 9, 20, 0.95)',
    heroGradient: 'linear-gradient(135deg, hsl(220 35% 6%) 0%, hsl(220 30% 9%) 40%, hsl(215 28% 8%) 75%, hsl(220 35% 6%) 100%)',
    heroGridColor: 'hsl(215 60% 40% / 0.09)',
    shimmerGradient: 'linear-gradient(90deg, hsl(215 75% 58%) 0%, hsl(210 90% 75%) 40%, hsl(215 75% 58%) 60%, hsl(220 65% 48%) 100%)',
    glowColor: 'rgba(59, 130, 246, 0.40)',
    logoColor: '#60a5fa',
    particles: {
      type: 'rain',
      count: 90,
      colors: ['rgba(147, 197, 253, 0.6)', 'rgba(191, 219, 254, 0.5)', 'rgba(219, 234, 254, 0.4)'],
      speedX: 0.8,
      speedY: 14,
      sizeMin: 0.5,
      sizeMax: 1,
      opacity: 0.6,
    },
    ambientNotes: [116.54, 146.83, 174.61],
    previewGradient: 'linear-gradient(180deg, #0d1224 0%, #080d16 60%, #050810 100%)',
    previewParticleColor: '#93c5fd',
  },

  cherry_blossom: {
    id: 'cherry_blossom',
    label: 'Cherry Blossom',
    emoji: '🌸',
    description: 'Soft pink petals drift through a deep rose twilight sky.',
    cssVars: {
      background: '340 35% 7%',
      primary: '340 80% 68%',
      primaryForeground: '340 35% 7%',
      card: '340 30% 10%',
      border: '340 22% 17%',
      muted: '340 26% 13%',
      mutedForeground: '340 16% 50%',
      ring: '340 80% 68%',
    },
    bgGradient: 'radial-gradient(ellipse at 30% 70%, hsl(330 45% 12%) 0%, hsl(340 35% 7%) 50%, hsl(350 40% 5%) 100%)',
    navTint: 'rgba(20, 5, 10, 0.93)',
    heroGradient: 'linear-gradient(135deg, hsl(340 35% 6%) 0%, hsl(340 30% 9%) 40%, hsl(330 28% 8%) 75%, hsl(340 35% 6%) 100%)',
    heroGridColor: 'hsl(340 60% 50% / 0.09)',
    shimmerGradient: 'linear-gradient(90deg, hsl(340 80% 68%) 0%, hsl(340 90% 82%) 40%, hsl(340 80% 68%) 60%, hsl(350 70% 55%) 100%)',
    glowColor: 'rgba(244, 114, 182, 0.40)',
    logoColor: '#f9a8d4',
    particles: {
      type: 'sakura',
      count: 35,
      colors: ['#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#fdf2f8'],
      speedX: 1.5,
      speedY: 1.0,
      sizeMin: 5,
      sizeMax: 12,
      opacity: 0.80,
    },
    ambientNotes: [277.18, 329.63, 415.30, 523.25],
    previewGradient: 'radial-gradient(ellipse at 30% 70%, #3d0f20 0%, #1a0509 60%, #100305 100%)',
    previewParticleColor: '#f9a8d4',
  },

  blossom: {
    id: 'blossom',
    label: 'Blossom',
    emoji: '🌼',
    description: 'Spring has arrived — flowers bloom and petals fill the air.',
    cssVars: {
      background: '160 30% 7%',
      primary: '145 65% 48%',
      primaryForeground: '160 30% 7%',
      card: '160 26% 10%',
      border: '160 20% 17%',
      muted: '160 23% 13%',
      mutedForeground: '160 15% 50%',
      ring: '145 65% 48%',
    },
    bgGradient: 'radial-gradient(ellipse at 60% 40%, hsl(160 40% 10%) 0%, hsl(160 30% 7%) 50%, hsl(150 35% 5%) 100%)',
    navTint: 'rgba(4, 18, 10, 0.93)',
    heroGradient: 'linear-gradient(135deg, hsl(160 30% 6%) 0%, hsl(160 26% 9%) 40%, hsl(145 22% 8%) 75%, hsl(160 30% 6%) 100%)',
    heroGridColor: 'hsl(145 55% 40% / 0.09)',
    shimmerGradient: 'linear-gradient(90deg, hsl(145 65% 48%) 0%, hsl(145 80% 65%) 40%, hsl(145 65% 48%) 60%, hsl(60 70% 50%) 100%)',
    glowColor: 'rgba(74, 222, 128, 0.35)',
    logoColor: '#86efac',
    particles: {
      type: 'flowers',
      count: 45,
      colors: ['#fce7f3', '#fef08a', '#bbf7d0', '#a5f3fc', '#e9d5ff', '#fed7aa'],
      speedX: 1.2,
      speedY: 0.9,
      sizeMin: 3,
      sizeMax: 9,
      opacity: 0.80,
    },
    ambientNotes: [261.63, 329.63, 392.00, 493.88],
    previewGradient: 'radial-gradient(ellipse at 60% 40%, #083518 0%, #030f07 60%, #010804 100%)',
    previewParticleColor: '#86efac',
  },

  moon: {
    id: 'moon',
    label: 'Moon Night',
    emoji: '🌙',
    description: 'A serene midnight sky bathed in silver moonlight and glittering stars.',
    cssVars: {
      background: '240 42% 6%',
      primary: '220 25% 82%',
      primaryForeground: '240 42% 6%',
      card: '240 38% 9%',
      border: '240 28% 16%',
      muted: '240 32% 12%',
      mutedForeground: '240 20% 52%',
      ring: '220 25% 82%',
    },
    bgGradient: 'radial-gradient(ellipse at 70% 20%, hsl(250 50% 10%) 0%, hsl(240 42% 6%) 50%, hsl(240 50% 4%) 100%)',
    navTint: 'rgba(3, 4, 14, 0.95)',
    heroGradient: 'linear-gradient(135deg, hsl(240 42% 5%) 0%, hsl(240 38% 8%) 40%, hsl(250 35% 7%) 75%, hsl(240 42% 5%) 100%)',
    heroGridColor: 'hsl(240 40% 40% / 0.08)',
    shimmerGradient: 'linear-gradient(90deg, hsl(220 25% 82%) 0%, hsl(220 40% 95%) 40%, hsl(220 25% 82%) 60%, hsl(240 20% 70%) 100%)',
    glowColor: 'rgba(203, 213, 225, 0.30)',
    logoColor: '#e2e8f0',
    particles: {
      type: 'sparkles',
      count: 70,
      colors: ['#ffffff', '#e2e8f0', '#c7d2fe', '#ddd6fe'],
      speedX: 0,
      speedY: 0,
      sizeMin: 1,
      sizeMax: 3,
      opacity: 0.9,
      glow: '#ffffff',
      glowRadius: 6,
    },
    ambientNotes: [185.00, 220.00, 261.63, 329.63],
    previewGradient: 'radial-gradient(ellipse at 70% 20%, #14104a 0%, #05050f 60%, #020208 100%)',
    previewParticleColor: '#e2e8f0',
  },

  april_fool: {
    id: 'april_fool',
    label: 'April Fool',
    emoji: '🃏',
    description: "It's chaos! Rainbow confetti and electric surprises everywhere.",
    cssVars: {
      background: '280 30% 7%',
      primary: '300 85% 62%',
      primaryForeground: '280 30% 7%',
      card: '280 25% 10%',
      border: '280 20% 17%',
      muted: '280 22% 13%',
      mutedForeground: '280 14% 50%',
      ring: '300 85% 62%',
    },
    bgGradient: 'radial-gradient(ellipse at 40% 60%, hsl(280 40% 10%) 0%, hsl(280 30% 7%) 50%, hsl(270 35% 5%) 100%)',
    navTint: 'rgba(14, 6, 20, 0.92)',
    heroGradient: 'linear-gradient(135deg, hsl(280 30% 6%) 0%, hsl(280 25% 9%) 40%, hsl(300 22% 8%) 75%, hsl(280 30% 6%) 100%)',
    heroGridColor: 'hsl(300 60% 50% / 0.09)',
    shimmerGradient: 'linear-gradient(90deg, #f87171 0%, #fb923c 15%, #fbbf24 30%, #4ade80 50%, #60a5fa 65%, #c084fc 80%, #f87171 100%)',
    glowColor: 'rgba(236, 72, 153, 0.40)',
    logoColor: '#f0abfc',
    particles: {
      type: 'confetti',
      count: 80,
      colors: ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc', '#f472b6', '#34d399'],
      speedX: 2.5,
      speedY: 2.0,
      sizeMin: 5,
      sizeMax: 11,
      opacity: 0.90,
    },
    ambientNotes: [261.63, 311.13, 392.00, 523.25],
    previewGradient: 'radial-gradient(ellipse at 40% 60%, #1e0d30 0%, #0d0514 60%, #080310 100%)',
    previewParticleColor: '#f0abfc',
  },

  halloween: {
    id: 'halloween',
    label: 'Halloween',
    emoji: '🎃',
    description: 'Bats swoop through the moonlit night and leaves scatter in the wind.',
    cssVars: {
      background: '25 50% 6%',
      primary: '25 90% 52%',
      primaryForeground: '25 50% 6%',
      card: '25 42% 9%',
      border: '25 32% 16%',
      muted: '25 38% 12%',
      mutedForeground: '25 20% 48%',
      ring: '25 90% 52%',
    },
    bgGradient: 'radial-gradient(ellipse at 50% 100%, hsl(270 35% 9%) 0%, hsl(25 50% 6%) 45%, hsl(15 55% 4%) 100%)',
    navTint: 'rgba(14, 6, 1, 0.94)',
    heroGradient: 'linear-gradient(135deg, hsl(25 50% 5%) 0%, hsl(25 42% 8%) 40%, hsl(270 28% 7%) 75%, hsl(25 50% 5%) 100%)',
    heroGridColor: 'hsl(25 70% 40% / 0.09)',
    shimmerGradient: 'linear-gradient(90deg, hsl(25 90% 52%) 0%, hsl(30 100% 68%) 40%, hsl(25 90% 52%) 60%, hsl(270 60% 50%) 100%)',
    glowColor: 'rgba(249, 115, 22, 0.40)',
    logoColor: '#fdba74',
    particles: {
      type: 'bats',
      count: 14,
      colors: ['#1c0f02', '#2d1504', '#3b1906'],
      speedX: 1.8,
      speedY: 0.3,
      sizeMin: 8,
      sizeMax: 18,
      opacity: 0.90,
    },
    ambientNotes: [110.00, 130.81, 155.56, 185.00],
    previewGradient: 'radial-gradient(ellipse at 50% 100%, #1e0d30 0%, #14050100 45%, #0a0200 100%), linear-gradient(180deg, #0d0200 0%, #1a0800 100%)',
    previewParticleColor: '#fb923c',
  },
};

export const THEME_ORDER: ThemeId[] = [
  'cosmic', 'summer', 'christmas', 'winter', 'raining',
  'cherry_blossom', 'blossom', 'moon', 'april_fool', 'halloween',
];

export function getTheme(id: string): ThemeConfig {
  return THEMES[id as ThemeId] ?? THEMES.cosmic;
}

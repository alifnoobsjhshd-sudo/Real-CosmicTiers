import { useEffect, useState } from "react";

const GAME_MODE_IMAGES = [
  { src: '/Sword-PvP.png',   left: '6%',  top: '14%', dur: '4.0s', delay: '0.0s', size: 64, opacity: 0.90 },
  { src: '/UHC.png',         left: '19%', top: '67%', dur: '3.7s', delay: '0.5s', size: 56, opacity: 0.85 },
  { src: '/Pot-PvP.png',     left: '76%', top: '16%', dur: '4.5s', delay: '1.0s', size: 60, opacity: 0.85 },
  { src: '/Nethpot.png',     left: '87%', top: '58%', dur: '3.9s', delay: '0.8s', size: 52, opacity: 0.80 },
  { src: '/Axe-PvP.png',     left: '4%',  top: '52%', dur: '5.0s', delay: '1.5s', size: 58, opacity: 0.80 },
  { src: '/Mace-PvP.png',    left: '82%', top: '76%', dur: '4.2s', delay: '0.3s', size: 54, opacity: 0.75 },
  { src: '/Crystal-PvP.png', left: '41%', top: '7%',  dur: '4.8s', delay: '1.8s', size: 50, opacity: 0.75 },
  { src: '/SMP-PvP.png',     left: '61%', top: '73%', dur: '3.5s', delay: '2.2s', size: 52, opacity: 0.70 },
  { src: '/Cart-PvP.png',    left: '27%', top: '79%', dur: '4.6s', delay: '1.2s', size: 48, opacity: 0.70 },
];

const AESTHETIC_EMOJIS = [
  { em: '✨', left: '13%', top: '36%', dur: '3.2s', delay: '0.7s', size: '1.3rem' },
  { em: '💜', left: '71%', top: '29%', dur: '4.1s', delay: '0.2s', size: '1.2rem' },
  { em: '🌙', left: '34%', top: '57%', dur: '5.2s', delay: '1.4s', size: '1.1rem' },
  { em: '🔮', left: '91%', top: '26%', dur: '3.8s', delay: '2.0s', size: '1.4rem' },
  { em: '💫', left: '50%', top: '84%', dur: '4.4s', delay: '0.9s', size: '1.0rem' },
  { em: '⭐', left: '2%',  top: '30%', dur: '4.9s', delay: '0.0s', size: '1.1rem' },
  { em: '🌟', left: '65%', top: '87%', dur: '3.6s', delay: '1.7s', size: '1.0rem' },
  { em: '🎮', left: '47%', top: '19%', dur: '4.3s', delay: '2.5s', size: '1.2rem' },
  { em: '⚡', left: '78%', top: '44%', dur: '3.3s', delay: '1.1s', size: '1.1rem' },
  { em: '🌌', left: '22%', top: '21%', dur: '5.5s', delay: '0.4s', size: '1.3rem' },
];

const TAB_LABELS: Record<string, string> = {
  leaderboard: 'Leaderboard',
  testers: 'Tier Testers',
  results: 'Results',
  top: 'Top Players',
  information: 'Information',
};

interface LoadingScreenProps {
  duration?: number;
  tabName?: string;
  onHide?: () => void;
}

export function LoadingScreen({ duration = 1800, tabName, onHide }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const pct = Math.min(((now - start) / duration) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setFading(true);
        setTimeout(() => onHide?.(), 500);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const label = tabName ? TAB_LABELS[tabName] ?? tabName : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center select-none transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, hsl(270 65% 6%) 0%, hsl(270 50% 10%) 40%, hsl(280 42% 8%) 75%, hsl(265 65% 5%) 100%)',
      }}
      data-testid="loading-screen"
    >
      {/* Pixel-grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(hsl(270 50% 45% / 0.07) 1px, transparent 1px),
            linear-gradient(90deg, hsl(270 50% 45% / 0.07) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Pixel star field */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={`ls-star-${i}`}
            className="absolute rounded-full"
            style={{
              width:  i % 5 === 0 ? '3px' : '2px',
              height: i % 5 === 0 ? '3px' : '2px',
              backgroundColor: i % 4 === 0
                ? 'rgba(190,110,255,0.75)'
                : i % 3 === 0
                  ? 'rgba(150,85,230,0.55)'
                  : 'rgba(210,160,255,0.35)',
              left: `${(i * 3.4 + 1.8) % 97}%`,
              top:  `${(i * 5.9 + 4) % 94}%`,
              animation: `mc-twinkle ${2.0 + (i % 5) * 0.7}s ease-in-out infinite`,
              animationDelay: `${(i * 0.31) % 3.5}s`,
            }}
          />
        ))}
      </div>

      {/* Floating game mode images */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {GAME_MODE_IMAGES.map((img, i) => (
          <img
            key={`gm-${i}`}
            src={img.src}
            alt=""
            className="absolute"
            style={{
              left: img.left, top: img.top,
              width: img.size, height: img.size,
              opacity: img.opacity,
              animation: `mc-float ${img.dur} ease-in-out infinite`,
              animationDelay: img.delay,
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 0 10px rgba(160,90,255,0.55))',
            }}
          />
        ))}
      </div>

      {/* Aesthetic emojis */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {AESTHETIC_EMOJIS.map((e, i) => (
          <span
            key={`ae-${i}`}
            className="absolute"
            style={{
              left: e.left, top: e.top,
              fontSize: e.size,
              opacity: 0.60,
              animation: `mc-float ${e.dur} ease-in-out infinite`,
              animationDelay: e.delay,
            }}
          >
            {e.em}
          </span>
        ))}
      </div>

      {/* ── Main centred content ── */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-8 text-center">

        {/* Three game mode icons as a logo cluster */}
        <div className="mc-animate-drop-in flex items-end justify-center gap-4 mb-1">
          <img src="/Axe-PvP.png" alt="" width={42} height={42}
            style={{
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 0 12px rgba(160,90,255,0.8))',
              animation: 'mc-float 3.8s ease-in-out infinite',
              animationDelay: '0.6s',
            }}
          />
          <img src="/Sword-PvP.png" alt="" width={58} height={58}
            style={{
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 0 16px rgba(160,90,255,0.9))',
              animation: 'mc-float 3.2s ease-in-out infinite',
              animationDelay: '0s',
            }}
          />
          <img src="/Crystal-PvP.png" alt="" width={42} height={42}
            style={{
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 0 12px rgba(160,90,255,0.8))',
              animation: 'mc-float 4.1s ease-in-out infinite',
              animationDelay: '1.0s',
            }}
          />
        </div>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight mc-animate-fade-up"
          style={{ animationDelay: '0.08s' }}
        >
          <span className="mc-shimmer-text-purple">Cosmic</span>
          <span className="text-white">Tiers</span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-sm sm:text-base mc-animate-fade-up"
          style={{ animationDelay: '0.18s', color: 'rgba(200,150,255,0.65)' }}
        >
          {label ? `Loading ${label}…` : 'Minecraft PvP · Ranked · Cracked · Free'}
        </p>

        {/* Progress bar */}
        <div
          className="mt-5 w-64 sm:w-80 xl:w-96 mc-animate-fade-up"
          style={{ animationDelay: '0.25s' }}
        >
          {/* Track */}
          <div
            className="relative h-2.5 rounded-full overflow-hidden"
            style={{
              background: 'rgba(160,90,255,0.12)',
              border: '1px solid rgba(160,90,255,0.22)',
            }}
          >
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, hsl(270 80% 45%), hsl(285 90% 62%), hsl(270 80% 45%))',
                backgroundSize: '200% auto',
                animation: 'mc-shimmer 1.4s linear infinite',
                boxShadow: '0 0 14px rgba(160,90,255,0.7), 0 0 4px rgba(200,140,255,0.5)',
                transition: 'width 16ms linear',
              }}
            />
            {/* Shine overlay */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 60%)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Percentage label */}
          <div
            className="mt-2 text-xs font-mono text-center tracking-widest"
            style={{ color: 'rgba(190,130,255,0.55)' }}
          >
            {Math.round(progress)}%
          </div>
        </div>

        {/* Bottom game mode strip */}
        <div
          className="mt-3 flex items-center justify-center gap-3 mc-animate-fade-up"
          style={{ animationDelay: '0.32s' }}
          aria-hidden="true"
        >
          {['/Pot-PvP.png','/Nethpot.png','/UHC.png','/Mace-PvP.png','/SMP-PvP.png','/Cart-PvP.png'].map((src, i) => (
            <img
              key={`strip-${i}`}
              src={src}
              alt=""
              width={24}
              height={24}
              style={{
                imageRendering: 'pixelated',
                opacity: 0.65,
                animation: `mc-float ${3.5 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                filter: 'drop-shadow(0 0 4px rgba(160,90,255,0.4))',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode } from "react";
import { getTheme, THEMES, type ThemeId, type ThemeConfig } from "@/lib/themes";
import { ParticleSystem } from "@/lib/particles";
import { audioManager } from "@/lib/audio";

interface ThemeContextType {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  particlesEnabled: boolean;
  setParticlesEnabled: (v: boolean) => void;
  particleDensity: "low" | "medium" | "high";
  setParticleDensity: (v: "low" | "medium" | "high") => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  ambientEnabled: boolean;
  setAmbientEnabled: (v: boolean) => void;
  playClick: () => void;
  playHover: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: "cosmic",
  theme: THEMES.cosmic,
  setTheme: () => {},
  particlesEnabled: true,
  setParticlesEnabled: () => {},
  particleDensity: "medium",
  setParticleDensity: () => {},
  soundEnabled: false,
  setSoundEnabled: () => {},
  ambientEnabled: false,
  setAmbientEnabled: () => {},
  playClick: () => {},
  playHover: () => {},
});

function safeGet(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const s = safeGet("ct_theme", "cosmic") as ThemeId;
    return THEMES[s] ? s : "cosmic";
  });
  const [particlesEnabled, setParticlesEnabledState] = useState(() =>
    safeGet("ct_particles", "true") !== "false"
  );
  const [particleDensity, setParticleDensityState] = useState<"low" | "medium" | "high">(() => {
    const s = safeGet("ct_particle_density", "medium");
    return s === "low" || s === "high" ? s : "medium";
  });
  const [soundEnabled, setSoundEnabledState] = useState(() =>
    safeGet("ct_sound", "false") === "true"
  );
  const [ambientEnabled, setAmbientEnabledState] = useState(() =>
    safeGet("ct_ambient", "false") === "true"
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const theme = getTheme(themeId);

  // Apply CSS vars synchronously before first paint
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", themeId);
    const v = theme.cssVars;
    el.style.setProperty("--background", v.background);
    el.style.setProperty("--primary", v.primary);
    el.style.setProperty("--primary-foreground", v.primaryForeground);
    el.style.setProperty("--card", v.card);
    el.style.setProperty("--border", v.border);
    el.style.setProperty("--muted", v.muted);
    el.style.setProperty("--muted-foreground", v.mutedForeground);
    el.style.setProperty("--ring", v.ring);
  }, [themeId]);

  // Fetch server-side active theme on mount
  useEffect(() => {
    fetch("/api/theme")
      .then(r => r.json())
      .then(data => {
        if (data?.theme && THEMES[data.theme as ThemeId]) {
          setThemeIdState(data.theme as ThemeId);
          safeSet("ct_theme", data.theme);
        }
      })
      .catch(() => {});
  }, []);

  // Init particle system
  useEffect(() => {
    if (!canvasRef.current) return;
    particleSystemRef.current = new ParticleSystem(canvasRef.current);
    return () => {
      particleSystemRef.current?.destroy();
      particleSystemRef.current = null;
    };
  }, []);

  // Update particles whenever theme or settings change
  useEffect(() => {
    const sys = particleSystemRef.current;
    if (!sys) return;
    const densityMap = { low: 0.5, medium: 1, high: 2 };
    if (particlesEnabled && theme.particles) {
      sys.setConfig(theme.particles, densityMap[particleDensity]);
    } else {
      sys.setConfig(null);
    }
  }, [themeId, particlesEnabled, particleDensity]);

  // Sync audio SFX setting
  useEffect(() => {
    audioManager.setSfxEnabled(soundEnabled);
  }, [soundEnabled]);

  // Sync ambient music setting + restart on theme change
  useEffect(() => {
    if (ambientEnabled) {
      audioManager.startAmbient(theme.ambientNotes);
    } else {
      audioManager.stopAmbient();
    }
  }, [ambientEnabled, themeId]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    safeSet("ct_theme", id);
  }, []);

  const setParticlesEnabled = useCallback((v: boolean) => {
    setParticlesEnabledState(v);
    safeSet("ct_particles", String(v));
  }, []);

  const setParticleDensity = useCallback((v: "low" | "medium" | "high") => {
    setParticleDensityState(v);
    safeSet("ct_particle_density", v);
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    safeSet("ct_sound", String(v));
    audioManager.setSfxEnabled(v);
  }, []);

  const setAmbientEnabled = useCallback((v: boolean) => {
    setAmbientEnabledState(v);
    safeSet("ct_ambient", String(v));
    if (v) audioManager.startAmbient(getTheme(themeId).ambientNotes);
    else audioManager.stopAmbient();
  }, [themeId]);

  const playClick = useCallback(() => audioManager.playClick(), []);
  const playHover = useCallback(() => audioManager.playHover(), []);

  return (
    <ThemeContext.Provider value={{
      themeId, theme, setTheme,
      particlesEnabled, setParticlesEnabled,
      particleDensity, setParticleDensity,
      soundEnabled, setSoundEnabled,
      ambientEnabled, setAmbientEnabled,
      playClick, playHover,
    }}>
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-700"
        style={{ zIndex: -1, background: theme.bgGradient }}
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
        aria-hidden="true"
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

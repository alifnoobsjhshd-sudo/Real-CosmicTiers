import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Lock, Eye, EyeOff, LogOut, ArrowLeft, CheckCircle, Loader2, Sparkles, Volume2, Music } from "lucide-react";
import { THEMES, THEME_ORDER, type ThemeId } from "@/lib/themes";
import { useTheme } from "@/components/ThemeProvider";
import { Switch } from "@/components/ui/switch";
import { audioManager } from "@/lib/audio";

const TOKEN_KEY = "ct_admin_token";
function getToken() { try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } }
function storeToken(t: string) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch {} }

async function adminFetch(path: string, opts?: RequestInit) {
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...((opts?.headers as Record<string, string>) ?? {}),
    },
  });
}

function ThemePreviewCard({
  id,
  serverActiveId,
  onApply,
  applying,
}: {
  id: ThemeId;
  serverActiveId: ThemeId;
  onApply: (id: ThemeId) => void;
  applying: ThemeId | null;
}) {
  const cfg = THEMES[id];
  const isLive = id === serverActiveId;
  const isApplying = applying === id;
  const primaryHsl = `hsl(${cfg.cssVars.primary})`;
  const fgHsl = `hsl(${cfg.cssVars.primaryForeground})`;

  return (
    <div
      data-testid={`theme-card-${id}`}
      onClick={() => !isLive && !applying && onApply(id)}
      className="relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer select-none"
      style={{
        border: `1px solid ${isLive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.09)"}`,
        boxShadow: isLive
          ? `0 0 24px -4px ${cfg.glowColor}, 0 0 0 2px rgba(255,255,255,0.12)`
          : undefined,
        transform: isLive ? "scale(1.02)" : undefined,
      }}
    >
      {/* Preview bg */}
      <div
        className="h-28 relative overflow-hidden flex items-center justify-center"
        style={{ background: cfg.previewGradient }}
      >
        {/* Floating particle dots */}
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              background: cfg.previewParticleColor,
              left: `${12 + i * 16}%`,
              top: `${25 + (i % 3) * 20}%`,
              boxShadow: `0 0 6px 2px ${cfg.previewParticleColor}55`,
              animation: `ct-preview-float ${2.8 + i * 0.45}s ease-in-out ${i * 0.28}s infinite`,
              opacity: 0.6 + (i % 2) * 0.3,
            }}
          />
        ))}

        {/* Live badge */}
        {isLive && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-extrabold text-white tracking-widest">LIVE</span>
          </div>
        )}

        <span
          className="text-4xl z-10 pointer-events-none"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}
        >
          {cfg.emoji}
        </span>
      </div>

      {/* Info */}
      <div className="p-3" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}>
        <div className="text-sm font-bold text-white mb-0.5 truncate">{cfg.label}</div>
        <div className="text-[11px] leading-tight mb-3 line-clamp-2" style={{ color: "rgba(255,255,255,0.45)" }}>
          {cfg.description}
        </div>

        <button
          data-testid={`apply-theme-${id}`}
          onClick={e => { e.stopPropagation(); if (!isLive && !applying) onApply(id); }}
          disabled={isLive || !!applying}
          className="w-full py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5"
          style={{
            background: isLive ? "rgba(255,255,255,0.12)" : primaryHsl,
            color: isLive ? "rgba(255,255,255,0.6)" : fgHsl,
            opacity: applying && !isApplying ? 0.45 : 1,
            border: `1px solid ${isLive ? "rgba(255,255,255,0.20)" : "transparent"}`,
          }}
        >
          {isApplying ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Applying…</>
          ) : isLive ? (
            <><CheckCircle className="h-3 w-3 text-emerald-400" /> Active</>
          ) : (
            "Apply Theme"
          )}
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [applying, setApplying] = useState<ThemeId | null>(null);
  const [serverActiveId, setServerActiveId] = useState<ThemeId>("cosmic");
  const [successMsg, setSuccessMsg] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  const {
    setTheme,
    particlesEnabled, setParticlesEnabled,
    particleDensity, setParticleDensity,
    soundEnabled, setSoundEnabled,
    ambientEnabled, setAmbientEnabled,
  } = useTheme();

  // Validate stored token on mount
  useEffect(() => {
    const t = getToken();
    if (!t) { setIsChecking(false); return; }
    adminFetch("/api/admin/theme")
      .then(r => {
        if (r.ok) { setIsAuthenticated(true); return r.json(); }
        clearToken(); return null;
      })
      .then(d => { if (d?.theme) setServerActiveId(d.theme as ThemeId); })
      .catch(() => clearToken())
      .finally(() => setIsChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLogging) return;
    setIsLogging(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        storeToken(data.token);
        if (data.currentTheme) setServerActiveId(data.currentTheme as ThemeId);
        setIsAuthenticated(true);
        audioManager.playSuccess();
      } else if (res.status === 429) {
        setLoginError("Too many attempts. Please wait 15 minutes.");
      } else {
        setLoginError("Incorrect password. Access denied.");
        setPassword("");
        setTimeout(() => passwordRef.current?.focus(), 50);
      }
    } catch {
      setLoginError("Connection error. Please try again.");
    } finally {
      setIsLogging(false);
    }
  };

  const handleApplyTheme = async (id: ThemeId) => {
    if (applying) return;
    setApplying(id);
    try {
      const res = await adminFetch("/api/admin/theme", {
        method: "POST",
        body: JSON.stringify({ theme: id }),
      });
      if (res.ok) {
        setServerActiveId(id);
        setTheme(id);
        const msg = `${THEMES[id].emoji} ${THEMES[id].label} is now live for all visitors!`;
        setSuccessMsg(msg);
        audioManager.playSuccess();
        setTimeout(() => setSuccessMsg(""), 4500);
      } else if (res.status === 401) {
        clearToken();
        setIsAuthenticated(false);
      }
    } catch {}
    finally { setApplying(null); }
  };

  const handleLogout = () => {
    clearToken();
    setIsAuthenticated(false);
    setPassword("");
  };

  // Loading
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
      </div>
    );
  }

  // ── Password Gate ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Lock icon */}
          <div className="flex justify-center mb-7">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 0 32px -8px rgba(139,92,246,0.4)",
              }}
            >
              <Lock className="h-9 w-9" style={{ color: "rgba(255,255,255,0.65)" }} />
            </div>
          </div>

          <h1 className="text-center text-2xl font-bold text-white mb-2 tracking-tight">
            Admin Access
          </h1>
          <p className="text-center text-sm mb-8" style={{ color: "rgba(255,255,255,0.38)" }}>
            Enter the admin password to manage the website's appearance.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                ref={passwordRef}
                data-testid="input-admin-password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(""); }}
                placeholder="Admin password"
                autoComplete="current-password"
                autoFocus
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${loginError ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.11)"}`,
                  color: "white",
                }}
                onFocus={e => { if (!loginError) e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
                onBlur={e => { if (!loginError) e.currentTarget.style.borderColor = "rgba(255,255,255,0.11)"; }}
              />
              <button
                type="button"
                data-testid="button-toggle-password"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {loginError && (
              <p data-testid="text-login-error" className="text-xs text-red-400 text-center">
                {loginError}
              </p>
            )}

            <button
              data-testid="button-admin-login"
              type="submit"
              disabled={!password || isLogging}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(109,40,217,0.85) 100%)",
                border: "1px solid rgba(139,92,246,0.35)",
                opacity: !password || isLogging ? 0.55 : 1,
              }}
            >
              {isLogging
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                : <><Lock className="h-4 w-4" /> Unlock Admin Panel</>
              }
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-xs flex items-center justify-center gap-1 transition-colors"
              style={{ color: "rgba(255,255,255,0.28)" }}
            >
              <ArrowLeft className="h-3 w-3" /> Back to Cosmic Tiers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-3.5"
        style={{
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4.5 w-4.5" style={{ color: "rgba(255,255,255,0.5)" }} />
          <span className="font-bold text-white text-base tracking-tight">Cosmic Tiers Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            data-testid="link-view-site"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> View Site
          </Link>
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.13)",
              color: "rgba(239,68,68,0.65)",
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 pt-8 space-y-10">
        {/* Success toast */}
        {successMsg && (
          <div
            data-testid="text-success-msg"
            className="flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium"
            style={{
              background: "rgba(52,211,153,0.07)",
              border: "1px solid rgba(52,211,153,0.18)",
              color: "rgb(110,231,183)",
            }}
          >
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
            {successMsg}
          </div>
        )}

        {/* ── Theme Gallery ──────────────────────────────────────── */}
        <section>
          <div className="mb-5">
            <h2 className="text-[11px] font-extrabold tracking-widest uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Global Theme
            </h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              Click a theme to make it live for <strong className="text-white/80">all visitors</strong> instantly.
              {" "}Currently active:{" "}
              <span className="font-semibold" style={{ color: `hsl(${THEMES[serverActiveId].cssVars.primary})` }}>
                {THEMES[serverActiveId].emoji} {THEMES[serverActiveId].label}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {THEME_ORDER.map(id => (
              <ThemePreviewCard
                key={id}
                id={id}
                serverActiveId={serverActiveId}
                onApply={handleApplyTheme}
                applying={applying}
              />
            ))}
          </div>
        </section>

        {/* ── Your Experience ──────────────────────────────────────── */}
        <section>
          <div className="mb-5">
            <h2 className="text-[11px] font-extrabold tracking-widest uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Your Experience
            </h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              Personal settings saved in your browser — other visitors are unaffected.
            </p>
          </div>

          <div
            className="rounded-2xl divide-y divide-white/5"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Particles */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(139,92,246,0.13)" }}>
                  <Sparkles className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Falling Particles</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Snow, petals, fireflies, rain — theme-specific
                  </div>
                </div>
              </div>
              <Switch data-testid="switch-particles" checked={particlesEnabled} onCheckedChange={setParticlesEnabled} />
            </div>

            {/* Density */}
            {particlesEnabled && (
              <div className="flex items-center justify-between gap-4 px-5 py-3.5 pl-16">
                <div>
                  <div className="text-sm text-white/65">Particle Density</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Less = better performance</div>
                </div>
                <div
                  className="flex rounded-lg overflow-hidden"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {(["low", "medium", "high"] as const).map(d => (
                    <button
                      key={d}
                      data-testid={`button-density-${d}`}
                      onClick={() => setParticleDensity(d)}
                      className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                      style={{
                        background: particleDensity === d ? "rgba(255,255,255,0.11)" : "transparent",
                        color: particleDensity === d ? "white" : "rgba(255,255,255,0.38)",
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sound FX */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.11)" }}>
                  <Volume2 className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Sound Effects</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Soft click sounds (browser requires interaction first)
                  </div>
                </div>
              </div>
              <Switch data-testid="switch-sound" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>

            {/* Ambient */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.11)" }}>
                  <Music className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Ambient Music</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Subtle synthesized chord pad — unique per theme
                  </div>
                </div>
              </div>
              <Switch data-testid="switch-ambient" checked={ambientEnabled} onCheckedChange={setAmbientEnabled} />
            </div>
          </div>

          <p className="mt-2.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
            Audio requires at least one user interaction before it can play (browser autoplay policy).
          </p>
        </section>

        {/* ── Theme Details Table ──────────────────────────────────── */}
        <section>
          <h2 className="text-[11px] font-extrabold tracking-widest uppercase mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Theme Details
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {THEME_ORDER.map((id, i) => {
              const t = THEMES[id];
              const isActive = id === serverActiveId;
              return (
                <div
                  key={id}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.05)" : i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                    borderBottom: i < THEME_ORDER.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  }}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{t.label}</span>
                      {isActive && (
                        <span className="text-[9px] font-extrabold tracking-widest text-emerald-400">● LIVE</span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{t.description}</p>
                  </div>
                  <div className="text-xs hidden sm:block" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {t.particles ? `${t.particles.type} · ${t.particles.count}px` : "no particles"}
                  </div>
                  <button
                    data-testid={`table-apply-${id}`}
                    onClick={() => !isActive && !applying && handleApplyTheme(id)}
                    disabled={isActive || !!applying}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0"
                    style={{
                      background: isActive ? "rgba(52,211,153,0.09)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isActive ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.09)"}`,
                      color: isActive ? "rgb(110,231,183)" : "rgba(255,255,255,0.55)",
                      opacity: applying && !isActive ? 0.4 : 1,
                    }}
                  >
                    {applying === id ? "…" : isActive ? "Active" : "Apply"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

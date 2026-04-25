/* ──────────────────────────────────────────────────────────────────
   SectionScenes — lightweight Minecraft-themed background scenes
   Used as soft, transparent atmospheres BEHIND section cards.

   • PeacefulScene  → animated  (Leaderboard)
   • NetherScene    → static    (Tier Testers)
   • BattleScene    → static    (Results)

   All visuals are inline SVG + a few absolutely-positioned divs.
   No external assets, no JavaScript animation, no heavy DOM.
   Cards over the scenes use a semi-transparent background so the
   scene shows through gently while text / skins stay perfectly sharp.
   ────────────────────────────────────────────────────────────────── */

interface SceneProps {
  className?: string;
}

/* ─── Peaceful Scene (ANIMATED) ──────────────────────────────────── */
export function PeacefulScene({ className = "" }: SceneProps) {
  return (
    <div
      className={`section-scene scene-peaceful ${className}`}
      aria-hidden="true"
      data-testid="scene-peaceful"
    >
      {/* sky gradient */}
      <div className="scene-sky scene-sky-peaceful" />

      {/* sun (gentle pulse) */}
      <div className="scene-sun" />

      {/* drifting clouds (different speeds for parallax) */}
      <div className="scene-cloud scene-cloud-1" />
      <div className="scene-cloud scene-cloud-2" />
      <div className="scene-cloud scene-cloud-3" />
      <div className="scene-cloud scene-cloud-4" />

      {/* distant rolling hills silhouette */}
      <svg
        className="scene-hills"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,200 0,160 100,110 220,150 360,90 500,140 640,100 780,150 920,110 1060,150 1200,120 1200,200"
          fill="rgba(40,80,55,0.55)"
        />
        <polygon
          points="0,200 0,180 130,140 260,170 390,130 520,165 650,135 780,170 910,140 1040,170 1200,150 1200,200"
          fill="rgba(28,60,40,0.7)"
        />
      </svg>

      {/* grass strip with subtle wave */}
      <div className="scene-grass" />
      <div className="scene-grass-blades" />

      {/* sitting player silhouette with sword — simplified pixel block style */}
      <svg
        className="scene-player-sitting"
        viewBox="0 0 80 100"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* sword (planted vertical, animated wobble via CSS class) */}
        <g className="scene-player-sword">
          <rect x="58" y="10" width="3" height="40" fill="rgba(220,225,235,0.85)" />
          <rect x="55" y="48" width="9" height="3" fill="rgba(140,100,60,0.9)" />
          <rect x="58" y="50" width="3" height="6" fill="rgba(110,80,50,0.9)" />
        </g>

        {/* arm holding sword (slight gentle sway) */}
        <g className="scene-player-arm">
          <rect x="48" y="48" width="6" height="14" fill="rgba(80,120,180,0.85)" />
          <rect x="48" y="60" width="6" height="4"  fill="rgba(180,140,100,0.85)" />
        </g>

        {/* head */}
        <rect x="22" y="34" width="18" height="18" fill="rgba(180,140,100,0.85)" />
        {/* hair */}
        <rect x="22" y="34" width="18" height="5"  fill="rgba(70,50,35,0.9)" />

        {/* body */}
        <rect x="22" y="52" width="18" height="16" fill="rgba(80,120,180,0.85)" />

        {/* sitting legs (forward) */}
        <rect x="20" y="68" width="9"  height="22" fill="rgba(70,90,140,0.85)" />
        <rect x="33" y="68" width="9"  height="22" fill="rgba(70,90,140,0.85)" />
        <rect x="20" y="86" width="9"  height="6"  fill="rgba(50,40,35,0.9)" />
        <rect x="33" y="86" width="9"  height="6"  fill="rgba(50,40,35,0.9)" />

        {/* back arm resting */}
        <rect x="14" y="52" width="6" height="14" fill="rgba(80,120,180,0.85)" />
        <rect x="14" y="64" width="6" height="4"  fill="rgba(180,140,100,0.85)" />
      </svg>

      {/* gentle floating sparkles */}
      <span className="scene-spark scene-spark-1" />
      <span className="scene-spark scene-spark-2" />
      <span className="scene-spark scene-spark-3" />
      <span className="scene-spark scene-spark-4" />
      <span className="scene-spark scene-spark-5" />
      <span className="scene-spark scene-spark-6" />
    </div>
  );
}

/* ─── Nether Scene (STATIC) ──────────────────────────────────────── */
export function NetherScene({ className = "" }: SceneProps) {
  return (
    <div
      className={`section-scene scene-nether ${className}`}
      aria-hidden="true"
      data-testid="scene-nether"
    >
      {/* nether sky gradient */}
      <div className="scene-sky scene-sky-nether" />

      {/* haze layer */}
      <div className="scene-nether-haze" />

      {/* glowing ember dots (static positions, very subtle pulse via CSS) */}
      <span className="scene-ember scene-ember-1" />
      <span className="scene-ember scene-ember-2" />
      <span className="scene-ember scene-ember-3" />
      <span className="scene-ember scene-ember-4" />
      <span className="scene-ember scene-ember-5" />
      <span className="scene-ember scene-ember-6" />
      <span className="scene-ember scene-ember-7" />
      <span className="scene-ember scene-ember-8" />

      {/* netherrack mountain silhouettes */}
      <svg
        className="scene-hills scene-hills-nether"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,200 0,140 140,90 280,130 420,80 560,120 700,70 840,130 980,90 1120,130 1200,110 1200,200"
          fill="rgba(80,20,15,0.55)"
        />
        <polygon
          points="0,200 0,170 120,130 240,160 360,120 480,155 600,125 720,160 840,130 960,160 1080,140 1200,160 1200,200"
          fill="rgba(60,15,10,0.75)"
        />
      </svg>

      {/* lava strip */}
      <div className="scene-lava" />
      <div className="scene-lava-glow" />

      {/* ghast silhouette (top-left) */}
      <svg className="scene-ghast" viewBox="0 0 80 90">
        <rect x="14" y="6"  width="52" height="52" fill="rgba(245,235,225,0.45)" />
        {/* eyes */}
        <rect x="22" y="22" width="8"  height="6"  fill="rgba(220,40,40,0.7)" />
        <rect x="50" y="22" width="8"  height="6"  fill="rgba(220,40,40,0.7)" />
        {/* mouth */}
        <rect x="32" y="40" width="16" height="4"  fill="rgba(200,30,30,0.6)" />
        {/* dangling tentacles */}
        <rect x="14" y="58" width="6"  height="22" fill="rgba(245,235,225,0.40)" />
        <rect x="26" y="58" width="6"  height="28" fill="rgba(245,235,225,0.40)" />
        <rect x="38" y="58" width="6"  height="22" fill="rgba(245,235,225,0.40)" />
        <rect x="50" y="58" width="6"  height="28" fill="rgba(245,235,225,0.40)" />
        <rect x="60" y="58" width="6"  height="22" fill="rgba(245,235,225,0.40)" />
      </svg>

      {/* enderman silhouette (right side, tall thin) */}
      <svg className="scene-enderman" viewBox="0 0 40 110" preserveAspectRatio="xMidYMax meet">
        {/* head */}
        <rect x="12" y="0"  width="16" height="14" fill="rgba(15,15,20,0.85)" />
        {/* eyes */}
        <rect x="14" y="6"  width="4"  height="2"  fill="rgba(200,80,255,0.85)" />
        <rect x="22" y="6"  width="4"  height="2"  fill="rgba(200,80,255,0.85)" />
        {/* body */}
        <rect x="14" y="14" width="12" height="40" fill="rgba(15,15,20,0.85)" />
        {/* arms (long) */}
        <rect x="6"  y="14" width="6"  height="58" fill="rgba(15,15,20,0.85)" />
        <rect x="28" y="14" width="6"  height="58" fill="rgba(15,15,20,0.85)" />
        {/* legs */}
        <rect x="14" y="54" width="5"  height="56" fill="rgba(15,15,20,0.85)" />
        <rect x="21" y="54" width="5"  height="56" fill="rgba(15,15,20,0.85)" />
      </svg>

      {/* piglin silhouette with golden axe (lower middle-right) */}
      <svg className="scene-piglin" viewBox="0 0 70 80" preserveAspectRatio="xMidYMax meet">
        {/* head */}
        <rect x="14" y="2"  width="22" height="18" fill="rgba(220,140,150,0.85)" />
        {/* snout */}
        <rect x="18" y="14" width="14" height="4"  fill="rgba(180,100,120,0.9)" />
        {/* tusks */}
        <rect x="18" y="16" width="2"  height="3"  fill="rgba(245,240,220,0.95)" />
        <rect x="30" y="16" width="2"  height="3"  fill="rgba(245,240,220,0.95)" />
        {/* eyes */}
        <rect x="19" y="8"  width="3"  height="2"  fill="rgba(20,20,20,0.9)" />
        <rect x="28" y="8"  width="3"  height="2"  fill="rgba(20,20,20,0.9)" />
        {/* body (gold armor hint) */}
        <rect x="14" y="20" width="22" height="22" fill="rgba(190,140,80,0.8)" />
        {/* arms */}
        <rect x="8"  y="20" width="6"  height="20" fill="rgba(220,140,150,0.85)" />
        <rect x="36" y="20" width="6"  height="20" fill="rgba(220,140,150,0.85)" />
        {/* legs */}
        <rect x="16" y="42" width="8"  height="22" fill="rgba(110,70,40,0.85)" />
        <rect x="26" y="42" width="8"  height="22" fill="rgba(110,70,40,0.85)" />
        {/* golden axe held in right hand */}
        <rect x="44" y="20" width="3"  height="32" fill="rgba(120,80,40,0.9)" />
        <rect x="40" y="14" width="14" height="10" fill="rgba(255,200,60,0.9)" />
        <rect x="38" y="16" width="3"  height="6"  fill="rgba(255,200,60,0.9)" />
      </svg>
    </div>
  );
}

/* ─── Battle Scene (STATIC) ──────────────────────────────────────── */
export function BattleScene({ className = "" }: SceneProps) {
  return (
    <div
      className={`section-scene scene-battle ${className}`}
      aria-hidden="true"
      data-testid="scene-battle"
    >
      {/* dim battle sky */}
      <div className="scene-sky scene-sky-battle" />

      {/* dust haze */}
      <div className="scene-battle-haze" />

      {/* distant battlefield silhouette */}
      <svg
        className="scene-hills scene-hills-battle"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,200 0,160 200,130 400,150 600,120 800,145 1000,125 1200,150 1200,200"
          fill="rgba(35,35,45,0.6)"
        />
      </svg>

      {/* ground */}
      <div className="scene-battle-ground" />

      {/* left fighter — sword raised + shield */}
      <svg className="scene-fighter scene-fighter-left" viewBox="0 0 90 110" preserveAspectRatio="xMidYMax meet">
        {/* head + helmet */}
        <rect x="32" y="6"  width="20" height="18" fill="rgba(140,140,150,0.9)" />
        <rect x="30" y="4"  width="24" height="6"  fill="rgba(170,170,180,0.95)" />
        {/* visor slit */}
        <rect x="34" y="14" width="16" height="2"  fill="rgba(20,20,25,0.9)" />
        {/* body armor */}
        <rect x="28" y="24" width="28" height="26" fill="rgba(120,120,135,0.9)" />
        <rect x="28" y="24" width="28" height="3"  fill="rgba(180,180,195,0.85)" />
        {/* shield (left arm) */}
        <rect x="14" y="28" width="14" height="26" fill="rgba(140,80,60,0.9)" />
        <rect x="16" y="32" width="10" height="18" fill="rgba(200,160,60,0.85)" />
        {/* sword arm raised */}
        <rect x="56" y="20" width="6"  height="20" fill="rgba(120,120,135,0.9)" />
        {/* sword blade raised */}
        <rect x="62" y="0"  width="3"  height="32" fill="rgba(220,225,235,0.9)" />
        <rect x="58" y="30" width="11" height="3"  fill="rgba(140,100,60,0.9)" />
        {/* legs */}
        <rect x="30" y="50" width="11" height="40" fill="rgba(90,90,100,0.9)" />
        <rect x="43" y="50" width="11" height="40" fill="rgba(90,90,100,0.9)" />
        <rect x="30" y="86" width="11" height="6"  fill="rgba(50,40,40,0.9)" />
        <rect x="43" y="86" width="11" height="6"  fill="rgba(50,40,40,0.9)" />
      </svg>

      {/* right fighter — sword forward, shield */}
      <svg className="scene-fighter scene-fighter-right" viewBox="0 0 90 110" preserveAspectRatio="xMidYMax meet">
        {/* head + helmet */}
        <rect x="38" y="6"  width="20" height="18" fill="rgba(150,140,130,0.9)" />
        <rect x="36" y="4"  width="24" height="6"  fill="rgba(180,170,160,0.95)" />
        {/* visor slit */}
        <rect x="40" y="14" width="16" height="2"  fill="rgba(20,20,25,0.9)" />
        {/* body armor */}
        <rect x="34" y="24" width="28" height="26" fill="rgba(130,120,110,0.9)" />
        <rect x="34" y="24" width="28" height="3"  fill="rgba(190,180,170,0.85)" />
        {/* shield */}
        <rect x="62" y="28" width="14" height="26" fill="rgba(60,80,140,0.9)" />
        <rect x="64" y="32" width="10" height="18" fill="rgba(200,200,210,0.7)" />
        {/* sword arm forward */}
        <rect x="28" y="30" width="6"  height="14" fill="rgba(130,120,110,0.9)" />
        {/* sword blade pointing left */}
        <rect x="6"  y="32" width="22" height="3"  fill="rgba(220,225,235,0.9)" />
        <rect x="26" y="29" width="3"  height="9"  fill="rgba(140,100,60,0.9)" />
        {/* legs */}
        <rect x="36" y="50" width="11" height="40" fill="rgba(95,90,85,0.9)" />
        <rect x="49" y="50" width="11" height="40" fill="rgba(95,90,85,0.9)" />
        <rect x="36" y="86" width="11" height="6"  fill="rgba(50,40,40,0.9)" />
        <rect x="49" y="86" width="11" height="6"  fill="rgba(50,40,40,0.9)" />
      </svg>

      {/* spark cluster between them */}
      <span className="scene-clash-spark scene-clash-spark-1" />
      <span className="scene-clash-spark scene-clash-spark-2" />
      <span className="scene-clash-spark scene-clash-spark-3" />
      <span className="scene-clash-spark scene-clash-spark-4" />
    </div>
  );
}

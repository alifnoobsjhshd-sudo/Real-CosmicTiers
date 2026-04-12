import { type TierLevel } from "@shared/schema";

const TIER_COLORS: Record<TierLevel, string> = {
  HT1: "#FFD700",
  LT1: "#FFC107",
  HT2: "#FF8C00",
  LT2: "#FF7043",
  HT3: "#F44336",
  LT3: "#C62828",
  HT4: "#AB47BC",
  LT4: "#9C27B0",
  HT5: "#5C9BD6",
  LT5: "#78909C",
};

const TIER_BG: Record<TierLevel, string> = {
  HT1: "rgba(255,215,0,0.15)",
  LT1: "rgba(255,193,7,0.12)",
  HT2: "rgba(255,140,0,0.12)",
  LT2: "rgba(255,112,67,0.12)",
  HT3: "rgba(244,67,54,0.12)",
  LT3: "rgba(198,40,40,0.12)",
  HT4: "rgba(171,71,188,0.12)",
  LT4: "rgba(156,39,176,0.12)",
  HT5: "rgba(92,155,214,0.12)",
  LT5: "rgba(120,144,156,0.12)",
};

const GAMEMODE_IMAGES: Record<string, string> = {
  "Sword-PvP":   "/Sword-PvP.png",
  "UHC":         "/UHC.png",
  "Pot-PvP":     "/Pot-PvP.png",
  "Nethpot":     "/Nethpot.png",
  "SMP-PvP":     "/SMP-PvP.png",
  "Axe-PvP":     "/Axe-PvP.png",
  "Mace-PvP":    "/Mace-PvP.png",
  "Crystal-PvP": "/Crystal-PvP.png",
  cartpvp: "/Cart-PvP.png",
};

interface TierBadgeProps {
  gameMode: string;
  tier: string;
  size?: "sm" | "md" | "lg";
  retired?: boolean;
}

export function TierBadge({ gameMode, tier, size = "md", retired = false }: TierBadgeProps) {
  const color = retired ? "#C47B3A" : (TIER_COLORS[tier as TierLevel] ?? "#78909C");
  const bg = retired ? "rgba(61,32,0,0.85)" : (TIER_BG[tier as TierLevel] ?? "rgba(120,144,156,0.12)");
  const borderColor = retired ? "#8B4513" : `${TIER_COLORS[tier as TierLevel] ?? "#78909C"}33`;
  const imgSrc = GAMEMODE_IMAGES[gameMode];
  const displayTier = retired ? `R${tier}` : tier;

  const iconSize = size === "lg" ? 20 : size === "md" ? 18 : 14;
  const minW = size === "lg" ? "52px" : "44px";

  const sizeClasses = {
    sm: "gap-0.5 px-1.5 py-0.5",
    md: "gap-1 px-2 py-1",
    lg: "gap-1 px-2.5 py-1.5",
  }[size];

  return (
    <div
      data-testid={`tier-badge-${gameMode}-${tier}`}
      className={`inline-flex flex-col items-center justify-center rounded ${sizeClasses} select-none`}
      style={{ backgroundColor: bg, border: `1px solid ${borderColor}`, minWidth: minW }}
      title={`${gameMode}: ${displayTier}${retired ? " (Retired)" : ""}`}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={gameMode}
          width={iconSize}
          height={iconSize}
          className="object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <span className="text-base leading-none">🎮</span>
      )}
      <span
        className="font-bold leading-none tracking-tight"
        style={{ color, fontSize: size === "lg" ? "11px" : "10px" }}
      >
        {displayTier}
      </span>
    </div>
  );
}

interface TierListProps {
  tiers: Record<string, string>;
  retiredTiers?: string[];
  size?: "sm" | "md" | "lg";
}

export function TierList({ tiers, retiredTiers = [], size = "md" }: TierListProps) {
  const entries = Object.entries(tiers);
  if (entries.length === 0) {
    return <span className="text-muted-foreground text-xs italic">No tiers yet</span>;
  }

  const ORDER = ['Sword-PvP', 'UHC', 'Pot-PvP', 'Nethpot', 'SMP-PvP', 'Axe-PvP', 'Mace-PvP', 'Crystal-PvP', 'cartpvp'];
  const sorted = entries.sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b));

  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map(([mode, tier]) => (
        <TierBadge key={mode} gameMode={mode} tier={tier} size={size} retired={retiredTiers.includes(mode)} />
      ))}
    </div>
  );
}

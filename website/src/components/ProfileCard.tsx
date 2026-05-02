import { MapPin, Calendar, Shield } from "lucide-react";
import type { PlayerProfile } from "@shared/schema";
import { PlayerSkin } from "@/components/PlayerSkin";
import { TierList } from "@/components/TierBadge";
import { TitleBadge, SpecialTitleBadge } from "@/components/TitleBadge";
import { Badge } from "@/components/ui/badge";

const REGION_NAMES: Record<string, string> = {
  NA: "North America", EU: "Europe", AS: "Asia",
  SA: "South America", OC: "Oceania", AF: "Africa", AN: "Antarctica",
};

const GAME_MODE_LABELS: Record<string, string> = {
  "Sword-PvP": "Sword PvP", "UHC": "UHC", "Pot-PvP": "Pot PvP",
  "Nethpot": "Nethpot", "SMP-PvP": "SMP PvP", "Axe-PvP": "Axe PvP",
  "Mace-PvP": "Mace PvP", "Crystal-PvP": "Crystal PvP", cartpvp: "Cart-PvP",
};

export const RANK_BORDERS: Record<"gold" | "silver" | "bronze" | "default", { border: string; glow: string }> = {
  gold:    { border: "#FFD700", glow: "0 0 22px rgba(255,215,0,0.55), 0 0 6px rgba(255,215,0,0.65) inset" },
  silver:  { border: "#D0D5DB", glow: "0 0 18px rgba(208,213,219,0.45), 0 0 6px rgba(208,213,219,0.55) inset" },
  bronze:  { border: "#CD7F32", glow: "0 0 18px rgba(205,127,50,0.50), 0 0 6px rgba(205,127,50,0.55) inset" },
  default: { border: "rgba(255,255,255,0.18)", glow: "0 4px 12px rgba(0,0,0,0.45)" },
};

export function ProfileCard({
  player,
  rankTier,
}: {
  player: PlayerProfile;
  rankTier: "gold" | "silver" | "bronze" | "default";
}) {
  const gameModes = player.testerGameModes ?? [];
  const rb = RANK_BORDERS[rankTier];

  return (
    <div
      className="profile-card rounded-xl overflow-hidden border border-border w-full mx-auto"
      style={{
        backgroundColor: "hsl(213 27% 11% / 0.92)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      data-testid="user-profile"
      data-rank-tier={rankTier}
    >
      <div className="flex flex-col items-center gap-4 px-4 sm:px-8 pt-7 pb-6">
        <div
          className="profile-skin-frame rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ border: `3px solid ${rb.border}`, boxShadow: rb.glow, padding: "3px", background: "rgba(0,0,0,0.35)" }}
        >
          <PlayerSkin
            discordId={player.discordId}
            mcUsername={player.mcUsername}
            skinUrl={player.skinUrl}
            size={128}
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-sm"
          />
        </div>

        <div className="text-center w-full">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground break-words" data-testid="text-player-name">
            {player.mcUsername}
          </h2>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            {player.specialTitle && <SpecialTitleBadge specialTitle={player.specialTitle} size="md" />}
            <TitleBadge title={player.title} size="md" />
            {player.isTester && (
              <Badge
                data-testid="badge-tier-tester"
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5"
                style={{ backgroundColor: "hsl(45 90% 55% / 0.15)", color: "hsl(45 90% 55%)", border: "1px solid hsl(45 90% 55% / 0.4)" }}
              >
                <Shield className="h-3 w-3" />
                Tier Tester
              </Badge>
            )}
          </div>
          {player.region && (
            <div className="flex items-center justify-center gap-1 mt-2 text-muted-foreground text-sm">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{REGION_NAMES[player.region] ?? player.region}</span>
            </div>
          )}
        </div>

        <div className="w-full rounded-lg overflow-hidden" style={{ backgroundColor: "hsl(213 30% 7%)" }}>
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="flex flex-col items-center p-3 sm:p-4 gap-0.5">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Rank</span>
              <span className="text-primary font-bold text-xl sm:text-2xl" data-testid="text-rank">
                {player.isTester && player.rank === 0 ? "—" : `#${player.rank}`}
              </span>
            </div>
            <div className="flex flex-col items-center p-3 sm:p-4 gap-0.5">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Points</span>
              <span className="text-foreground font-bold text-xl sm:text-2xl" data-testid="text-points">
                {player.totalPoints}
              </span>
            </div>
            <div className="flex flex-col items-center p-3 sm:p-4 gap-0.5">
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Modes</span>
              <span className="text-foreground font-bold text-xl sm:text-2xl" data-testid="text-modes-count">
                {Object.keys(player.tiers).length}
              </span>
            </div>
          </div>
        </div>

        {player.isTester && gameModes.length > 0 && (
          <div className="w-full">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Tester For</h3>
            <div className="flex flex-wrap gap-1.5" data-testid="tester-game-modes">
              {gameModes.map(mode => (
                <Badge
                  key={mode}
                  data-testid={`badge-mode-${mode}`}
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: "hsl(45 90% 55% / 0.4)", color: "hsl(45 90% 55%)" }}
                >
                  {GAME_MODE_LABELS[mode] ?? mode}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {Object.keys(player.tiers).length > 0 && (
          <div className="w-full">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Tiers</h3>
            <TierList tiers={player.tiers} retiredTiers={player.retiredTiers ?? []} size="lg" />
          </div>
        )}

        {player.registeredAt > 0 && (
          <div className="w-full flex items-center gap-1.5 text-muted-foreground text-xs">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Registered{" "}
              {new Date(player.registeredAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

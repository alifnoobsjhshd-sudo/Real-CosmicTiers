import { X, MapPin, Calendar, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type PlayerProfile } from "@shared/schema";
import { PlayerSkin } from "./PlayerSkin";
import { TierList } from "./TierBadge";
import { TitleBadge, SpecialTitleBadge } from "./TitleBadge";

interface PlayerModalProps {
  player: PlayerProfile | null;
  open: boolean;
  onClose: () => void;
}

const REGION_NAMES: Record<string, string> = {
  NA: "North America", EU: "Europe", AS: "Asia",
  SA: "South America", OC: "Oceania", AF: "Africa", AN: "Antarctica",
};

const GAME_MODE_LABELS: Record<string, string> = {
  "Sword-PvP": "Sword PvP",
  "UHC": "UHC",
  "Pot-PvP": "Pot PvP",
  "Nethpot": "Nethpot",
  "SMP-PvP": "SMP PvP",
  "Axe-PvP": "Axe PvP",
  "Mace-PvP": "Mace PvP",
  "Crystal-PvP": "Crystal PvP",
};

export function PlayerModal({ player, open, onClose }: PlayerModalProps) {
  if (!player) return null;

  const gameModes = player.testerGameModes ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden border-border"
        style={{ backgroundColor: "hsl(213 27% 11%)" }}
        data-testid="player-modal"
      >
        <DialogTitle className="sr-only">{player.mcUsername} Profile</DialogTitle>
        <button
          onClick={onClose}
          data-testid="button-close-modal"
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-4 p-6 pt-8">
          <div
            className="rounded-full overflow-hidden flex-shrink-0"
            style={{ border: "3px solid hsl(45 90% 55%)", padding: "2px" }}
          >
            <PlayerSkin
              discordId={player.discordId}
              mcUsername={player.mcUsername}
              hasSkin={!!player.renderedSkinPath}
              size={96}
              className="rounded-full w-24 h-24"
            />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-player-name">
              {player.mcUsername}
            </h2>
            <div className="mt-1.5 flex flex-col items-center gap-1.5">
              {player.specialTitle && (
                <SpecialTitleBadge specialTitle={player.specialTitle} size="md" />
              )}
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
                <MapPin className="h-3.5 w-3.5" />
                <span>{REGION_NAMES[player.region] ?? player.region}</span>
              </div>
            )}
          </div>

          <div className="w-full rounded-lg overflow-hidden" style={{ backgroundColor: "hsl(213 30% 7%)" }}>
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="flex flex-col items-center p-3 gap-0.5">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">Rank</span>
                <span className="text-primary font-bold text-xl">#{player.rank}</span>
              </div>
              <div className="flex flex-col items-center p-3 gap-0.5">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">Points</span>
                <span className="text-foreground font-bold text-xl">{player.totalPoints}</span>
              </div>
              <div className="flex flex-col items-center p-3 gap-0.5">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">Modes</span>
                <span className="text-foreground font-bold text-xl">{Object.keys(player.tiers).length}</span>
              </div>
            </div>
          </div>

          {player.isTester && gameModes.length > 0 && (
            <div className="w-full">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Tester For
              </h3>
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
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Tiers
              </h3>
              <TierList tiers={player.tiers} retiredTiers={player.retiredTiers ?? []} size="lg" />
            </div>
          )}

          <div className="w-full flex items-center gap-1.5 text-muted-foreground text-xs">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Registered {new Date(player.registeredAt).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

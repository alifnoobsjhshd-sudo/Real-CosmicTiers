import { useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, Shield } from "lucide-react";
import type {
  LeaderboardResponse,
  TesterLeaderboardResponse,
  InfoResponse,
  PlayerProfile,
  TierTester,
} from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { PlayerSkin } from "@/components/PlayerSkin";
import { TierList } from "@/components/TierBadge";
import { TitleBadge, SpecialTitleBadge } from "@/components/TitleBadge";
import { Badge } from "@/components/ui/badge";

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
  cartpvp: "Cart-PvP",
};

function testerAsProfile(t: TierTester): PlayerProfile {
  return {
    discordId: t.discordId,
    mcUsername: t.mcUsername ?? "",
    title: t.title,
    specialTitle: null,
    region: t.region ?? "",
    rank: t.rank,
    totalPoints: t.totalPoints,
    tiers: t.tiers ?? {},
    retiredTiers: t.retiredTiers ?? [],
    isTester: true,
    testerGameModes: t.gameModes ?? [],
    skinUrl: t.skinUrl ?? "",
    renderedSkinPath: t.renderedSkinPath ?? null,
    trend: t.trend,
    registeredAt: 0,
  };
}

export default function UserPage() {
  const params = useParams<{ username: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const fromTab = new URLSearchParams(search).get("from");
  const username = decodeURIComponent(params.username || "").toLowerCase();

  const { data: lb, isLoading: lbLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
  });
  const { data: tl, isLoading: tlLoading } = useQuery<TesterLeaderboardResponse>({
    queryKey: ["/api/testers"],
  });
  const { data: info } = useQuery<InfoResponse>({
    queryKey: ["/api/info"],
  });

  const player: PlayerProfile | null = useMemo(() => {
    if (!username) return null;
    const fromLb = lb?.players?.find(p => p.mcUsername?.toLowerCase() === username);
    if (fromLb) return fromLb;
    const fromT = tl?.testers?.find(t => t.mcUsername?.toLowerCase() === username);
    if (fromT) return testerAsProfile(fromT);
    return null;
  }, [lb, tl, username]);

  const loading = lbLoading || tlLoading;
  const discordLink = info?.discordLink || "#";

  const handleBack = () => {
    if (fromTab) {
      navigate(`/?tab=${fromTab}`);
    } else {
      navigate("/");
    }
  };

  // Clicking on the empty page background acts like a back button. We only
  // trigger when the click target is the backdrop element itself, so clicks
  // inside the profile card or the back button still behave normally.
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleBack();
  };

  // Top-3 detection — only based on real leaderboard rank (testers without rank don't count)
  const rank = player?.rank ?? 0;
  const isTop3 = !player?.isTester && rank >= 1 && rank <= 3;
  const rankTier: "gold" | "silver" | "bronze" | "default" =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";

  // Background theme based on rank: top-3 → animated underwater, below → static MC grass
  const bgClass = !player
    ? "" // plain background while loading / not found
    : isTop3
      ? "profile-bg-underwater"
      : "profile-bg-mcgrass";

  return (
    <div
      className={`min-h-screen text-foreground relative ${bgClass}`}
      onClick={handleBackdropClick}
      data-testid="user-backdrop"
    >
      {/* Underwater bubbles — only for top-3 */}
      {isTop3 && (
        <div aria-hidden="true" className="profile-bubbles pointer-events-none">
          <span className="bubble b1" /><span className="bubble b2" /><span className="bubble b3" />
          <span className="bubble b4" /><span className="bubble b5" /><span className="bubble b6" />
          <span className="bubble b7" /><span className="bubble b8" /><span className="bubble b9" />
        </div>
      )}

      <Navbar onSearch={() => {}} discordLink={discordLink} />

      <div
        className="relative max-w-xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center"
        onClick={handleBackdropClick}
        data-testid="user-backdrop-inner"
      >
        <div className="w-full">
          <button
            onClick={(e) => { e.stopPropagation(); handleBack(); }}
            data-testid="button-back-home"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white transition-colors mb-5 px-2.5 py-1.5 rounded-md backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.28)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            {fromTab && fromTab !== "leaderboard"
              ? `Back to ${fromTab.charAt(0).toUpperCase() + fromTab.slice(1)}`
              : "Back to Leaderboard"}
          </button>
        </div>

        {loading && (
          <div
            className="rounded-xl border border-border p-8 text-center text-muted-foreground w-full"
            style={{ backgroundColor: "hsl(213 27% 11%)" }}
            data-testid="text-user-loading"
            onClick={(e) => e.stopPropagation()}
          >
            Loading player profile…
          </div>
        )}

        {!loading && !player && (
          <div
            className="rounded-xl border border-border p-8 text-center w-full"
            style={{ backgroundColor: "hsl(213 27% 11%)" }}
            data-testid="text-user-not-found"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-foreground mb-2">Player not found</h2>
            <p className="text-muted-foreground text-sm">
              No player named "{decodeURIComponent(params.username || "")}" exists on CosmicTiers.
            </p>
          </div>
        )}

        {!loading && player && (
          <div onClick={(e) => e.stopPropagation()} className="w-full">
            <ProfileView player={player} rankTier={rankTier} />
          </div>
        )}
      </div>
    </div>
  );
}

const RANK_BORDERS: Record<"gold" | "silver" | "bronze" | "default", { border: string; glow: string }> = {
  gold:    { border: "#FFD700", glow: "0 0 22px rgba(255, 215, 0, 0.55), 0 0 6px rgba(255, 215, 0, 0.65) inset" },
  silver:  { border: "#D0D5DB", glow: "0 0 18px rgba(208, 213, 219, 0.45), 0 0 6px rgba(208, 213, 219, 0.55) inset" },
  bronze:  { border: "#CD7F32", glow: "0 0 18px rgba(205, 127, 50, 0.50), 0 0 6px rgba(205, 127, 50, 0.55) inset" },
  default: { border: "rgba(255,255,255,0.18)", glow: "0 4px 12px rgba(0,0,0,0.45)" },
};

function ProfileView({
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
      {/* Header */}
      <div className="flex flex-col items-center gap-4 px-4 sm:px-8 pt-7 pb-6">

        {/* Avatar — square (matches leaderboard card style) with rank-colored border */}
        <div
          className="profile-skin-frame rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{
            border: `3px solid ${rb.border}`,
            boxShadow: rb.glow,
            padding: "3px",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <PlayerSkin
            discordId={player.discordId}
            mcUsername={player.mcUsername}
            skinUrl={player.skinUrl}
            size={128}
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-sm"
          />
        </div>

        {/* Name + badges */}
        <div className="text-center w-full">
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground break-words"
            data-testid="text-player-name"
          >
            {player.mcUsername}
          </h1>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            {player.specialTitle && (
              <SpecialTitleBadge specialTitle={player.specialTitle} size="md" />
            )}
            <TitleBadge title={player.title} size="md" />
            {player.isTester && (
              <Badge
                data-testid="badge-tier-tester"
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5"
                style={{
                  backgroundColor: "hsl(45 90% 55% / 0.15)",
                  color: "hsl(45 90% 55%)",
                  border: "1px solid hsl(45 90% 55% / 0.4)",
                }}
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

        {/* Stats row */}
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

        {/* Tester game modes */}
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

        {/* Personal tiers */}
        {Object.keys(player.tiers).length > 0 && (
          <div className="w-full">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
              Tiers
            </h3>
            <TierList tiers={player.tiers} retiredTiers={player.retiredTiers ?? []} size="lg" />
          </div>
        )}

        {/* Registered date */}
        {player.registeredAt > 0 && (
          <div className="w-full flex items-center gap-1.5 text-muted-foreground text-xs">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Registered{" "}
              {new Date(player.registeredAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

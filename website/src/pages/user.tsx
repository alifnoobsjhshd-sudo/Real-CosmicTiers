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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar onSearch={() => {}} discordLink={discordLink} />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <button
          onClick={handleBack}
          data-testid="button-back-home"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          {fromTab && fromTab !== "leaderboard"
            ? `Back to ${fromTab.charAt(0).toUpperCase() + fromTab.slice(1)}`
            : "Back to Leaderboard"}
        </button>

        {loading && (
          <div className="rounded-xl border border-border p-8 text-center text-muted-foreground" data-testid="text-user-loading">
            Loading player profile…
          </div>
        )}

        {!loading && !player && (
          <div className="rounded-xl border border-border p-8 text-center" data-testid="text-user-not-found">
            <h2 className="text-xl font-bold text-foreground mb-2">Player not found</h2>
            <p className="text-muted-foreground text-sm">
              No player named "{decodeURIComponent(params.username || "")}" exists on CosmicTiers.
            </p>
          </div>
        )}

        {!loading && player && <ProfileView player={player} />}
      </div>
    </div>
  );
}

function ProfileView({ player }: { player: PlayerProfile }) {
  const gameModes = player.testerGameModes ?? [];

  return (
    <div
      className="rounded-xl overflow-hidden border border-border w-full"
      style={{ backgroundColor: "hsl(213 27% 11%)" }}
      data-testid="user-profile"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-4 px-4 sm:px-8 pt-8 pb-6">

        {/* Avatar */}
        <div
          className="rounded-full overflow-hidden flex-shrink-0"
          style={{ border: "3px solid hsl(45 90% 55%)", padding: "2px" }}
        >
          <PlayerSkin
            discordId={player.discordId}
            mcUsername={player.mcUsername}
            skinUrl={player.skinUrl}
            size={112}
            className="rounded-full w-24 h-24 sm:w-28 sm:h-28"
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

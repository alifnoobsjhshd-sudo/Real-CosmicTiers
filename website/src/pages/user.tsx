import { useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type {
  LeaderboardResponse,
  TesterLeaderboardResponse,
  InfoResponse,
  PlayerProfile,
  TierTester,
} from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { ProfileCard } from "@/components/ProfileCard";

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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleBack();
  };

  const rank = player?.rank ?? 0;
  const isTop3 = !player?.isTester && rank >= 1 && rank <= 3;
  const rankTier: "gold" | "silver" | "bronze" | "default" =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";

  const bgClass = !player
    ? ""
    : isTop3
      ? "profile-bg-underwater"
      : "profile-bg-mcgrass";

  return (
    <div
      className={`min-h-screen text-foreground relative ${bgClass}`}
      onClick={handleBackdropClick}
      data-testid="user-backdrop"
    >
      {isTop3 && (
        <div aria-hidden="true" className="profile-bubbles pointer-events-none">
          <span className="bubble b1" /><span className="bubble b2" /><span className="bubble b3" />
          <span className="bubble b4" /><span className="bubble b5" /><span className="bubble b6" />
          <span className="bubble b7" /><span className="bubble b8" /><span className="bubble b9" />
        </div>
      )}

      <Navbar onSearchOpen={() => {}} discordLink={discordLink} />

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
            <ProfileCard player={player} rankTier={rankTier} />
          </div>
        )}
      </div>
    </div>
  );
}

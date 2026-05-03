import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { LoadingScreen } from "@/components/loading-screen";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/components/ThemeProvider";
import { Trophy, Users, Info, RefreshCw, ChevronDown, ChevronUp, Star, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Minus, ClipboardList, Crown } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import type { LeaderboardResponse, TesterLeaderboardResponse, InfoResponse, PlayerProfile, TierTester, ResultsResponse, ResultEntry, TrendArrow, TopPlayersResponse, TopPlayerEntry } from "@shared/schema";
import { TITLES, TIER_POINTS, GAME_MODES } from "@shared/schema";
import { Navbar } from "@/components/Navbar";
import { PlayerSkin } from "@/components/PlayerSkin";
import { TierList } from "@/components/TierBadge";
import { TitleBadge } from "@/components/TitleBadge";
import { RankBadge } from "@/components/RankBadge";

type Tab = "leaderboard" | "testers" | "results" | "top" | "information";
type InfoTab = "titles" | "points";

const REGION_FLAGS: Record<string, string> = {
  NA: "🌎", EU: "🌍", AS: "🌏", SA: "🌎", OC: "🌏", AF: "🌍", AN: "❄️",
};

const GAME_MODE_IMAGES: Record<string, string> = {
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

function TrendIcon({ trend, size = "sm" }: { trend?: TrendArrow; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  if (trend === "high_up")   return <ChevronsUp className={`${cls} text-emerald-400`} />;
  if (trend === "up")        return <ArrowUp className={`${cls} text-green-400`} />;
  if (trend === "high_down") return <ChevronsDown className={`${cls} text-red-500`} />;
  if (trend === "down")      return <ArrowDown className={`${cls} text-orange-400`} />;
  return null;
}

function testerAsProfile(t: TierTester): PlayerProfile {
  return {
    discordId: t.discordId,
    mcUsername: t.mcUsername ?? `User ${t.discordId.slice(-4)}`,
    region: t.region ?? "",
    totalPoints: t.totalPoints,
    tiers: t.tiers,
    retiredTiers: t.retiredTiers ?? [],
    registeredAt: 0,
    skinUrl: t.skinUrl,
    renderedSkinPath: t.renderedSkinPath,
    rank: t.rank,
    trend: t.trend,
    title: t.title,
    isTester: true,
    testerGameModes: t.gameModes,
    specialTitle: null,
  };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [infoTab, setInfoTab] = useState<InfoTab>("titles");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTesters, setExpandedTesters] = useState<Set<string>>(new Set());
  const [topGameMode, setTopGameMode] = useState<string>(GAME_MODES[0]);
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [loadingKey, setLoadingKey] = useState(0);
  const [loadingDuration, setLoadingDuration] = useState(1800);
  const [loadingTab, setLoadingTab] = useState('');

  const [, navigate] = useLocation();
  const switchTab = (newTab: Tab) => {
    setTab(newTab);
  };
  const selectPlayer = (p: PlayerProfile) => {
    if (p?.mcUsername) navigate(`/user/${encodeURIComponent(p.mcUsername)}`);
  };

  const { data: leaderboardData, isLoading: lbLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
  });

  const { data: testersData, isLoading: testLoading } = useQuery<TesterLeaderboardResponse>({
    queryKey: ["/api/testers"],
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery<ResultsResponse>({
    queryKey: ["/api/results"],
  });

  const { data: infoData } = useQuery<InfoResponse>({
    queryKey: ["/api/info"],
  });

  const { data: topPlayersData, isLoading: topLoading } = useQuery<TopPlayersResponse>({
    queryKey: ["/api/top-players"],
    enabled: tab === "top",
  });

  const filteredPlayers = useMemo(() => {
    if (!leaderboardData?.players) return [];
    if (!searchQuery.trim()) return leaderboardData.players;
    const q = searchQuery.toLowerCase();
    return leaderboardData.players.filter(p =>
      p.mcUsername.toLowerCase().includes(q) ||
      p.title.name.toLowerCase().includes(q)
    );
  }, [leaderboardData, searchQuery]);

  const filteredTesters = useMemo(() => {
    if (!testersData?.testers) return [];
    if (!searchQuery.trim()) return testersData.testers;
    const q = searchQuery.toLowerCase();
    return testersData.testers.filter(t =>
      t.mcUsername?.toLowerCase().includes(q) ||
      t.discordId.includes(q)
    );
  }, [testersData, searchQuery]);

  const filteredResults = useMemo(() => {
    if (!resultsData?.results) return [];
    if (!searchQuery.trim()) return resultsData.results;
    const q = searchQuery.toLowerCase();
    return resultsData.results.filter(r =>
      r.playerMcUsername.toLowerCase().includes(q) ||
      r.testerMcUsername?.toLowerCase().includes(q) ||
      r.gameMode.toLowerCase().includes(q)
    );
  }, [resultsData, searchQuery]);

  function toggleTesterExpand(id: string) {
    setExpandedTesters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const discordLink = infoData?.discordLink || "#";
  const websiteLink = infoData?.websiteLink || "#";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {loadingVisible && (
        <LoadingScreen
          key={loadingKey}
          duration={loadingDuration}
          tabName={loadingTab}
          onHide={() => setLoadingVisible(false)}
        />
      )}
      <Navbar onSearch={setSearchQuery} discordLink={discordLink} />

      <div className="max-w-5xl 2xl:max-w-7xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <TabButton
            active={tab === "leaderboard"}
            onClick={() => switchTab("leaderboard")}
            icon={<Trophy className="h-4 w-4" />}
            label="Leaderboard"
            testId="tab-leaderboard"
          />
          <TabButton
            active={tab === "testers"}
            onClick={() => switchTab("testers")}
            icon={<Users className="h-4 w-4" />}
            label="Tier Testers"
            testId="tab-testers"
          />
          <TabButton
            active={tab === "results"}
            onClick={() => switchTab("results")}
            icon={<ClipboardList className="h-4 w-4" />}
            label="Results"
            testId="tab-results"
          />
          <TabButton
            active={tab === "top"}
            onClick={() => switchTab("top")}
            icon={<Crown className="h-4 w-4" />}
            label="Top"
            testId="tab-top"
          />
          <TabButton
            active={tab === "information"}
            onClick={() => switchTab("information")}
            icon={<Info className="h-4 w-4" />}
            label="Information"
            testId="tab-information"
          />

          <div className="ml-auto flex items-center gap-2">
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: "#5865F2", color: "white" }}
              data-testid="link-discord-nav"
            >
              <SiDiscord className="h-4 w-4" />
              <span className="hidden sm:inline">Join Discord</span>
            </a>
          </div>
        </div>

        {/* Leaderboard Tab */}
        {tab === "leaderboard" && (
          <div className="mc-animate-fade-up mc-delay-3">
            <LeaderboardSection
              players={filteredPlayers}
              loading={lbLoading}
              onSelectPlayer={selectPlayer}
              lastUpdated={leaderboardData?.lastUpdated}
            />
          </div>
        )}

        {/* Tier Testers Tab */}
        {tab === "testers" && (
          <div className="mc-animate-fade-up mc-delay-3">
            <TestersSection
              testers={filteredTesters}
              loading={testLoading}
              expandedTesters={expandedTesters}
              toggleExpand={toggleTesterExpand}
              lastUpdated={testersData?.lastUpdated}
              onSelectPlayer={selectPlayer}
            />
          </div>
        )}

        {/* Results Tab */}
        {tab === "results" && (
          <div className="mc-animate-fade-up mc-delay-3">
            <ResultsSection
              results={filteredResults}
              loading={resultsLoading}
              lastUpdated={resultsData?.lastUpdated}
              players={leaderboardData?.players ?? []}
              onSelectPlayer={selectPlayer}
            />
          </div>
        )}

        {/* Top Tab */}
        {tab === "top" && (
          <div className="mc-animate-fade-up mc-delay-3">
            <TopSection
              data={topPlayersData}
              loading={topLoading}
              activeGameMode={topGameMode}
              setActiveGameMode={setTopGameMode}
              players={leaderboardData?.players ?? []}
              onSelectPlayer={selectPlayer}
            />
          </div>
        )}

        {/* Information Tab */}
        {tab === "information" && (
          <div className="mc-animate-fade-up mc-delay-3">
            <InformationSection
              infoTab={infoTab}
              setInfoTab={setInfoTab}
              discordLink={discordLink}
              websiteLink={websiteLink}
            />
          </div>
        )}
      </div>

    </div>
  );
}

function TabButton({
  active, onClick, icon, label, testId
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`mc-button-outline flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border ${
        active
          ? "is-active"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ─── Leaderboard Section ──────────────────────────────────────────────────── */

function LeaderboardSection({
  players, loading, onSelectPlayer, lastUpdated
}: {
  players: PlayerProfile[];
  loading: boolean;
  onSelectPlayer: (p: PlayerProfile) => void;
  lastUpdated?: number;
}) {
  const { theme, backgroundAppearanceEnabled } = useTheme();

  if (loading) return <LeaderboardSkeleton />;

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Trophy className="h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">No players found</p>
        <p className="text-sm">Players will appear here after registering with the bot.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl transition-all duration-700"
      data-testid="leaderboard-section"
      style={backgroundAppearanceEnabled && theme.leaderboardBgGradient !== 'none' ? {
        background: theme.leaderboardBgGradient,
        padding: '1rem',
      } : {}}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_1fr] gap-3 px-3 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>#</span>
          <span>Player</span>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1 text-muted-foreground/60 text-xs flex-shrink-0 pr-2">
            <RefreshCw className="h-3 w-3" />
          </div>
        )}
      </div>

      {players.map((player) => (
        <PlayerRow key={player.discordId} player={player} onClick={() => onSelectPlayer(player)} />
      ))}
    </div>
  );
}

function PlayerRow({ player, onClick }: { player: PlayerProfile; onClick: () => void }) {
  const isTop3 = player.rank <= 3;

  return (
    <button
      onClick={onClick}
      data-testid={`player-row-${player.discordId}`}
      className="mc-interactive w-full text-left rounded-lg border border-border group"
      style={{
        backgroundColor: isTop3
          ? player.rank === 1 ? "hsl(45 30% 12%)"
          : player.rank === 2 ? "hsl(220 15% 12%)"
          : "hsl(25 20% 11%)"
          : "hsl(213 27% 11%)",
        boxShadow: isTop3 ? `inset 0 0 30px -10px ${
          player.rank === 1 ? "rgba(255,215,0,0.08)"
          : player.rank === 2 ? "rgba(192,192,192,0.06)"
          : "rgba(205,127,50,0.06)"
        }` : undefined,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <RankBadge rank={player.rank} size="md" />

        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          <PlayerSkin
            discordId={player.discordId}
            mcUsername={player.mcUsername}
            skinUrl={player.skinUrl}
            size={56}
            className="w-full h-full"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-foreground text-base leading-tight" data-testid={`text-username-${player.discordId}`}>
              {player.mcUsername}
            </span>
            <TitleBadge title={player.title} size="sm" />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-primary text-sm font-semibold">{player.totalPoints} pts</span>
            <TrendIcon trend={player.trend} />
            {player.region && (
              <span className="text-muted-foreground text-xs">
                {REGION_FLAGS[player.region] ?? ""} {player.region}
              </span>
            )}
          </div>
          <div className="mt-1.5 hidden sm:block">
            <TierList tiers={player.tiers} retiredTiers={player.retiredTiers ?? []} size="sm" />
          </div>
        </div>

        <div className="sm:hidden flex flex-col items-center gap-0.5">
          <TrendIcon trend={player.trend} size="md" />
        </div>
      </div>

      <div className="sm:hidden px-3 pb-2.5">
        <TierList tiers={player.tiers} retiredTiers={player.retiredTiers ?? []} size="sm" />
      </div>
    </button>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-3 flex items-center gap-3 animate-pulse" style={{ backgroundColor: "hsl(213 27% 11%)" }}>
          <div className="w-8 h-8 rounded bg-muted/40" />
          <div className="w-14 h-14 rounded bg-muted/40" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-muted/40" />
            <div className="h-3 w-20 rounded bg-muted/40" />
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="w-10 h-8 rounded bg-muted/40" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Testers Section ─────────────────────────────────────────────────────── */

function TestersSection({
  testers, loading, expandedTesters, toggleExpand, lastUpdated, onSelectPlayer
}: {
  testers: TierTester[];
  loading: boolean;
  expandedTesters: Set<string>;
  toggleExpand: (id: string) => void;
  lastUpdated?: number;
  onSelectPlayer: (p: PlayerProfile) => void;
}) {
  if (loading) return <LeaderboardSkeleton />;

  if (testers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Users className="h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">No tier testers found</p>
        <p className="text-sm">Set up the Tier Tester role with the bot to see testers here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="testers-section">
      <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_auto] gap-3 px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <span>Tester</span>
        <span>Tests</span>
      </div>

      {testers.map((tester) => (
        <TesterRow
          key={tester.discordId}
          tester={tester}
          expanded={expandedTesters.has(tester.discordId)}
          onToggle={() => toggleExpand(tester.discordId)}
          onSelectPlayer={onSelectPlayer}
        />
      ))}
    </div>
  );
}

function TesterRow({ tester, expanded, onToggle, onSelectPlayer }: {
  tester: TierTester;
  expanded: boolean;
  onToggle: () => void;
  onSelectPlayer: (p: PlayerProfile) => void;
}) {
  const displayName = tester.mcUsername ?? `User ${tester.discordId.slice(-4)}`;

  return (
    <div
      data-testid={`tester-card-${tester.discordId}`}
      className="mc-interactive rounded-lg border border-border overflow-hidden"
      style={{ backgroundColor: "hsl(213 27% 11%)" }}
    >
      <div className="flex items-center gap-3 p-3">
        <RankBadge rank={tester.rank} size="md" />

        <button
          onClick={() => onSelectPlayer(testerAsProfile(tester))}
          className="w-12 h-12 rounded overflow-hidden flex-shrink-0 flex items-center justify-center hover:opacity-80 transition-opacity"
          title={`View ${displayName}'s profile`}
        >
          {tester.mcUsername ? (
            <PlayerSkin
              discordId={tester.discordId}
              mcUsername={tester.mcUsername}
              skinUrl={tester.skinUrl}
              size={48}
              className="w-full h-full"
            />
          ) : (
            <Users className="h-6 w-6 text-muted-foreground" />
          )}
        </button>

        <button
          onClick={() => onSelectPlayer(testerAsProfile(tester))}
          className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <span className="font-bold text-foreground text-base" data-testid={`text-tester-name-${tester.discordId}`}>
            {displayName}
          </span>
          {tester.title && tester.mcUsername && (
            <div className="mt-0.5">
              <TitleBadge title={tester.title} size="sm" />
            </div>
          )}
          {tester.region && (
            <div className="text-muted-foreground text-xs mt-0.5">
              {REGION_FLAGS[tester.region] ?? ""} {tester.region}
            </div>
          )}
        </button>

        <button
          onClick={onToggle}
          className="flex items-center gap-2 hover:bg-primary/5 rounded p-1 transition-colors"
        >
          <div className="flex flex-col items-end">
            <span className="text-primary font-bold text-lg leading-tight" data-testid={`text-test-count-${tester.discordId}`}>
              {tester.testCount}
            </span>
            <span className="text-muted-foreground text-xs">tests</span>
          </div>
          <div className="text-muted-foreground">
            {expanded
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />
            }
          </div>
        </button>
      </div>

      {expanded && (
        <div
          className="px-4 py-3 border-t border-border"
          style={{ backgroundColor: "hsl(213 30% 8%)" }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <StatPill label="Total Tests" value={tester.testCount.toString()} />
            <StatPill label="Total Points" value={`${tester.totalPoints} pts`} trendArrow={tester.trend} />
            <StatPill label="Modes Tested" value={Object.keys(tester.tiers).length.toString()} />
          </div>
          {Object.keys(tester.tiers).length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Personal Tiers</p>
              <TierList tiers={tester.tiers} retiredTiers={tester.retiredTiers ?? []} size="md" />
            </div>
          )}
          {!tester.mcUsername && (
            <p className="text-xs text-muted-foreground italic">This tester has not registered a Minecraft account yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, trendArrow }: { label: string; value: string; trendArrow?: TrendArrow }) {
  return (
    <div className="flex flex-col rounded p-2 gap-0.5" style={{ backgroundColor: "hsl(213 27% 11%)" }}>
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-foreground font-bold text-sm">{value}</span>
        {trendArrow && <TrendIcon trend={trendArrow} />}
      </div>
    </div>
  );
}

/* ─── Results Section ─────────────────────────────────────────────────────── */

function ResultsSection({
  results, loading, lastUpdated, players, onSelectPlayer
}: {
  results: ResultEntry[];
  loading: boolean;
  lastUpdated?: number;
  players: PlayerProfile[];
  onSelectPlayer: (p: PlayerProfile) => void;
}) {
  if (loading) return <LeaderboardSkeleton />;

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <ClipboardList className="h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">No results yet</p>
        <p className="text-sm">Tier test results will appear here after tests are completed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="results-section">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </p>
        {lastUpdated && (
          <div className="flex items-center gap-1 text-muted-foreground/60 text-xs">
            <RefreshCw className="h-3 w-3" />
          </div>
        )}
      </div>

      {results.map(result => (
        <ResultCard key={result.id} result={result} players={players} onSelectPlayer={onSelectPlayer} />
      ))}
    </div>
  );
}

function getTierColor(tier: string): string {
  if (tier.includes("1")) return "#FFD700";
  if (tier.includes("2")) return "#C0C0C0";
  if (tier.includes("3")) return "#FF6B35";
  if (tier.includes("4")) return "#4CAF50";
  return "#2196F3";
}

function ResultCard({ result, players, onSelectPlayer }: {
  result: ResultEntry;
  players: PlayerProfile[];
  onSelectPlayer: (p: PlayerProfile) => void;
}) {
  const tierColor = getTierColor(result.earnedTier);
  const isPrevious = result.previousTier !== "Unranked";
  const isPromotion = result.pointDelta > 0;
  const isDemotion = result.pointDelta < 0;
  const playerProfile = players.find(p => p.discordId === result.playerDiscordId);

  const date = new Date(result.timestamp).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="mc-interactive rounded-lg border border-border overflow-hidden"
      style={{ backgroundColor: "hsl(213 27% 11%)" }}
      data-testid={`result-card-${result.id}`}
    >
      {/* Header bar with game mode color */}
      <div
        className="h-1"
        style={{ backgroundColor: tierColor }}
      />

      <div className="p-4">
        {/* Player row */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => playerProfile && onSelectPlayer(playerProfile)}
            disabled={!playerProfile}
            className="w-14 h-14 rounded overflow-hidden flex-shrink-0 flex items-center justify-center border border-border hover:opacity-80 transition-opacity disabled:cursor-default"
            title={playerProfile ? `View ${result.playerMcUsername}'s profile` : undefined}
          >
            <PlayerSkin
              discordId={result.playerDiscordId}
              mcUsername={result.playerMcUsername}
              skinUrl={result.playerSkinUrl ?? playerProfile?.skinUrl}
              size={56}
              className="w-full h-full"
            />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <button
                onClick={() => playerProfile && onSelectPlayer(playerProfile)}
                disabled={!playerProfile}
                className="font-bold text-foreground text-base hover:text-primary transition-colors disabled:cursor-default"
                data-testid={`text-result-player-${result.id}`}
              >
                {result.playerMcUsername}
              </button>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: `${tierColor}22`, color: tierColor, border: `1px solid ${tierColor}44` }}
              >
                {result.earnedTier}
              </span>
              {result.trend && <TrendIcon trend={result.trend} size="md" />}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                <span className="text-muted-foreground/60">Previous: </span>
                <span className="font-medium">{result.previousTier}</span>
              </span>
              <span className="text-muted-foreground/40">→</span>
              <span>
                <span className="text-muted-foreground/60">Earned: </span>
                <span className="font-bold" style={{ color: tierColor }}>{result.earnedTier}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
              <span className="flex items-center gap-1.5">
                {GAME_MODE_IMAGES[result.gameMode] ? (
                  <img src={GAME_MODE_IMAGES[result.gameMode]} alt={result.gameMode} width={14} height={14} className="object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <span>🎮</span>
                )}
                <span className="text-muted-foreground">{result.gameMode}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-primary font-semibold">{result.newPoints} pts</span>
                {result.pointDelta !== 0 && (
                  <span className={`font-medium ${isPromotion ? "text-green-400" : "text-orange-400"}`}>
                    ({isPromotion ? "+" : ""}{result.pointDelta})
                  </span>
                )}
                <TrendIcon trend={result.trend} />
              </span>
              <span className="text-muted-foreground/60">{date}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50 my-3" />

        {/* Tester row */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mr-1">
            Tester
          </span>
          {result.testerProfile ? (
            <>
              <button
                onClick={() => onSelectPlayer(testerAsProfile(result.testerProfile!))}
                className="w-7 h-7 rounded overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                title={`View ${result.testerProfile.mcUsername ?? "tester"}'s profile`}
              >
                <PlayerSkin
                  discordId={result.testerDiscordId}
                  mcUsername={result.testerProfile.mcUsername ?? ""}
                  skinUrl={result.testerProfile.skinUrl}
                  size={28}
                  className="w-full h-full"
                />
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onSelectPlayer(testerAsProfile(result.testerProfile!))}
                  className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                >
                  {result.testerProfile.mcUsername ?? result.testerMcUsername ?? "Unknown"}
                </button>
                {result.testerProfile.region && (
                  <span className="text-muted-foreground text-xs">
                    {REGION_FLAGS[result.testerProfile.region] ?? ""} {result.testerProfile.region}
                  </span>
                )}
                {result.testerProfile.title && (
                  <TitleBadge title={result.testerProfile.title} size="sm" />
                )}
                <span className="text-muted-foreground text-xs">
                  {result.testerProfile.testCount} tests • {result.testerProfile.totalPoints} pts
                </span>
              </div>
              {Object.keys(result.testerProfile.tiers).length > 0 && (
                <div className="ml-auto hidden sm:block">
                  <TierList tiers={result.testerProfile.tiers} retiredTiers={result.testerProfile.retiredTiers ?? []} size="sm" />
                </div>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">
              {result.testerMcUsername ?? "Unknown tester"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Information Section ─────────────────────────────────────────────────── */

function InformationSection({
  infoTab, setInfoTab, discordLink, websiteLink
}: {
  infoTab: InfoTab;
  setInfoTab: (t: InfoTab) => void;
  discordLink: string;
  websiteLink: string;
}) {
  return (
    <div className="flex flex-col gap-5" data-testid="information-section">
      {/* Discord Banner */}
      <div
        className="rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ backgroundColor: "#5865F233", border: "1px solid #5865F255" }}
      >
        <div className="flex items-center gap-3">
          <SiDiscord className="h-8 w-8 text-[#5865F2]" />
          <div>
            <p className="font-bold text-foreground">Join our Discord Server</p>
            <p className="text-muted-foreground text-sm">Get tier tested and join the community</p>
          </div>
        </div>
        <a
          href={discordLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: "#5865F2", color: "white" }}
          data-testid="link-discord-info"
        >
          <SiDiscord className="h-4 w-4" />
          <span>Join Server</span>
        </a>
      </div>


      {/* Info Subtabs */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ backgroundColor: "hsl(213 27% 11%)" }}>
        <div className="flex border-b border-border">
          <button
            onClick={() => setInfoTab("titles")}
            data-testid="tab-info-titles"
            className={`mc-button-outline flex-1 py-3 text-sm font-semibold border-b-2 ${
              infoTab === "titles"
                ? "text-white border-white/70 bg-white/[0.06]"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Titles
          </button>
          <button
            onClick={() => setInfoTab("points")}
            data-testid="tab-info-points"
            className={`mc-button-outline flex-1 py-3 text-sm font-semibold border-b-2 ${
              infoTab === "points"
                ? "text-white border-white/70 bg-white/[0.06]"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Points
          </button>
        </div>

        <div className="p-5">
          {infoTab === "titles" && <TitlesInfo />}
          {infoTab === "points" && <PointsInfo />}
        </div>
      </div>

      {/* How to get tier tested */}
      <div className="rounded-lg border border-border p-5" style={{ backgroundColor: "hsl(213 27% 11%)" }}>
        <h3 className="font-bold text-foreground text-lg mb-4">How to Get Tier Tested</h3>
        <div className="flex flex-col gap-3">
          {[
            { step: "1", title: "Join our Discord Server", desc: "Click the Discord link above to join the Cosmic Tiers community server." },
            { step: "2", title: "Register your account", desc: "Use the /register command to link your Minecraft username and region." },
            { step: "3", title: "Request a tier test", desc: "Go to the tier test channel and click the 'Start Tier Test' button." },
            { step: "4", title: "Complete your test", desc: "A tier tester will challenge you in your chosen game mode and assign your tier." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{ backgroundColor: "hsl(45 90% 55%)", color: "hsl(213 30% 9%)" }}
              >
                {step}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Game modes */}
      <div className="rounded-lg border border-border p-5" style={{ backgroundColor: "hsl(213 27% 11%)" }}>
        <h3 className="font-bold text-foreground text-lg mb-4">Available Game Modes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GAME_MODES.map(mode => (
            <div
              key={mode}
              className="flex items-center gap-2 rounded p-2.5"
              style={{ backgroundColor: "hsl(213 25% 15%)" }}
            >
              {GAME_MODE_IMAGES[mode] ? (
                <img src={GAME_MODE_IMAGES[mode]} alt={mode} width={20} height={20} className="object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
              ) : (
                <span className="text-lg">🎮</span>
              )}
              <span className="text-foreground text-sm font-medium">{GAME_MODE_LABELS[mode] ?? mode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TitlesInfo() {
  return (
    <div>
      <h3 className="font-bold text-foreground text-lg mb-1">How to obtain Achievement Titles</h3>
      <p className="text-muted-foreground text-sm mb-4">Earn titles by accumulating points through tier tests.</p>
      <div className="flex flex-col gap-3">
        {TITLES.map(title => (
          <div key={title.name} className="flex items-start gap-3" data-testid={`title-info-${title.name}`}>
            <div className="w-1 rounded-full self-stretch" style={{ backgroundColor: title.color, minHeight: "2rem" }} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base" style={{ color: title.color }}>
                  {title.name}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                {title.minPoints === 0
                  ? "Starting rank — no points required."
                  : `Requires ${title.minPoints}+ points.`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Top Section ─────────────────────────────────────────────────────────── */

const TIER_GROUPS = [
  { label: "Tier 1", htKey: "HT1", ltKey: "LT1", color: "#FFD700", bg: "hsl(45 60% 13%)" },
  { label: "Tier 2", htKey: "HT2", ltKey: "LT2", color: "#C0C0C0", bg: "hsl(220 15% 13%)" },
  { label: "Tier 3", htKey: "HT3", ltKey: "LT3", color: "#FF6B35", bg: "hsl(20 40% 12%)" },
  { label: "Tier 4", htKey: "HT4", ltKey: "LT4", color: "#4CAF50", bg: "hsl(140 25% 12%)" },
  { label: "Tier 5", htKey: "HT5", ltKey: "LT5", color: "#2196F3", bg: "hsl(210 40% 12%)" },
];

const GAME_MODE_LABELS: Record<string, string> = {
  "Sword-PvP": "Sword",
  "UHC": "UHC",
  "Pot-PvP": "Pot",
  "Nethpot": "Nethpot",
  "SMP-PvP": "SMP",
  "Axe-PvP": "Axe",
  "Mace-PvP": "Mace",
  "Crystal-PvP": "Crystal",
  cartpvp: "Cart-PvP",
};

function TopSection({
  data, loading, activeGameMode, setActiveGameMode, players, onSelectPlayer
}: {
  data?: TopPlayersResponse;
  loading: boolean;
  activeGameMode: string;
  setActiveGameMode: (gm: string) => void;
  players: PlayerProfile[];
  onSelectPlayer: (p: PlayerProfile) => void;
}) {
  const gameModeData = data?.gameModeData ?? {};
  const tierData = gameModeData[activeGameMode] ?? {};

  const hasTierData = GAME_MODES.some(gm => Object.keys(gameModeData[gm] ?? {}).length > 0);
  const totalPlayers = Object.values(tierData).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="flex flex-col gap-4" data-testid="top-section">
      {/* Game mode tab strip */}
      <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {GAME_MODES.map(gm => (
          <button
            key={gm}
            onClick={() => setActiveGameMode(gm)}
            data-testid={`tab-top-${gm}`}
            className={`mc-button-outline flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap flex-shrink-0 border ${
              activeGameMode === gm
                ? "is-active"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {GAME_MODE_IMAGES[gm] && (
              <img src={GAME_MODE_IMAGES[gm]} alt={gm} width={14} height={14} className="object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />
            )}
            {GAME_MODE_LABELS[gm] ?? gm}
            {gameModeData[gm] && (
              <span className="text-xs opacity-60">
                {Object.values(gameModeData[gm]).reduce((s, a) => s + a.length, 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <TopSectionSkeleton />
      ) : !hasTierData ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Crown className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">No tier data yet</p>
          <p className="text-sm">Rankings will appear here once players have been tier tested.</p>
        </div>
      ) : totalPlayers === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Crown className="h-10 w-10 opacity-30" />
          <p className="text-base font-medium">No players in {GAME_MODE_LABELS[activeGameMode] ?? activeGameMode} yet</p>
        </div>
      ) : (
        /* Tier columns */
        <div className="overflow-x-auto pb-2">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${TIER_GROUPS.length}, minmax(140px, 1fr))`,
              minWidth: `${TIER_GROUPS.length * 148}px`,
            }}
          >
            {TIER_GROUPS.map(({ label, htKey, ltKey, color, bg }) => {
              const htPlayers = tierData[htKey] ?? [];
              const ltPlayers = tierData[ltKey] ?? [];
              const allPlayers = [...htPlayers, ...ltPlayers];
              return (
                <div key={label} className="flex flex-col rounded-lg overflow-hidden border border-border/50">
                  {/* Column header */}
                  <div
                    className="py-2 px-3 flex items-center justify-between"
                    style={{ backgroundColor: bg, borderBottom: `2px solid ${color}30` }}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
                      {label}
                    </span>
                    <span className="text-xs font-semibold opacity-60" style={{ color }}>
                      {allPlayers.length}
                    </span>
                  </div>

                  {/* Sub-tier labels + players */}
                  <div className="flex flex-col gap-0" style={{ backgroundColor: "hsl(213 27% 10%)" }}>
                    {htPlayers.length > 0 && (
                      <>
                        <div className="px-2 pt-1.5 pb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color }}>
                            HT
                          </span>
                        </div>
                        {htPlayers.map(p => (
                          <TopPlayerRow key={p.discordId} player={p} tierColor={color} players={players} onSelectPlayer={onSelectPlayer} />
                        ))}
                      </>
                    )}
                    {ltPlayers.length > 0 && (
                      <>
                        <div className="px-2 pt-1.5 pb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color }}>
                            LT
                          </span>
                        </div>
                        {ltPlayers.map(p => (
                          <TopPlayerRow key={p.discordId} player={p} tierColor={color} players={players} onSelectPlayer={onSelectPlayer} />
                        ))}
                      </>
                    )}
                    {allPlayers.length === 0 && (
                      <div className="px-3 py-3 text-xs text-muted-foreground/40 italic">
                        No players
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TopPlayerRow({ player, tierColor, players, onSelectPlayer }: {
  player: TopPlayerEntry;
  tierColor: string;
  players: PlayerProfile[];
  onSelectPlayer: (p: PlayerProfile) => void;
}) {
  const profile = players.find(p => p.discordId === player.discordId);
  return (
    <button
      onClick={() => profile && onSelectPlayer(profile)}
      disabled={!profile}
      className="flex items-center gap-1.5 px-2 py-1 w-full text-left hover:bg-white/5 transition-colors disabled:cursor-default"
      title={profile ? `View ${player.mcUsername}'s profile` : undefined}
    >
      <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
        <PlayerSkin
          discordId={player.discordId}
          mcUsername={player.mcUsername}
          skinUrl={player.skinUrl}
          size={20}
          className="w-full h-full"
        />
      </div>
      <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0" title={player.mcUsername}>
        {player.mcUsername}
      </span>
      {player.trend === "high_up"   && <ChevronsUp className="h-3 w-3 flex-shrink-0 text-emerald-400" />}
      {player.trend === "up"        && <ArrowUp className="h-3 w-3 flex-shrink-0 text-green-400" />}
      {player.trend === "high_down" && <ChevronsDown className="h-3 w-3 flex-shrink-0 text-red-500" />}
      {player.trend === "down"      && <ArrowDown className="h-3 w-3 flex-shrink-0 text-orange-400" />}
    </button>
  );
}

function TopSectionSkeleton() {
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-2 animate-pulse"
        style={{ gridTemplateColumns: `repeat(5, minmax(140px, 1fr))`, minWidth: "740px" }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-lg overflow-hidden border border-border/50">
            <div className="h-9 bg-muted/30" />
            <div className="flex flex-col gap-1 p-2" style={{ backgroundColor: "hsl(213 27% 10%)" }}>
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-6 rounded bg-muted/20" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PointsInfo() {
  const tierGroups = [
    { label: "Tier 5", tiers: ["LT5", "HT5"], color: "#2196F3" },
    { label: "Tier 4", tiers: ["LT4", "HT4"], color: "#4CAF50" },
    { label: "Tier 3", tiers: ["LT3", "HT3"], color: "#FF6B35" },
    { label: "Tier 2", tiers: ["LT2", "HT2"], color: "#C0C0C0" },
    { label: "Tier 1", tiers: ["LT1", "HT1"], color: "#FFD700" },
  ];
  return (
    <div>
      <h3 className="font-bold text-foreground text-lg mb-1">Points per Tier</h3>
      <p className="text-muted-foreground text-sm mb-4">Points are cumulative across all game modes.</p>
      <div className="flex flex-col gap-2">
        {tierGroups.map(({ label, tiers, color }) => (
          <div key={label} className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: "hsl(213 25% 15%)" }}>
            <span className="text-sm font-semibold w-14" style={{ color }}>{label}</span>
            <div className="flex gap-3">
              {tiers.map(tier => (
                <div key={tier} className="flex items-center gap-1.5">
                  <span className="text-sm font-bold" style={{ color }}>{tier}</span>
                  <span className="text-muted-foreground text-sm">= {TIER_POINTS[tier]} pts</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

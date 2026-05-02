import { useLocation } from "wouter";
import { Search } from "lucide-react";

interface NavbarProps {
  onSearchOpen: () => void;
  discordLink: string;
}

export function Navbar({ onSearchOpen }: NavbarProps) {
  const [, navigate] = useLocation();

  function goToLeaderboard(e: React.MouseEvent) {
    e.preventDefault();
    navigate("/");
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b mc-navbar-skyblue" data-testid="navbar">
      <div className="max-w-6xl mx-auto px-4 h-16 sm:h-[72px] flex items-center gap-4">
        {/* Logo */}
        <div className="flex-1 min-w-0 sm:flex-none flex items-center">
          <a
            href="/"
            onClick={goToLeaderboard}
            className="flex items-center gap-2 flex-shrink-0 mc-logo-wrap mc-no-interact"
            data-testid="link-logo"
            aria-label="CosmicTiers — go to Leaderboard"
          >
            <span className="mc-logo-pixel mc-logo-pixel-1" aria-hidden="true" />
            <span className="mc-logo-pixel mc-logo-pixel-2" aria-hidden="true" />
            <span className="mc-logo-pixel mc-logo-pixel-3" aria-hidden="true" />
            <span className="mc-logo-pixel mc-logo-pixel-4" aria-hidden="true" />
            <span className="mc-logo-pixel mc-logo-pixel-5" aria-hidden="true" />
            <span className="mc-logo-pixel mc-logo-pixel-6" aria-hidden="true" />
            <h1 className="mc-logo-title font-extrabold tracking-tight leading-none flex items-baseline">
              <span className="mc-logo-cosmic">Cosmic</span>
              <span className="mc-logo-tiers">Tiers</span>
            </h1>
          </a>
        </div>

        {/* Search trigger — CENTERED on desktop */}
        <div className="hidden sm:flex flex-1 justify-center px-4">
          <button
            onClick={onSearchOpen}
            className="mc-navbar-search w-full max-w-md flex items-center gap-2.5 px-3 h-10 rounded-md cursor-text group"
            data-testid="button-search-trigger"
            aria-label="Open search"
          >
            <Search className="h-4 w-4 text-sky-200/60 flex-shrink-0 group-hover:text-sky-200/90 transition-colors" />
            <span className="flex-1 text-left text-sm text-sky-200/45 group-hover:text-sky-200/70 transition-colors">
              Search players, results, testers...
            </span>
            <span className="hidden lg:flex items-center gap-1 text-[10px] text-sky-200/30 font-mono">
              <kbd className="px-1.5 py-0.5 rounded border border-sky-200/20">/</kbd>
            </span>
          </button>
        </div>

        {/* Right column — mobile search icon */}
        <div className="flex-none sm:flex-1 sm:flex sm:justify-end">
          <button
            className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={onSearchOpen}
            data-testid="button-mobile-search"
            aria-label="Open search"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

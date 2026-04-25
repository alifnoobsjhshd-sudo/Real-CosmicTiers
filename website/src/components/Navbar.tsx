import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, X } from "lucide-react";

interface NavbarProps {
  onSearch: (q: string) => void;
  discordLink: string;
}

export function Navbar({ onSearch }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  function handleSearch(val: string) {
    setSearchVal(val);
    onSearch(val);
  }

  function goToLeaderboard(e: React.MouseEvent) {
    e.preventDefault();
    navigate("/");
  }

  // Auto-focus the search field as soon as the mobile search drawer opens.
  useEffect(() => {
    if (mobileOpen) {
      // Defer one frame so the input is mounted before focusing.
      const id = window.setTimeout(() => mobileInputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [mobileOpen]);

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b mc-navbar-skyblue"
      data-testid="navbar"
    >
      <div className="max-w-6xl mx-auto px-4 h-16 sm:h-[72px] flex items-center gap-4">
        <a
          href="/"
          onClick={goToLeaderboard}
          className="flex items-center gap-2 flex-shrink-0 mc-logo-wrap"
          data-testid="link-logo"
          aria-label="CosmicTiers — go to Leaderboard"
        >
          {/* Pixel particles around the logo */}
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

        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative mc-navbar-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-200/70" />
            <input
              type="search"
              placeholder="Search player or title..."
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-md text-[15px] focus:outline-none"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex-1" />

        <button
          className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-search"
          aria-label={mobileOpen ? "Close search" : "Open search"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="sm:hidden border-t border-border px-4 py-3 flex flex-col gap-3 mc-navbar-skyblue"
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={mobileInputRef}
              type="search"
              placeholder="Search player..."
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded text-sm bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              data-testid="input-search-mobile"
            />
          </div>
        </div>
      )}
    </nav>
  );
}

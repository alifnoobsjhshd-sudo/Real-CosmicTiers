import { useState } from "react";
import { Search, Menu, X } from "lucide-react";

interface NavbarProps {
  onSearch: (q: string) => void;
  discordLink: string;
}

export function Navbar({ onSearch }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  function handleSearch(val: string) {
    setSearchVal(val);
    onSearch(val);
  }

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-border"
      style={{ backgroundColor: "hsl(213 30% 7%)", backdropFilter: "blur(12px)" }}
      data-testid="navbar"
    >
      <div className="max-w-6xl mx-auto px-4 h-16 sm:h-[72px] flex items-center gap-4">
        <a
          href="/"
          className="flex items-center gap-2 flex-shrink-0 mc-logo-wrap"
          data-testid="link-logo"
          aria-label="CosmicTiers home"
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

        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search player..."
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded text-sm bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex-1" />

        <button
          className="sm:hidden text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="sm:hidden border-t border-border px-4 py-3 flex flex-col gap-3"
          style={{ backgroundColor: "hsl(213 30% 7%)" }}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
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

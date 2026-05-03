import { useState } from "react";
import { Search, Menu, X } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { useTheme } from "@/components/ThemeProvider";

interface NavbarProps {
  onSearch: (q: string) => void;
  discordLink: string;
}

export function Navbar({ onSearch, discordLink }: NavbarProps) {
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  function handleSearch(val: string) {
    setSearchVal(val);
    onSearch(val);
  }

  return (
    <nav
      className="sticky top-0 z-50 w-full border-b border-border transition-all duration-700"
      style={{ backgroundColor: theme.navTint, backdropFilter: "blur(12px)" }}
      data-testid="navbar"
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0" data-testid="link-logo">
          <div className="flex items-center">
            <span
              className="font-extrabold text-xl tracking-tight transition-all duration-700"
              style={{
                color: theme.logoColor,
              }}
            >
              COSMIC
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white ml-1.5">
              TIERS
            </span>
          </div>
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

        <a
          href={discordLink || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105 duration-300"
          style={{
            backgroundColor: `hsl(${theme.cssVars.primary})`,
            color: `hsl(${theme.cssVars.primaryForeground})`,
            boxShadow: `0 0 12px -2px hsl(${theme.cssVars.primary} / 0.4)`,
          }}
          data-testid="link-discord"
        >
          <SiDiscord className="h-4 w-4" />
          <span>Discord</span>
        </a>

        <button
          className="sm:hidden text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="sm:hidden border-t border-border px-4 py-3 flex flex-col gap-3 transition-all duration-700" style={{ backgroundColor: theme.navTint }}>
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
          <a
            href={discordLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all duration-300"
            style={{
              backgroundColor: `hsl(${theme.cssVars.primary})`,
              color: `hsl(${theme.cssVars.primaryForeground})`,
              boxShadow: `0 0 12px -2px hsl(${theme.cssVars.primary} / 0.4)`,
            }}
            data-testid="link-discord-mobile"
          >
            <SiDiscord className="h-4 w-4" />
            <span>Join Discord Server</span>
          </a>
        </div>
      )}
    </nav>
  );
}

import { useState } from "react";
import { MoreVertical, LogOut, User, ChevronRight } from "lucide-react";
import { useAuth } from "./AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import EditProfileModal from "./EditProfileModal";

interface UserMenuProps {
  onTabChange?: (tab: string) => void;
}

export default function UserMenu({ onTabChange }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  if (!user) return null;

  const avatarUrl = user.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const displayName = user.player?.mcUsername ?? user.discordUsername ?? "Player";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2 py-1 h-auto rounded-full hover:bg-white/10"
            data-testid="button-user-menu"
          >
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full border border-white/20"
              data-testid="img-user-avatar"
            />
            <span className="text-sm font-medium text-white hidden sm:block max-w-[120px] truncate" data-testid="text-username">
              {displayName}
            </span>
            <MoreVertical className="w-4 h-4 text-white/70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[#1a1f2e] border border-white/10 text-white">
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="font-semibold text-sm">{displayName}</span>
            {user.discordUsername && (
              <span className="text-xs text-white/50 font-normal">{user.discordUsername}</span>
            )}
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="bg-white/10" />

          {user.player && (
            <DropdownMenuItem
              className="cursor-pointer flex items-center justify-between hover:bg-white/10 focus:bg-white/10"
              onClick={() => onTabChange?.("players")}
              data-testid="menu-item-profile"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-white/70" />
                <span>My Profile</span>
              </div>
              <ChevronRight className="w-3 h-3 text-white/40" />
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 hover:bg-white/10 focus:bg-white/10"
            onClick={() => setEditOpen(true)}
            data-testid="menu-item-edit-profile"
          >
            <User className="w-4 h-4 text-white/70" />
            <span>Edit Profile</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10" />

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 hover:bg-white/10 focus:bg-white/10"
            onClick={() => onTabChange?.("tier-test")}
            data-testid="menu-item-start-tier-test"
          >
            <span>⚔️ Start Tier Test</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 hover:bg-white/10 focus:bg-white/10"
            onClick={() => onTabChange?.("apply-tester")}
            data-testid="menu-item-apply-tester"
          >
            <span>🎮 Apply for Tester</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 hover:bg-white/10 focus:bg-white/10"
            onClick={() => onTabChange?.("contact")}
            data-testid="menu-item-contact"
          >
            <span>✉️ Contact Us</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10" />

          <DropdownMenuItem
            className="cursor-pointer flex items-center gap-2 text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
            onClick={logout}
            data-testid="menu-item-logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

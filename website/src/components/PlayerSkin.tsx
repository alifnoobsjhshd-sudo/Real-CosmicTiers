import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PlayerSkinProps {
  discordId: string;
  mcUsername: string;
  hasSkin?: boolean;
  className?: string;
  size?: number;
}

export function PlayerSkin({ discordId, mcUsername, hasSkin, className = "", size = 48 }: PlayerSkinProps) {
  const [failed, setFailed] = useState(false);
  const [fallback2, setFallback2] = useState(false);

  const primarySrc = `${API_BASE}/api/skin/${discordId}`;
  const fallbackSrc = `https://mc-heads.net/avatar/${mcUsername}/${size}`;
  const defaultSrc = `${API_BASE}/api/default-skin`;

  const src = failed ? (fallback2 ? defaultSrc : fallbackSrc) : primarySrc;

  return (
    <img
      src={src}
      alt={mcUsername}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ imageRendering: "pixelated" }}
      onError={() => {
        if (!failed) setFailed(true);
        else if (!fallback2) setFallback2(true);
      }}
      data-testid={`skin-${discordId}`}
    />
  );
}

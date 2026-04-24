import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PlayerSkinProps {
  discordId: string;
  mcUsername: string;
  skinUrl?: string | null;
  hasSkin?: boolean;
  className?: string;
  size?: number;
}

function resolveApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

export function PlayerSkin({ discordId, mcUsername, skinUrl, className = "", size = 48 }: PlayerSkinProps) {
  const [failed, setFailed] = useState(false);

  const primarySrc = skinUrl ? resolveApiUrl(skinUrl) : `${API_BASE}/api/skin/${discordId}`;
  const defaultSrc = `${API_BASE}/api/default-skin`;

  const src = failed ? defaultSrc : primarySrc;

  return (
    <img
      src={src}
      alt={mcUsername}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`object-contain ${className}`}
      style={{ imageRendering: "pixelated" }}
      onError={() => {
        if (!failed) setFailed(true);
      }}
      data-testid={`skin-${discordId}`}
    />
  );
}

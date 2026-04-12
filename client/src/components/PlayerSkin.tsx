import { useState } from "react";

interface PlayerSkinProps {
  discordId: string;
  mcUsername: string;
  skinUrl?: string | null;
  hasSkin?: boolean;
  className?: string;
  size?: number;
}

export function PlayerSkin({ discordId, mcUsername, skinUrl, className = "", size = 48 }: PlayerSkinProps) {
  const [failed, setFailed] = useState(false);

  const primarySrc = skinUrl ?? `/api/skin/${discordId}`;
  const defaultSrc = `/api/default-skin`;

  const src = failed ? defaultSrc : primarySrc;

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
      }}
      data-testid={`skin-${discordId}`}
    />
  );
}

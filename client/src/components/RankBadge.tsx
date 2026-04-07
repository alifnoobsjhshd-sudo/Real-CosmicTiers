interface RankBadgeProps {
  rank: number;
  size?: "sm" | "md" | "lg";
}

export function RankBadge({ rank, size = "md" }: RankBadgeProps) {
  const isTop3 = rank <= 3;

  const colors: Record<number, { bg: string; text: string; glow: string }> = {
    1: { bg: "linear-gradient(135deg, #B8860B, #FFD700, #B8860B)", text: "#1a1100", glow: "0 0 12px rgba(255,215,0,0.5)" },
    2: { bg: "linear-gradient(135deg, #808080, #C0C0C0, #808080)", text: "#111", glow: "0 0 10px rgba(192,192,192,0.4)" },
    3: { bg: "linear-gradient(135deg, #8B4513, #CD7F32, #8B4513)", text: "#fff", glow: "0 0 10px rgba(205,127,50,0.4)" },
  };

  const sizeMap = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  }[size];

  if (isTop3) {
    const style = colors[rank];
    return (
      <div
        data-testid={`rank-badge-${rank}`}
        className={`${sizeMap} rounded flex items-center justify-center font-bold flex-shrink-0`}
        style={{ background: style.bg, color: style.text, boxShadow: style.glow }}
      >
        {rank}
      </div>
    );
  }

  return (
    <div
      data-testid={`rank-badge-${rank}`}
      className={`${sizeMap} rounded flex items-center justify-center font-semibold text-muted-foreground flex-shrink-0`}
      style={{ backgroundColor: "hsl(213 25% 15%)" }}
    >
      {rank}
    </div>
  );
}

import { TITLES, type SpecialTitle } from "@shared/schema";

const TITLE_IMAGES: Record<string, string> = {
  "Combat Grandmaster": "/combat_grandmaster.gif",
  "Combat Master":      "/combat_master.gif",
  "Combat Ace":         "/combat_ace.gif",
  "Combat Specialist":  "/combat_specialist.png",
  "Combat Cadet":       "/combat_cadet.png",
  "Combat Novice":      "/combat_novice.png",
  "Combat Initiate":    "/combat_initiate.png",
  "Rookie":             "/rookie.png",
};

interface TitleBadgeProps {
  title: typeof TITLES[number];
  size?: "sm" | "md" | "lg";
}

export function TitleBadge({ title, size = "md" }: TitleBadgeProps) {
  const imgSrc = TITLE_IMAGES[title.name];

  const iconSize = size === "lg" ? 20 : size === "md" ? 16 : 14;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  }[size];

  return (
    <span
      data-testid={`title-badge-${title.name}`}
      className={`inline-flex items-center rounded-full font-semibold ${sizeClasses}`}
      style={{
        color: title.color,
        backgroundColor: `${title.color}18`,
        border: `1px solid ${title.color}44`,
      }}
    >
      <span>{title.name}</span>
      {imgSrc && (
        <img
          src={imgSrc}
          alt={title.name}
          width={iconSize}
          height={iconSize}
          className="object-contain flex-shrink-0"
        />
      )}
    </span>
  );
}

interface SpecialTitleBadgeProps {
  specialTitle: SpecialTitle;
  size?: "sm" | "md" | "lg";
}

export function SpecialTitleBadge({ specialTitle, size = "md" }: SpecialTitleBadgeProps) {
  const textColor       = specialTitle.textColor       ?? "#f1c40f";
  const backgroundColor = specialTitle.backgroundColor ?? null;
  const outline         = specialTitle.outline         ?? null;
  const iconUrl         = specialTitle.iconUrl         ?? null;

  const iconSize = size === "lg" ? 20 : size === "md" ? 16 : 14;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  }[size];

  const bgStyle = backgroundColor
    ? `${backgroundColor}28`
    : `${textColor}18`;

  const borderStyle = outline
    ? `1px solid ${outline}88`
    : `1px solid ${textColor}44`;

  return (
    <span
      data-testid="badge-special-title"
      className={`inline-flex items-center rounded-full font-bold ${sizeClasses}`}
      style={{
        color: textColor,
        backgroundColor: bgStyle,
        border: borderStyle,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {iconUrl && (
        <img
          src={iconUrl}
          alt={specialTitle.name}
          width={iconSize}
          height={iconSize}
          className="object-contain flex-shrink-0"
        />
      )}
      <span>{specialTitle.name}</span>
    </span>
  );
}

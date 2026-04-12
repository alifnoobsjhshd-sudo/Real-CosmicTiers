import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, bigint, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const players = pgTable("players", {
  discordId: text("discord_id").primaryKey(),
  mcUsername: text("mc_username").notNull().unique(),
  region: text("region").notNull(),
  skinUrl: text("skin_url"),
  renderedSkinPath: text("rendered_skin_path"),
  renderedSkinData: text("rendered_skin_data"),
  registeredAt: bigint("registered_at", { mode: "number" }).notNull(),
  isTester: boolean("is_tester").default(false).notNull(),
  testCount: integer("test_count").default(0).notNull(),
  previousPoints: integer("previous_points").default(0).notNull(),
  testerGameModes: text("tester_game_modes").array(),
  specialTitle: text("special_title"),
});

export const guildConfig = pgTable("guild_config", {
  guildId: text("guild_id").primaryKey(),
  configJson: text("config_json").notNull().default('{}'),
});

export const specialTitles = pgTable("special_titles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  roleId: text("role_id").notNull(),
  textColor: text("text_color"),
  backgroundColor: text("background_color"),
  outline: text("outline"),
  iconUrl: text("icon_url"),
});

export const playerTiers = pgTable("player_tiers", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  gameMode: text("game_mode").notNull(),
  tier: text("tier").notNull(),
});

export const retiredPlayerTiers = pgTable("retired_player_tiers", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  gameMode: text("game_mode").notNull(),
});

export const resultEntries = pgTable("result_entries", {
  id: serial("id").primaryKey(),
  playerDiscordId: text("player_discord_id").notNull(),
  playerMcUsername: text("player_mc_username").notNull(),
  testerDiscordId: text("tester_discord_id").notNull(),
  testerMcUsername: text("tester_mc_username"),
  gameMode: text("game_mode").notNull(),
  previousTier: text("previous_tier").notNull(),
  earnedTier: text("earned_tier").notNull(),
  previousPoints: integer("previous_points").notNull().default(0),
  newPoints: integer("new_points").notNull().default(0),
  pointDelta: integer("point_delta").notNull().default(0),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
});

export const GAME_MODES = [
  "Sword-PvP", "UHC", "Pot-PvP", "Nethpot",
  "SMP-PvP", "Axe-PvP", "Mace-PvP", "Crystal-PvP",
] as const;

export type GameMode = typeof GAME_MODES[number];

export const TIER_POINTS: Record<string, number> = {
  LT5: 1, HT5: 2,
  LT4: 3, HT4: 4,
  LT3: 6, HT3: 10,
  LT2: 20, HT2: 30,
  LT1: 45, HT1: 60,
};

export type TierLevel = "HT1" | "LT1" | "HT2" | "LT2" | "HT3" | "LT3" | "HT4" | "LT4" | "HT5" | "LT5";

export const TITLES = [
  { name: "Rookie",             minPoints: 1,   color: "#99aab5" },
  { name: "Combat Initiate",    minPoints: 5,   color: "#3498db" },
  { name: "Combat Novice",      minPoints: 10,  color: "#2ecc71" },
  { name: "Combat Cadet",       minPoints: 20,  color: "#1abc9c" },
  { name: "Combat Specialist",  minPoints: 50,  color: "#f1c40f" },
  { name: "Combat Ace",         minPoints: 100, color: "#e67e22" },
  { name: "Combat Master",      minPoints: 250, color: "#e74c3c" },
  { name: "Combat Grandmaster", minPoints: 400, color: "#FFD700" },
] as const;

export type TitleEntry = typeof TITLES[number];

export type TrendArrow = "high_up" | "up" | "down" | "high_down" | null;

export interface SpecialTitle {
  id: number;
  name: string;
  roleId: string;
  textColor: string | null;
  backgroundColor: string | null;
  outline: string | null;
  iconUrl: string | null;
}

export interface TopPlayerEntry {
  discordId: string;
  mcUsername: string;
  skinUrl: string;
  renderedSkinPath: string | null;
  trend: TrendArrow;
}

export interface TopPlayersResponse {
  gameModeData: Record<string, Record<string, TopPlayerEntry[]>>;
  lastUpdated: number;
}

export interface PlayerProfile {
  discordId: string;
  mcUsername: string;
  region: string;
  totalPoints: number;
  tiers: Record<string, string>;
  retiredTiers: string[];
  registeredAt: number;
  skinUrl: string;
  renderedSkinPath: string | null;
  rank: number;
  trend: TrendArrow;
  title: TitleEntry;
  isTester: boolean;
  testerGameModes: string[];
  specialTitle: SpecialTitle | null;
}

export interface TierTester {
  discordId: string;
  mcUsername: string | null;
  region: string | null;
  testCount: number;
  tiers: Record<string, string>;
  retiredTiers: string[];
  totalPoints: number;
  title: TitleEntry;
  trend: TrendArrow;
  skinUrl: string;
  renderedSkinPath: string | null;
  rank: number;
  gameModes: string[];
}

export interface ResultEntry {
  id: number;
  playerDiscordId: string;
  playerMcUsername: string;
  playerSkinUrl: string;
  testerDiscordId: string;
  testerMcUsername: string | null;
  gameMode: string;
  previousTier: string;
  earnedTier: string;
  previousPoints: number;
  newPoints: number;
  pointDelta: number;
  trend: TrendArrow;
  timestamp: number;
  testerProfile: TierTester | null;
}

export interface LeaderboardResponse {
  players: PlayerProfile[];
  lastUpdated: number;
}

export interface TesterLeaderboardResponse {
  testers: TierTester[];
  lastUpdated: number;
}

export interface ResultsResponse {
  results: ResultEntry[];
  lastUpdated: number;
}

export interface InfoResponse {
  discordLink: string;
  websiteLink: string;
}

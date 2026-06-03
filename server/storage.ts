import { db } from "./db";
import {
  players as playersTable,
  playerTiers as playerTiersTable,
  retiredPlayerTiers as retiredPlayerTiersTable,
  resultEntries as resultEntriesTable,
  specialTitles as specialTitlesTable,
  TITLES,
  TIER_POINTS,
  type PlayerProfile,
  type TierTester,
  type ResultEntry,
  type TrendArrow,
  type TitleEntry,
  type SpecialTitle,
  type TopPlayerEntry,
  type TopPlayersResponse,
  type User,
  type InsertUser,
} from "@shared/schema";
import { eq, desc, and, gte, sql, or, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

function calcPoints(tiers: Record<string, string>): number {
  return Object.values(tiers).reduce((sum, tier) => sum + (TIER_POINTS[tier] ?? 0), 0);
}

function getTitleForPoints(points: number): TitleEntry {
  let result: TitleEntry = TITLES[0];
  for (const t of TITLES) {
    if (points >= t.minPoints) result = t;
    else break;
  }
  return result;
}

function calcTrend(pointDelta: number): TrendArrow {
  if (pointDelta >= 6) return "high_up";
  if (pointDelta >= 1) return "up";
  if (pointDelta <= -6) return "high_down";
  if (pointDelta <= -1) return "down";
  return null;
}

function getPlayerSkinUrl(discordId: string): string {
  return `/api/skin/${encodeURIComponent(discordId)}`;
}

function getPeriodStartMs(period: string): number | null {
  const now = new Date();
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  }
  if (period === 'year') {
    return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
  }
  return null;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  registerPlayer(data: { discordId: string; mcUsername: string; region: string; skinUrl?: string | null }): Promise<void>;
  updatePlayerSkin(discordId: string, renderedSkinPath: string | null): Promise<void>;
  updatePlayerSkinData(discordId: string, base64Data: string | null): Promise<void>;
  getSkinData(discordId: string): Promise<string | null>;
  getPlayerMcUsername(discordId: string): Promise<string | null>;
  updatePlayerProfile(discordId: string, data: { mcUsername?: string; region?: string }): Promise<void>;
  postResult(data: {
    discordId: string;
    mcUsername: string;
    gameMode: string;
    tier: string;
    previousTier: string;
    testerDiscordId: string;
    testerMcUsername?: string | null;
  }): Promise<void>;
  addTesterRole(discordId: string): Promise<void>;
  removeTesterRole(discordId: string): Promise<void>;
  setTesterGameModes(discordId: string, gameModes: string[]): Promise<void>;
  incrementTesterStat(discordId: string): Promise<void>;
  clearTesterStat(discordId: string): Promise<void>;
  clearPlayerTiers(discordId: string): Promise<void>;
  removePlayerTier(discordId: string, gameMode: string): Promise<void>;
  deletePlayer(discordId: string): Promise<void>;
  retireTier(discordId: string, gameMode: string): Promise<void>;
  unretireTier(discordId: string, gameMode: string): Promise<void>;
  getLeaderboard(): Promise<PlayerProfile[]>;
  getTesters(period?: string): Promise<TierTester[]>;
  getTesterStatsByPeriod(period: string): Promise<Record<string, number>>;
  getResults(limit?: number): Promise<ResultEntry[]>;
  getSkin(discordId: string): Promise<string | null>;

  createSpecialTitle(
    name: string,
    roleId: string,
    opts?: {
      textColor?: string | null;
      backgroundColor?: string | null;
      outline?: string | null;
      iconUrl?: string | null;
    }
  ): Promise<SpecialTitle>;
  getSpecialTitles(): Promise<SpecialTitle[]>;
  giveSpecialTitle(discordId: string, titleName: string | null): Promise<void>;
  removeSpecialTitle(discordId: string): Promise<void>;
  getTopPlayers(): Promise<TopPlayersResponse>;
}

export class DatabaseStorage implements IStorage {
  private users: Map<string, User> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async registerPlayer(data: { discordId: string; mcUsername: string; region: string; skinUrl?: string | null }): Promise<void> {
    await db
      .insert(playersTable)
      .values({
        discordId: data.discordId,
        mcUsername: data.mcUsername,
        region: data.region,
        skinUrl: data.skinUrl ?? null,
        registeredAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: playersTable.discordId,
        set: {
          region: data.region,
          skinUrl: data.skinUrl ?? null,
        },
      });
  }

  async updatePlayerSkin(discordId: string, renderedSkinPath: string | null): Promise<void> {
    await db
      .update(playersTable)
      .set({ renderedSkinPath })
      .where(eq(playersTable.discordId, discordId));
  }

  async updatePlayerSkinData(discordId: string, base64Data: string | null): Promise<void> {
    await db
      .update(playersTable)
      .set({ renderedSkinData: base64Data })
      .where(eq(playersTable.discordId, discordId));
  }

  async getSkinData(discordId: string): Promise<string | null> {
    const result = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId)).limit(1);
    return result[0]?.renderedSkinData ?? null;
  }

  async getPlayerMcUsername(discordId: string): Promise<string | null> {
    const result = await db
      .select({ mcUsername: playersTable.mcUsername })
      .from(playersTable)
      .where(eq(playersTable.discordId, discordId))
      .limit(1);
    return result[0]?.mcUsername ?? null;
  }

  async updatePlayerProfile(discordId: string, data: { mcUsername?: string; region?: string }): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (data.mcUsername) updates.mcUsername = data.mcUsername;
    if (data.region) updates.region = data.region;
    if (Object.keys(updates).length === 0) return;
    await db
      .update(playersTable)
      .set(updates as any)
      .where(eq(playersTable.discordId, discordId));
  }

  async postResult(data: {
    discordId: string;
    mcUsername: string;
    gameMode: string;
    tier: string;
    previousTier: string;
    testerDiscordId: string;
    testerMcUsername?: string | null;
  }): Promise<void> {
    const existing = await db.select().from(playersTable).where(eq(playersTable.discordId, data.discordId)).limit(1);
    if (existing.length === 0) return;

    const currentTiers = await db.select().from(playerTiersTable).where(eq(playerTiersTable.discordId, data.discordId));
    const tiersMap: Record<string, string> = {};
    for (const t of currentTiers) tiersMap[t.gameMode] = t.tier;

    const previousPoints = calcPoints(tiersMap);

    tiersMap[data.gameMode] = data.tier;
    const newPoints = calcPoints(tiersMap);
    const pointDelta = newPoints - previousPoints;

    const tierExists = currentTiers.find(t => t.gameMode === data.gameMode);
    if (tierExists) {
      await db
        .update(playerTiersTable)
        .set({ tier: data.tier })
        .where(eq(playerTiersTable.id, tierExists.id));
    } else {
      await db.insert(playerTiersTable).values({
        discordId: data.discordId,
        gameMode: data.gameMode,
        tier: data.tier,
      });
    }

    await db.update(playersTable)
      .set({ previousPoints })
      .where(eq(playersTable.discordId, data.discordId));

    await db.insert(resultEntriesTable).values({
      playerDiscordId: data.discordId,
      playerMcUsername: data.mcUsername,
      testerDiscordId: data.testerDiscordId,
      testerMcUsername: data.testerMcUsername ?? null,
      gameMode: data.gameMode,
      previousTier: data.previousTier,
      earnedTier: data.tier,
      previousPoints,
      newPoints,
      pointDelta,
      timestamp: Date.now(),
    });
  }

  async addTesterRole(discordId: string): Promise<void> {
    await db
      .update(playersTable)
      .set({ isTester: true })
      .where(eq(playersTable.discordId, discordId));
  }

  async removeTesterRole(discordId: string): Promise<void> {
    await db
      .update(playersTable)
      .set({ isTester: false, testerGameModes: [] })
      .where(eq(playersTable.discordId, discordId));
  }

  async setTesterGameModes(discordId: string, gameModes: string[]): Promise<void> {
    await db
      .update(playersTable)
      .set({ testerGameModes: gameModes })
      .where(eq(playersTable.discordId, discordId));
  }

  async incrementTesterStat(discordId: string): Promise<void> {
    const existing = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId)).limit(1);
    if (existing.length === 0) return;
    await db
      .update(playersTable)
      .set({ testCount: (existing[0].testCount ?? 0) + 1 })
      .where(eq(playersTable.discordId, discordId));
  }

  async clearTesterStat(discordId: string): Promise<void> {
    await db
      .update(playersTable)
      .set({ testCount: 0 })
      .where(eq(playersTable.discordId, discordId));
  }

  async clearPlayerTiers(discordId: string): Promise<void> {
    const currentTiers = await db.select().from(playerTiersTable).where(eq(playerTiersTable.discordId, discordId));
    const oldPoints = calcPoints(Object.fromEntries(currentTiers.map(t => [t.gameMode, t.tier])));

    await db.delete(playerTiersTable).where(eq(playerTiersTable.discordId, discordId));
    await db.update(playersTable)
      .set({ previousPoints: oldPoints })
      .where(eq(playersTable.discordId, discordId));
  }

  async removePlayerTier(discordId: string, gameMode: string): Promise<void> {
    const currentTiers = await db.select().from(playerTiersTable).where(eq(playerTiersTable.discordId, discordId));
    const oldPoints = calcPoints(Object.fromEntries(currentTiers.map(t => [t.gameMode, t.tier])));

    await db.delete(playerTiersTable).where(
      and(eq(playerTiersTable.discordId, discordId), eq(playerTiersTable.gameMode, gameMode)),
    );
    await db.delete(retiredPlayerTiersTable).where(
      and(eq(retiredPlayerTiersTable.discordId, discordId), eq(retiredPlayerTiersTable.gameMode, gameMode)),
    );
    await db.update(playersTable)
      .set({ previousPoints: oldPoints })
      .where(eq(playersTable.discordId, discordId));
  }

  async deletePlayer(discordId: string): Promise<void> {
    await db.delete(playerTiersTable).where(eq(playerTiersTable.discordId, discordId));
    await db.delete(retiredPlayerTiersTable).where(eq(retiredPlayerTiersTable.discordId, discordId));
    await db.delete(playersTable).where(eq(playersTable.discordId, discordId));
  }

  async retireTier(discordId: string, gameMode: string): Promise<void> {
    const existing = await db
      .select()
      .from(retiredPlayerTiersTable)
      .where(and(eq(retiredPlayerTiersTable.discordId, discordId), eq(retiredPlayerTiersTable.gameMode, gameMode)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(retiredPlayerTiersTable).values({ discordId, gameMode });
    }
  }

  async unretireTier(discordId: string, gameMode: string): Promise<void> {
    await db
      .delete(retiredPlayerTiersTable)
      .where(and(eq(retiredPlayerTiersTable.discordId, discordId), eq(retiredPlayerTiersTable.gameMode, gameMode)));
  }

  private async buildSpecialTitleMap(): Promise<Record<string, SpecialTitle>> {
    const allTitles = await db.select().from(specialTitlesTable);
    const map: Record<string, SpecialTitle> = {};
    for (const t of allTitles) map[t.name] = t;
    return map;
  }

  async getLeaderboard(): Promise<PlayerProfile[]> {
    const allPlayers = await db.select().from(playersTable);
    const allTiers = await db.select().from(playerTiersTable);
    const allRetired = await db.select().from(retiredPlayerTiersTable);
    const specialTitleMap = await this.buildSpecialTitleMap();

    const tiersByPlayer: Record<string, Record<string, string>> = {};
    for (const t of allTiers) {
      if (!tiersByPlayer[t.discordId]) tiersByPlayer[t.discordId] = {};
      tiersByPlayer[t.discordId][t.gameMode] = t.tier;
    }

    const retiredByPlayer: Record<string, string[]> = {};
    for (const r of allRetired) {
      if (!retiredByPlayer[r.discordId]) retiredByPlayer[r.discordId] = [];
      retiredByPlayer[r.discordId].push(r.gameMode);
    }

    const profiles: PlayerProfile[] = allPlayers
      .map(p => {
        const tiers = tiersByPlayer[p.discordId] ?? {};
        const totalPoints = calcPoints(tiers);
        const pointDelta = totalPoints - (p.previousPoints ?? 0);
        const specialTitle = p.specialTitle ? (specialTitleMap[p.specialTitle] ?? null) : null;
        return {
          discordId: p.discordId,
          mcUsername: p.mcUsername,
          region: p.region,
          totalPoints,
          tiers,
          retiredTiers: retiredByPlayer[p.discordId] ?? [],
          registeredAt: p.registeredAt,
          skinUrl: getPlayerSkinUrl(p.discordId),
          renderedSkinPath: getPlayerSkinUrl(p.discordId),
          rank: 0,
          trend: calcTrend(pointDelta),
          title: getTitleForPoints(totalPoints),
          isTester: p.isTester ?? false,
          testerGameModes: p.testerGameModes ?? [],
          specialTitle,
        } as PlayerProfile;
      })
      .filter(p => p.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints || a.mcUsername.localeCompare(b.mcUsername));

    profiles.forEach((p, i) => { p.rank = i + 1; });
    return profiles;
  }

  async getTesterStatsByPeriod(period: string): Promise<Record<string, number>> {
    const periodStartMs = getPeriodStartMs(period);
    const baseQuery = db
      .select({
        testerDiscordId: resultEntriesTable.testerDiscordId,
        cnt: sql<number>`cast(count(*) as int)`,
      })
      .from(resultEntriesTable);

    const rows = periodStartMs !== null
      ? await baseQuery.where(gte(resultEntriesTable.timestamp, periodStartMs)).groupBy(resultEntriesTable.testerDiscordId)
      : await baseQuery.groupBy(resultEntriesTable.testerDiscordId);

    const stats: Record<string, number> = {};
    for (const r of rows) stats[r.testerDiscordId] = r.cnt;
    return stats;
  }

  async getTesters(period?: string): Promise<TierTester[]> {
    // Include players who have isTester=true OR who appear as a tester in result_entries.
    // This makes the tester list self-healing: even if isTester was never synced from the
    // bot, anyone who has actually conducted a tier test will still appear on the website.
    const testerIdsFromResults = await db
      .selectDistinct({ discordId: resultEntriesTable.testerDiscordId })
      .from(resultEntriesTable);
    const testerDiscordIds = testerIdsFromResults.map(r => r.discordId);

    let allPlayers;
    if (testerDiscordIds.length > 0) {
      allPlayers = await db
        .select()
        .from(playersTable)
        .where(or(eq(playersTable.isTester, true), inArray(playersTable.discordId, testerDiscordIds)));
    } else {
      allPlayers = await db.select().from(playersTable).where(eq(playersTable.isTester, true));
    }

    const allTiers = await db.select().from(playerTiersTable);
    const allRetired = await db.select().from(retiredPlayerTiersTable);

    const tiersForTesters: Record<string, Record<string, string>> = {};
    for (const t of allTiers) {
      if (!tiersForTesters[t.discordId]) tiersForTesters[t.discordId] = {};
      tiersForTesters[t.discordId][t.gameMode] = t.tier;
    }

    const retiredByPlayer: Record<string, string[]> = {};
    for (const r of allRetired) {
      if (!retiredByPlayer[r.discordId]) retiredByPlayer[r.discordId] = [];
      retiredByPlayer[r.discordId].push(r.gameMode);
    }

    const effectivePeriod = period ?? 'alltime';
    const periodStats = await this.getTesterStatsByPeriod(effectivePeriod);

    const testers: TierTester[] = allPlayers
      .map(p => {
        const tiers = tiersForTesters[p.discordId] ?? {};
        const totalPoints = calcPoints(tiers);
        const pointDelta = totalPoints - (p.previousPoints ?? 0);
        return {
          discordId: p.discordId,
          mcUsername: p.mcUsername,
          region: p.region,
          testCount: periodStats[p.discordId] ?? 0,
          tiers,
          retiredTiers: retiredByPlayer[p.discordId] ?? [],
          totalPoints,
          title: getTitleForPoints(totalPoints),
          trend: calcTrend(pointDelta),
          skinUrl: getPlayerSkinUrl(p.discordId),
          renderedSkinPath: getPlayerSkinUrl(p.discordId),
          rank: 0,
          gameModes: p.testerGameModes ?? [],
        } as TierTester;
      })
      .sort((a, b) => (b.testCount ?? 0) - (a.testCount ?? 0));

    testers.forEach((t, i) => { t.rank = i + 1; });
    return testers;
  }

  async getResults(limit = 50): Promise<ResultEntry[]> {
    const rows = await db
      .select()
      .from(resultEntriesTable)
      .orderBy(desc(resultEntriesTable.timestamp))
      .limit(limit);

    const testerIds = [...new Set(rows.map(r => r.testerDiscordId))];
    let testerMap: Record<string, TierTester> = {};

    if (testerIds.length > 0) {
      const testersList = await this.getTesters();
      for (const t of testersList) {
        testerMap[t.discordId] = t;
      }
      const allPlayers = await db.select().from(playersTable);
      const allTiers = await db.select().from(playerTiersTable);
      const tiersMap: Record<string, Record<string, string>> = {};
      for (const t of allTiers) {
        if (!tiersMap[t.discordId]) tiersMap[t.discordId] = {};
        tiersMap[t.discordId][t.gameMode] = t.tier;
      }
      const allRetired = await db.select().from(retiredPlayerTiersTable);
      const retiredByPlayer: Record<string, string[]> = {};
      for (const r of allRetired) {
        if (!retiredByPlayer[r.discordId]) retiredByPlayer[r.discordId] = [];
        retiredByPlayer[r.discordId].push(r.gameMode);
      }
      for (const p of allPlayers) {
        if (!testerMap[p.discordId]) {
          const tiers = tiersMap[p.discordId] ?? {};
          const totalPoints = calcPoints(tiers);
          const pointDelta = totalPoints - (p.previousPoints ?? 0);
          testerMap[p.discordId] = {
            discordId: p.discordId,
            mcUsername: p.mcUsername,
            region: p.region,
            testCount: p.testCount ?? 0,
            tiers,
            retiredTiers: retiredByPlayer[p.discordId] ?? [],
            totalPoints,
            title: getTitleForPoints(totalPoints),
            trend: calcTrend(pointDelta),
            skinUrl: getPlayerSkinUrl(p.discordId),
            renderedSkinPath: getPlayerSkinUrl(p.discordId),
            rank: 0,
            gameModes: p.testerGameModes ?? [],
          };
        }
      }
    }

    return rows.map(r => ({
      id: r.id,
      playerDiscordId: r.playerDiscordId,
      playerMcUsername: r.playerMcUsername,
      playerSkinUrl: getPlayerSkinUrl(r.playerDiscordId),
      testerDiscordId: r.testerDiscordId,
      testerMcUsername: r.testerMcUsername ?? null,
      gameMode: r.gameMode,
      previousTier: r.previousTier,
      earnedTier: r.earnedTier,
      previousPoints: r.previousPoints,
      newPoints: r.newPoints,
      pointDelta: r.pointDelta,
      trend: calcTrend(r.pointDelta),
      timestamp: r.timestamp,
      testerProfile: testerMap[r.testerDiscordId] ?? null,
    }));
  }

  async getSkin(discordId: string): Promise<string | null> {
    const result = await db.select().from(playersTable).where(eq(playersTable.discordId, discordId)).limit(1);
    return result[0]?.renderedSkinPath ?? null;
  }

  async createSpecialTitle(
    name: string,
    roleId: string,
    opts?: {
      textColor?: string | null;
      backgroundColor?: string | null;
      outline?: string | null;
      iconUrl?: string | null;
    }
  ): Promise<SpecialTitle> {
    const [row] = await db
      .insert(specialTitlesTable)
      .values({
        name,
        roleId,
        textColor: opts?.textColor ?? null,
        backgroundColor: opts?.backgroundColor ?? null,
        outline: opts?.outline ?? null,
        iconUrl: opts?.iconUrl ?? null,
      })
      .onConflictDoUpdate({
        target: specialTitlesTable.name,
        set: {
          roleId,
          textColor: opts?.textColor ?? null,
          backgroundColor: opts?.backgroundColor ?? null,
          outline: opts?.outline ?? null,
          iconUrl: opts?.iconUrl ?? null,
        },
      })
      .returning();
    return row;
  }

  async getSpecialTitles(): Promise<SpecialTitle[]> {
    return await db.select().from(specialTitlesTable);
  }

  async giveSpecialTitle(discordId: string, titleName: string | null): Promise<void> {
    await db
      .update(playersTable)
      .set({ specialTitle: titleName })
      .where(eq(playersTable.discordId, discordId));
  }

  async removeSpecialTitle(discordId: string): Promise<void> {
    await db
      .update(playersTable)
      .set({ specialTitle: null })
      .where(eq(playersTable.discordId, discordId));
  }

  async getTopPlayers(): Promise<TopPlayersResponse> {
    const allTiers = await db.select().from(playerTiersTable);
    const allPlayers = await db.select().from(playersTable);
    const allRetired = await db.select().from(retiredPlayerTiersTable);
    const allResults = await db
      .select()
      .from(resultEntriesTable)
      .orderBy(desc(resultEntriesTable.timestamp));

    const playerMap: Record<string, typeof allPlayers[0]> = {};
    for (const p of allPlayers) playerMap[p.discordId] = p;

    const retiredSet = new Set(allRetired.map(r => `${r.discordId}::${r.gameMode}`));

    const TIER_RANK: Record<string, number> = {
      HT1: 10, LT1: 9, HT2: 8, LT2: 7, HT3: 6, LT3: 5, HT4: 4, LT4: 3, HT5: 2, LT5: 1,
    };

    const lastResultPerPlayerMode: Record<string, Record<string, typeof allResults[0]>> = {};
    for (const r of allResults) {
      if (!lastResultPerPlayerMode[r.playerDiscordId]) lastResultPerPlayerMode[r.playerDiscordId] = {};
      if (!lastResultPerPlayerMode[r.playerDiscordId][r.gameMode]) {
        lastResultPerPlayerMode[r.playerDiscordId][r.gameMode] = r;
      }
    }

    function calcGameModeTrend(discordId: string, gameMode: string): TrendArrow {
      const r = lastResultPerPlayerMode[discordId]?.[gameMode];
      if (!r || r.previousTier === "Unranked") return null;
      const prev = TIER_RANK[r.previousTier] ?? 0;
      const curr = TIER_RANK[r.earnedTier] ?? 0;
      const diff = curr - prev;
      if (diff >= 2) return "high_up";
      if (diff === 1) return "up";
      if (diff <= -2) return "high_down";
      if (diff === -1) return "down";
      return null;
    }

    const gameModeData: Record<string, Record<string, TopPlayerEntry[]>> = {};
    for (const tierEntry of allTiers) {
      const player = playerMap[tierEntry.discordId];
      if (!player) continue;
      if (retiredSet.has(`${tierEntry.discordId}::${tierEntry.gameMode}`)) continue;
      if (!gameModeData[tierEntry.gameMode]) gameModeData[tierEntry.gameMode] = {};
      if (!gameModeData[tierEntry.gameMode][tierEntry.tier]) gameModeData[tierEntry.gameMode][tierEntry.tier] = [];
      gameModeData[tierEntry.gameMode][tierEntry.tier].push({
        discordId: tierEntry.discordId,
        mcUsername: player.mcUsername,
        skinUrl: getPlayerSkinUrl(tierEntry.discordId),
        renderedSkinPath: getPlayerSkinUrl(tierEntry.discordId),
        trend: calcGameModeTrend(tierEntry.discordId, tierEntry.gameMode),
      });
    }

    for (const gm of Object.keys(gameModeData)) {
      for (const tier of Object.keys(gameModeData[gm])) {
        gameModeData[gm][tier].sort((a, b) => a.mcUsername.localeCompare(b.mcUsername));
      }
    }

    return { gameModeData, lastUpdated: Date.now() };
  }
}

export const storage = new DatabaseStorage();

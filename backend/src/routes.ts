import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const INTERNAL_API_KEY = process.env["INTERNAL_API_KEY"] ?? "";
const DEFAULT_SKIN_PATH = path.resolve(process.cwd(), "default-skin.png");
const TITLE_ICONS_DIR = path.resolve(process.cwd(), "title-icons");

function sendDefaultSkin(res: Response) {
  if (fs.existsSync(DEFAULT_SKIN_PATH)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(DEFAULT_SKIN_PATH);
    return;
  }
  res.status(404).json({ error: "Default skin not found" });
}

function botAuth(req: Request, res: Response, next: NextFunction) {
  if (INTERNAL_API_KEY) {
    const key = req.headers["x-internal-api-key"] as string;
    if (key !== INTERNAL_API_KEY) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const players = await storage.getLeaderboard();
      res.json({ players, lastUpdated: Date.now() });
    } catch (err) {
      console.error("[leaderboard]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/testers", async (_req, res) => {
    try {
      const testers = await storage.getTesters();
      res.json({ testers, lastUpdated: Date.now() });
    } catch (err) {
      console.error("[testers]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/results", async (_req, res) => {
    try {
      const results = await storage.getResults(50);
      res.json({ results, lastUpdated: Date.now() });
    } catch (err) {
      console.error("[results]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/info", (_req, res) => {
    res.json({
      discordLink: process.env["DISCORD_SERVER_LINK"] ?? "",
      websiteLink: process.env["WEBSITE_LINK"] ?? "",
    });
  });

  app.get("/api/skin/:discordId", async (req, res) => {
    try {
      const { discordId } = req.params;
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");

      const skinData = await storage.getSkinData(discordId);
      if (skinData) {
        const buffer = Buffer.from(skinData, "base64");
        res.setHeader("Content-Type", "image/png");
        res.send(buffer);
        return;
      }

      sendDefaultSkin(res);
    } catch (err) {
      console.error("[skin]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/default-skin", (_req, res) => {
    sendDefaultSkin(res);
  });

  app.get("/api/title-icon/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(TITLE_ICONS_DIR, filename);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: "Icon not found" });
      }
    } catch (err) {
      console.error("[title-icon]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/bot/players", botAuth, async (_req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json({ players });
    } catch (err) {
      console.error("[bot/players]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/bot/config/:guildId", botAuth, async (req, res) => {
    try {
      const config = await storage.getGuildConfig(req.params.guildId);
      res.json({ config });
    } catch (err) {
      console.error("[bot/config get]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/config", botAuth, async (req, res) => {
    try {
      const { guildId, config } = req.body;
      if (!guildId || typeof config !== "object") {
        res.status(400).json({ error: "Missing guildId or config" });
        return;
      }
      await storage.setGuildConfig(guildId, config);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/config post]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/register", botAuth, async (req, res) => {
    try {
      const { discordId, mcUsername, region, skinUrl } = req.body;
      if (!discordId || !mcUsername || !region) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      await storage.registerPlayer({ discordId, mcUsername, region, skinUrl });
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/register]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/skin", botAuth, async (req, res) => {
    try {
      const { discordId, renderedSkinPath } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      await storage.updatePlayerSkin(discordId, renderedSkinPath ?? null);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/skin]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/upload-skin", botAuth, async (req, res) => {
    try {
      const { discordId, data } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      if (data != null && typeof data !== "string") {
        res.status(400).json({ error: "Skin data must be a base64 string" });
        return;
      }
      await storage.updatePlayerSkinData(discordId, data ?? null);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/upload-skin]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/result", botAuth, async (req, res) => {
    try {
      const { discordId, mcUsername, gameMode, tier, previousTier, testerDiscordId, testerMcUsername } = req.body;
      if (!discordId || !mcUsername || !gameMode || !tier || !previousTier || !testerDiscordId) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      await storage.postResult({ discordId, mcUsername, gameMode, tier, previousTier, testerDiscordId, testerMcUsername });
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/result]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/tester-role", botAuth, async (req, res) => {
    try {
      const { discordId, action } = req.body;
      if (!discordId || !action) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      if (action === "add") {
        await storage.addTesterRole(discordId);
      } else if (action === "remove") {
        await storage.removeTesterRole(discordId);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/tester-role]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/tester-stat", botAuth, async (req, res) => {
    try {
      const { discordId, action } = req.body;
      if (!discordId || !action) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      if (action === "increment") {
        await storage.incrementTesterStat(discordId);
      } else if (action === "clear") {
        await storage.clearTesterStat(discordId);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/tester-stat]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/clear-user", botAuth, async (req, res) => {
    try {
      const { discordId } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      await storage.clearPlayerTiers(discordId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/clear-user]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/update-profile", botAuth, async (req, res) => {
    try {
      const { discordId, mcUsername, region } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      await storage.updatePlayerProfile(discordId, {
        mcUsername: mcUsername ?? undefined,
        region: region ?? undefined,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/update-profile]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/delete-player", botAuth, async (req, res) => {
    try {
      const { discordId } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      await storage.deletePlayer(discordId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/delete-player]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/retire-tier", botAuth, async (req, res) => {
    try {
      const { discordId, gameMode } = req.body;
      if (!discordId || !gameMode) {
        res.status(400).json({ error: "Missing discordId or gameMode" });
        return;
      }
      await storage.retireTier(discordId, gameMode);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/retire-tier]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/unretire-tier", botAuth, async (req, res) => {
    try {
      const { discordId, gameMode } = req.body;
      if (!discordId || !gameMode) {
        res.status(400).json({ error: "Missing discordId or gameMode" });
        return;
      }
      await storage.unretireTier(discordId, gameMode);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/unretire-tier]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/tester-game-modes", botAuth, async (req, res) => {
    try {
      const { discordId, gameModes } = req.body;
      if (!discordId || !Array.isArray(gameModes)) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      await storage.setTesterGameModes(discordId, gameModes);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/tester-game-modes]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/special-titles", async (_req, res) => {
    try {
      const titles = await storage.getSpecialTitles();
      res.json({ titles });
    } catch (err) {
      console.error("[special-titles]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/upload-title-icon", botAuth, async (req, res) => {
    try {
      const { filename, data, mimeType } = req.body;
      if (!filename || !data) {
        res.status(400).json({ error: "Missing filename or data" });
        return;
      }
      const ext = mimeType === "image/gif" ? ".gif" : ".png";
      const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_") + ext;
      fs.mkdirSync(TITLE_ICONS_DIR, { recursive: true });
      const buffer = Buffer.from(data, "base64");
      const filePath = path.join(TITLE_ICONS_DIR, safeName);
      fs.writeFileSync(filePath, buffer);
      res.json({ ok: true, iconUrl: `/api/title-icon/${safeName}` });
    } catch (err) {
      console.error("[bot/upload-title-icon]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/create-title", botAuth, async (req, res) => {
    try {
      const { name, roleId, textColor, backgroundColor, outline, iconUrl } = req.body;
      if (!name || !roleId) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      const title = await storage.createSpecialTitle(name, roleId, {
        textColor: textColor ?? null,
        backgroundColor: backgroundColor ?? null,
        outline: outline ?? null,
        iconUrl: iconUrl ?? null,
      });
      res.json({ ok: true, title });
    } catch (err) {
      console.error("[bot/create-title]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/give-title", botAuth, async (req, res) => {
    try {
      const { discordId, titleName } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      await storage.giveSpecialTitle(discordId, titleName ?? null);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/give-title]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/remove-title", botAuth, async (req, res) => {
    try {
      const { discordId } = req.body;
      if (!discordId) {
        res.status(400).json({ error: "Missing discordId" });
        return;
      }
      await storage.removeSpecialTitle(discordId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/remove-title]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/top-players", async (_req, res) => {
    try {
      const data = await storage.getTopPlayers();
      res.json(data);
    } catch (err) {
      console.error("[top-players]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Bot: Remove Tier ────────────────────────────────────────────────────────

  app.post("/api/bot/remove-tier", botAuth, async (req, res) => {
    try {
      const { discordId, gameMode } = req.body;
      if (!discordId || !gameMode) {
        res.status(400).json({ error: "Missing discordId or gameMode" });
        return;
      }
      await storage.removePlayerTier(discordId, gameMode);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/remove-tier]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bot/remove-tester-game-mode", botAuth, async (req, res) => {
    try {
      const { discordId, gameMode } = req.body;
      if (!discordId || !gameMode) {
        res.status(400).json({ error: "Missing discordId or gameMode" });
        return;
      }
      await storage.removeTesterFromGameMode(discordId, gameMode);
      res.json({ ok: true });
    } catch (err) {
      console.error("[bot/remove-tester-game-mode]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Bot: Get Full Player Profile (for role restoration on rejoin) ───────────

  app.get("/api/bot/player/:discordId", botAuth, async (req, res) => {
    try {
      const { discordId } = req.params;
      const player = await storage.getPlayerByDiscordId(discordId);
      res.json({ player: player ?? null });
    } catch (err) {
      console.error("[bot/player]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Web Auth ─────────────────────────────────────────────────────────────────

  const DISCORD_CLIENT_ID     = process.env["DISCORD_CLIENT_ID"]     ?? "";
  const DISCORD_CLIENT_SECRET = process.env["DISCORD_CLIENT_SECRET"] ?? "";
  const DISCORD_REDIRECT_URI  = process.env["DISCORD_REDIRECT_URI"]  ?? "";
  const DISCORD_BOT_TOKEN     = process.env["DISCORD_BOT_TOKEN"]     ?? "";
  const SERVER_ID             = process.env["SERVER_ID"]             ?? "";
  const WEBSITE_URL           = process.env["WEBSITE_URL"]           ?? "";

  async function discordRequest(path: string, opts: RequestInit = {}): Promise<any> {
    const r = await fetch(`https://discord.com/api/v10${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    });
    if (!r.ok) return null;
    return r.json();
  }

  async function assignDiscordRole(discordId: string, roleId: string): Promise<void> {
    if (!DISCORD_BOT_TOKEN || !SERVER_ID || !roleId) return;
    await fetch(`https://discord.com/api/v10/guilds/${SERVER_ID}/members/${discordId}/roles/${roleId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
  }

  function webAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers["authorization"];
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as any).webToken = auth.slice(7);
    next();
  }

  app.get("/api/auth/discord", (req, res) => {
    if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
      res.status(503).json({ error: "Discord OAuth not configured" });
      return;
    }
    const state = randomUUID();
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds",
      state,
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get("/api/auth/discord/callback", async (req, res) => {
    const { code, error } = req.query as Record<string, string>;
    const websiteUrl = WEBSITE_URL || `${req.protocol}://${req.get("host")}`;

    if (error || !code) {
      res.redirect(`${websiteUrl}/auth/callback?error=oauth_denied`);
      return;
    }

    try {
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: DISCORD_REDIRECT_URI,
        }),
      });
      if (!tokenRes.ok) {
        res.redirect(`${websiteUrl}/auth/callback?error=token_exchange`);
        return;
      }
      const tokenData = await tokenRes.json() as { access_token: string; token_type: string };
      const discordUser = await discordRequest("/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!discordUser?.id) {
        res.redirect(`${websiteUrl}/auth/callback?error=user_fetch`);
        return;
      }

      const discordId: string = discordUser.id;

      let inServer = false;
      if (SERVER_ID) {
        const guilds: any[] = await discordRequest("/users/@me/guilds", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }) ?? [];
        inServer = guilds.some((g: any) => g.id === SERVER_ID);
      } else {
        inServer = true;
      }

      if (!inServer) {
        res.redirect(`${websiteUrl}/auth/callback?error=not_in_server`);
        return;
      }

      const existingPlayer = await storage.getPlayerByDiscordId(discordId);
      const sessionToken = randomUUID();
      const isTemp = !existingPlayer;
      const expiresAt = Date.now() + (isTemp ? 30 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);

      await storage.createWebSession(sessionToken, discordId, tokenData.access_token, isTemp, expiresAt);

      const params = new URLSearchParams({ token: sessionToken });
      if (!existingPlayer) params.set("needs_registration", "1");
      res.redirect(`${websiteUrl}/auth/callback?${params}`);
    } catch (err) {
      console.error("[auth/callback]", err);
      res.redirect(`${websiteUrl}/auth/callback?error=server_error`);
    }
  });

  app.get("/api/auth/me", webAuth, async (req, res) => {
    const token = (req as any).webToken as string;
    try {
      const session = await storage.getWebSession(token);
      if (!session) {
        res.status(401).json({ error: "Invalid or expired session" });
        return;
      }
      const discordUser = await discordRequest("/users/@me", {
        headers: { Authorization: `Bearer ${session.discordAccessToken}` },
      });
      const player = await storage.getPlayerByDiscordId(session.discordId);
      res.json({
        discordId: session.discordId,
        isTemp: session.isTemp,
        discordUsername: discordUser?.username ?? null,
        discordAvatar: discordUser?.avatar ?? null,
        player: player ?? null,
      });
    } catch (err) {
      console.error("[auth/me]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", webAuth, async (req, res) => {
    const token = (req as any).webToken as string;
    try {
      await storage.deleteWebSession(token);
      res.json({ ok: true });
    } catch (err) {
      console.error("[auth/logout]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/register", webAuth, async (req, res) => {
    const token = (req as any).webToken as string;
    try {
      const session = await storage.getWebSession(token);
      if (!session || !session.isTemp) {
        res.status(401).json({ error: "Invalid session or already registered" });
        return;
      }
      const { mcUsername, region, skinBase64 } = req.body as { mcUsername?: string; region?: string; skinBase64?: string };
      if (!mcUsername || !region) {
        res.status(400).json({ error: "Missing mcUsername or region" });
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(mcUsername)) {
        res.status(400).json({ error: "Invalid Minecraft username" });
        return;
      }
      const VALID_REGIONS = ["NA", "EU", "AS", "SA", "AF", "OC", "AN"];
      if (!VALID_REGIONS.includes(region)) {
        res.status(400).json({ error: "Invalid region" });
        return;
      }

      let skinUrl: string | null = null;
      try {
        const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(mcUsername)}`);
        if (mojangRes.ok) {
          const mojangData = await mojangRes.json() as { id?: string };
          if (mojangData.id) {
            skinUrl = `https://crafatar.com/avatars/${mojangData.id}?size=64&overlay`;
          }
        }
      } catch { /* ignore, skinUrl stays null */ }

      await storage.registerPlayer({ discordId: session.discordId, mcUsername, region, skinUrl });

      if (skinBase64) {
        await storage.updatePlayerSkinData(session.discordId, skinBase64);
      }

      if (SERVER_ID && DISCORD_BOT_TOKEN) {
        const guildConfig = await storage.getGuildConfig(SERVER_ID).catch(() => ({}));
        if (guildConfig?.registeredRoleId) {
          await assignDiscordRole(session.discordId, guildConfig.registeredRoleId);
        }
        const guildMember = await discordRequest(`/guilds/${SERVER_ID}/members/${session.discordId}`, {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        });
        if (guildMember && guildConfig?.unrankedRoleId) {
          await assignDiscordRole(session.discordId, guildConfig.unrankedRoleId);
        }
      }

      await storage.upgradeWebSession(token);
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.message?.includes("unique constraint") || err?.code === "23505") {
        res.status(409).json({ error: "That Minecraft username is already registered" });
        return;
      }
      console.error("[auth/register]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/update-profile", webAuth, async (req, res) => {
    const token = (req as any).webToken as string;
    try {
      const session = await storage.getWebSession(token);
      if (!session || session.isTemp) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { mcUsername, region } = req.body as { mcUsername?: string; region?: string };
      const result = await storage.updatePlayerProfileWithCooldown(session.discordId, { mcUsername, region });
      if (!result.ok && result.cooldownRemaining) {
        res.status(429).json({ error: "Username change cooldown active", cooldownRemaining: result.cooldownRemaining });
        return;
      }
      res.json({ ok: result.ok });
    } catch (err) {
      console.error("[auth/update-profile]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/update-skin", webAuth, async (req, res) => {
    const token = (req as any).webToken as string;
    try {
      const session = await storage.getWebSession(token);
      if (!session || session.isTemp) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { skinBase64 } = req.body as { skinBase64?: string };
      if (!skinBase64) {
        res.status(400).json({ error: "Missing skinBase64" });
        return;
      }
      if (skinBase64.length > 2 * 1024 * 1024) {
        res.status(413).json({ error: "Skin file too large (max 2MB)" });
        return;
      }
      await storage.updatePlayerSkinData(session.discordId, skinBase64);
      res.json({ ok: true });
    } catch (err) {
      console.error("[auth/update-skin]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import fs from "fs";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";

const INTERNAL_API_KEY = process.env["INTERNAL_API_KEY"] ?? "";
const ADMIN_PASSWORD = "@alif_op24";
const DEFAULT_SKIN_PATH = path.resolve(process.cwd(), "default-skin.png");
const DEFAULT_SKIN_HEAD_PATH = path.resolve(process.cwd(), "default-skin-head.png");
const TITLE_ICONS_DIR = path.resolve(process.cwd(), "title-icons");

// ── Admin auth ───────────────────────────────────────────────────────────────
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
let cachedTheme = "cosmic";
const VALID_THEMES = new Set([
  "cosmic", "summer", "christmas", "winter", "raining",
  "cherry_blossom", "blossom", "moon", "april_fool", "halloween",
]);

function checkRateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= MAX_AUTH_ATTEMPTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

function makeAdminToken(): string {
  const secret = ADMIN_PASSWORD;
  const day = Math.floor(Date.now() / 86400000);
  return createHmac("sha256", secret + "ct-admin-v1").update(`admin:${day}`).digest("hex");
}

function verifyAdminToken(token: string): boolean {
  const secret = ADMIN_PASSWORD;
  if (!secret || !token || !/^[0-9a-f]{64}$/i.test(token)) return false;
  const day = Math.floor(Date.now() / 86400000);
  for (const d of [day, day - 1]) {
    try {
      const expected = createHmac("sha256", secret + "ct-admin-v1")
        .update(`admin:${d}`)
        .digest("hex");
      if (timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"))) return true;
    } catch {}
  }
  return false;
}

function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"] as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!verifyAdminToken(auth.slice(7))) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  next();
}

const MC_USERNAME_RE = /^[a-zA-Z0-9_]{1,16}$/;
const MOJANG_HEAD_TTL_MS = 60 * 60 * 1000;
const MOJANG_HEAD_FETCH_TIMEOUT_MS = 4000;
const mojangHeadCache = new Map<string, { buffer: Buffer; expires: number }>();

function sendDefaultSkin(res: Response) {
  const headPath = fs.existsSync(DEFAULT_SKIN_HEAD_PATH) ? DEFAULT_SKIN_HEAD_PATH : null;
  const fallbackPath = headPath ?? (fs.existsSync(DEFAULT_SKIN_PATH) ? DEFAULT_SKIN_PATH : null);
  if (fallbackPath) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(fallbackPath);
    return;
  }
  res.status(404).json({ error: "Default skin not found" });
}

async function fetchMojangHead(mcUsername: string): Promise<Buffer | null> {
  const key = mcUsername.toLowerCase();
  const cached = mojangHeadCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.buffer;

  try {
    const url = `https://mc-heads.net/avatar/${encodeURIComponent(mcUsername)}/64`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(MOJANG_HEAD_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length === 0) return null;
    mojangHeadCache.set(key, { buffer, expires: Date.now() + MOJANG_HEAD_TTL_MS });
    return buffer;
  } catch (err) {
    console.warn(`[skin] Mojang head fetch failed for ${mcUsername}:`, (err as Error).message);
    return null;
  }
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

      const skinData = await storage.getSkinData(discordId);
      if (skinData) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        const buffer = Buffer.from(skinData, "base64");
        res.setHeader("Content-Type", "image/png");
        res.send(buffer);
        return;
      }

      const mcUsername = await storage.getPlayerMcUsername(discordId);
      if (mcUsername && MC_USERNAME_RE.test(mcUsername)) {
        const headBuffer = await fetchMojangHead(mcUsername);
        if (headBuffer) {
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("Content-Type", "image/png");
          res.send(headBuffer);
          return;
        }
      }

      sendDefaultSkin(res);
    } catch (err) {
      console.error("[skin]", err);
      sendDefaultSkin(res);
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

  // ── Load theme from DB on startup ────────────────────────────────────────────
  try {
    const rows = await db.execute(sql`SELECT value FROM site_settings WHERE key = 'theme' LIMIT 1`);
    const row = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : null);
    if (row?.value && VALID_THEMES.has(row.value)) {
      cachedTheme = row.value;
    }
  } catch (e) {
    console.warn("[theme] DB init failed:", (e as Error).message);
  }

  // ── Public: get active theme ─────────────────────────────────────────────────
  app.get("/api/theme", (_req, res) => {
    res.json({ theme: cachedTheme });
  });

  // ── Admin: authenticate ──────────────────────────────────────────────────────
  app.post("/api/admin/auth", (req, res) => {
    const ip = String(
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
      req.socket.remoteAddress ?? "unknown"
    ).slice(0, 64);

    const rate = checkRateLimit(ip);
    if (!rate.ok) {
      res.status(429).json({ error: `Too many attempts. Retry in ${rate.retryAfter}s.` });
      return;
    }

    const { password } = (req.body ?? {}) as { password?: unknown };
    let match = false;
    try {
      if (typeof password === "string" && password.length > 0 && password.length <= 256) {
        const padLen = Math.max(password.length, ADMIN_PASSWORD.length, 32);
        const a = Buffer.alloc(padLen);
        const b = Buffer.alloc(padLen);
        Buffer.from(password).copy(a);
        Buffer.from(ADMIN_PASSWORD).copy(b);
        match = timingSafeEqual(a, b);
      }
    } catch {}

    if (!match) {
      res.status(401).json({ error: "Incorrect password." });
      return;
    }

    authAttempts.delete(ip);
    res.json({ token: makeAdminToken(), expiresIn: 172800, currentTheme: cachedTheme });
  });

  // ── Admin: get theme (protected) ─────────────────────────────────────────────
  app.get("/api/admin/theme", adminAuthMiddleware, (_req, res) => {
    res.json({ theme: cachedTheme });
  });

  // ── Admin: set theme (protected) ─────────────────────────────────────────────
  app.post("/api/admin/theme", adminAuthMiddleware, async (req, res) => {
    const { theme } = (req.body ?? {}) as { theme?: unknown };
    if (typeof theme !== "string" || !VALID_THEMES.has(theme)) {
      res.status(400).json({ error: "Invalid theme." });
      return;
    }
    cachedTheme = theme;
    try {
      await db.execute(sql`
        INSERT INTO site_settings (key, value) VALUES ('theme', ${theme})
        ON CONFLICT (key) DO UPDATE SET value = ${theme}
      `);
    } catch (e) {
      console.warn("[theme] Persist to DB failed:", (e as Error).message);
    }
    res.json({ ok: true, theme: cachedTheme });
  });

  return httpServer;
}

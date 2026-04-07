import express from "express";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcryptjs from "bcryptjs";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRODUCTION_DB_PATH = "/app/data/url-shortener.db";
const LOCAL_DB_PATH = path.join(__dirname, "data", "url-shortener.db");
const RESERVED_SLUGS = new Set(["api", "health", "login", "logout"]);

const DEVICE_TYPES = {
  DESKTOP: "desktop",
  MOBILE: "mobile",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
};

function detectDeviceAndBrowser(userAgent = "") {
  const ua = String(userAgent).toLowerCase();
  if (ua.includes("instagram")) return DEVICE_TYPES.INSTAGRAM;
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("facebook")) return DEVICE_TYPES.FACEBOOK;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|phone|windows phone/i;
  return mobileRegex.test(ua) ? DEVICE_TYPES.MOBILE : DEVICE_TYPES.DESKTOP;
}
const SESSION_COOKIE_NAME = "shortly_session";

let SQL = null;
let dbInstance = null;

function normalizeRedirectType(value) {
  return Number(value) === 302 ? 302 : 301;
}

function resolveDatabasePath(customPath) {
  if (customPath) return customPath;
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  return process.env.NODE_ENV === "production" ? PRODUCTION_DB_PATH : LOCAL_DB_PATH;
}

function ensureDatabaseDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeSlug(slug) {
  return String(slug || "").trim().toLowerCase();
}

function validateSlug(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug);
}

function validateTargetUrl(targetUrl) {
  try {
    const parsed = new URL(String(targetUrl || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatLink(row) {
  if (!row) return row;
  return {
    id: row.id,
    slug: row.slug,
    targetUrl: row.target_url,
    redirectType: row.redirect_type,
    clicks: row.clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastClickedAt: row.last_clicked_at || null,
    shortUrl: row.short_url,
  };
}

function persistDatabase(db, dbPath) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function loadExistingDatabase(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

async function initializeDatabase(dbPath) {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  const resolvedPath = resolveDatabasePath(dbPath);
  ensureDatabaseDirectory(resolvedPath);

  const existing = loadExistingDatabase(resolvedPath);
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      target_url TEXT NOT NULL,
      redirect_type INTEGER NOT NULL DEFAULT 301,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_clicked_at TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_links_slug ON links (slug)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES admin_users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS link_cloaker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL UNIQUE,
      desktop_url TEXT,
      mobile_url TEXT,
      instagram_url TEXT,
      facebook_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cloaker_link_id ON link_cloaker (link_id)`);

  persistDatabase(db, resolvedPath);
  return { db, path: resolvedPath };
}

export function createApp(options = {}) {
  const app = express();
  const dbPath = resolveDatabasePath(options.dbPath);
  const defaultRedirectType = normalizeRedirectType(
    options.defaultRedirectType ?? process.env.DEFAULT_REDIRECT_TYPE ?? 301,
  );
  const dashboardPath = options.dashboardPath || path.join(__dirname, "index.html");

  let db = options.db || null;

  // Middleware
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Helper para executar queries
  const executeQuery = (sql, params = []) => {
    if (!db) throw new Error("Database not initialized");
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  };

  const executeOne = (sql, params = []) => {
    const rows = executeQuery(sql, params);
    return rows[0] || null;
  };

  const runQuery = (sql, params = []) => {
    if (!db) throw new Error("Database not initialized");
    db.run(sql, params);
    persistDatabase(db, dbPath);
  };

  // Middleware de autenticação
  const requireAuth = (req, res, next) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: "Não autenticado. Faça login para continuar." });
    }

    try {
      const session = executeOne(
        `SELECT id, user_id FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now') LIMIT 1`,
        [token],
      );

      if (!session) {
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
      }

      req.userId = session.user_id;
      next();
    } catch (error) {
      console.error("[Auth Error]", error);
      res.status(500).json({ error: "Erro ao verificar autenticação." });
    }
  };

  // Rotas públicas
  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      databasePath: dbPath,
      defaultRedirectType,
    });
  });

  // Autenticação
  app.post("/api/auth/login", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ error: "Usuário e senha são obrigatórios." });
    }

    try {
      const admin = executeOne(`SELECT id, username, password_hash FROM admin_users WHERE username = ?`, [username]);

      if (!admin) {
        return res.status(401).json({ error: "Credenciais inválidas." });
      }

      const isValid = bcryptjs.compareSync(password, admin.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: "Credenciais inválidas." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      runQuery(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [admin.id, token, expiresAt]);

      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, message: "Login realizado com sucesso." });
    } catch (error) {
      console.error("[Login Error]", error);
      res.status(500).json({ error: "Erro ao fazer login." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) {
      try {
        runQuery(`DELETE FROM sessions WHERE token = ?`, [token]);
      } catch (error) {
        console.error("[Logout Error]", error);
      }
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ success: true, message: "Logout realizado com sucesso." });
  });

  app.get("/api/auth/status", (req, res) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    let authenticated = false;

    if (token) {
      try {
        const session = executeOne(
          `SELECT id FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now') LIMIT 1`,
          [token],
        );
        authenticated = !!session;
      } catch (error) {
        console.error("[Auth Status Error]", error);
      }
    }

    res.json({ authenticated });
  });

  // Rotas protegidas de gerenciamento
  app.get("/api/links", requireAuth, (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const rows = executeQuery(
        `SELECT id, slug, target_url, redirect_type, clicks, created_at, updated_at, last_clicked_at FROM links ORDER BY created_at DESC, id DESC`,
      );

      const links = rows.map((row) => formatLink({ ...row, short_url: `${baseUrl}/${row.slug}` }));
      res.json({ links });
    } catch (error) {
      console.error("[List Links Error]", error);
      res.status(500).json({ error: "Não foi possível carregar os links." });
    }
  });

  app.post("/api/links", requireAuth, (req, res) => {
    const slug = normalizeSlug(req.body.slug);
    const targetUrl = String(req.body.targetUrl || "").trim();
    const redirectType = normalizeRedirectType(req.body.redirectType ?? defaultRedirectType);

    if (!validateSlug(slug) || RESERVED_SLUGS.has(slug)) {
      return res.status(400).json({
        error: "Slug inválido. Use letras minúsculas, números e hífens, com 3 a 63 caracteres.",
      });
    }

    if (!validateTargetUrl(targetUrl)) {
      return res.status(400).json({ error: "Informe uma URL válida iniciando com http:// ou https://." });
    }

    try {
      runQuery(
        `INSERT INTO links (slug, target_url, redirect_type, clicks, created_at, updated_at) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [slug, targetUrl, redirectType],
      );

      const created = executeOne(
        `SELECT id, slug, target_url, redirect_type, clicks, created_at, updated_at, last_clicked_at FROM links WHERE slug = ?`,
        [slug],
      );

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      return res.status(201).json({ link: formatLink({ ...created, short_url: `${baseUrl}/${created.slug}` }) });
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Este slug já está em uso. Escolha outro identificador." });
      }
      console.error("[Create Link]", error);
      return res.status(500).json({ error: "Não foi possível criar o link." });
    }
  });

  app.put("/api/links/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const targetUrl = String(req.body.targetUrl || "").trim();
    const redirectType = normalizeRedirectType(req.body.redirectType ?? defaultRedirectType);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }

    if (!validateTargetUrl(targetUrl)) {
      return res.status(400).json({ error: "Informe uma URL válida iniciando com http:// ou https://." });
    }

    try {
      const existing = executeOne(`SELECT id FROM links WHERE id = ?`, [id]);
      if (!existing) {
        return res.status(404).json({ error: "Link não encontrado." });
      }

      runQuery(
        `UPDATE links SET target_url = ?, redirect_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [targetUrl, redirectType, id],
      );

      const updated = executeOne(
        `SELECT id, slug, target_url, redirect_type, clicks, created_at, updated_at, last_clicked_at FROM links WHERE id = ?`,
        [id],
      );

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      return res.json({ link: formatLink({ ...updated, short_url: `${baseUrl}/${updated.slug}` }) });
    } catch (error) {
      console.error("[Update Link]", error);
      return res.status(500).json({ error: "Não foi possível atualizar o link." });
    }
  });

  app.delete("/api/links/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }

    try {
      const existing = executeOne(`SELECT id FROM links WHERE id = ?`, [id]);
      if (!existing) {
        return res.status(404).json({ error: "Link não encontrado." });
      }

      runQuery(`DELETE FROM links WHERE id = ?`, [id]);
      return res.status(204).send();
    } catch (error) {
      console.error("[Delete Link]", error);
      return res.status(500).json({ error: "Não foi possível excluir o link." });
    }
  });

  // Exportação de relatório em CSV
  app.get("/api/links/export/csv", requireAuth, (req, res) => {
    try {
      const rows = executeQuery(`SELECT slug, target_url, redirect_type, clicks, created_at, updated_at FROM links ORDER BY created_at DESC`);

      let csv = "Slug,URL de Destino,Tipo de Redirect,Cliques,Criado em,Atualizado em\n";

      rows.forEach((row) => {
        const slug = `"${String(row.slug).replace(/"/g, '""')}"`;
        const url = `"${String(row.target_url).replace(/"/g, '""')}"`;
        const type = row.redirect_type;
        const clicks = row.clicks;
        const created = `"${row.created_at}"`;
        const updated = `"${row.updated_at}"`;
        csv += `${slug},${url},${type},${clicks},${created},${updated}\n`;
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="links-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("[Export CSV Error]", error);
      res.status(500).json({ error: "Erro ao exportar relatório." });
    }
  });

  // Rota pública de redirecionamento
  app.get("/:slug", (req, res, next) => {
    const slug = normalizeSlug(req.params.slug);

    if (!slug || RESERVED_SLUGS.has(slug)) {
      return next();
    }

    try {
      const link = executeOne(`SELECT id, slug, target_url, redirect_type FROM links WHERE slug = ? LIMIT 1`, [slug]);

      if (!link) {
        return res.status(404).send("Link não encontrado.");
      }

      let targetUrl = link.target_url;
      const cloaker = executeOne(`SELECT desktop_url, mobile_url, instagram_url, facebook_url FROM link_cloaker WHERE link_id = ? LIMIT 1`, [link.id]);

      if (cloaker) {
        const userAgent = req.get("User-Agent") || "";
        const deviceType = detectDeviceAndBrowser(userAgent);

        if (deviceType === DEVICE_TYPES.INSTAGRAM && cloaker.instagram_url) {
          targetUrl = cloaker.instagram_url;
        } else if (deviceType === DEVICE_TYPES.FACEBOOK && cloaker.facebook_url) {
          targetUrl = cloaker.facebook_url;
        } else if (deviceType === DEVICE_TYPES.MOBILE && cloaker.mobile_url) {
          targetUrl = cloaker.mobile_url;
        } else if (deviceType === DEVICE_TYPES.DESKTOP && cloaker.desktop_url) {
          targetUrl = cloaker.desktop_url;
        }
      }

      runQuery(`UPDATE links SET clicks = clicks + 1, last_clicked_at = CURRENT_TIMESTAMP WHERE id = ?`, [link.id]);

      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      return res.redirect(link.redirect_type, targetUrl);
    } catch (error) {
      console.error("[Redirect Error]", error);
      return res.status(500).send("Erro ao processar redirecionamento.");
    }
  });

  // Rotas de gerenciamento de cloaker
  app.get("/api/links/:id/cloaker", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }
    try {
      const cloaker = executeOne(`SELECT desktop_url, mobile_url, instagram_url, facebook_url FROM link_cloaker WHERE link_id = ? LIMIT 1`, [id]);
      res.json({ cloaker: cloaker || null });
    } catch (error) {
      console.error("[Get Cloaker Error]", error);
      res.status(500).json({ error: "Erro ao carregar configuração de cloaker." });
    }
  });

  app.put("/api/links/:id/cloaker", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const { desktopUrl, mobileUrl, instagramUrl, facebookUrl } = req.body;
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }
    try {
      if (!desktopUrl && !mobileUrl && !instagramUrl && !facebookUrl) {
        return res.status(400).json({ error: "Forneça pelo menos uma URL para o cloaker." });
      }
      const urlsToValidate = [desktopUrl, mobileUrl, instagramUrl, facebookUrl].filter(Boolean);
      for (const url of urlsToValidate) {
        if (!validateTargetUrl(url)) {
          return res.status(400).json({ error: "Uma ou mais URLs são inválidas." });
        }
      }
      const existing = executeOne(`SELECT id FROM link_cloaker WHERE link_id = ? LIMIT 1`, [id]);
      if (existing) {
        runQuery(
          `UPDATE link_cloaker SET desktop_url = ?, mobile_url = ?, instagram_url = ?, facebook_url = ?, updated_at = CURRENT_TIMESTAMP WHERE link_id = ?`,
          [desktopUrl || null, mobileUrl || null, instagramUrl || null, facebookUrl || null, id],
        );
      } else {
        runQuery(
          `INSERT INTO link_cloaker (link_id, desktop_url, mobile_url, instagram_url, facebook_url) VALUES (?, ?, ?, ?, ?)`,
          [id, desktopUrl || null, mobileUrl || null, instagramUrl || null, facebookUrl || null],
        );
      }
      res.json({ success: true, message: "Cloaker atualizado com sucesso." });
    } catch (error) {
      console.error("[Update Cloaker Error]", error);
      res.status(500).json({ error: "Erro ao atualizar cloaker." });
    }
  });

  app.delete("/api/links/:id/cloaker", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }
    try {
      runQuery(`DELETE FROM link_cloaker WHERE link_id = ?`, [id]);
      res.json({ success: true, message: "Cloaker removido com sucesso." });
    } catch (error) {
      console.error("[Delete Cloaker Error]", error);
      res.status(500).json({ error: "Erro ao remover cloaker." });
    }
  });

  // Servir dashboard
  app.get("/", (_req, res) => {
    res.sendFile(dashboardPath);
  });

  app.use((error, _req, res, _next) => {
    console.error("[Unexpected Error]", error);
    res.status(500).json({ error: "Ocorreu um erro inesperado no servidor." });
  });

  return {
    app,
    db,
    setDb: (newDb) => {
      db = newDb;
    },
    close: () => {
      if (db) {
        persistDatabase(db, dbPath);
        db.close();
      }
    },
  };
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";

  initializeDatabase().then(({ db: database }) => {
    dbInstance = database;
    const { app, setDb } = createApp();
    setDb(database);

    app.listen(port, host, () => {
      console.log(`URL Shortener running at http://${host}:${port}`);
    });

    process.on("SIGTERM", () => {
      console.log("SIGTERM received, closing database...");
      if (dbInstance) {
        persistDatabase(dbInstance, resolveDatabasePath());
        dbInstance.close();
      }
      process.exit(0);
    });
  });
}

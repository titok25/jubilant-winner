import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcryptjs from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, "data", "url-shortener.db");

const dbPath = process.env.SQLITE_PATH || LOCAL_DB_PATH;

async function initAdmin() {
  try {
    const SQL = await initSqlJs();

    // Criar diretório se não existir
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    // Carregar banco existente ou criar novo
    let db;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
      // Criar tabelas
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Verificar se já existe admin
    const stmt = db.prepare("SELECT COUNT(*) as count FROM admin_users");
    stmt.bind([]);
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();

    if (result.count > 0) {
      console.log("✓ Usuário admin já existe no banco de dados.");
      db.close();
      process.exit(0);
    }

    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const passwordHash = bcryptjs.hashSync(password, 10);

    db.run(`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`, [username, passwordHash]);

    // Persistir banco
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    console.log(`✓ Usuário admin criado com sucesso!`);
    console.log(`  Usuário: ${username}`);
    console.log(`  Senha: ${password}`);
    console.log(`\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!`);

    db.close();
  } catch (error) {
    console.error("✗ Erro ao criar usuário admin:", error.message);
    process.exit(1);
  }
}

initAdmin();

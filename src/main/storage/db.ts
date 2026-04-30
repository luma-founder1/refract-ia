import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'refract.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    repo TEXT,
    branch TEXT DEFAULT 'main',
    status TEXT DEFAULT 'Not analysed',
    created_at TEXT DEFAULT (datetime('now')),
    last_run TEXT
  );

  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

// Simple schema migration for existing databases
try {
  db.exec("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'Not analysed'");
} catch (e) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN last_run TEXT");
} catch (e) {}

export default db;

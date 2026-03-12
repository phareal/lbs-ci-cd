const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const isTestEnv = process.env.NODE_ENV === 'test';

const dbPath = isTestEnv ? ':memory:' : path.join(__dirname, '..', 'data', 'users.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    // Erreur critique au démarrage, on log et on sort
    // eslint-disable-next-line no-console
    console.error('Impossible de se connecter à SQLite:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
});

module.exports = db;


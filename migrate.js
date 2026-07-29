'use strict';
const pool = require('./db');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate] No DATABASE_URL — skipping migration');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Session table (connect-pg-simple) ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid    VARCHAR      NOT NULL COLLATE "default",
        sess   JSON         NOT NULL,
        expire TIMESTAMPTZ  NOT NULL,
        CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire)
    `);

    // ── Users ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT        PRIMARY KEY,
        name          TEXT        NOT NULL,
        email         TEXT        NOT NULL UNIQUE,
        password_hash TEXT        NOT NULL,
        role          TEXT        NOT NULL DEFAULT 'user',
        avatar        TEXT,
        watchlist     JSONB       NOT NULL DEFAULT '[]',
        secret_code   TEXT,
        first_login   BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Catalog ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog (
        id          TEXT        PRIMARY KEY,
        title       TEXT        NOT NULL,
        genre       TEXT        NOT NULL,
        type        TEXT        NOT NULL,
        duration    TEXT,
        year        INT,
        audio       TEXT        NOT NULL,
        quality     TEXT,
        description TEXT,
        trailer_url TEXT,
        poster_url  TEXT,
        video_url   TEXT,
        actors      JSONB       NOT NULL DEFAULT '[]',
        rows        JSONB       NOT NULL DEFAULT '[]',
        seasons     JSONB       NOT NULL DEFAULT '[]',
        added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Migration: add seasons column if it doesn't exist yet
    await client.query(`
      ALTER TABLE catalog ADD COLUMN IF NOT EXISTS seasons JSONB NOT NULL DEFAULT '[]'
    `);

    // ── Ratings ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        item_id TEXT    NOT NULL,
        user_id TEXT    NOT NULL,
        rating  NUMERIC NOT NULL,
        PRIMARY KEY (item_id, user_id)
      )
    `);

    // ── Suggestions ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id                TEXT        PRIMARY KEY,
        user_id           TEXT        NOT NULL,
        user_name         TEXT        NOT NULL,
        title             TEXT        NOT NULL,
        type              TEXT,
        preferred_version TEXT        NOT NULL,
        note              TEXT,
        status            TEXT        NOT NULL DEFAULT 'pending',
        admin_note        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✔ Migration complete — all tables ready');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✘ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;

// Run directly: node migrate.js
if (require.main === module) {
  migrate().then(() => pool.end()).catch(() => { pool.end(); process.exit(1); });
}

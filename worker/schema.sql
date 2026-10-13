CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  edit_hash TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar','en','cop','egy')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
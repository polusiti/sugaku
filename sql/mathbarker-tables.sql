CREATE TABLE IF NOT EXISTS mathbarker_users (
  uuid TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mathbarker_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uuid TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT,
  is_correct INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mb_records_user ON mathbarker_records(user_uuid);
CREATE INDEX IF NOT EXISTS idx_mb_records_qid ON mathbarker_records(question_id);

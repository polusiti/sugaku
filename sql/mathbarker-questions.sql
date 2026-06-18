CREATE TABLE IF NOT EXISTS mathbarker_questions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT 'math',
  level TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  q TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  answer INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mbq_level ON mathbarker_questions(level);

-- Seed: 3 Basic questions
INSERT OR IGNORE INTO mathbarker_questions (id, level, category, q, explanation, answer) VALUES
  ('basic-algebra-001', 'basic', 'algebra',
   '2次方程式 $x^2 - 7x + 12 = 0$ の解をすべて求めよ。解の和を計算せよ。',
   '$x^2-7x+12=(x-3)(x-4)=0$ より $x=3,4$。和は $3+4=7$。', 7),
  ('basic-calculus-001', 'basic', 'calculus',
   '定積分 $\displaystyle\int_0^1 3x^2\,dx$ の値を求めよ。',
   '$\int 3x^2 dx = x^3$ より $[x^3]_0^1 = 1^3 - 0^3 = 1$。', 1),
  ('basic-log-001', 'basic', 'logarithm',
   '$\log_2 32 + \log_3 9$ の値を求めよ。',
   '$\log_2 32 = 5$、$\log_3 9 = 2$ より $5+2=7$。', 7);

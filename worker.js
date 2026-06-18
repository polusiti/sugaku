export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ── API ── */
    if (url.pathname === '/api/identity' && request.method === 'POST') {
      return handleIdentity(request, env);
    }
    if (url.pathname === '/api/record' && request.method === 'POST') {
      return handleRecord(request, env);
    }
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return handleStats(request, env);
    }

    /* ── assets ── */
    return env.ASSETS.fetch(request);
  }
};

/* ─────────────────────────────────────
   POST /api/identity
   body: { uuid, handle }
   → upsert user
───────────────────────────────────── */
async function handleIdentity(request, env) {
  const h = corsHeaders();
  try {
    const { uuid, handle } = await request.json();
    if (!uuid || !handle) return json({ error: 'uuid and handle required' }, 400);
    if (handle.length > 40) return json({ error: 'handle too long' }, 400);

    const existing = await env.MATHBARKER_DB
      .prepare('SELECT uuid FROM mathbarker_users WHERE uuid = ?')
      .bind(uuid).first();

    if (existing) {
      await env.MATHBARKER_DB
        .prepare('UPDATE mathbarker_users SET handle = ?, updated_at = datetime("now") WHERE uuid = ?')
        .bind(handle, uuid).run();
    } else {
      await env.MATHBARKER_DB
        .prepare('INSERT INTO mathbarker_users (uuid, handle) VALUES (?, ?)')
        .bind(uuid, handle).run();
    }

    return json({ ok: true, uuid, handle }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

/* ─────────────────────────────────────
   POST /api/record
   body: { uuid, handle, question_id, answer, is_correct, time_ms }
───────────────────────────────────── */
async function handleRecord(request, env) {
  const h = corsHeaders();
  try {
    const { uuid, handle, question_id, answer, is_correct, time_ms } = await request.json();
    if (!uuid || !question_id) return json({ error: 'uuid and question_id required' }, 400);

    // ensure user exists (lazy registration)
    const user = await env.MATHBARKER_DB
      .prepare('SELECT uuid FROM mathbarker_users WHERE uuid = ?')
      .bind(uuid).first();
    if (!user) {
      await env.MATHBARKER_DB
        .prepare('INSERT INTO mathbarker_users (uuid, handle) VALUES (?, ?)')
        .bind(uuid, handle || 'anon').run();
    }

    await env.MATHBARKER_DB
      .prepare('INSERT INTO mathbarker_records (user_uuid, question_id, answer, is_correct, time_ms) VALUES (?, ?, ?, ?, ?)')
      .bind(uuid, question_id, answer || null, is_correct ? 1 : 0, time_ms || null).run();

    return json({ ok: true }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

/* ─────────────────────────────────────
   GET /api/stats?uuid=xxx
   → { total, correct, avg_time_ms }
───────────────────────────────────── */
async function handleStats(request, env) {
  const h = corsHeaders();
  try {
    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid');
    if (!uuid) return json({ error: 'uuid required' }, 400);

    const [total, correct, time] = await Promise.all([
      env.MATHBARKER_DB.prepare('SELECT COUNT(*) as c FROM mathbarker_records WHERE user_uuid = ?').bind(uuid).first(),
      env.MATHBARKER_DB.prepare('SELECT COUNT(*) as c FROM mathbarker_records WHERE user_uuid = ? AND is_correct = 1').bind(uuid).first(),
      env.MATHBARKER_DB.prepare('SELECT AVG(time_ms) as avg FROM mathbarker_records WHERE user_uuid = ? AND time_ms IS NOT NULL').bind(uuid).first(),
    ]);

    return json({
      total: total.c,
      correct: correct.c,
      avg_time_ms: Math.round(time.avg || 0),
    }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

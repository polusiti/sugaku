export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* ── question API ── */
    if (url.pathname === '/api/questions' && request.method === 'GET') {
      return handleListQuestions(request, env);
    }
    if (url.pathname === '/api/questions' && request.method === 'POST') {
      return handleCreateQuestion(request, env);
    }
    if (url.pathname.startsWith('/api/questions/') && request.method === 'PUT') {
      return handleUpdateQuestion(request, env, url.pathname);
    }
    if (url.pathname.startsWith('/api/questions/') && request.method === 'DELETE') {
      return handleDeleteQuestion(request, env, url.pathname);
    }

    /* ── record / stats ── */
    if (url.pathname === '/api/identity' && request.method === 'POST') {
      return handleIdentity(request, env);
    }
    if (url.pathname === '/api/record' && request.method === 'POST') {
      return handleRecord(request, env);
    }
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return handleStats(request, env);
    }
    if (url.pathname === '/api/review' && request.method === 'GET') {
      return handleReview(request, env);
    }
    if (url.pathname === '/api/accuracy' && request.method === 'GET') {
      return handleAccuracy(request, env);
    }

    /* ── admin auth ── */
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }

    /* ── problems CRUD ── */
    if (url.pathname === '/api/problems' && request.method === 'GET') {
      return handleListProblems(request, env);
    }
    if (url.pathname === '/api/problems' && request.method === 'POST') {
      return handleCreateProblem(request, env);
    }
    {
      const m = url.pathname.match(/^\/api\/problems\/([^/]+)$/);
      if (m) {
        if (request.method === 'PUT')    return handleUpdateProblem(request, env, m[1]);
        if (request.method === 'DELETE') return handleDeleteProblem(request, env, m[1]);
      }
    }

    /* ── sets CRUD ── */
    if (url.pathname === '/api/sets' && request.method === 'GET') {
      return handleListSets(request, env);
    }
    if (url.pathname === '/api/sets' && request.method === 'POST') {
      return handleCreateSet(request, env);
    }
    {
      const m = url.pathname.match(/^\/api\/sets\/([^/]+)$/);
      if (m) {
        if (request.method === 'GET')    return handleGetSet(request, env, m[1]);
        if (request.method === 'PUT')    return handleUpdateSet(request, env, m[1]);
        if (request.method === 'DELETE') return handleDeleteSet(request, env, m[1]);
      }
    }

    /* ── page routing ── */
    const p = url.pathname.toLowerCase();
    if (p.startsWith('/level/')) {
      return env.ASSETS.fetch(new URL('/level.html', request.url).toString());
    }
    if (p === '/random') {
      return env.ASSETS.fetch(new URL('/random.html', request.url).toString());
    }
    if (p === '/review') {
      return env.ASSETS.fetch(new URL('/review.html', request.url).toString());
    }
    if (p === '/admin') {
      return env.ASSETS.fetch(new URL('/admin.html', request.url).toString());
    }
    if (p === '/jikken' || p.startsWith('/jikken/')) {
      return env.ASSETS.fetch(new URL('/jikken.html', request.url).toString());
    }

    /* ── assets ── */
    return env.ASSETS.fetch(request);
  }
};

/* ═══════════════════════════════════════════
   Question CRUD
   ═══════════════════════════════════════════ */

async function handleListQuestions(request, env) {
  const h = corsHeaders();
  const url = new URL(request.url);
  const level = url.searchParams.get('level') || '';
  const subject = url.searchParams.get('subject') || '';
  const admin = url.searchParams.get('admin');

  const conditions = [];
  const binds = [];

  if (level) { conditions.push('level = ?'); binds.push(level); }
  if (subject) { conditions.push('subject_group = ?'); binds.push(subject); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const cols = admin === '1' ? '*' : 'id, q, explanation, answer';

  const stmt = `SELECT ${cols} FROM mathbarker_questions ${where} ORDER BY subject_group, category, id`;
  const result = await env.MATHBARKER_DB.prepare(stmt).bind(...binds).all();
  return json(result.results, 200, h);
}

async function handleCreateQuestion(request, env) {
  const h = corsHeaders();
  try {
    const body = await request.json();
    const { id, level, subject_group, category, q, explanation, answer } = body;
    if (!id || !level || !q || answer === undefined) {
      return json({ error: 'id, level, q, answer required' }, 400);
    }

    await env.MATHBARKER_DB.prepare(
      'INSERT OR REPLACE INTO mathbarker_questions (id, level, subject_group, category, q, explanation, answer, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))'
    ).bind(id, level, subject_group || '1a', category || '', q, explanation || '', answer).run();

    return json({ ok: true, id }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleUpdateQuestion(request, env, path) {
  const h = corsHeaders();
  const id = path.replace('/api/questions/', '');
  try {
    const body = await request.json();
    const existing = await env.MATHBARKER_DB.prepare(
      'SELECT id FROM mathbarker_questions WHERE id = ?'
    ).bind(id).first();
    if (!existing) return json({ error: 'not found' }, 404);

    const sets = [], vals = [];
    for (const k of ['level','subject_group','category','q','explanation','answer']) {
      if (body[k] !== undefined) { sets.push(k+'=?'); vals.push(body[k]); }
    }
    if (!sets.length) return json({ error: 'no fields' }, 400);
    vals.push(id);

    await env.MATHBARKER_DB.prepare(
      `UPDATE mathbarker_questions SET ${sets.join(',')}, updated_at=datetime('now') WHERE id = ?`
    ).bind(...vals).run();

    return json({ ok: true, id }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleDeleteQuestion(request, env, path) {
  const h = corsHeaders();
  const id = path.replace('/api/questions/', '');
  await env.MATHBARKER_DB.prepare(
    'DELETE FROM mathbarker_questions WHERE id = ?'
  ).bind(id).run();
  return json({ ok: true, id }, 200, h);
}

/* ═══════════════════════════════════════════
   Identity / Record / Stats
   ═══════════════════════════════════════════ */

async function handleIdentity(request, env) {
  const h = corsHeaders();
  try {
    const { uuid, handle } = await request.json();
    if (!uuid || !handle) return json({ error: 'uuid and handle required' }, 400);
    if (handle.length > 40) return json({ error: 'handle too long' }, 400);

    const existing = await env.MATHBARKER_DB
      .prepare('SELECT uuid FROM mathbarker_users WHERE uuid = ?').bind(uuid).first();

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

async function handleRecord(request, env) {
  const h = corsHeaders();
  try {
    const { uuid, handle, question_id, answer, is_correct, time_ms } = await request.json();
    if (!uuid || !question_id) return json({ error: 'uuid and question_id required' }, 400);

    const user = await env.MATHBARKER_DB
      .prepare('SELECT uuid FROM mathbarker_users WHERE uuid = ?').bind(uuid).first();
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
      total: total.c, correct: correct.c,
      avg_time_ms: Math.round(time.avg || 0),
    }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleAccuracy(request, env) {
  const h = corsHeaders();
  try {
    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid');
    if (!uuid) return json({ error: 'uuid required' }, 400);

    const { results } = await env.MATHBARKER_DB.prepare(
      `SELECT level, subject_group,
              COUNT(*) as total,
              SUM(is_correct) as correct
       FROM mathbarker_records r
       JOIN mathbarker_questions q ON r.question_id = q.id
       WHERE r.user_uuid = ?
       GROUP BY level, subject_group`
    ).bind(uuid).all();

    const { c } = await env.MATHBARKER_DB.prepare(
      `SELECT COUNT(DISTINCT question_id) as c FROM mathbarker_records
       WHERE user_uuid = ? AND is_correct = 0`
    ).bind(uuid).first();

    return json({ groups: results, reviewCount: c }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleReview(request, env) {
  const h = corsHeaders();
  try {
    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid');
    if (!uuid) return json({ error: 'uuid required' }, 400);

    const { results } = await env.MATHBARKER_DB.prepare(
      `SELECT DISTINCT question_id FROM mathbarker_records
       WHERE user_uuid = ? AND is_correct = 0
       ORDER BY created_at DESC
       LIMIT 20`
    ).bind(uuid).all();

    const ids = results.map(r => r.question_id);
    if (!ids.length) return json([], 200, h);

    // load those questions
    const placeholders = ids.map(() => '?').join(',');
    const { results: questions } = await env.MATHBARKER_DB.prepare(
      `SELECT id, q, explanation, answer FROM mathbarker_questions WHERE id IN (${placeholders})`
    ).bind(...ids).all();

    // preserve wrong-answer order
    const ordered = ids.map(id => questions.find(q => q.id === id)).filter(Boolean);
    return json(ordered, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

/* ═══════════════════════════════════════════
   Admin
   ═══════════════════════════════════════════ */

async function handleAdminLogin(request, env) {
  try {
    const { password } = await request.json();
    if (password === env.ADMIN_TOKEN) {
      return json({ token: env.ADMIN_TOKEN });
    }
    return json({ error: 'Incorrect' }, 401);
  } catch (e) {
    return json({ error: e.message }, 400);
  }
}

/* ═══════════════════════════════════════════
   Problems
   ═══════════════════════════════════════════ */

async function handleListProblems(request, env) {
  const h = corsHeaders();
  const url = new URL(request.url);
  const subject = url.searchParams.get('subject') || '';
  const mode    = url.searchParams.get('mode') || '';
  const status  = url.searchParams.get('status') || '';
  const topic   = url.searchParams.get('topic') || '';

  const conds = [], binds = [];
  if (subject) { conds.push('subject=?'); binds.push(subject); }
  if (mode)    { conds.push('mode=?');    binds.push(mode); }
  if (status)  { conds.push('status=?');  binds.push(status); }
  if (topic)   { conds.push('topic LIKE ?'); binds.push('%' + topic + '%'); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const { results } = await env.MATHBARKER_DB.prepare(
    `SELECT id, subject, mode, topic, status, type, q, ans as answer, explanation, created_at FROM problems ${where} ORDER BY created_at DESC, id`
  ).bind(...binds).all();
  return json(results, 200, h);
}

async function handleCreateProblem(request, env) {
  const h = corsHeaders();
  try {
    const { id, subject, mode, topic, status, type, q, ans, explanation } = await request.json();
    if (!id || !q || ans === undefined) return json({ error: 'id, q, ans required' }, 400, h);
    await env.MATHBARKER_DB.prepare(
      'INSERT INTO problems (id,subject,mode,topic,status,type,q,ans,explanation,created_at) VALUES (?,?,?,?,?,?,?,?,?,date(\'now\'))'
    ).bind(id, subject||'1A', mode||'standard', topic||'', status||'draft', type||'calc', q, ans, explanation||'').run();
    return json({ ok: true, id }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleUpdateProblem(request, env, id) {
  const h = corsHeaders();
  try {
    const body = await request.json();
    const sets = [], vals = [];
    for (const k of ['subject','mode','topic','status','type','q','ans','explanation']) {
      if (body[k] !== undefined) { sets.push(k+'=?'); vals.push(body[k]); }
    }
    if (!sets.length) return json({ error: 'no fields' }, 400, h);
    vals.push(id);
    await env.MATHBARKER_DB.prepare(`UPDATE problems SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleDeleteProblem(request, env, id) {
  const h = corsHeaders();
  await env.MATHBARKER_DB.prepare('DELETE FROM problems WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, h);
}

/* ═══════════════════════════════════════════
   Sets
   ═══════════════════════════════════════════ */

async function handleListSets(request, env) {
  const h = corsHeaders();
  const url = new URL(request.url);
  const subject = url.searchParams.get('subject') || '';
  const mode    = url.searchParams.get('mode') || '';

  const conds = [], binds = [];
  if (subject) { conds.push('subject=?'); binds.push(subject); }
  if (mode)    { conds.push('mode=?');    binds.push(mode); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const { results } = await env.MATHBARKER_DB.prepare(
    `SELECT * FROM sets ${where} ORDER BY subject, mode, id`
  ).bind(...binds).all();
  return json(results, 200, h);
}

async function handleGetSet(request, env, id) {
  const h = corsHeaders();
  const set = await env.MATHBARKER_DB.prepare('SELECT * FROM sets WHERE id=?').bind(id).first();
  if (!set) return json({ error: 'not found' }, 404, h);

  const ids = JSON.parse(set.problem_ids || '[]');
  let questions = [];
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const { results } = await env.MATHBARKER_DB.prepare(
      `SELECT id, subject, mode, topic, status, type, q, ans as answer, explanation FROM problems WHERE id IN (${ph})`
    ).bind(...ids).all();
    questions = ids.map(pid => results.find(p => p.id === pid)).filter(Boolean);
  }
  return json({ ...set, questions }, 200, h);
}

async function handleCreateSet(request, env) {
  const h = corsHeaders();
  try {
    const { id, subject, mode, title, context, problem_ids } = await request.json();
    if (!id) return json({ error: 'id required' }, 400, h);
    const pids = JSON.stringify(Array.isArray(problem_ids) ? problem_ids : []);
    await env.MATHBARKER_DB.prepare(
      'INSERT INTO sets (id,subject,mode,title,context,problem_ids) VALUES (?,?,?,?,?,?)'
    ).bind(id, subject||'1A', mode||'standard', title||'', context||'', pids).run();
    return json({ ok: true, id }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleUpdateSet(request, env, id) {
  const h = corsHeaders();
  try {
    const body = await request.json();
    const sets = [], vals = [];
    for (const k of ['subject','mode','title','context']) {
      if (body[k] !== undefined) { sets.push(k+'=?'); vals.push(body[k]); }
    }
    if (body.problem_ids !== undefined) {
      sets.push('problem_ids=?');
      vals.push(JSON.stringify(Array.isArray(body.problem_ids) ? body.problem_ids : []));
    }
    if (!sets.length) return json({ error: 'no fields' }, 400, h);
    vals.push(id);
    await env.MATHBARKER_DB.prepare(`UPDATE sets SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
    return json({ ok: true }, 200, h);
  } catch (e) {
    return json({ error: e.message }, 500, h);
  }
}

async function handleDeleteSet(request, env, id) {
  const h = corsHeaders();
  await env.MATHBARKER_DB.prepare('DELETE FROM sets WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, h);
}

/* ═══════════════════════════════════════════ */

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

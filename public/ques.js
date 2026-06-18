/* mathbarker — question engine */
async function loadQuestions(level) {
  try {
    const r = await fetch('/api/questions?level=' + level);
    if (r.ok) return await r.json();
  } catch (_) {}
  return [];
}

function getId() {
  try {
    return JSON.parse(localStorage.getItem('mathbarker_id'));
  } catch (_) { return null; }
}

async function recordAnswer(q, userAnswer, isCorrect, timeMs) {
  const id = getId();
  if (!id) return;
  try {
    await fetch('/api/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuid: id.uuid,
        handle: id.handle || '',
        question_id: q.id,
        answer: String(userAnswer),
        is_correct: isCorrect,
        time_ms: timeMs,
      }),
    });
  } catch (_) {}
}

async function fetchStats() {
  const id = getId();
  if (!id) return null;
  try {
    const r = await fetch('/api/stats?uuid=' + id.uuid);
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}

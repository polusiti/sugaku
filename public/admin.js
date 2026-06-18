/* mathbarker — admin */
const API = '/api/questions';

function token() {
  return sessionStorage.getItem('mb_admin_token') || '';
}

async function login() {
  const pw = document.getElementById('adminPw').value;
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const d = await r.json();
    if (d.token) {
      sessionStorage.setItem('mb_admin_token', d.token);
      showAdmin();
    }
  } catch (_) {}
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token()) headers['Authorization'] = 'Bearer ' + token();
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  return r.ok ? r.json() : null;
}

async function loadAll() {
  const qs = await api('GET', API + '?admin=1');
  if (!qs) return;
  const tbody = document.getElementById('qTable');
  tbody.innerHTML = qs.map(q => `
    <tr class="q-row" data-id="${q.id}">
      <td class="q-td-id">${q.id}</td>
      <td class="q-td-lv">${q.level}</td>
      <td class="q-td-cat">${q.category||''}</td>
      <td class="q-td-q">${esc(q.q.substring(0,60))}${q.q.length>60?'…':''}</td>
      <td class="q-td-ans">${q.answer}</td>
      <td class="q-td-act">
        <button class="act-btn edit" onclick="startEdit('${q.id}')">edit</button>
        <button class="act-btn del" onclick="deleteQ('${q.id}')">del</button>
      </td>
    </tr>
  `).join('');
}

async function saveQ() {
  const id = document.getElementById('qId').value.trim();
  const level = document.getElementById('qLevel').value;
  const category = document.getElementById('qCat').value.trim();
  const q = document.getElementById('qText').value.trim();
  const explanation = document.getElementById('qExp').value.trim();
  const answer = parseInt(document.getElementById('qAns').value, 10);

  if (!id || !level || !q || isNaN(answer)) {
    alert('Fill all required fields: id, level, question, answer');
    return;
  }

  const body = { id, level, category, q, explanation, answer };
  const editId = document.getElementById('editor').dataset.editId;

  if (editId) {
    await api('PUT', API + '/' + editId, body);
  } else {
    await api('POST', API, body);
  }

  closeEditor();
  loadAll();
}

async function deleteQ(id) {
  if (!confirm('Delete ' + id + '?')) return;
  await api('DELETE', API + '/' + id);
  loadAll();
}

function startEdit(id) {
  // find row data
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  const cells = row.querySelectorAll('td');
  document.getElementById('qId').value = cells[0].textContent;
  document.getElementById('qLevel').value = cells[1].textContent;
  document.getElementById('qCat').value = cells[2].textContent;
  // need full q + exp from API
  api('GET', API + '?admin=1').then(qs => {
    const q = qs.find(x => x.id === id);
    if (q) {
      document.getElementById('qText').value = q.q;
      document.getElementById('qExp').value = q.explanation || '';
      document.getElementById('qAns').value = q.answer;
    }
  });
  document.getElementById('editor').dataset.editId = id;
  document.getElementById('editorTitle').textContent = 'Edit Question';
  document.getElementById('editor').style.display = 'block';
}

function newQ() {
  document.getElementById('qId').value = '';
  document.getElementById('qLevel').value = 'basic';
  document.getElementById('qCat').value = '';
  document.getElementById('qText').value = '';
  document.getElementById('qExp').value = '';
  document.getElementById('qAns').value = '';
  document.getElementById('editor').dataset.editId = '';
  document.getElementById('editorTitle').textContent = 'New Question';
  document.getElementById('editor').style.display = 'block';
  document.getElementById('qId').focus();
}

function closeEditor() {
  document.getElementById('editor').style.display = 'none';
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showAdmin() {
  document.getElementById('loginCard').hidden = true;
  document.getElementById('adminCard').hidden = false;
  loadAll();
}

document.addEventListener('DOMContentLoaded', () => {
  if (token() && token() !== 'admin') {
    // verify token (skip for simple setup)
  }
  document.getElementById('adminCard').hidden = true;
});

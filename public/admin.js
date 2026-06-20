/* mathbarker — admin 2-pane */

var _sets = [];
var _allProblems = [];
var _activeSetId = null;
var _openProbId = null;  // inline form open for this problem id ('new' for add-new)

/* ─── auth ─── */
function token() { return sessionStorage.getItem('mb_admin_token') || ''; }

async function login() {
  var pw = document.getElementById('adminPw').value;
  var r = await fetch('/api/admin/login', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({password: pw})
  });
  var d = await r.json();
  if (d.token) {
    sessionStorage.setItem('mb_admin_token', d.token);
    showAdmin();
  } else {
    document.getElementById('adminPw').style.borderBottomColor = '#c44';
  }
}

async function api(method, path, body) {
  var h = {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token()};
  var opts = {method: method, headers: h};
  if (body) opts.body = JSON.stringify(body);
  var r = await fetch(path, opts);
  return r.ok ? r.json() : null;
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showAdmin() {
  document.getElementById('loginWrap').hidden = true;
  document.getElementById('shell').hidden = false;
  loadAllData();
}

/* ─── data load ─── */
async function loadAllData() {
  var [sets, probs] = await Promise.all([
    api('GET', '/api/sets'),
    api('GET', '/api/problems')
  ]);
  _sets = sets || [];
  _allProblems = probs || [];
  renderTree();
  if (_activeSetId) selectSet(_activeSetId);
}

/* ─── sidebar tree ─── */
function applyFilter() { renderTree(); }

function renderTree() {
  var subjF = document.getElementById('sbSubj').value;
  var modeF = document.getElementById('sbMode').value;
  var filtered = _sets.filter(function(s) {
    return (!subjF || s.subject === subjF) && (!modeF || s.mode === modeF);
  });

  // group by subject+mode
  var groups = {};
  filtered.forEach(function(s) {
    var k = s.subject + ' / ' + s.mode;
    (groups[k] = groups[k] || []).push(s);
  });

  var html = '';
  Object.keys(groups).sort().forEach(function(k) {
    html += '<div class="sb-grp">' + esc(k) + '</div>';
    groups[k].forEach(function(s) {
      var ids = JSON.parse(s.problem_ids || '[]');
      var active = s.id === _activeSetId ? ' active' : '';
      html += '<button class="sb-item' + active + '" onclick="selectSet(\'' + esc(s.id) + '\')">'
        + esc(s.title || s.id)
        + (ids.length ? '<span class="sb-cnt">(' + ids.length + ')</span>' : '')
        + '</button>';
    });
  });
  if (!html) html = '<div style="padding:16px 14px;font-size:0.75rem;color:var(--faint)">no sets</div>';
  document.getElementById('sbTree').innerHTML = html;
}

/* ─── set panel ─── */
function selectSet(id) {
  _activeSetId = id;
  _openProbId = null;
  renderTree();
  var set = _sets.find(function(s) { return s.id === id; });
  if (!set) return;
  renderSetPanel(set);
}

function getSetProblems(set) {
  var ids = JSON.parse(set.problem_ids || '[]');
  return ids.map(function(id) {
    return _allProblems.find(function(p) { return p.id === id; });
  }).filter(Boolean);
}

function renderSetPanel(set) {
  var probs = getSetProblems(set);
  document.getElementById('mpEmpty').hidden = true;
  var sp = document.getElementById('setPanel');
  sp.hidden = false;

  var html = ''
    + '<div class="sp-meta">'
    +   '<span class="sp-id">' + esc(set.id) + '</span>'
    +   '<select class="sp-sel" id="spSubj">'
    +     opt('1A', set.subject) + opt('2B', set.subject) + opt('3', set.subject)
    +   '</select>'
    +   '<select class="sp-sel" id="spMode">'
    +     opt('standard', set.mode) + opt('basic', set.mode)
    +   '</select>'
    +   '<input class="sp-title" id="spTitle" value="' + esc(set.title) + '" placeholder="title">'
    +   '<button class="btn btn-sm" onclick="saveSetMeta()">Save</button>'
    + '</div>'

    + '<div class="sec-hd">context</div>'
    + '<div class="ctx-split">'
    +   '<textarea class="ctx-ta" id="ctxTa" oninput="debPreview(\'ctxTa\',\'ctxPv\')">'
    +     esc(set.context || '')
    +   '</textarea>'
    +   '<div class="ctx-pv" id="ctxPv"></div>'
    + '</div>'

    + '<div class="sec-hd">problems</div>'
    + '<div class="prob-list" id="probList">'
    +   renderProbRows(probs)
    + '</div>'
    + '<button class="btn btn-sm" style="margin-top:10px" onclick="openNewProbForm()">+ Add Problem</button>';

  sp.innerHTML = html;
  debPreview('ctxTa', 'ctxPv');
}

function opt(val, current) {
  return '<option value="' + val + '"' + (val === current ? ' selected' : '') + '>' + val + '</option>';
}

function renderProbRows(probs) {
  if (!probs.length) return '<div style="padding:12px 14px;font-size:0.75rem;color:var(--faint)">no problems</div>';
  return probs.map(function(p, i) {
    var dotColor = p.status === 'live' ? '#2a7a2a' : p.status === 'broken' ? '#a02020' : '#aaa';
    var formHtml = _openProbId === p.id ? renderProbForm(p) : '';
    return '<div class="prob-row" id="pr-' + esc(p.id) + '">'
      + '<div class="prob-hd">'
      +   '<span class="prob-n">' + (i + 1) + '</span>'
      +   '<span class="prob-q">' + esc((p.q || '').substring(0, 70)) + ((p.q || '').length > 70 ? '…' : '') + '</span>'
      +   '<span class="prob-ans">ans=' + p.answer + '</span>'
      +   '<span class="prob-sdot" style="background:' + dotColor + '"></span>'
      +   '<button class="prob-edt" onclick="toggleProbForm(\'' + esc(p.id) + '\')">edit</button>'
      +   '<button class="prob-del" onclick="deleteProblem(\'' + esc(p.id) + '\')">del</button>'
      + '</div>'
      + formHtml
      + '</div>';
  }).join('');
}

function renderProbForm(p) {
  var isNew = !p.id;
  return '<div class="prob-form">'
    + '<div class="pf-row pf-r3">'
    +   '<div><div class="pf-lbl">ID</div><input class="pf-in" id="pfId" value="' + esc(p.id || '') + '" ' + (isNew ? '' : 'disabled') + '></div>'
    +   '<div><div class="pf-lbl">Answer</div><input class="pf-in" id="pfAns" type="number" value="' + (p.answer !== undefined ? p.answer : '') + '"></div>'
    +   '<div><div class="pf-lbl">Status</div>'
    +     '<select class="pf-sel" id="pfStatus">'
    +       opt2('live', p.status) + opt2('draft', p.status) + opt2('broken', p.status)
    +     '</select>'
    +   '</div>'
    + '</div>'
    + '<div class="pf-row">'
    +   '<div><div class="pf-lbl">Topic</div><input class="pf-in" id="pfTopic" value="' + esc(p.topic || '') + '"></div>'
    +   '<div><div class="pf-lbl">Subject / Mode</div>'
    +     '<select class="pf-sel" id="pfSubj" style="width:48%;margin-right:4%">'
    +       opt2('1A', p.subject) + opt2('2B', p.subject) + opt2('3', p.subject)
    +     '</select>'
    +     '<select class="pf-sel" id="pfMode" style="width:48%">'
    +       opt2('standard', p.mode) + opt2('basic', p.mode)
    +     '</select>'
    +   '</div>'
    + '</div>'
    + '<div class="pf-lbl">Question (LaTeX)</div>'
    + '<div class="pf-split">'
    +   '<textarea class="pf-ta" id="pfQ" oninput="debPreview(\'pfQ\',\'pfQPv\')">' + esc(p.q || '') + '</textarea>'
    +   '<div class="pf-pv" id="pfQPv"></div>'
    + '</div>'
    + '<div class="pf-lbl">Explanation</div>'
    + '<div class="pf-split">'
    +   '<textarea class="pf-ta" id="pfExp" oninput="debPreview(\'pfExp\',\'pfExpPv\')">' + esc(p.explanation || '') + '</textarea>'
    +   '<div class="pf-pv" id="pfExpPv"></div>'
    + '</div>'
    + '<div class="pf-btns">'
    +   '<button class="btn btn-sm" onclick="saveProblemInline(' + (isNew ? 'true' : 'false') + ')">Save</button>'
    +   '<button class="btn btn-sm btn-ghost" onclick="closeProbForm()">Cancel</button>'
    + (isNew ? '' : '<button class="btn btn-sm btn-ghost" style="margin-left:auto;color:#c44" onclick="deleteProblem(\'' + esc(p.id) + '\')">Delete</button>')
    + '</div>'
    + '</div>';
}

function opt2(val, current) {
  return '<option value="' + val + '"' + (val === current ? ' selected' : '') + '>' + val + '</option>';
}

/* ─── prob form actions ─── */
function toggleProbForm(id) {
  _openProbId = _openProbId === id ? null : id;
  refreshProbList();
  if (_openProbId === id) {
    setTimeout(function() {
      debPreview('pfQ', 'pfQPv');
      debPreview('pfExp', 'pfExpPv');
    }, 0);
  }
}

function openNewProbForm() {
  _openProbId = 'new';
  var set = _sets.find(function(s) { return s.id === _activeSetId; });
  var probs = set ? getSetProblems(set) : [];
  var list = document.getElementById('probList');
  var newRow = '<div class="prob-row" id="pr-new">'
    + renderProbForm({subject: set ? set.subject : '1A', mode: set ? set.mode : 'standard', status: 'draft'})
    + '</div>';
  list.insertAdjacentHTML('beforeend', newRow);
}

function closeProbForm() {
  _openProbId = null;
  refreshProbList();
}

function refreshProbList() {
  var set = _sets.find(function(s) { return s.id === _activeSetId; });
  if (!set) return;
  document.getElementById('probList').innerHTML = renderProbRows(getSetProblems(set));
  if (_openProbId && _openProbId !== 'new') {
    setTimeout(function() {
      debPreview('pfQ', 'pfQPv');
      debPreview('pfExp', 'pfExpPv');
    }, 0);
  }
}

async function saveProblemInline(isNew) {
  var id      = (document.getElementById('pfId').value || '').trim();
  var ans     = parseInt(document.getElementById('pfAns').value, 10);
  var status  = document.getElementById('pfStatus').value;
  var topic   = (document.getElementById('pfTopic').value || '').trim();
  var subject = document.getElementById('pfSubj').value;
  var mode    = document.getElementById('pfMode').value;
  var q       = (document.getElementById('pfQ').value || '').trim();
  var exp     = (document.getElementById('pfExp').value || '').trim();
  if (!id || isNaN(ans)) { alert('id and ans are required'); return; }
  var body = {id, subject, mode, topic, status, q, ans, explanation: exp};
  if (isNew) {
    var ok = await api('POST', '/api/problems', body);
    if (ok) {
      // add to current set's problem_ids
      var set = _sets.find(function(s) { return s.id === _activeSetId; });
      if (set) {
        var ids = JSON.parse(set.problem_ids || '[]');
        ids.push(id);
        await api('PUT', '/api/sets/' + encodeURIComponent(_activeSetId), {problem_ids: ids});
      }
    }
  } else {
    await api('PUT', '/api/problems/' + encodeURIComponent(id), body);
  }
  _openProbId = null;
  await loadAllData();
}

async function deleteProblem(id) {
  if (!confirm('Delete problem ' + id + '?')) return;
  await api('DELETE', '/api/problems/' + encodeURIComponent(id));
  // remove from set
  var set = _sets.find(function(s) { return s.id === _activeSetId; });
  if (set) {
    var ids = JSON.parse(set.problem_ids || '[]').filter(function(x) { return x !== id; });
    await api('PUT', '/api/sets/' + encodeURIComponent(_activeSetId), {problem_ids: ids});
  }
  _openProbId = null;
  await loadAllData();
}

/* ─── set meta save ─── */
async function saveSetMeta() {
  var subj    = document.getElementById('spSubj').value;
  var mode    = document.getElementById('spMode').value;
  var title   = (document.getElementById('spTitle').value || '').trim();
  var context = (document.getElementById('ctxTa').value || '').trim();
  await api('PUT', '/api/sets/' + encodeURIComponent(_activeSetId), {subject: subj, mode: mode, title: title, context: context});
  await loadAllData();
}

/* ─── new set ─── */
function toggleNsForm() {
  var f = document.getElementById('nsForm');
  f.hidden = !f.hidden;
  if (!f.hidden) document.getElementById('nsId').focus();
}

async function createSet() {
  var id      = (document.getElementById('nsId').value || '').trim();
  var title   = (document.getElementById('nsTitle').value || '').trim();
  var subject = document.getElementById('nsSubj').value;
  var mode    = document.getElementById('nsMode').value;
  if (!id) { alert('id required'); return; }
  await api('POST', '/api/sets', {id, subject, mode, title, context: '', problem_ids: []});
  document.getElementById('nsId').value = '';
  document.getElementById('nsTitle').value = '';
  document.getElementById('nsForm').hidden = true;
  await loadAllData();
  selectSet(id);
}

async function deleteSet(id) {
  if (!confirm('Delete set ' + id + '? (problems are not deleted)')) return;
  await api('DELETE', '/api/sets/' + encodeURIComponent(id));
  if (_activeSetId === id) {
    _activeSetId = null;
    document.getElementById('mpEmpty').hidden = false;
    document.getElementById('setPanel').hidden = true;
  }
  await loadAllData();
}

/* ─── KaTeX preview ─── */
var _pvTimers = {};
function debPreview(taId, pvId) {
  clearTimeout(_pvTimers[pvId]);
  _pvTimers[pvId] = setTimeout(function() { renderPreview(taId, pvId); }, 120);
}

function renderPreview(taId, pvId) {
  var ta = document.getElementById(taId);
  var pv = document.getElementById(pvId);
  if (!ta || !pv || !window.renderMathInElement) return;
  pv.textContent = ta.value;
  renderMathInElement(pv, {
    delimiters: [
      {left:'$$', right:'$$', display:true},
      {left:'\\[', right:'\\]', display:true},
      {left:'$',  right:'$',  display:false},
      {left:'\\(', right:'\\)', display:false}
    ],
    throwOnError: false
  });
}

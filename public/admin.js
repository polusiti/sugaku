/* mathbarker — admin 2-pane */

var _sets = [];
var _allProblems = [];
var _chapters = [];
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
  document.getElementById('manageShell').hidden = false;
  loadAllData();
}

/* ─── data load ─── */
async function loadAllData() {
  var [sets, probs, chapters] = await Promise.all([
    api('GET', '/api/sets'),
    api('GET', '/api/problems'),
    api('GET', '/api/chapters')
  ]);
  _sets = sets || [];
  _allProblems = probs || [];
  _chapters = chapters || [];
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
    +   '<select class="sp-sel" id="spSubj" onchange="updateChapterOpts(\'spSubj\',\'spChapter\')">'
    +     opt('1A', set.subject) + opt('2B', set.subject) + opt('3', set.subject)
    +   '</select>'
    +   '<select class="sp-sel" id="spMode">'
    +     opt('standard', set.mode) + opt('basic', set.mode)
    +   '</select>'
    +   '<select class="sp-sel" id="spChapter">' + chapterOpts(set.subject, set.chapter_id) + '</select>'
    +   '<input class="sp-title" id="spTitle" value="' + esc(set.title) + '" placeholder="title">'
    +   '<input class="sp-title" id="spTags" style="font-size:0.8rem;width:180px" value="' + esc((JSON.parse(set.tags||'[]')).join(', ')) + '" placeholder="tags: 確率, 数列, ...">'
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

function chapterOpts(subject, current) {
  var opts = '<option value="">-- 章 --</option>';
  _chapters.filter(function(c) { return c.subject === subject; }).forEach(function(c) {
    opts += '<option value="' + esc(c.id) + '"' + (c.id === current ? ' selected' : '') + '>' + esc(c.title) + '</option>';
  });
  return opts;
}

function updateChapterOpts(subjSelId, chapterSelId) {
  var subj = document.getElementById(subjSelId).value;
  document.getElementById(chapterSelId).innerHTML = chapterOpts(subj, '');
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
  var subj      = document.getElementById('spSubj').value;
  var mode      = document.getElementById('spMode').value;
  var chapterId = document.getElementById('spChapter').value;
  var title     = (document.getElementById('spTitle').value || '').trim();
  var context   = (document.getElementById('ctxTa').value || '').trim();
  var tagsRaw   = (document.getElementById('spTags').value || '').trim();
  var tags      = tagsRaw ? tagsRaw.split(',').map(function(t){return t.trim();}).filter(Boolean) : [];
  await api('PUT', '/api/sets/' + encodeURIComponent(_activeSetId), {subject: subj, mode: mode, chapter_id: chapterId, title: title, context: context, tags: tags});
  await loadAllData();
}

/* ─── new set ─── */
function toggleNsForm() {
  var f = document.getElementById('nsForm');
  f.hidden = !f.hidden;
  if (!f.hidden) {
    document.getElementById('nsId').focus();
    updateChapterOpts('nsSubj', 'nsChapter');
  }
}

async function createSet() {
  var id        = (document.getElementById('nsId').value || '').trim();
  var title     = (document.getElementById('nsTitle').value || '').trim();
  var subject   = document.getElementById('nsSubj').value;
  var mode      = document.getElementById('nsMode').value;
  var chapterId = document.getElementById('nsChapter').value;
  if (!id) { alert('id required'); return; }
  await api('POST', '/api/sets', {id, subject, mode, chapter_id: chapterId, title, context: '', problem_ids: []});
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

/* ─── Import Panel ─── */
var _importData = null;

function showImportPanel() {
  _activeSetId = null;
  document.getElementById('mpEmpty').hidden = true;
  document.getElementById('setPanel').hidden = true;
  document.getElementById('importPanel').hidden = false;
  renderTree();
}

function cancelImport() {
  _importData = null;
  document.getElementById('importPanel').hidden = true;
  document.getElementById('ipPreview').hidden = true;
  document.getElementById('ipErr').hidden = true;
  document.getElementById('mpEmpty').hidden = false;
}

function clearImport() {
  document.getElementById('ipJson').value = '';
  document.getElementById('ipPreview').hidden = true;
  document.getElementById('ipErr').hidden = true;
  _importData = null;
}

/* ─── mathbarker converter (R1〜R4) ─── */
function mathbarkerConvert(latex) {
  var s = String(latex || '');
  var steps = [];
  var total = 0;

  function eat(val, label) {
    if (!isNaN(val) && val > 0) { steps.push(label + ' = ' + val); total += val; }
  }

  // R4: π を除去（係数ごと）
  s = s.replace(/\d*\\pi(?:\^\{?\d+\}?)?/g, '');
  // R4: Euler e（単独）を除去
  s = s.replace(/(?<![a-zA-Z\\])e(?![a-zA-Z{])/g, '');
  // \log_{10} の底 10 は数えない
  s = s.replace(/\\log_\{?10\}?/g, '\\logSTD');

  // R2: \frac{a}{b}（整数のみ）
  s = s.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, function(_, a, b) {
    eat(+a + +b, '\\frac{' + a + '}{' + b + '}');
    return ' ';
  });
  // R2: \sqrt[n]{a} — 非2乗根は指数も数える
  s = s.replace(/\\sqrt\[(\d+)\]\{(\d+)\}/g, function(_, n, a) {
    eat(+n + +a, '\\sqrt[' + n + ']{' + a + '}');
    return ' ';
  });
  // R2: \sqrt{a} — 平方根は中身のみ
  s = s.replace(/\\sqrt\{(\d+)\}/g, function(_, a) {
    eat(+a, '\\sqrt{' + a + '}');
    return ' ';
  });
  // R2: \log_{b}{a} or \log_b a（非標準底）
  s = s.replace(/\\log_\{(\d+)\}\{?(\d+)\}?/g, function(_, b, a) {
    eat(+b + +a, '\\log_{' + b + '} ' + a);
    return ' ';
  });
  s = s.replace(/\\log_(\d+)\s+(\d+)/g, function(_, b, a) {
    eat(+b + +a, '\\log_' + b + ' ' + a);
    return ' ';
  });
  // R2: \logSTD a or \log a（標準底、底は数えない）
  s = s.replace(/\\(?:log|logSTD)\s*\{?(\d+)\}?/g, function(_, a) {
    eat(+a, '\\log ' + a);
    return ' ';
  });

  // R3: マイナス・特殊記号を除去
  s = s.replace(/[-+×÷=<>≤≥(){}[\]\\^_]/g, ' ');
  s = s.replace(/[a-zA-Z]/g, ' ');

  // 残った整数
  var nums = s.match(/\b\d+\b/g) || [];
  nums.forEach(function(n) { eat(+n, n); });

  return { total: total, steps: steps };
}

/* ─── LaTeX parser ─── */
function parseMondaiLatex(raw) {
  var result = { error: null, set: { id: '', subject: '', mode: '', title: '' }, context: '', problems: [] };

  // header: \begin{mondai}[subject、mode、title]
  var hm = raw.match(/\\begin\{mondai\}\[([^\]]+)\]/);
  if (!hm) { result.error = '\\begin{mondai}[...] が見つかりません'; return result; }
  var hp = hm[1].split(/[、,，]/);
  var subjectRaw = (hp[0] || '').trim();
  result.set.subject = subjectRaw.replace(/\$?\\clubsuit\$?\s*/g, '').trim();
  result.set.isProof = /\\clubsuit/.test(subjectRaw);
  var modeStr = (hp[1] || '').trim().toUpperCase();
  result.set.mode  = (modeStr === 'BASIC') ? 'basic' : 'standard';
  result.set.title = (hp[2] || '').trim();

  // mondai body
  var mm = raw.match(/\\begin\{mondai\}\[[^\]]*\]([\s\S]*?)\\end\{mondai\}/);
  if (!mm) { result.error = '\\end{mondai} が見つかりません'; return result; }
  var body = mm[1]
    .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '[図 — TikZ省略]')
    .replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/g, '')
    .trim();

  // answer body
  var am = raw.match(/\\begin\{answer\}([\s\S]*?)\\end\{answer\}/);
  var ansBody = am ? am[1]
    .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '')
    .replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/g, '') : '';

  // answer body を小問ごとに分割 → explanation & ans expression
  var ansSections = splitAtSubqMarkers(ansBody);

  // mondai body を context + 小問に分割
  var firstMatch = body.match(/(?:^|\n)[ \t]*\(1\)/);
  var subqParts;
  if (!firstMatch) {
    result.context = body;
    subqParts = [''];
  } else {
    var splitIdx = body.indexOf(firstMatch[0]);
    if (firstMatch[0][0] === '\n') splitIdx++;
    result.context = body.substring(0, splitIdx).trim();
    subqParts = splitAtSubqMarkers(body.substring(splitIdx));
  }

  // auto-suggest IDs
  var nextNum = 1;
  _allProblems.forEach(function(p) {
    var m2 = (p.id || '').match(/^p(\d+)$/);
    if (m2) nextNum = Math.max(nextNum, parseInt(m2[1], 10) + 1);
  });

  result.problems = subqParts.map(function(part, i) {
    // [calc] / [proof] タグを検出
    var typeTag = (part.match(/^\s*\[(calc|proof)\]\s*/i) || [])[1];
    var type = typeTag ? typeTag.toLowerCase() : (result.set.isProof ? 'proof' : 'calc');
    var q = part.replace(/^\s*\[(calc|proof)\]\s*/i, '').trim();

    // answer section から explanation と答えの式を抽出
    var ansSection = ansSections[i] || '';
    // $\star$ N があれば ans を直接確定（最優先）
    var starMatch = ansSection.match(/\$\\star\$\s*(\d+)/);
    var starAns = starMatch ? starMatch[1] : '';
    // 答えの式: $\star$ を除いた後の最後の $...$ ブロック
    var ansForExpr = ansSection.replace(/\$\\star\$\s*\d+/g, '');
    var exprMatch = ansForExpr.match(/\$([^$]+)\$(?![\s\S]*\$[^$]+\$)/);
    var ansExpr = '';
    if (exprMatch) {
      var candidate = exprMatch[1];
      // = を含む場合は = 以降を取る
      var eqIdx = candidate.lastIndexOf('=');
      ansExpr = (eqIdx >= 0 ? candidate.substring(eqIdx + 1) : candidate).trim();
    }
    // explanation: $\star$ N を除去した全文
    var explanation = ansForExpr.trim();

    return {
      id: 'p' + String(nextNum + i).padStart(3, '0'),
      type: type,
      q: q,
      ansExpr: ansExpr,
      ans: starAns,      // $\star$ N があれば初期値として使用、なければ converter で確定
      explanation: explanation
    };
  });

  return result;
}

function splitAtSubqMarkers(text) {
  var parts = text.split(/(?=(?:^|\n)[ \t]*\(\d+(?:-\d+)?\))/m);
  return parts.map(function(s) { return s.trim(); }).filter(Boolean);
}

/* ─── converter UI ─── */
function updateConverter(i) {
  var exprEl = document.getElementById('ipExpr-' + i);
  var ansEl  = document.getElementById('ipProbAns-' + i);
  var nEl    = document.getElementById('ipConvN-' + i);
  var stEl   = document.getElementById('ipConvSt-' + i);
  if (!exprEl) return;
  var r = mathbarkerConvert(exprEl.value);
  if (nEl)  nEl.textContent  = r.total > 0 ? r.total : '?';
  if (stEl) stEl.textContent = r.steps.length ? r.steps.join('  +  ') : '(数値が見つかりません)';
  if (ansEl && r.total > 0) ansEl.value = r.total;
}

function parseAndPreview() {
  var raw = (document.getElementById('ipJson').value || '').trim();
  var errEl = document.getElementById('ipErr');
  errEl.hidden = true;
  if (!raw) { errEl.textContent = 'LaTeX を貼り付けてください'; errEl.hidden = false; return; }

  var data = parseMondaiLatex(raw);
  if (data.error) { errEl.textContent = data.error; errEl.hidden = false; return; }
  _importData = data;

  document.getElementById('ipSetId').value = data.set.id;
  document.getElementById('ipSubj').value  = data.set.subject || '1A';
  document.getElementById('ipMode').value  = data.set.mode || 'standard';
  document.getElementById('ipTitle').value = data.set.title;
  document.getElementById('ipCtxTa').value = data.context;

  renderImportProblems(data.problems);
  document.getElementById('ipPreview').hidden = false;
  debPreview('ipCtxTa', 'ipCtxPv');
}

function renderImportProblems(probs) {
  var calcCount = probs.filter(function(p) { return p.type !== 'proof'; }).length;
  var proofCount = probs.length - calcCount;

  var html = '<div style="font-size:0.72rem;color:var(--faint);margin-bottom:12px">'
    + '計 ' + probs.length + ' 設問 — '
    + '<span style="color:#2a7a2a">calc: ' + calcCount + '</span>'
    + (proofCount ? ' &nbsp;／&nbsp; <span style="color:#888">proof: ' + proofCount + '（DBに追加しない）</span>' : '')
    + '</div>';

  probs.forEach(function(p, i) {
    var isProof = p.type === 'proof';
    html += '<div class="ip-prob' + (isProof ? ' ip-prob-proof' : '') + '">'
      // ── header row
      + '<div class="ip-prob-hd">'
      +   '<span class="ip-badge ip-badge-' + (isProof ? 'proof' : 'calc') + '">' + (isProof ? 'proof' : 'calc') + '</span>'
      +   '<span class="prob-n" style="margin-right:8px">(' + (i+1) + ')</span>'
      +   '<div class="pf-split" style="flex:1;margin:0">'
      +     '<div id="ipProbQPv-' + i + '" class="pf-pv" style="min-height:0;border:none;padding:0;font-size:0.85rem"></div>'
      +   '</div>'
      + '</div>';

    if (isProof) {
      html += '<div class="ip-skip-note">証明・図示問題 — Import 対象外。q テキストと解説は参考として保持。</div>';
    } else {
      // ── Step B: converter
      html += '<div class="ip-conv">'
        +   '<div class="ip-conv-expr">'
        +     '<div class="pf-lbl">答えの式（LaTeX）— R1〜R3 変換後の整数を自動計算</div>'
        +     '<input class="pf-in" id="ipExpr-' + i + '" value="' + esc(p.ansExpr || '') + '" '
        +       'oninput="updateConverter(' + i + ')" placeholder="例: \\frac{\\sqrt{3}+1}{2}">'
        +     '<div class="ip-conv-steps" id="ipConvSt-' + i + '"></div>'
        +   '</div>'
        +   '<div class="ip-conv-result" id="ipConvRes-' + i + '">'
        +     '<span class="ip-conv-star">★</span>'
        +     '<span class="ip-conv-n" id="ipConvN-' + i + '">?</span>'
        +   '</div>'
        + '</div>';
    }

    // ── metadata row
    html += '<div class="pf-row pf-r3" style="margin-top:10px">'
      +   '<div><div class="pf-lbl">ID</div>'
      +     '<input class="pf-in" id="ipProbId-' + i + '" value="' + esc(p.id || '') + '"' + (isProof ? ' disabled' : '') + '></div>'
      +   '<div><div class="pf-lbl">ans</div>'
      +     '<input class="pf-in" id="ipProbAns-' + i + '" type="number" value="' + (p.ans || '') + '"'
      +       (isProof ? ' disabled' : '') + '></div>'
      +   '<div><div class="pf-lbl">status</div>'
      +     '<select class="pf-sel" id="ipProbStatus-' + i + '"' + (isProof ? ' disabled' : '') + '>'
      +       opt2('draft', 'draft') + opt2('live', 'draft') + opt2('broken', 'draft')
      +     '</select></div>'
      + '</div>';

    // ── q textarea
    html += '<div class="pf-lbl" style="margin-top:10px">q (LaTeX)</div>'
      + '<div class="pf-split">'
      +   '<textarea class="pf-ta" id="ipProbQ-' + i + '" oninput="debPreview(\'ipProbQ-' + i + '\',\'ipProbQPv-' + i + '\')">'
      +     esc(p.q || '') + '</textarea>'
      +   '<div class="pf-pv" id="ipProbQPv2-' + i + '"></div>'
      + '</div>';

    // ── explanation textarea
    html += '<div class="pf-lbl" style="margin-top:8px">explanation</div>'
      + '<div class="pf-split">'
      +   '<textarea class="pf-ta" id="ipProbExp-' + i + '" oninput="debPreview(\'ipProbExp-' + i + '\',\'ipProbExpPv-' + i + '\')">'
      +     esc(p.explanation || '') + '</textarea>'
      +   '<div class="pf-pv" id="ipProbExpPv-' + i + '"></div>'
      + '</div>';

    html += '</div>'; // .ip-prob
  });

  document.getElementById('ipProblems').innerHTML = html;

  probs.forEach(function(p, i) {
    setTimeout(function() {
      // q preview in header
      var qEl = document.getElementById('ipProbQ-' + i);
      var pvEl = document.getElementById('ipProbQPv-' + i);
      if (qEl && pvEl) {
        pvEl.textContent = (p.q || '').substring(0, 80) + ((p.q || '').length > 80 ? '…' : '');
        renderMathInElement && renderMathInElement(pvEl, { delimiters: [{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false}], throwOnError: false });
      }
      debPreview('ipProbQ-' + i, 'ipProbQPv2-' + i);
      debPreview('ipProbExp-' + i, 'ipProbExpPv-' + i);
      if (p.type !== 'proof') updateConverter(i);
    }, 0);
  });
}

async function executeImport() {
  if (!_importData) return;

  var setId   = (document.getElementById('ipSetId').value || '').trim();
  var subject = document.getElementById('ipSubj').value;
  var mode    = document.getElementById('ipMode').value;
  var title   = (document.getElementById('ipTitle').value || '').trim();
  var context = (document.getElementById('ipCtxTa').value || '').trim();
  if (!setId) { alert('set id が必要です'); return; }

  // calc 問題のみ import（proof はスキップ）
  var probIds = [];
  var n = _importData.problems.length;
  for (var i = 0; i < n; i++) {
    var prob = _importData.problems[i];
    if (prob.type === 'proof') continue;

    var pid    = (document.getElementById('ipProbId-' + i).value || '').trim();
    var ans    = parseInt(document.getElementById('ipProbAns-' + i).value, 10);
    var status = document.getElementById('ipProbStatus-' + i).value;
    var q      = (document.getElementById('ipProbQ-' + i).value || '').trim();
    var exp    = (document.getElementById('ipProbExp-' + i).value || '').trim();

    if (!pid)     { alert('(' + (i+1) + ') の ID を入力してください'); return; }
    if (isNaN(ans)) { alert('(' + (i+1) + ') の ★ 値（ans）を入力してください\n答えの式を入力してConverterで計算してください'); return; }

    var ok = await api('POST', '/api/problems', {
      id: pid, subject, mode, topic: title, status, type: 'calc', q, ans, explanation: exp
    });
    if (!ok) { alert('problem ' + pid + ' の作成に失敗しました'); return; }
    probIds.push(pid);
  }

  var ok = await api('POST', '/api/sets', {id: setId, subject, mode, title, context, problem_ids: probIds});
  if (!ok) { alert('set ' + setId + ' の作成に失敗しました'); return; }

  _importData = null;
  document.getElementById('importPanel').hidden = true;
  document.getElementById('ipPreview').hidden = true;
  await loadAllData();
  selectSet(setId);
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

/* ═══════════════════════════════════════════
   Mode: manage / book
   ═══════════════════════════════════════════ */

var _mode = 'manage';
var _bookChapters = [];
var _bookProblems = [];
var _bookSubject = '1A';
var _bookChapter = null;

function initApp(mode) {
  if (mode === 'book') {
    setMode('book');
  } else {
    // manage: ログイン状態を確認
    var tok = sessionStorage.getItem('mb_admin_token');
    if (tok) {
      showAdmin();
    } else {
      document.getElementById('loginWrap').hidden = false;
    }
    document.getElementById('tabManage').classList.add('active');
    document.getElementById('tabBook').classList.remove('active');
  }
}

function setMode(mode) {
  _mode = mode;
  var isBook = mode === 'book';

  document.getElementById('tabManage').classList.toggle('active', !isBook);
  document.getElementById('tabBook').classList.toggle('active', isBook);

  document.getElementById('loginWrap').hidden = true;
  document.getElementById('manageShell').hidden = isBook;
  var bk = document.getElementById('bookShell');
  if (isBook) {
    bk.style.display = 'flex';
    bk.hidden = false;
    initBook();
  } else {
    bk.style.display = 'none';
    bk.hidden = true;
    var tok = sessionStorage.getItem('mb_admin_token');
    if (tok) {
      document.getElementById('manageShell').hidden = false;
      loadAllData();
    } else {
      document.getElementById('loginWrap').hidden = false;
    }
  }

  history.pushState({}, '', isBook ? '/admin/book' : '/admin');
}

/* ── book: init ── */
async function initBook() {
  var [ch, pr] = await Promise.all([
    fetch('/api/chapters').then(function(r){ return r.json(); }),
    fetch('/api/problems?status=live').then(function(r){ return r.json(); })
  ]);
  _bookChapters = ch || [];
  _bookProblems = pr || [];
  renderBookTabs();
  renderBookSidebar();
}

/* ── book: subject tabs ── */
function renderBookTabs() {
  var order = ['1A','2B','3'];
  var labels = {'1A':'数学I・A','2B':'数学II・B','3':'数学III'};
  var subjects = order.filter(function(s) {
    return _bookChapters.some(function(c){ return c.subject === s; });
  });
  var html = subjects.map(function(s) {
    return '<button class="bk-tab' + (s === _bookSubject ? ' active' : '') + '" onclick="selectBookSubject(\'' + s + '\')">'
      + (labels[s] || s) + '</button>';
  }).join('');
  document.getElementById('bookTabs').innerHTML = html;
}

function selectBookSubject(s) {
  _bookSubject = s;
  _bookChapter = null;
  renderBookTabs();
  renderBookSidebar();
  document.getElementById('bookMain').innerHTML = '<div class="bk-empty">章を選んでください</div>';
}

/* ── book: chapter sidebar ── */
function renderBookSidebar() {
  var chs = _bookChapters.filter(function(c){ return c.subject === _bookSubject; });
  if (!chs.length) { document.getElementById('bookSb').innerHTML = ''; return; }
  var labels = {'1A':'数学I・A','2B':'数学II・B','3':'数学III'};
  var html = '<div class="book-sb-sect">' + esc(labels[_bookSubject] || _bookSubject) + '</div>';
  chs.forEach(function(c) {
    var cnt = _bookProblems.filter(function(p){ return p.chapter_id === c.id; }).length;
    html += '<button class="ch-item' + (c.id === _bookChapter ? ' active' : '') + '" onclick="selectBookChapter(\'' + esc(c.id) + '\')">'
      + esc(c.title)
      + '<span class="ch-cnt">' + cnt + '</span>'
      + '</button>';
  });
  document.getElementById('bookSb').innerHTML = html;
}

function selectBookChapter(chId) {
  _bookChapter = chId;
  renderBookSidebar();
  renderBookMain();
}

/* ── book: main panel ── */
function renderBookMain() {
  var ch = _bookChapters.find(function(c){ return c.id === _bookChapter; });
  if (!ch) return;
  var probs = _bookProblems.filter(function(p){ return p.chapter_id === _bookChapter; });

  // set_id でグループ化（set_order 順）
  var sets = {}, setOrder = [];
  probs.forEach(function(p) {
    var sid = p.set_id || p.id;
    if (!sets[sid]) { sets[sid] = []; setOrder.push(sid); }
    sets[sid].push(p);
  });
  Object.values(sets).forEach(function(arr) {
    arr.sort(function(a,b){ return (a.set_order||1)-(b.set_order||1); });
  });

  var html = '<div class="bk-ch-title">' + esc(ch.title) + '</div>';
  if (!setOrder.length) { html += '<div class="bk-empty">問題なし</div>'; }

  setOrder.forEach(function(sid, i) {
    var ps = sets[sid];
    var first = ps[0];
    var mode = first.mode === 'basic' ? 'basic' : 'standard';
    var title = bkSetTitle(ps);

    html += '<div class="set-card" id="bksc-' + esc(sid) + '">'
      + '<div class="set-hd" onclick="bkToggleSet(\'' + esc(sid) + '\')">'
      +   '<span class="set-num">' + (i+1) + '</span>'
      +   '<span class="set-title">' + esc(title) + '</span>'
      +   '<div class="set-meta">'
      +     '<span class="bk-badge">' + mode + '</span>'
      +     '<span>' + ps.length + '問</span>'
      +   '</div>'
      +   '<span class="set-chev" id="bkchev-' + esc(sid) + '">&#9654;</span>'
      + '</div>'
      + '<div class="set-body" id="bksb-' + esc(sid) + '">'
      + bkRenderSetBody(ps)
      + '</div>'
      + '</div>';
  });

  document.getElementById('bookMain').innerHTML = html;
  bkRenderKatex(document.getElementById('bookMain'));
}

function bkSetTitle(ps) {
  if (ps.length === 1) return ps[0].topic;
  return ps[0].topic.replace(/\s*\(\d+\)\s*$/, '').trim() || ps[0].topic;
}

function bkRenderSetBody(ps) {
  var html = '';
  ps.forEach(function(p, i) {
    var isProof = p.type === 'proof';
    var pid = esc(p.id);
    html += '<div class="bk-prob-row" id="bkpr-' + pid + '" onclick="bkToggleProb(\'' + pid + '\')">'
      +   '<div class="bk-subq">'
      +   (ps.length > 1 ? '<span class="bk-pn">(' + (p.set_order||i+1) + ')</span>' : '')
      +   '<div class="bk-q' + (isProof ? ' proof' : '') + '">' + bkLatex(p.q) + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="bk-ans-panel" id="bkap-' + pid + '">'
      + (isProof
        ? '<div style="color:var(--faint);font-size:0.8rem">証明問題</div>'
        : '<div class="bk-ans-row">'
          + '<input class="bk-ans-in" id="bkai-' + pid + '" type="number" placeholder="?" '
          + 'onkeydown="if(event.key===\'Enter\')bkCheckAns(\'' + pid + '\',' + (p.answer||0) + ')">'
          + '<button class="bk-ans-btn" onclick="bkCheckAns(\'' + pid + '\',' + (p.answer||0) + ')">確認</button>'
          + '<span class="bk-ans-res" id="bkar-' + pid + '"></span>'
          + '</div>'
        )
      + (p.explanation
        ? '<div class="bk-exp" id="bkae-' + pid + '" style="display:none">' + bkLatex(p.explanation) + '</div>'
        : '')
      + '</div>';
  });
  return html;
}

function bkToggleSet(sid) {
  var body = document.getElementById('bksb-' + sid);
  var chev = document.getElementById('bkchev-' + sid);
  var hd   = body.previousElementSibling;
  var open = body.classList.toggle('open');
  hd.classList.toggle('open', open);
  chev.classList.toggle('open', open);
}

function bkToggleProb(pid) {
  var ap = document.getElementById('bkap-' + pid);
  var pr = document.getElementById('bkpr-' + pid);
  var open = ap.classList.toggle('open');
  pr.classList.toggle('open', open);
  ap.style.display = open ? 'block' : 'none';
  if (open) bkRenderKatex(ap);
}

function bkCheckAns(pid, correct) {
  var inp = document.getElementById('bkai-' + pid);
  var res = document.getElementById('bkar-' + pid);
  var exp = document.getElementById('bkae-' + pid);
  var val = parseInt(inp.value, 10);
  if (isNaN(val)) return;
  if (val === correct) {
    inp.className = 'bk-ans-in correct';
    res.className = 'bk-ans-res correct'; res.textContent = '正解';
    if (exp) { exp.style.display = 'block'; bkRenderKatex(exp); }
  } else {
    inp.className = 'bk-ans-in wrong';
    res.className = 'bk-ans-res wrong'; res.textContent = '不正解';
    setTimeout(function(){ inp.className = 'bk-ans-in'; }, 600);
  }
  fetch('/api/record', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({uuid: bkUserId(), question_id: pid, answer: val, is_correct: val===correct})
  }).catch(function(){});
}

function bkUserId() {
  var id = localStorage.getItem('mb_uuid');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('mb_uuid', id); }
  return id;
}

function bkLatex(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function bkRenderKatex(el) {
  if (!el || typeof renderMathInElement === 'undefined') return;
  renderMathInElement(el, {
    delimiters: [
      {left:'$$',right:'$$',display:true},
      {left:'\\[',right:'\\]',display:true},
      {left:'$',right:'$',display:false},
      {left:'\\(',right:'\\)',display:false}
    ],
    throwOnError: false
  });
}

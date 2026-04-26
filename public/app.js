let currentUser = null;
let allCandidates = [];
let currentCandidateId = null;
let currentAnswers = [];
let currentType = 1;
let currentQuestions = [];

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch("/api/me");
  if (!res.ok) { window.location.href = "/login"; return; }
  currentUser = await res.json();

  // Sidebar user
  document.getElementById("sidebarName").textContent = currentUser.username;
  document.getElementById("sidebarRole").textContent = currentUser.canManage ? "Администратор" : "Интервьюер";
  if (currentUser.avatar) {
    document.getElementById("sidebarAvatar").src =
      `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=64`;
  }

  // Show admin items
  if (currentUser.canManage) {
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("visible"));
  }

  // Nav
  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });

  loadCandidates();
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add("active");

  if (page === "results") loadResults();
  if (page === "profile") loadProfile();
  if (page === "manage") loadManage();
}

// ── Candidates ────────────────────────────────────────────────────────────────
async function loadCandidates() {
  const res = await fetch("/api/candidates");
  if (!res.ok) return;
  allCandidates = await res.json();
  renderCandidates(allCandidates);
}

function filterCandidates() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  renderCandidates(allCandidates.filter(c => c.name.toLowerCase().includes(q)));
}

function renderCandidates(list) {
  const grid = document.getElementById("candidateGrid");
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">👥</div><div class="empty-text">Нет кандидатов</div></div>`;
    return;
  }
  grid.innerHTML = list.map(c => `
    <div class="candidate-card" onclick="openInterview(${c.id}, '${esc(c.name)}')">
      <div class="c-avatar">${c.name[0].toUpperCase()}</div>
      <div class="c-name">${esc(c.name)}</div>
      <div class="c-sub">${c.discord_id ? `<span style="color:var(--accent)">@</span> ${c.discord_id}` : "Без Discord ID"}</div>
      ${currentUser.canManage ? `
        <div class="c-actions">
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteCandidate(event,${c.id})" title="Удалить">🗑</button>
        </div>` : ""}
    </div>
  `).join("");
}

async function addCandidate() {
  const name = document.getElementById("inputName").value.trim();
  const discord_id = document.getElementById("inputDiscordId").value.trim();
  if (!name) return toast("Введите имя", "error");
  const res = await fetch("/api/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, discord_id }),
  });
  if (!res.ok) return toast("Ошибка добавления", "error");
  closeModal("modalAdd");
  document.getElementById("inputName").value = "";
  document.getElementById("inputDiscordId").value = "";
  toast("Кандидат добавлен", "success");
  loadCandidates();
}

async function deleteCandidate(e, id) {
  e.stopPropagation();
  if (!confirm("Удалить кандидата?")) return;
  const res = await fetch(`/api/candidates?id=${id}`, { method: "DELETE" });
  if (!res.ok) return toast("Ошибка", "error");
  toast("Удалено", "success");
  loadCandidates();
}

// ── Interview ─────────────────────────────────────────────────────────────────
async function openInterview(candidateId, name) {
  currentCandidateId = candidateId;
  currentAnswers = [];
  currentType = 1;
  document.getElementById("interviewTitle").textContent = `Обзвон: ${name}`;
  document.getElementById("questionsContainer").innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  document.getElementById("interviewFoot").style.display = "none";
  document.getElementById("scorePreview").style.display = "none";
  document.getElementById("progressIndicator").innerHTML = "";
  document.getElementById("interviewHistory").innerHTML = "";

  // Reset type buttons
  document.querySelectorAll(".type-btn").forEach(b => b.classList.toggle("active", b.dataset.type == "1"));

  openModal("modalInterview");
  await loadQuestions(1);
  loadInterviewHistory(candidateId);
}

async function selectType(type) {
  currentType = type;
  currentAnswers = [];
  document.querySelectorAll(".type-btn").forEach(b => b.classList.toggle("active", b.dataset.type == type));
  document.getElementById("questionsContainer").innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  document.getElementById("interviewFoot").style.display = "none";
  document.getElementById("scorePreview").style.display = "none";
  document.getElementById("progressIndicator").innerHTML = "";
  await loadQuestions(type);
}

async function loadQuestions(type) {
  const res = await fetch(`/api/questions?type=${type}`);
  if (!res.ok) { toast("Ошибка загрузки вопросов", "error"); return; }
  currentQuestions = await res.json();
  currentAnswers = new Array(currentQuestions.length).fill(null);
  renderQuestions();
  renderProgress();
  document.getElementById("interviewFoot").style.display = "flex";
}

function renderQuestions() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = `<div class="questions-list">${currentQuestions.map((q, i) => `
    <div class="q-row" id="qrow-${i}">
      <div class="q-num">Вопрос ${i + 1} из ${currentQuestions.length}</div>
      <div class="q-text">${esc(q.question)}</div>
      <div class="q-answer-hint">Ответ: ${esc(q.answer)}</div>
      <div class="answer-btns">
        <button class="ans-btn" onclick="setAnswer(${i},'+')">✓ Правильно</button>
        <button class="ans-btn" onclick="setAnswer(${i},'0')">✗ Неправильно</button>
        <button class="ans-btn" onclick="setAnswer(${i},'50/50')">~ 50/50</button>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderProgress() {
  const wrap = document.getElementById("progressIndicator");
  wrap.innerHTML = currentAnswers.map((a, i) => {
    const cls = a === "+" ? "done-plus" : a === "0" ? "done-zero" : a === "50/50" ? "done-half" : "";
    return `<div class="prog-dot ${cls}" title="Вопрос ${i+1}"></div>`;
  }).join("");
}

function setAnswer(index, value) {
  currentAnswers[index] = value;
  const row = document.getElementById(`qrow-${index}`);
  row.classList.add("answered");
  const btns = row.querySelectorAll(".ans-btn");
  btns.forEach(b => b.classList.remove("sel-plus","sel-zero","sel-half"));
  const map = { "+": "sel-plus", "0": "sel-zero", "50/50": "sel-half" };
  const idx = value === "+" ? 0 : value === "0" ? 1 : 2;
  btns[idx].classList.add(map[value]);
  renderProgress();
  updateScorePreview();
}

function updateScorePreview() {
  const answered = currentAnswers.filter(a => a !== null).length;
  if (answered === 0) return;
  const plus = currentAnswers.filter(a => a === "+").length;
  const total = currentAnswers.length;
  const pct = Math.round((plus / total) * 100);

  document.getElementById("scorePreview").style.display = "block";
  document.getElementById("scoreText").textContent = `${plus}/${total} правильных (${pct}%)`;
  const fill = document.getElementById("scoreBarFill");
  fill.style.width = pct + "%";
  fill.className = "score-bar-fill" + (pct >= 70 ? "" : pct >= 40 ? " mid" : " low");
}

async function submitInterview() {
  if (currentAnswers.some(a => a === null)) return toast("Ответьте на все вопросы", "error");
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_id: currentCandidateId, obzvon_type: currentType, answers: currentAnswers }),
  });
  if (!res.ok) return toast("Ошибка сохранения", "error");
  const data = await res.json();
  toast(`Сохранено! ${data.score}`, "success");
  closeModal("modalInterview");
}

async function loadInterviewHistory(candidateId) {
  const res = await fetch(`/api/sessions?candidate_id=${candidateId}`);
  if (!res.ok) return;
  const sessions = await res.json();
  if (!sessions.length) return;

  const wrap = document.getElementById("interviewHistory");
  wrap.innerHTML = `<div class="divider"></div><div style="font-size:0.78rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">История обзвонов</div>
  <div class="history-list">${sessions.map(s => {
    const date = new Date(s.created_at * 1000).toLocaleString("ru-RU");
    const chips = s.answers.map(a => `<span class="ha ${a==="+"?"ha-plus":a==="0"?"ha-zero":"ha-half"}">${a}</span>`).join("");
    const scoreClass = s.pct >= 70 ? "score-high" : s.pct >= 40 ? "score-mid" : "score-low";
    return `<div class="history-item">
      <div class="history-meta">
        <span><span class="type-badge">Обзвон ${s.obzvon_type}</span></span>
        <span>${date}</span>
        <span>👤 ${esc(s.conducted_by_name || s.conducted_by)}</span>
        <span class="score-badge ${scoreClass}">${s.score}</span>
      </div>
      <div class="history-answers">${chips}</div>
    </div>`;
  }).join("")}</div>`;
}

// ── Results ───────────────────────────────────────────────────────────────────
async function loadResults() {
  const typeFilter = document.getElementById("filterType").value;
  const res = await fetch("/api/sessions");
  if (!res.ok) return;
  let sessions = await res.json();
  if (typeFilter) sessions = sessions.filter(s => String(s.obzvon_type) === typeFilter);

  // Stats
  const total = sessions.length;
  const avgPct = total ? Math.round(sessions.reduce((a, s) => a + (s.pct || 0), 0) / total) : 0;
  const passed = sessions.filter(s => (s.pct || 0) >= 70).length;

  document.getElementById("resultsStats").innerHTML = `
    <div class="stat-card"><div class="stat-label">Всего обзвонов</div><div class="stat-value blue">${total}</div></div>
    <div class="stat-card"><div class="stat-label">Средний результат</div><div class="stat-value ${avgPct>=70?"green":avgPct>=40?"yellow":"red"}">${avgPct}%</div></div>
    <div class="stat-card"><div class="stat-label">Прошли (≥70%)</div><div class="stat-value green">${passed}</div></div>
    <div class="stat-card"><div class="stat-label">Не прошли</div><div class="stat-value red">${total - passed}</div></div>
  `;

  if (!sessions.length) {
    document.getElementById("resultsTableWrap").innerHTML = `<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">Нет результатов</div></div>`;
    return;
  }

  // Get candidates map
  const candRes = await fetch("/api/candidates");
  const candidates = candRes.ok ? await candRes.json() : [];
  const candMap = Object.fromEntries(candidates.map(c => [c.id, c.name]));

  document.getElementById("resultsTableWrap").innerHTML = `
    <table class="results-table">
      <thead><tr>
        <th>Кандидат</th><th>Тип</th><th>Результат</th><th>Правильных</th><th>Проводил</th><th>Дата</th>
      </tr></thead>
      <tbody>${sessions.map(s => {
        const scoreClass = (s.pct||0) >= 70 ? "score-high" : (s.pct||0) >= 40 ? "score-mid" : "score-low";
        const date = new Date(s.created_at * 1000).toLocaleString("ru-RU");
        return `<tr>
          <td><strong>${esc(candMap[s.candidate_id] || "Удалён")}</strong></td>
          <td><span class="type-badge">Обзвон ${s.obzvon_type}</span></td>
          <td><span class="score-badge ${scoreClass}">${s.score}</span></td>
          <td>${s.plus || 0} / ${s.total || 12}</td>
          <td>${esc(s.conducted_by_name || s.conducted_by)}</td>
          <td style="color:var(--text2)">${date}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function loadProfile() {
  const res = await fetch("/api/me");
  if (!res.ok) return;
  const user = await res.json();
  const s = user.stats;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const roleNames = {
    "1453878770309271684": "Интервьюер",
    "1453878766916075663": "Старший администратор",
    "1453878697676505109": "Администратор",
  };
  const adminRoles = ["1453878766916075663","1453878697676505109"];
  const roleChips = (user.roles || [])
    .filter(r => roleNames[r])
    .map(r => `<span class="role-chip ${adminRoles.includes(r)?"admin":""}">${roleNames[r]}</span>`)
    .join("");

  const avgPct = s.total ? Math.round(
    (s.totalPlus / (s.total * 12)) * 100
  ) : 0;

  document.getElementById("profileContent").innerHTML = `
    <div class="profile-header">
      <img class="profile-avatar" src="${avatarUrl}" alt="" />
      <div>
        <div class="profile-name">${esc(user.username)}</div>
        <div class="profile-tag">Discord ID: ${user.id}</div>
        <div class="profile-roles">${roleChips || '<span style="color:var(--text2);font-size:0.8rem">Нет ролей</span>'}</div>
      </div>
    </div>

    <div class="profile-stats-grid">
      <div class="stat-card"><div class="stat-label">Обзвонов всего</div><div class="stat-value blue">${s.total}</div></div>
      <div class="stat-card"><div class="stat-label">Обзвон 1</div><div class="stat-value">${s.byType[1]||0}</div></div>
      <div class="stat-card"><div class="stat-label">Обзвон 2</div><div class="stat-value">${s.byType[2]||0}</div></div>
      <div class="stat-card"><div class="stat-label">Обзвон 3</div><div class="stat-value">${s.byType[3]||0}</div></div>
      <div class="stat-card"><div class="stat-label">Правильных ответов</div><div class="stat-value green">${s.totalPlus}</div></div>
      <div class="stat-card"><div class="stat-label">Неправильных</div><div class="stat-value red">${s.totalZero}</div></div>
      <div class="stat-card"><div class="stat-label">Спорных (50/50)</div><div class="stat-value yellow">${s.totalHalf}</div></div>
      <div class="stat-card"><div class="stat-label">Средний % правильных</div><div class="stat-value ${avgPct>=70?"green":avgPct>=40?"yellow":"red"}">${avgPct}%</div></div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-weight:600">Последние обзвоны</span>
      </div>
      <div id="profileSessions"><div class="loader"><div class="spinner"></div></div></div>
    </div>
  `;

  // Load my sessions
  const sRes = await fetch(`/api/sessions?conducted_by=${user.id}`);
  if (sRes.ok) {
    const sessions = await sRes.json();
    const candRes = await fetch("/api/candidates");
    const candidates = candRes.ok ? await candRes.json() : [];
    const candMap = Object.fromEntries(candidates.map(c => [c.id, c.name]));

    const wrap = document.getElementById("profileSessions");
    if (!sessions.length) {
      wrap.innerHTML = `<div class="empty" style="padding:24px"><div class="empty-text">Вы ещё не проводили обзвонов</div></div>`;
    } else {
      wrap.innerHTML = `<table class="results-table">
        <thead><tr><th>Кандидат</th><th>Тип</th><th>Результат</th><th>Дата</th></tr></thead>
        <tbody>${sessions.slice(0,20).map(s => {
          const sc = (s.pct||0)>=70?"score-high":(s.pct||0)>=40?"score-mid":"score-low";
          return `<tr>
            <td>${esc(candMap[s.candidate_id]||"Удалён")}</td>
            <td><span class="type-badge">Обзвон ${s.obzvon_type}</span></td>
            <td><span class="score-badge ${sc}">${s.score}</span></td>
            <td style="color:var(--text2)">${new Date(s.created_at*1000).toLocaleString("ru-RU")}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;
    }
  }
}

async function refreshProfile() {
  toast("Обновление ролей...", "info");
  const res = await fetch("/api/auth/refresh");
  if (!res.ok) return toast("Ошибка обновления", "error");
  const data = await res.json();
  toast(`Роли обновлены: ${data.username}`, "success");
  // Reload page to apply new token
  setTimeout(() => window.location.reload(), 800);
}

// ── Manage ────────────────────────────────────────────────────────────────────
async function loadManage() {
  if (!currentUser.canManage) {
    document.getElementById("manageContent").innerHTML = `<div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Нет доступа</div></div>`;
    return;
  }
  const [candRes, sessRes] = await Promise.all([fetch("/api/candidates"), fetch("/api/sessions")]);
  const candidates = candRes.ok ? await candRes.json() : [];
  const sessions = sessRes.ok ? await sessRes.json() : [];

  document.getElementById("manageContent").innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Кандидатов</div><div class="stat-value blue">${candidates.length}</div></div>
      <div class="stat-card"><div class="stat-label">Всего сессий</div><div class="stat-value">${sessions.length}</div></div>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:14px">Все кандидаты</div>
      <table class="results-table">
        <thead><tr><th>Имя</th><th>Discord ID</th><th>Добавил</th><th>Обзвонов</th><th></th></tr></thead>
        <tbody>${candidates.map(c => {
          const cnt = sessions.filter(s => String(s.candidate_id) === String(c.id)).length;
          return `<tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td style="color:var(--text2)">${c.discord_id||"—"}</td>
            <td style="color:var(--text2)">${c.added_by||"—"}</td>
            <td>${cnt}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteCandidate(event,${c.id})">Удалить</button></td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("open"); });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const wrap = document.getElementById("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✓", error: "✗", info: "ℹ" };
  el.innerHTML = `<span>${icons[type]||""}</span> ${esc(msg)}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

init();

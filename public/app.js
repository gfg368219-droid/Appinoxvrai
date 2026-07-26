/* ═══════════════════════════════════════════════════════════
   APPINOX — APPLICATION SCRIPT
═══════════════════════════════════════════════════════════ */
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let CATALOG = [];
let currentUser = null;
let watchlist = new Set();
let currentModalId = null;
let isPlaying = false;
let playerRaf = null;
let progressInterval = null;
let progressPct = 0;
let isMuted = false;

// ── Persistent Playback ───────────────────────────────────────────────────────
const RESUME_KEY = 'appinox_resume';

function saveProgress() {
  if (!currentModalId || progressPct <= 1) return;
  const item = CATALOG.find(c => c.id === currentModalId);
  if (!item) return;
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({
      id: currentModalId,
      progressPct,
      title: item.title,
      savedAt: Date.now(),
    }));
  } catch {}
}

function loadResume() {
  try { return JSON.parse(localStorage.getItem(RESUME_KEY)); } catch { return null; }
}

function clearResume(id) {
  const saved = loadResume();
  if (!id || saved?.id === id) localStorage.removeItem(RESUME_KEY);
}

// Save when leaving the page
document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
window.addEventListener('beforeunload', saveProgress);

// ── Boot ──────────────────────────────────────────────────────────────────────
(function boot() { runIntro(); })();

// ── INTRO ─────────────────────────────────────────────────────────────────────
function runIntro() {
  const canvas = document.getElementById('streak-canvas');
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const streaks = Array.from({ length: 65 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.5,
    speed: 3 + Math.random() * 10,
    width: 0.5 + Math.random() * 2.5,
    length: 40 + Math.random() * 220,
    opacity: 0.25 + Math.random() * 0.75,
    color: ['#00d4ff','#bf40ff','#ff2d78'][Math.floor(Math.random() * 3)],
    delay: Math.random() * 60,
    born: false,
  }));

  // Stagger letters
  document.querySelectorAll('#intro-wordmark span').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.display = 'inline-block';
    el.style.transition = `opacity 0.45s ease ${1.2 + i * 0.07}s, transform 0.45s ease ${1.2 + i * 0.07}s`;
    setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, 1200 + i * 70);
  });

  let start = null, burstAt = null, rafId;
  function draw(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    if (elapsed > 1500 && !burstAt) burstAt = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    streaks.forEach(s => {
      if (elapsed < s.delay) return;
      if (!s.born) { s.born = true; s.x = Math.random() * canvas.width; s.y = -s.length; }
      s.y += burstAt ? s.speed * 5 : s.speed * 0.25;
      if (s.y > canvas.height + s.length) { s.y = -s.length; s.x = Math.random() * canvas.width; }
      const grd = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.length);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, s.color + Math.floor(s.opacity * 255).toString(16).padStart(2, '0'));
      grd.addColorStop(1, 'transparent');
      ctx.strokeStyle = grd;
      ctx.lineWidth = burstAt ? s.width * 2.5 : s.width;
      ctx.shadowBlur = burstAt ? 25 : 8;
      ctx.shadowColor = s.color;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.length); ctx.stroke();
    });
    ctx.shadowBlur = 0;
    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  setTimeout(() => {
    const intro = document.getElementById('intro-screen');
    const app = document.getElementById('main-app');
    intro.style.transition = 'opacity 0.9s ease';
    intro.style.opacity = '0';
    setTimeout(() => {
      cancelAnimationFrame(rafId);
      intro.style.display = 'none';
      app.classList.remove('hidden');
      app.style.opacity = '0';
      app.style.transition = 'opacity 0.6s ease';
      requestAnimationFrame(() => { app.style.opacity = '1'; });
      initApp();
    }, 900);
  }, 4600);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function initApp() {
  try {
    const [meRes, catRes, wlRes] = await Promise.all([
      fetch('/api/me'),
      fetch('/api/catalog'),
      fetch('/api/watchlist'),
    ]);
    currentUser = await meRes.json();
    CATALOG = await catRes.json();
    const wlData = await wlRes.json();
    watchlist = new Set(wlData.watchlist || []);

    // Update user UI
    const letter = currentUser.avatar || currentUser.name?.[0]?.toUpperCase() || 'U';
    document.getElementById('avatar-letter').textContent = letter;
    document.getElementById('menu-avatar-big').textContent = letter;
    document.getElementById('menu-name').textContent = currentUser.name;
    document.getElementById('menu-email').textContent = currentUser.email;
    if (currentUser.role === 'admin') {
      document.getElementById('menu-role').textContent = '🛡 Administrateur';
      document.getElementById('menu-role').style.color = '#bf40ff';
      document.getElementById('admin-btn').style.display = 'flex';
    }

    renderHero();
    renderRows();
    renderResumeRow();
    initHeroCanvas();
    initNavbarScroll();
  } catch (e) {
    console.error('initApp error:', e);
  }
}

function renderResumeRow() {
  const resume = loadResume();
  const rowEl = document.getElementById('row-resume');
  const wrapEl = document.getElementById('resume-card-wrap');
  if (!rowEl || !wrapEl) return;
  if (!resume) { rowEl.style.display = 'none'; return; }
  const item = CATALOG.find(c => c.id === resume.id);
  if (!item) { rowEl.style.display = 'none'; return; }
  rowEl.style.display = '';
  const pct = Math.round(resume.progressPct);
  wrapEl.innerHTML = `
    <div class="resume-card" onclick="openModal('${item.id}')" style="cursor:pointer;display:flex;align-items:center;gap:18px;
      background:rgba(255,255,255,0.04);border:1px solid rgba(191,64,255,0.18);border-radius:14px;
      padding:14px 18px;max-width:480px;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.07)'" onmouseleave="this.style.background='rgba(255,255,255,0.04)'">
      <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#0a0030,#1a0060);
        display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,212,255,0.2)">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;color:#00d4ff"><polygon points="5,3 19,12 5,21"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:3px">${item.genre} · ${item.year} · <span style="color:var(--cyan)">${item.audio}</span></div>
        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:3px;margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#00d4ff,#bf40ff);border-radius:3px"></div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--purple);font-weight:600;flex-shrink:0">${pct}%</div>
    </div>`;
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function renderHero() {
  const area = document.getElementById('hero-content-area');
  if (!CATALOG.length) {
    area.innerHTML = `
      <div class="hero-welcome">
        <div class="hero-badge"><span class="badge-icon">◆</span> BIENVENUE</div>
        <h1 class="hero-title">APPINOX</h1>
        <p class="hero-desc">Bienvenue sur APPINOX. Les contenus seront ajoutés par les administrateurs.</p>
      </div>`;
    return;
  }
  // Show first item as featured
  const featured = CATALOG[0];
  area.innerHTML = `
    <div class="hero-badge"><span class="badge-icon">◆</span> ${featured.type === 'serie' ? 'SÉRIE' : 'FILM'} · ${featured.audio}</div>
    <h1 class="hero-title">${featured.title}</h1>
    <div class="hero-meta">
      ${featured.rating ? `<span class="rating">⭐ ${featured.rating}</span>` : ''}
      <span class="year">${featured.year}</span>
      ${featured.quality ? `<span class="tag">${featured.quality}</span>` : ''}
      ${featured.duration ? `<span class="duration">${featured.duration}</span>` : ''}
    </div>
    <p class="hero-desc">${featured.description}</p>
    <div class="hero-actions">
      <button class="btn-play" onclick="openModal('${featured.id}')">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        Regarder
      </button>
      <button class="btn-add" onclick="toggleWatchlist('${featured.id}',this)" id="hero-wl-btn" title="Ma liste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${watchlist.has(featured.id)
            ? '<polyline points="20 6 9 17 4 12"/>'
            : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
        </svg>
      </button>
    </div>`;
}

// ── ROWS ──────────────────────────────────────────────────────────────────────
function renderRows() {
  const trending = CATALOG.filter(c => c.rows?.includes('trending'));
  const recent = [...CATALOG].reverse().slice(0, 12);

  renderRow('trending-track', trending);
  renderRow('recent-track', recent);

  // Hide empty rows
  document.getElementById('row-trending').style.display = trending.length ? '' : 'none';
  document.getElementById('row-recent').style.display = recent.length ? '' : 'none';

  // Grids
  renderGrid('movies-grid', CATALOG.filter(c => c.type === 'film' || c.type === 'court-metrage' || c.type === 'documentaire'));
  renderGrid('series-grid', CATALOG.filter(c => c.type === 'serie'));
}

function renderRow(trackId, items) {
  const track = document.getElementById(trackId);
  if (!track) return;
  track.innerHTML = '';
  items.forEach((item, i) => track.appendChild(makeCard(item, i)));
}

function renderGrid(gridId, items) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🎬</div><p>Aucun contenu disponible</p></div>`;
    return;
  }
  items.forEach((item, i) => grid.appendChild(makeCard(item, i)));
}

// ── CARD ──────────────────────────────────────────────────────────────────────
function makeCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.dataset.id = item.id;
  const inList = watchlist.has(item.id);
  const colors = PALETTE[idx % PALETTE.length];

  card.innerHTML = `
    <div class="card-thumb" style="background:linear-gradient(160deg,${colors[0]} 0%,${colors[1]} 55%,#000 100%)">
      <div class="card-art">${posterArt(idx)}</div>
      <div class="card-gradient-overlay"></div>
    </div>
    <div class="card-badge-top">
      <span class="audio-badge">${item.audio || 'VO'}</span>
      ${item.quality ? `<span class="quality-badge">${item.quality}</span>` : ''}
    </div>
    ${item.rating ? `<div class="card-rating">⭐ ${item.rating}</div>` : ''}
    <div class="card-info">
      <div class="card-title">${item.title}</div>
      <div class="card-genre">${item.genre} · ${item.year}</div>
    </div>
    <div class="card-hover-overlay">
      <div class="card-hover-actions">
        <button class="play-circle" onclick="event.stopPropagation();openModal('${item.id}')">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
        <button class="add-circle ${inList ? 'in-list' : ''}" onclick="event.stopPropagation();toggleWatchlist('${item.id}',this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${inList ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
          </svg>
        </button>
      </div>
      <div class="card-hover-info">
        <div class="card-hover-title">${item.title}</div>
        <div class="card-hover-meta">
          ${item.rating ? `<span>⭐ ${item.rating}</span>` : ''}
          ${item.duration ? `<span>${item.duration}</span>` : ''}
        </div>
        <div class="card-hover-genre">${item.genre} · <span style="color:var(--cyan)">${item.audio}</span></div>
      </div>
    </div>`;
  card.addEventListener('click', () => openModal(item.id));
  return card;
}

const PALETTE = [
  ['#0a0020','#1a0040'],['#200005','#400010'],['#000a20','#001540'],
  ['#050015','#0a0030'],['#001a10','#003020'],['#200000','#3a0808'],
  ['#000520','#00093a'],['#1a0005','#300010'],['#0a1000','#152000'],
  ['#050020','#0a003a'],['#200a00','#3a1500'],['#00101a','#001a2d'],
];

function posterArt(idx) {
  const h = [220,280,340,160,200,260,30,180,310,120,240,300][idx % 12];
  const arts = [
    `<circle cx="60" cy="60" r="38" fill="none" stroke="hsla(${h},100%,70%,0.3)" stroke-width="1.5"/>
     <circle cx="60" cy="60" r="20" fill="hsla(${h},100%,60%,0.12)"/>
     <line x1="22" y1="60" x2="98" y2="60" stroke="hsla(${h},100%,70%,0.2)" stroke-width="1"/>
     <line x1="60" y1="22" x2="60" y2="98" stroke="hsla(${h},100%,70%,0.2)" stroke-width="1"/>`,
    `<polygon points="60,18 98,85 22,85" fill="none" stroke="hsla(${h},100%,70%,0.35)" stroke-width="1.5"/>
     <polygon points="60,36 82,78 38,78" fill="hsla(${h},100%,60%,0.1)"/>`,
    `<rect x="22" y="22" width="76" height="76" fill="none" stroke="hsla(${h},100%,70%,0.28)" stroke-width="1.5" rx="4" transform="rotate(45 60 60)"/>`,
    `<path d="M20,60 Q40,20 60,60 Q80,100 100,60" fill="none" stroke="hsla(${h},100%,70%,0.45)" stroke-width="2"/>
     <path d="M20,60 Q40,100 60,60 Q80,20 100,60" fill="none" stroke="hsla(${h+60},100%,70%,0.25)" stroke-width="1.5"/>`,
    `<circle cx="60" cy="60" r="34" fill="none" stroke="hsla(${h},100%,70%,0.18)" stroke-dasharray="6 4" stroke-width="1"/>
     <circle cx="60" cy="60" r="18" fill="hsla(${h},100%,60%,0.18)"/>
     <circle cx="60" cy="60" r="6" fill="hsla(${h},100%,80%,0.4)"/>`,
  ];
  return `<svg viewBox="0 0 120 120" fill="none">${arts[idx % arts.length]}</svg>`;
}

// ── WATCHLIST ─────────────────────────────────────────────────────────────────
async function toggleWatchlist(id, btn) {
  try {
    const res = await fetch(`/api/watchlist/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.inList) { watchlist.add(id); showToast('Ajouté à ma liste ✓'); }
    else { watchlist.delete(id); showToast('Retiré de ma liste'); }
    // Update all add buttons for this id
    document.querySelectorAll('.media-card').forEach(card => {
      if (card.dataset.id === id) {
        const b = card.querySelector('.add-circle');
        if (b) {
          b.classList.toggle('in-list', data.inList);
          b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            ${data.inList ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
          </svg>`;
        }
      }
    });
    // Update hero btn
    const hBtn = document.getElementById('hero-wl-btn');
    if (hBtn && CATALOG[0]?.id === id) {
      hBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${data.inList ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
      </svg>`;
    }
    const mBtn = document.getElementById('modal-watchlist-btn');
    if (currentModalId === id && mBtn) mBtn.textContent = data.inList ? '✓ Dans ma liste' : '+ Ma liste';
    if (!document.getElementById('section-mylist').classList.contains('hidden')) renderMyList();
  } catch { showToast('Erreur', true); }
}

function toggleWatchlistModal() { if (currentModalId) toggleWatchlist(currentModalId, null); }

// ── MY LIST ───────────────────────────────────────────────────────────────────
async function renderMyList() {
  const res = await fetch('/api/watchlist');
  const data = await res.json();
  watchlist = new Set(data.watchlist || []);
  const items = CATALOG.filter(c => watchlist.has(c.id));
  const grid = document.getElementById('mylist-grid');
  const empty = document.getElementById('mylist-empty');
  grid.innerHTML = '';
  if (!items.length) { empty.classList.remove('hidden'); }
  else { empty.classList.add('hidden'); items.forEach((c, i) => grid.appendChild(makeCard(c, i))); }
}

// ── SECTIONS ──────────────────────────────────────────────────────────────────
function showSection(name, linkEl) {
  ['home','movies','series','mylist','admin'].forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.classList.add('hidden');
  });
  document.getElementById('search-overlay').classList.add('hidden');
  const target = document.getElementById(`section-${name}`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');
  if (name === 'mylist') renderMyList();
  if (name === 'admin') loadAdminData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
async function loadAdminData() {
  // Stats
  document.getElementById('stat-content').textContent = CATALOG.length;
  document.getElementById('stat-films').textContent = CATALOG.filter(c => c.type === 'film' || c.type === 'documentaire' || c.type === 'court-metrage').length;
  document.getElementById('stat-series').textContent = CATALOG.filter(c => c.type === 'serie').length;

  // Users
  try {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    document.getElementById('stat-users').textContent = data.total;
    const wrap = document.getElementById('admin-users-table');
    if (!data.users.length) {
      wrap.innerHTML = '<p style="color:var(--text-dim);padding:16px">Aucun utilisateur inscrit.</p>';
    } else {
      wrap.innerHTML = `<table class="admin-table">
        <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Inscription</th></tr></thead>
        <tbody>${data.users.map(u => `
          <tr>
            <td><div class="user-cell"><div class="user-av">${(u.avatar || u.name[0]).toUpperCase()}</div>${u.name}</div></td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${u.role}</span></td>
            <td>${new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    }
  } catch (e) { console.error(e); }

  // Content list
  renderAdminContentList();
}

function renderAdminContentList() {
  const wrap = document.getElementById('admin-content-list');
  if (!CATALOG.length) {
    wrap.innerHTML = '<p style="color:var(--text-dim);padding:16px">Aucun contenu ajouté.</p>';
    return;
  }
  wrap.innerHTML = `<table class="admin-table">
    <thead><tr><th>Titre</th><th>Type</th><th>Genre</th><th>Année</th><th>Audio</th><th>Qualité</th><th>Action</th></tr></thead>
    <tbody>${CATALOG.map(c => `
      <tr>
        <td><strong style="color:#fff">${c.title}</strong></td>
        <td>${c.type}</td>
        <td>${c.genre}</td>
        <td>${c.year}</td>
        <td><span class="audio-tag">${c.audio}</span></td>
        <td>${c.quality || '—'}</td>
        <td><button class="btn-delete" onclick="deleteContent('${c.id}')">Supprimer</button></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function submitAddContent(e) {
  e.preventDefault();
  const errDiv = document.getElementById('form-error');
  const btn = document.getElementById('form-submit-btn');
  const btnText = document.getElementById('form-btn-text');
  const spinner = document.getElementById('form-spinner');
  errDiv.classList.add('hidden');

  const rows = [...document.querySelectorAll('input[name="rows"]:checked')].map(i => i.value);

  const payload = {
    title:       document.getElementById('f-title').value.trim(),
    genre:       document.getElementById('f-genre').value.trim(),
    type:        document.getElementById('f-type').value,
    duration:    document.getElementById('f-duration').value.trim(),
    year:        parseInt(document.getElementById('f-year').value),
    rating:      parseFloat(document.getElementById('f-rating').value) || null,
    audio:       document.getElementById('f-audio').value,
    quality:     document.getElementById('f-quality').value,
    description: document.getElementById('f-desc').value.trim(),
    rows,
  };

  if (!payload.title || !payload.genre || !payload.type || !payload.audio) {
    errDiv.textContent = 'Veuillez remplir tous les champs obligatoires.';
    errDiv.classList.remove('hidden');
    return;
  }

  btn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'block';

  try {
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    CATALOG = data.catalog;
    showToast(`"${payload.title}" ajouté ✓`);
    resetForm();
    renderRows();
    renderHero();
    renderAdminContentList();
    // Update stats
    document.getElementById('stat-content').textContent = CATALOG.length;
    document.getElementById('stat-films').textContent = CATALOG.filter(c => c.type === 'film' || c.type === 'documentaire' || c.type === 'court-metrage').length;
    document.getElementById('stat-series').textContent = CATALOG.filter(c => c.type === 'serie').length;
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false; btnText.style.display = 'block'; spinner.style.display = 'none';
  }
}

async function deleteContent(id) {
  if (!confirm('Supprimer ce contenu ?')) return;
  try {
    const res = await fetch(`/api/admin/content/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    CATALOG = data.catalog;
    showToast('Contenu supprimé');
    renderRows();
    renderHero();
    renderAdminContentList();
    document.getElementById('stat-content').textContent = CATALOG.length;
    document.getElementById('stat-films').textContent = CATALOG.filter(c => c.type === 'film' || c.type === 'documentaire' || c.type === 'court-metrage').length;
    document.getElementById('stat-series').textContent = CATALOG.filter(c => c.type === 'serie').length;
  } catch (err) { showToast(err.message, true); }
}

function resetForm() {
  document.getElementById('add-content-form').reset();
  document.getElementById('form-error').classList.add('hidden');
}

function updateDurationPlaceholder() {
  const type = document.getElementById('f-type').value;
  const input = document.getElementById('f-duration');
  input.placeholder = type === 'serie' ? 'ex : 6 épisodes' : 'ex : 1h 52m';
}

// ── SEARCH ─────────────────────────────────────────────────────────────────────
let searchTimeout = null;
function toggleSearch() {
  const wrap = document.getElementById('search-wrap');
  const isOpen = wrap.classList.contains('search-open');
  if (isOpen) {
    wrap.classList.remove('search-open');
    document.getElementById('search-input').value = '';
    document.getElementById('search-overlay').classList.add('hidden');
    document.getElementById('section-home').classList.remove('hidden');
  } else {
    wrap.classList.add('search-open');
    setTimeout(() => document.getElementById('search-input').focus(), 100);
  }
}

function doSearch(q) {
  clearTimeout(searchTimeout);
  q = q.trim();
  if (!q) {
    document.getElementById('search-overlay').classList.add('hidden');
    document.getElementById('section-home').classList.remove('hidden');
    return;
  }
  searchTimeout = setTimeout(() => {
    ['home','movies','series','mylist','admin'].forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.classList.add('hidden');
    });
    const overlay = document.getElementById('search-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('search-query-label').textContent = `"${q}"`;

    const ql = q.toLowerCase();
    const results = CATALOG.filter(c =>
      c.title.toLowerCase().includes(ql) ||
      c.genre.toLowerCase().includes(ql) ||
      c.description.toLowerCase().includes(ql) ||
      c.audio?.toLowerCase().includes(ql) ||
      c.type?.toLowerCase().includes(ql)
    );

    document.getElementById('search-count').textContent =
      results.length ? ` — ${results.length} résultat${results.length > 1 ? 's' : ''}` : '';

    const track = document.getElementById('search-results-track');
    const empty = document.getElementById('search-empty');
    track.innerHTML = '';
    if (!results.length) { empty.classList.remove('hidden'); }
    else { empty.classList.add('hidden'); results.forEach((c, i) => track.appendChild(makeCard(c, i))); }
  }, 200);
}

// ── HERO CANVAS ───────────────────────────────────────────────────────────────
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
  resize();
  window.addEventListener('resize', resize);
  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random(), y: Math.random(),
    size: 0.4 + Math.random() * 2.8,
    vx: (Math.random() - 0.5) * 0.00015,
    vy: (Math.random() - 0.5) * 0.00015,
    opacity: Math.random() * 0.6,
    color: ['#00d4ff','#bf40ff','#ff2d78','#7b2fff'][Math.floor(Math.random() * 4)],
    tw: Math.random() * Math.PI * 2,
  }));
  const orbs = [
    { x: 0.72, y: 0.32, r: 0.24, c: 'rgba(123,47,255,0.22)' },
    { x: 0.88, y: 0.62, r: 0.16, c: 'rgba(0,212,255,0.14)' },
  ];
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    orbs.forEach(o => {
      const grd = ctx.createRadialGradient(o.x*canvas.width, o.y*canvas.height, 0, o.x*canvas.width, o.y*canvas.height, o.r*canvas.width);
      grd.addColorStop(0, o.c); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(o.x*canvas.width, o.y*canvas.height, o.r*canvas.width, 0, Math.PI*2); ctx.fill();
    });
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
      p.tw += 0.018;
      ctx.globalAlpha = p.opacity * (0.4 + 0.6 * Math.sin(p.tw));
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x*canvas.width, p.y*canvas.height, p.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }
  draw();
}

// ── NAVBAR ─────────────────────────────────────────────────────────────────────
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 60); }, { passive: true });
}

function scrollRow(trackId, dir) {
  const t = document.getElementById(trackId);
  if (t) t.scrollBy({ left: dir * 450, behavior: 'smooth' });
}

function toggleAvatarMenu() { document.getElementById('avatar-menu').classList.toggle('open'); }
function closeAvatarMenu() { document.getElementById('avatar-menu').classList.remove('open'); }
document.addEventListener('click', e => {
  if (!document.getElementById('avatar-wrap')?.contains(e.target)) closeAvatarMenu();
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ── MODAL ──────────────────────────────────────────────────────────────────────
function openModal(id) {
  const item = CATALOG.find(c => c.id === id);
  if (!item) return;
  currentModalId = id;
  document.getElementById('modal-title-text').textContent = item.title;
  document.getElementById('modal-playing-title').textContent = item.title;
  document.getElementById('modal-desc-text').textContent = item.description;
  document.getElementById('total-time').textContent = item.duration || '—';
  const tags = document.getElementById('modal-tags');
  tags.innerHTML = [
    item.quality ? `<span class="tag-badge">${item.quality}</span>` : '',
    `<span class="tag-badge">${item.audio}</span>`,
    item.rating ? `<span class="rating-badge">⭐ ${item.rating}</span>` : '',
    item.year ? `<span class="tag-badge">${item.year}</span>` : '',
  ].join('');
  document.getElementById('modal-watchlist-btn').textContent = watchlist.has(id) ? '✓ Dans ma liste' : '+ Ma liste';
  document.getElementById('video-modal').classList.remove('modal-hidden');
  document.body.style.overflow = 'hidden';

  // Restore saved progress if any
  const resume = loadResume();
  if (resume && resume.id === id && resume.progressPct > 1 && resume.progressPct < 98) {
    progressPct = resume.progressPct;
    showToast(`▶ Reprise à ${Math.round(progressPct)}%`);
  } else {
    progressPct = 0;
  }

  setTimeout(() => { startPlayerCanvas(); startProgressTimer(item.duration); }, 100);
}

function closeModal() {
  saveProgress(); // persist before closing
  document.getElementById('video-modal').classList.add('modal-hidden');
  document.body.style.overflow = '';
  isPlaying = false;
  if (playerRaf) cancelAnimationFrame(playerRaf);
  if (progressInterval) clearInterval(progressInterval);
  playerRaf = null; progressInterval = null; currentModalId = null;
  renderResumeRow(); // refresh the "Continue watching" row
}

// ── PLAYER CANVAS ─────────────────────────────────────────────────────────────
function startPlayerCanvas() {
  const canvas = document.getElementById('player-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 860;
  canvas.height = canvas.offsetHeight || 484;
  const lines = Array.from({ length: 45 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    len: 30 + Math.random() * 100,
    speed: 1.5 + Math.random() * 5,
    color: ['#00d4ff','#bf40ff','#ff2d78'][Math.floor(Math.random() * 3)],
    op: 0.2 + Math.random() * 0.5, w: 0.5 + Math.random() * 2,
  }));
  isPlaying = true;
  document.getElementById('play-icon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

  function draw(ts) {
    if (!isPlaying) return;
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#000010'); bg.addColorStop(1, '#0a0020');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(191,64,255,0.06)'; ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    lines.forEach(l => {
      l.y += l.speed;
      if (l.y > canvas.height + l.len) { l.y = -l.len; l.x = Math.random() * canvas.width; }
      const grd = ctx.createLinearGradient(l.x, l.y, l.x, l.y + l.len);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, l.color + Math.floor(l.op * 255).toString(16).padStart(2, '0'));
      grd.addColorStop(1, 'transparent');
      ctx.strokeStyle = grd; ctx.lineWidth = l.w;
      ctx.shadowBlur = 10; ctx.shadowColor = l.color;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + l.len); ctx.stroke();
    });
    ctx.shadowBlur = 0;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const pulse = 0.85 + 0.15 * Math.sin(ts * 0.0015);
    const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140 * pulse);
    orb.addColorStop(0, 'rgba(191,64,255,0.28)'); orb.addColorStop(0.5, 'rgba(0,212,255,0.08)'); orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px "Rajdhani",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('APPINOX', cx, canvas.height - 18);
    ctx.globalAlpha = 1;
    playerRaf = requestAnimationFrame(draw);
  }
  if (playerRaf) cancelAnimationFrame(playerRaf);
  playerRaf = requestAnimationFrame(draw);
}

function togglePlay() {
  const icon = document.getElementById('play-icon');
  if (isPlaying) {
    isPlaying = false;
    if (playerRaf) cancelAnimationFrame(playerRaf);
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
  } else {
    startPlayerCanvas();
  }
}

function restartPlayer() {
  progressPct = 0;
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-thumb').style.left = '0%';
  document.getElementById('current-time').textContent = '0:00';
}

function seekTo(e, bar) {
  const rect = bar.getBoundingClientRect();
  progressPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  document.getElementById('progress-fill').style.width = progressPct + '%';
  document.getElementById('progress-thumb').style.left = progressPct + '%';
}

function toggleMute() {
  isMuted = !isMuted;
  document.getElementById('vol-icon').innerHTML = isMuted
    ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`
    : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
}

function setVolume(v) { isMuted = v == 0; }

function toggleFullscreen() {
  const el = document.querySelector('.modal-player');
  if (!document.fullscreenElement) el.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function startProgressTimer(duration) {
  if (progressInterval) clearInterval(progressInterval);
  const totalSec = parseDuration(duration);
  let saveTick = 0;
  // Apply any restored progress to the UI immediately
  const fillEl = document.getElementById('progress-fill');
  const thumbEl = document.getElementById('progress-thumb');
  const ctEl = document.getElementById('current-time');
  if (fillEl) fillEl.style.width = progressPct + '%';
  if (thumbEl) thumbEl.style.left = progressPct + '%';
  if (ctEl) ctEl.textContent = formatTime(Math.floor((progressPct / 100) * totalSec));

  progressInterval = setInterval(() => {
    if (!isPlaying) return;
    progressPct += (100 / totalSec) * 0.25;
    if (progressPct >= 100) { progressPct = 0; clearResume(currentModalId); }
    const fill = document.getElementById('progress-fill');
    const thumb = document.getElementById('progress-thumb');
    const ct = document.getElementById('current-time');
    if (fill) fill.style.width = progressPct + '%';
    if (thumb) thumb.style.left = progressPct + '%';
    if (ct) ct.textContent = formatTime(Math.floor((progressPct / 100) * totalSec));
    // Save to localStorage every ~5 seconds (20 ticks × 250ms)
    if (++saveTick % 20 === 0) saveProgress();
  }, 250);
}

function parseDuration(str) {
  if (!str) return 5400;
  const hm = str.match(/(\d+)h\s*(\d+)m/);
  if (hm) return parseInt(hm[1]) * 3600 + parseInt(hm[2]) * 60;
  const m = str.match(/(\d+)m/); if (m) return parseInt(m[1]) * 60;
  const ep = str.match(/(\d+)\s*épisode/); if (ep) return parseInt(ep[1]) * 2400;
  return 5400;
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ── SHARE ─────────────────────────────────────────────────────────────────────
function shareContent() {
  const item = CATALOG.find(c => c.id === currentModalId);
  if (!item) return;
  if (navigator.share) navigator.share({ title: item.title, text: item.description, url: location.href });
  else navigator.clipboard.writeText(location.href).then(() => showToast('Lien copié ✓'));
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' toast-error' : '');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('video-modal').classList.contains('modal-hidden')) closeModal();
    else if (document.getElementById('search-wrap').classList.contains('search-open')) toggleSearch();
  }
  if (e.key === ' ' && !document.getElementById('video-modal').classList.contains('modal-hidden')) {
    e.preventDefault(); togglePlay();
  }
});

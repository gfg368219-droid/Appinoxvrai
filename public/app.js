/* ═══════════════════════════════════════════════════════════
   APPINOX — APPLICATION SCRIPT
═══════════════════════════════════════════════════════════ */
'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let CATALOG = [];
let currentUser = null;
let watchlist = new Set();
let currentModalId = null;
let currentModalTab = 'trailer';
let isPlaying = false;
let playerRaf = null;
let progressInterval = null;
let progressPct = 0;
let isMuted = false;

// TMDB selected result
let tmdbSelected = null;
let tmdbDetail   = null;

// Background upload state (persists across section navigation)
const bgUpload = { active: false, pct: 0, filename: null, videoUrl: null, xhr: null };
// Poster upload state
const bgPoster = { active: false, url: null };

// ── Persistent Playback ───────────────────────────────────────────────────────
const RESUME_KEY = 'appinox_resume';
function saveProgress() {
  if (!currentModalId) return;
  const item = CATALOG.find(c => c.id === currentModalId);
  if (!item) return;
  const videoEl = document.getElementById('player-video');
  const state = { id: currentModalId, title: item.title, savedAt: Date.now() };
  if (item.videoUrl && videoEl && videoEl.currentTime > 3 && isFinite(videoEl.duration)) {
    state.currentTime = videoEl.currentTime;
    state.duration    = videoEl.duration;
  } else if (!item.videoUrl && progressPct > 1) {
    state.progressPct = progressPct;
  } else { return; }
  try { localStorage.setItem(RESUME_KEY, JSON.stringify(state)); } catch {}
}
function loadResume()     { try { return JSON.parse(localStorage.getItem(RESUME_KEY)); } catch { return null; } }
function clearResume(id)  { const s = loadResume(); if (!id || s?.id === id) localStorage.removeItem(RESUME_KEY); }

document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
window.addEventListener('beforeunload', saveProgress);

// ── Boot ──────────────────────────────────────────────────────────────────────
(function boot() { runIntro(); })();

// ── INTRO SOUND (Web Audio API, aucun fichier externe) ───────────────────────
function playIntroSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();

    function gain(val, when) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(val, when ?? ctx.currentTime);
      return g;
    }

    // ── 1. Rumble grave (dès le départ) ──────────────────────────────────────
    const rumbleOsc = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(40, ctx.currentTime);
    rumbleOsc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 3);
    rumbleGain.gain.setValueAtTime(0, ctx.currentTime);
    rumbleGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.3);
    rumbleGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 3.5);
    rumbleGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 4.5);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;
    rumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumbleOsc.start(ctx.currentTime);
    rumbleOsc.stop(ctx.currentTime + 4.6);

    // ── 2. Impact + sweep montant quand le logo apparaît (t=0.5s) ────────────
    const t1 = ctx.currentTime + 0.5;

    // Impact grave
    const impactOsc = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impactOsc.type = 'sine';
    impactOsc.frequency.setValueAtTime(90, t1);
    impactOsc.frequency.exponentialRampToValueAtTime(30, t1 + 0.8);
    impactGain.gain.setValueAtTime(0.6, t1);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t1 + 1.0);
    impactOsc.connect(impactGain);
    impactGain.connect(ctx.destination);
    impactOsc.start(t1);
    impactOsc.stop(t1 + 1.0);

    // Sweep montant (whoosh)
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    const sweepFilter = ctx.createBiquadFilter();
    sweepOsc.type = 'sawtooth';
    sweepOsc.frequency.setValueAtTime(200, t1);
    sweepOsc.frequency.exponentialRampToValueAtTime(1800, t1 + 0.7);
    sweepFilter.type = 'bandpass';
    sweepFilter.frequency.setValueAtTime(400, t1);
    sweepFilter.frequency.exponentialRampToValueAtTime(2000, t1 + 0.7);
    sweepFilter.Q.value = 3;
    sweepGain.gain.setValueAtTime(0, t1);
    sweepGain.gain.linearRampToValueAtTime(0.18, t1 + 0.15);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, t1 + 0.75);
    sweepOsc.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(t1);
    sweepOsc.stop(t1 + 0.8);

    // Bruit blanc pour le "air"
    const bufSize = ctx.sampleRate * 1.0;
    const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) nd[i] = (Math.random() * 2 - 1);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(600, t1);
    noiseFilter.frequency.exponentialRampToValueAtTime(4000, t1 + 0.6);
    noiseFilter.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, t1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t1 + 0.9);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(t1);
    noiseSource.stop(t1 + 1.0);

    // ── 3. Scintillement quand les lettres apparaissent (t=1.2s) ─────────────
    const t2 = ctx.currentTime + 1.2;
    const shimmerFreqs = [1046, 1318, 1568, 2093, 2637];
    shimmerFreqs.forEach((freq, i) => {
      const delay = i * 0.07;
      const sOsc = ctx.createOscillator();
      const sGain = ctx.createGain();
      sOsc.type = 'sine';
      sOsc.frequency.value = freq;
      sGain.gain.setValueAtTime(0, t2 + delay);
      sGain.gain.linearRampToValueAtTime(0.06, t2 + delay + 0.04);
      sGain.gain.exponentialRampToValueAtTime(0.001, t2 + delay + 0.35);
      sOsc.connect(sGain);
      sGain.connect(ctx.destination);
      sOsc.start(t2 + delay);
      sOsc.stop(t2 + delay + 0.4);
    });

    // ── 4. Accélération (burst à t=1.5s) ─────────────────────────────────────
    const t3 = ctx.currentTime + 1.5;
    const burstOsc = ctx.createOscillator();
    const burstGain = ctx.createGain();
    burstOsc.type = 'sawtooth';
    burstOsc.frequency.setValueAtTime(60, t3);
    burstOsc.frequency.exponentialRampToValueAtTime(400, t3 + 0.4);
    burstGain.gain.setValueAtTime(0, t3);
    burstGain.gain.linearRampToValueAtTime(0.22, t3 + 0.05);
    burstGain.gain.exponentialRampToValueAtTime(0.001, t3 + 0.5);
    const burstFilter = ctx.createBiquadFilter();
    burstFilter.type = 'lowpass';
    burstFilter.frequency.setValueAtTime(300, t3);
    burstFilter.frequency.exponentialRampToValueAtTime(3000, t3 + 0.4);
    burstOsc.connect(burstFilter);
    burstFilter.connect(burstGain);
    burstGain.connect(ctx.destination);
    burstOsc.start(t3);
    burstOsc.stop(t3 + 0.6);

    // ── 5. Note finale grave (fin du chargement ~t=3.8s) ─────────────────────
    const t4 = ctx.currentTime + 3.8;
    const endOsc = ctx.createOscillator();
    const endGain = ctx.createGain();
    endOsc.type = 'sine';
    endOsc.frequency.setValueAtTime(130, t4);
    endOsc.frequency.exponentialRampToValueAtTime(65, t4 + 0.6);
    endGain.gain.setValueAtTime(0.3, t4);
    endGain.gain.exponentialRampToValueAtTime(0.001, t4 + 0.8);
    endOsc.connect(endGain);
    endGain.connect(ctx.destination);
    endOsc.start(t4);
    endOsc.stop(t4 + 1.0);

  } catch(e) { /* audio non dispo, on passe */ }
}

// ── INTRO ─────────────────────────────────────────────────────────────────────
function runIntro() {
  playIntroSound();
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
    delay: Math.random() * 60, born: false,
  }));

  document.querySelectorAll('#intro-wordmark span').forEach((el, i) => {
    el.style.opacity = '0'; el.style.transform = 'translateY(30px)';
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
      ctx.strokeStyle = grd; ctx.lineWidth = burstAt ? s.width * 2.5 : s.width;
      ctx.shadowBlur = burstAt ? 25 : 8; ctx.shadowColor = s.color;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.length); ctx.stroke();
    });
    ctx.shadowBlur = 0;
    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  setTimeout(() => {
    const intro = document.getElementById('intro-screen');
    const app   = document.getElementById('main-app');
    intro.style.transition = 'opacity 0.9s ease';
    intro.style.opacity = '0';
    setTimeout(() => {
      cancelAnimationFrame(rafId);
      intro.style.display = 'none';
      app.classList.remove('hidden');
      app.style.opacity = '0'; app.style.transition = 'opacity 0.6s ease';
      requestAnimationFrame(() => { app.style.opacity = '1'; });
      initApp();
    }, 900);
  }, 4600);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function initApp() {
  try {
    const [meRes, catRes, wlRes] = await Promise.all([
      fetch('/api/me'), fetch('/api/catalog'), fetch('/api/watchlist'),
    ]);
    currentUser = await meRes.json();
    CATALOG = await catRes.json();
    const wlData = await wlRes.json();
    watchlist = new Set(wlData.watchlist || []);

    const letter = currentUser.avatar || currentUser.name?.[0]?.toUpperCase() || 'U';
    document.getElementById('avatar-letter').textContent    = letter;
    document.getElementById('menu-avatar-big').textContent  = letter;
    document.getElementById('menu-name').textContent        = currentUser.name;
    document.getElementById('menu-email').textContent       = currentUser.email;
    if (currentUser.role === 'admin') {
      document.getElementById('menu-role').textContent    = 'Administrateur';
      document.getElementById('menu-role').style.color   = '#bf40ff';
      document.getElementById('admin-btn').style.display = 'flex';
    }

    // Hide "Mon Code Secret" menu item for admin
    const codeBtn = document.getElementById('code-btn');
    if (codeBtn) codeBtn.style.display = currentUser.role === 'admin' ? 'none' : 'flex';

    // First login: prompt user to create their secret code
    if (currentUser.firstLogin && currentUser.role !== 'admin') {
      setTimeout(() => showSetCodeModal(), 600);
    }

    renderHero();
    renderRows();
    renderResumeRow();
    initHeroCanvas();
    initNavbarScroll();
  } catch (e) { console.error('initApp error:', e); }
}

// ── RESUME ROW ────────────────────────────────────────────────────────────────
function renderResumeRow() {
  const resume = loadResume();
  const rowEl  = document.getElementById('row-resume');
  const wrapEl = document.getElementById('resume-card-wrap');
  if (!rowEl || !wrapEl) return;
  if (!resume) { rowEl.style.display = 'none'; return; }
  const item = CATALOG.find(c => c.id === resume.id);
  if (!item) { rowEl.style.display = 'none'; return; }
  rowEl.style.display = '';

  let pct = 0, timeLabel = '';
  if (resume.currentTime && resume.duration) {
    pct = Math.round((resume.currentTime / resume.duration) * 100);
    timeLabel = formatTime(Math.round(resume.currentTime)) + ' / ' + formatTime(Math.round(resume.duration));
  } else if (resume.progressPct) {
    pct = Math.round(resume.progressPct); timeLabel = pct + '%';
  }

  const posterStyle = item.posterUrl
    ? `background:url('${item.posterUrl}') center/cover no-repeat;`
    : 'background:linear-gradient(135deg,#0a0030,#1a0060);';

  wrapEl.innerHTML = `
    <div onclick="openModal('${item.id}')" style="cursor:pointer;display:flex;align-items:center;gap:18px;
      background:rgba(255,255,255,0.04);border:1px solid rgba(191,64,255,0.18);border-radius:14px;
      padding:14px 18px;max-width:500px;transition:background 0.2s"
      onmouseenter="this.style.background='rgba(255,255,255,0.07)'"
      onmouseleave="this.style.background='rgba(255,255,255,0.04)'">
      <div style="width:54px;height:54px;border-radius:10px;${posterStyle}
        display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,212,255,0.2);overflow:hidden">
        ${!item.posterUrl ? '<svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;color:#00d4ff"><polygon points="5,3 19,12 5,21"/></svg>' : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:3px">${item.genre} · ${item.year} · <span style="color:var(--cyan)">${item.audio}</span></div>
        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:3px;margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#00d4ff,#bf40ff);border-radius:3px"></div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--purple);font-weight:600;flex-shrink:0;text-align:right">${timeLabel}</div>
    </div>`;
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function renderHero() {
  const area = document.getElementById('hero-content-area');
  const posterBg = document.getElementById('hero-poster-bg');
  if (!CATALOG.length) {
    if (posterBg) posterBg.style.backgroundImage = '';
    area.innerHTML = `
      <div class="hero-welcome">
        <div class="hero-badge"><span class="badge-icon">◆</span> BIENVENUE</div>
        <h1 class="hero-title">APPINOX</h1>
        <p class="hero-desc">Bienvenue sur APPINOX. Les contenus seront ajoutés par les administrateurs.</p>
      </div>`;
    return;
  }
  const featured = CATALOG[0];
  if (posterBg && featured.posterUrl) {
    posterBg.style.backgroundImage = `url('${featured.posterUrl}')`;
    posterBg.style.opacity = '0.35';
  } else if (posterBg) {
    posterBg.style.backgroundImage = '';
    posterBg.style.opacity = '0';
  }

  const communityRating = featured.communityRating;
  area.innerHTML = `
    <div class="hero-badge"><span class="badge-icon">◆</span> ${featured.type === 'serie' ? 'SÉRIE' : 'FILM'} · ${featured.audio}</div>
    <h1 class="hero-title">${featured.title}</h1>
    <div class="hero-meta">
      ${communityRating ? `<span class="rating">${renderStarsSmall(communityRating.avg)} ${communityRating.avg}/5 <span style="color:var(--text-dim);font-size:11px">(${communityRating.count})</span></span>` : ''}
      <span class="year">${featured.year}</span>
      ${featured.quality ? `<span class="tag">${featured.quality}</span>` : ''}
      ${featured.duration ? `<span class="duration">${featured.duration}</span>` : ''}
    </div>
    <p class="hero-desc">${featured.description}</p>
    <div class="hero-actions">
      <button class="btn-play" onclick="openModal('${featured.id}')">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:17px;height:17px"><polygon points="5,3 19,12 5,21"/></svg>
        ${featured.trailerUrl ? 'Bande-annonce' : 'Regarder'}
      </button>
      <button class="btn-add" onclick="toggleWatchlist('${featured.id}',this)" id="hero-wl-btn" title="Ma liste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${watchlist.has(featured.id) ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
        </svg>
      </button>
    </div>`;
}

function renderStarsSmall(avg) {
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += `<span style="color:${i <= Math.round(avg) ? '#ffd700' : 'rgba(255,215,0,0.25)'}">★</span>`;
  }
  return s;
}

// ── ROWS ──────────────────────────────────────────────────────────────────────
function renderRows() {
  // Trending = manual checkbox OR top community-rated (avg >= 3.5, at least 1 vote)
  const manualTrending = CATALOG.filter(c => c.rows?.includes('trending'));
  const ratedTrending  = CATALOG.filter(c =>
    c.communityRating && c.communityRating.avg >= 3.5 && !manualTrending.find(m => m.id === c.id)
  ).sort((a, b) => (b.communityRating.avg - a.communityRating.avg));
  const trending = [...manualTrending, ...ratedTrending].slice(0, 20);

  const recent = [...CATALOG].reverse().slice(0, 12);

  renderRow('trending-track', trending);
  renderRow('recent-track', recent);

  document.getElementById('row-trending').style.display = trending.length ? '' : 'none';
  document.getElementById('row-recent').style.display   = recent.length  ? '' : 'none';

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
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-svg"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg><p>Aucun contenu disponible</p></div>`;
    return;
  }
  items.forEach((item, i) => grid.appendChild(makeCard(item, i)));
}

// ── CARD ──────────────────────────────────────────────────────────────────────
const PALETTE = [
  ['#0a0020','#1a0040'],['#200005','#400010'],['#000a20','#001540'],
  ['#050015','#0a0030'],['#001a10','#003020'],['#200000','#3a0808'],
  ['#000520','#00093a'],['#1a0005','#300010'],['#0a1000','#152000'],
  ['#050020','#0a003a'],['#200a00','#3a1500'],['#00101a','#001a2d'],
];

function makeCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.dataset.id = item.id;
  const inList = watchlist.has(item.id);
  const colors = PALETTE[idx % PALETTE.length];
  const cr = item.communityRating;

  const thumbContent = item.posterUrl
    ? `<img src="${item.posterUrl}" class="card-poster-img" alt="${item.title}" loading="lazy"/>`
    : `<div class="card-art">${posterArt(idx)}</div>`;

  const thumbStyle = item.posterUrl
    ? ''
    : `style="background:linear-gradient(160deg,${colors[0]} 0%,${colors[1]} 55%,#000 100%)"`;

  card.innerHTML = `
    <div class="card-thumb" ${thumbStyle}>
      ${thumbContent}
      <div class="card-gradient-overlay"></div>
    </div>
    <div class="card-badge-top">
      <span class="audio-badge">${item.audio || 'VO'}</span>
      ${item.quality ? `<span class="quality-badge">${item.quality}</span>` : ''}
      ${item.trailerUrl ? `<span class="trailer-badge"><svg viewBox="0 0 24 24" fill="currentColor" style="width:8px;height:8px"><polygon points="5,3 19,12 5,21"/></svg></span>` : ''}
    </div>
    ${cr ? `<div class="card-rating">${'★'.repeat(Math.round(cr.avg))}${'☆'.repeat(5-Math.round(cr.avg))} <span style="font-size:10px;opacity:0.7">${cr.avg}</span></div>` : ''}
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
          ${cr ? `<span style="color:#ffd700">★ ${cr.avg}/5</span>` : ''}
          ${item.duration ? `<span>${item.duration}</span>` : ''}
        </div>
        <div class="card-hover-genre">${item.genre} · <span style="color:var(--cyan)">${item.audio}</span></div>
      </div>
    </div>`;
  card.addEventListener('click', () => openModal(item.id));
  return card;
}

function posterArt(idx) {
  const h = [220,280,340,160,200,260,30,180,310,120,240,300][idx % 12];
  const arts = [
    `<circle cx="60" cy="60" r="38" fill="none" stroke="hsla(${h},100%,70%,0.3)" stroke-width="1.5"/>
     <circle cx="60" cy="60" r="20" fill="hsla(${h},100%,60%,0.12)"/>`,
    `<polygon points="60,18 98,85 22,85" fill="none" stroke="hsla(${h},100%,70%,0.35)" stroke-width="1.5"/>
     <polygon points="60,36 82,78 38,78" fill="hsla(${h},100%,60%,0.1)"/>`,
    `<rect x="22" y="22" width="76" height="76" fill="none" stroke="hsla(${h},100%,70%,0.28)" stroke-width="1.5" rx="4" transform="rotate(45 60 60)"/>`,
    `<path d="M20,60 Q40,20 60,60 Q80,100 100,60" fill="none" stroke="hsla(${h},100%,70%,0.45)" stroke-width="2"/>`,
    `<circle cx="60" cy="60" r="34" fill="none" stroke="hsla(${h},100%,70%,0.18)" stroke-dasharray="6 4" stroke-width="1"/>
     <circle cx="60" cy="60" r="6" fill="hsla(${h},100%,80%,0.4)"/>`,
  ];
  return `<svg viewBox="0 0 120 120" fill="none">${arts[idx % arts.length]}</svg>`;
}

// ── WATCHLIST ─────────────────────────────────────────────────────────────────
async function toggleWatchlist(id, btn) {
  try {
    const res  = await fetch(`/api/watchlist/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.inList) { watchlist.add(id); showToast('Ajouté à ma liste'); }
    else { watchlist.delete(id); showToast('Retiré de ma liste'); }
    document.querySelectorAll('.media-card').forEach(card => {
      if (card.dataset.id !== id) return;
      const b = card.querySelector('.add-circle');
      if (b) {
        b.classList.toggle('in-list', data.inList);
        b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          ${data.inList ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
        </svg>`;
      }
    });
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
  const res  = await fetch('/api/watchlist');
  const data = await res.json();
  watchlist = new Set(data.watchlist || []);
  const items = CATALOG.filter(c => watchlist.has(c.id));
  const grid  = document.getElementById('mylist-grid');
  const empty = document.getElementById('mylist-empty');
  grid.innerHTML = '';
  if (!items.length) empty.classList.remove('hidden');
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
  if (name === 'admin')  loadAdminData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
async function loadAdminData() {
  document.getElementById('stat-content').textContent = CATALOG.length;
  document.getElementById('stat-films').textContent   = CATALOG.filter(c => c.type === 'film' || c.type === 'documentaire' || c.type === 'court-metrage').length;
  document.getElementById('stat-series').textContent  = CATALOG.filter(c => c.type === 'serie').length;

  try {
    const res  = await fetch('/api/admin/users');
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
            <td><div class="user-cell"><div class="user-av">${(u.avatar||u.name[0]).toUpperCase()}</div>${u.name}</div></td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${u.role}</span></td>
            <td>${new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    }
  } catch(e) { console.error(e); }
  renderAdminContentList();
}

function renderAdminContentList() {
  const wrap = document.getElementById('admin-content-list');
  if (!CATALOG.length) {
    wrap.innerHTML = '<p style="color:var(--text-dim);padding:16px">Aucun contenu ajouté.</p>';
    return;
  }
  wrap.innerHTML = `<table class="admin-table">
    <thead><tr><th>Affiche</th><th>Titre</th><th>Type</th><th>Genre</th><th>Année</th><th>Audio</th><th>Trailer</th><th>Action</th></tr></thead>
    <tbody>${CATALOG.map(c => `
      <tr>
        <td>${c.posterUrl ? `<img src="${c.posterUrl}" style="width:36px;height:52px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.1)">` : '<div style="width:36px;height:52px;background:rgba(255,255,255,0.05);border-radius:4px;border:1px solid rgba(255,255,255,0.08)"></div>'}</td>
        <td><strong style="color:#fff">${c.title}</strong></td>
        <td>${c.type}</td>
        <td>${c.genre}</td>
        <td>${c.year}</td>
        <td><span class="audio-tag">${c.audio}</span></td>
        <td>${c.trailerUrl ? `<a href="${c.trailerUrl}" target="_blank" style="color:var(--cyan);font-size:11px">YT</a>` : '—'}</td>
        <td><button class="btn-delete" onclick="deleteContent('${c.id}')">Supprimer</button></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

// ── AUTO-FILL SEARCH (iTunes, sans clé API) ───────────────────────────────────
let tmdbTimeout = null;
function debounceTmdb(val) {
  clearTimeout(tmdbTimeout);
  const status  = document.getElementById('tmdb-status');
  const results = document.getElementById('tmdb-results');
  if (!val.trim()) { results.innerHTML = ''; status.textContent = ''; return; }
  status.textContent = 'Recherche…';
  tmdbTimeout = setTimeout(() => doTmdbSearch(val.trim()), 500);
}

async function doTmdbSearch(q) {
  const status  = document.getElementById('tmdb-status');
  const results = document.getElementById('tmdb-results');
  try {
    const res  = await fetch(`/api/admin/auto-search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    status.textContent = '';
    if (data.error) { status.textContent = data.error; results.innerHTML = ''; return; }
    if (!data.results.length) { results.innerHTML = '<p style="color:var(--text-dim);font-size:13px;padding:8px 0">Aucun résultat.</p>'; return; }
    results.innerHTML = data.results.map(r => `
      <div class="tmdb-result-card" onclick="selectTmdb(${JSON.stringify(r).replace(/"/g,'&quot;')})">
        ${r.poster ? `<img src="${r.poster}" class="tmdb-result-poster" alt="">` : `<div class="tmdb-result-poster tmdb-no-poster"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px;color:var(--text-dim)"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></div>`}
        <div class="tmdb-result-info">
          <div class="tmdb-result-title">${r.title}</div>
          <div class="tmdb-result-meta">${r.type === 'serie' ? 'Série' : 'Film'} · ${r.year || '?'} ${r.genre ? '· ' + r.genre : ''}</div>
        </div>
      </div>`).join('');
  } catch(e) {
    status.textContent = 'Erreur de recherche';
    results.innerHTML = '';
  }
}

async function selectTmdb(result) {
  tmdbSelected = result;
  tmdbDetail   = null;

  // Pré-remplir les champs de base immédiatement
  document.getElementById('f-title').value = result.title || '';
  if (result.type)     document.getElementById('f-type').value = result.type;
  if (result.year)     document.getElementById('f-year').value = result.year;
  if (result.overview) document.getElementById('f-desc').value = result.overview;
  if (result.genre)    document.getElementById('f-genre').value = result.genre;

  // Durée depuis iTunes (ms → Xh Ymin)
  if (result.durationMs) {
    const mins = Math.round(result.durationMs / 60000);
    document.getElementById('f-duration').value = mins >= 60
      ? `${Math.floor(mins/60)}h ${mins%60}min`
      : `${mins}min`;
  }

  // Affiche les boutons "+ Auto"
  ['genre','duration','year','desc','trailer','poster','actors'].forEach(k => {
    const btn = document.getElementById(`fill-${k}-btn`);
    if (btn) btn.style.display = 'inline-flex';
  });

  // Highlight sélectionné
  document.querySelectorAll('.tmdb-result-card').forEach(el => el.classList.remove('selected'));
  event?.currentTarget?.classList?.add('selected');

  // Affiche l'affiche auto si disponible
  if (result.poster) {
    document.getElementById('f-poster-url').value = result.poster;
    const prev = document.getElementById('poster-preview-img');
    if (prev) { prev.src = result.poster; document.getElementById('poster-preview-wrap').style.display='flex'; }
    document.getElementById('poster-upload-label').style.display='none';
  }

  showToast(`"${result.title}" sélectionné — champs pré-remplis`);

  // Chargement des détails supplémentaires (durée précise si pas encore disponible)
  try {
    const res = await fetch(`/api/admin/auto-detail/${result.itunesId}`);
    tmdbDetail = await res.json();
    if (tmdbDetail.runtime && !result.durationMs) {
      document.getElementById('f-duration').value = tmdbDetail.runtime;
    }
    if (tmdbDetail.genre && !result.genre) {
      document.getElementById('f-genre').value = tmdbDetail.genre;
    }
  } catch {}
}

function fillFromTmdb(field) {
  if (!tmdbSelected) return;
  switch(field) {
    case 'genre':
      const g = tmdbDetail?.genre || tmdbSelected.genre;
      if (g) document.getElementById('f-genre').value = g;
      break;
    case 'duration':
      if (tmdbDetail?.runtime) document.getElementById('f-duration').value = tmdbDetail.runtime;
      else if (tmdbSelected.durationMs) {
        const mins = Math.round(tmdbSelected.durationMs / 60000);
        document.getElementById('f-duration').value = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}min` : `${mins}min`;
      }
      break;
    case 'year':
      if (tmdbSelected.year) document.getElementById('f-year').value = tmdbSelected.year;
      break;
    case 'description':
      if (tmdbSelected.overview) document.getElementById('f-desc').value = tmdbSelected.overview;
      break;
    case 'trailer':
      showToast('Le lien bande-annonce doit être ajouté manuellement (YouTube)', false);
      document.getElementById('f-trailer').focus();
      return;
    case 'poster':
      if (tmdbSelected.poster) {
        document.getElementById('f-poster-url').value = tmdbSelected.poster;
        const prev = document.getElementById('poster-preview-img');
        if (prev) { prev.src = tmdbSelected.poster; document.getElementById('poster-preview-wrap').style.display='flex'; }
        document.getElementById('poster-upload-label').style.display='none';
      }
      break;
    case 'actors':
      showToast('Les acteurs doivent être ajoutés manuellement', false);
      return;
  }
  showToast('Champ rempli automatiquement');
}

// ── ACTORS (Admin form) ───────────────────────────────────────────────────────
let actorCount = 0;
function addActorRow(name = '', photo = '') {
  const list = document.getElementById('actors-list');
  const id   = actorCount++;
  const div  = document.createElement('div');
  div.className  = 'actor-row';
  div.dataset.id = id;

  const photoPreview = photo ? `<img src="${photo}" class="actor-photo-preview" alt="">` : '';

  div.innerHTML = `
    <input type="text" class="form-input actor-name-input" placeholder="Nom de l'acteur" value="${name.replace(/"/g,'&quot;')}" style="flex:1"/>
    <input type="url"  class="form-input actor-photo-input" placeholder="URL photo" value="${photo.replace(/"/g,'&quot;')}" style="flex:1" oninput="updateActorPhoto(this,${id})"/>
    <div class="actor-photo-wrap" id="actor-photo-${id}">${photoPreview}</div>
    <button type="button" class="actor-remove-btn" onclick="removeActorRow(${id})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  list.appendChild(div);
}

function updateActorPhoto(input, id) {
  const wrap = document.getElementById(`actor-photo-${id}`);
  if (!wrap) return;
  wrap.innerHTML = input.value ? `<img src="${input.value}" class="actor-photo-preview" alt="" onerror="this.style.display='none'">` : '';
}

function removeActorRow(id) {
  const el = document.querySelector(`.actor-row[data-id="${id}"]`);
  if (el) el.remove();
}
function clearActors() { document.getElementById('actors-list').innerHTML = ''; actorCount = 0; }

function getActors() {
  return [...document.querySelectorAll('.actor-row')].map(row => ({
    name:  row.querySelector('.actor-name-input').value.trim(),
    photo: row.querySelector('.actor-photo-input').value.trim(),
  })).filter(a => a.name);
}

// ── POSTER UPLOAD ─────────────────────────────────────────────────────────────
function onPosterChosen(input) {
  if (!input.files[0]) return;
  const file  = input.files[0];
  const label = document.getElementById('poster-upload-label');
  const prog  = document.getElementById('poster-upload-progress');
  const bar   = document.getElementById('poster-progress-bar');

  label.style.display = 'none';
  prog.style.display  = 'block';

  const fd = new FormData();
  fd.append('image', file);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/admin/upload-image');
  xhr.upload.onprogress = ev => { if (ev.lengthComputable) bar.style.width = Math.round(ev.loaded/ev.total*100)+'%'; };
  xhr.onload = () => {
    prog.style.display = 'none';
    try {
      const data = JSON.parse(xhr.responseText);
      if (data.imageUrl) {
        bgPoster.url = data.imageUrl;
        document.getElementById('f-poster-url').value = data.imageUrl;
        const prev = document.getElementById('poster-preview-img');
        prev.src = data.imageUrl;
        document.getElementById('poster-preview-wrap').style.display = 'flex';
        showToast('Image uploadée');
      }
    } catch { label.style.display = 'flex'; }
  };
  xhr.onerror = () => { prog.style.display = 'none'; label.style.display = 'flex'; showToast('Erreur upload image', true); };
  xhr.send(fd);

  // Show local preview immediately
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('poster-preview-img');
    prev.src = e.target.result;
    document.getElementById('poster-preview-wrap').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function removePoster() {
  bgPoster.url = null;
  document.getElementById('f-poster-url').value = '';
  document.getElementById('poster-preview-wrap').style.display = 'none';
  document.getElementById('poster-upload-label').style.display = 'flex';
  const input = document.getElementById('f-poster');
  if (input) input.value = '';
  const tmdbUrl = document.getElementById('f-poster-url');
  if (tmdbUrl) tmdbUrl.value = '';
}

// ── VIDEO BACKGROUND UPLOAD ───────────────────────────────────────────────────
function onVideoFileChosen(input) {
  const labelText = document.getElementById('video-file-label-text');
  const label     = document.getElementById('video-upload-label');
  const progWrap  = document.getElementById('video-upload-progress');
  const progBar   = document.getElementById('video-progress-bar');
  const progText  = document.getElementById('video-progress-text');
  const globalInd = document.getElementById('global-upload-indicator');
  const globalBar = document.getElementById('global-upload-bar');
  const globalPct = document.getElementById('global-upload-pct');
  const globalTxt = document.getElementById('global-upload-text');

  if (!input.files[0]) return;
  const file = input.files[0];
  const mb   = (file.size / 1024 / 1024).toFixed(1);
  if (labelText) labelText.textContent = `${file.name} (${mb} Mo)`;
  if (label) label.classList.add('has-file');

  // Reset previous upload
  if (bgUpload.xhr) { bgUpload.xhr.abort(); }
  bgUpload.active   = false;
  bgUpload.filename = null;
  bgUpload.videoUrl = null;
  document.getElementById('f-video-url').value = '';

  // Start background upload immediately
  const fd = new FormData();
  fd.append('video', file);
  const xhr = new XMLHttpRequest();
  bgUpload.xhr = xhr;
  bgUpload.active = true;

  progWrap.style.display  = 'block';
  globalInd.style.display = 'flex';
  if (globalTxt) globalTxt.textContent = `Upload : ${file.name}`;

  xhr.open('POST', '/api/admin/upload-video');
  xhr.upload.onprogress = ev => {
    if (!ev.lengthComputable) return;
    const pct = Math.round(ev.loaded / ev.total * 100);
    bgUpload.pct = pct;
    if (progBar)  progBar.style.width  = pct + '%';
    if (progText) progText.textContent = `Upload : ${pct}% — ${(ev.loaded/1024/1024).toFixed(1)} / ${(ev.total/1024/1024).toFixed(1)} Mo`;
    if (globalBar) globalBar.style.width = pct + '%';
    if (globalPct) globalPct.textContent = pct + '%';
  };
  xhr.onload = () => {
    bgUpload.active = false;
    progWrap.style.display = 'none';
    try {
      const data = JSON.parse(xhr.responseText);
      if (data.videoUrl) {
        bgUpload.videoUrl = data.videoUrl;
        bgUpload.filename = data.filename;
        document.getElementById('f-video-url').value = data.videoUrl;
        if (globalTxt) globalTxt.textContent = `Upload terminé : ${file.name}`;
        if (globalPct) globalPct.textContent = '100%';
        if (globalBar) globalBar.style.width = '100%';
        showToast('Vidéo uploadée en arrière-plan');
        setTimeout(() => { globalInd.style.display = 'none'; }, 3000);
      }
    } catch {
      globalInd.style.display = 'none';
      showToast('Erreur upload vidéo', true);
    }
  };
  xhr.onerror = () => {
    bgUpload.active = false;
    progWrap.style.display  = 'none';
    globalInd.style.display = 'none';
    showToast('Erreur upload vidéo', true);
  };
  xhr.send(fd);
}

// ── SUBMIT FORM ───────────────────────────────────────────────────────────────
async function submitAddContent(e) {
  e.preventDefault();
  const errDiv  = document.getElementById('form-error');
  const btn     = document.getElementById('form-submit-btn');
  const btnText = document.getElementById('form-btn-text');
  const spinner = document.getElementById('form-spinner');
  errDiv.classList.add('hidden');

  const title = document.getElementById('f-title').value.trim();
  const genre = document.getElementById('f-genre').value.trim();
  const type  = document.getElementById('f-type').value;
  const audio = document.getElementById('f-audio').value;

  // Vérification des champs obligatoires avec détail
  const missing = [];
  if (!title) missing.push('Titre');
  if (!genre)  missing.push('Genre');
  if (!type)   missing.push('Type (Film / Série…)');
  if (!audio)  missing.push('Langue audio');
  if (missing.length) {
    errDiv.innerHTML = `<strong>Champs obligatoires manquants :</strong><br>• ${missing.join('<br>• ')}`;
    errDiv.classList.remove('hidden');
    errDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Avertissements pour champs recommandés (sans bloquer)
  const videoUrl2 = document.getElementById('f-video-url').value.trim();
  const desc2     = document.getElementById('f-desc').value.trim();
  const poster2   = document.getElementById('f-poster-url').value.trim();
  const warnings  = [];
  if (!videoUrl2) warnings.push('Fichier vidéo non ajouté');
  if (!desc2)     warnings.push('Description vide');
  if (!poster2)   warnings.push('Affiche (poster) non définie');
  if (warnings.length && !window._ignoreWarnings) {
    errDiv.innerHTML = `<strong>Champs recommandés non remplis :</strong><br>• ${warnings.join('<br>• ')}<br><br><button type="button" onclick="window._ignoreWarnings=true;document.getElementById('form-submit-btn').click()" style="background:var(--grad);border:none;color:#fff;padding:7px 18px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px">Ajouter quand même</button>`;
    errDiv.classList.remove('hidden');
    errDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  window._ignoreWarnings = false;

  // Wait if video is still uploading
  if (bgUpload.active) {
    errDiv.textContent = 'Upload vidéo en cours, veuillez patienter…';
    errDiv.classList.remove('hidden');
    return;
  }

  btn.disabled = true; btnText.style.display = 'none'; spinner.style.display = 'block';

  const rows       = [...document.querySelectorAll('input[name="rows"]:checked')].map(i => i.value);
  const posterUrl  = document.getElementById('f-poster-url').value.trim();
  const videoUrl   = document.getElementById('f-video-url').value.trim();
  const trailerUrl = document.getElementById('f-trailer').value.trim();
  const actors     = getActors();

  const fd = new FormData();
  fd.append('title',       title);
  fd.append('genre',       genre);
  fd.append('type',        type);
  fd.append('audio',       audio);
  fd.append('duration',    document.getElementById('f-duration').value.trim());
  fd.append('year',        document.getElementById('f-year').value || '');
  fd.append('quality',     document.getElementById('f-quality').value);
  fd.append('description', document.getElementById('f-desc').value.trim());
  fd.append('trailerUrl',  trailerUrl);
  fd.append('posterUrl',   posterUrl);
  fd.append('videoUrl',    videoUrl);
  fd.append('actors',      JSON.stringify(actors));
  rows.forEach(r => fd.append('rows', r));

  try {
    const res  = await fetch('/api/admin/content', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    CATALOG = data.catalog;
    showToast(`"${title}" ajouté`);
    resetForm();
    renderRows();
    renderResumeRow();
    renderHero();
    renderAdminContentList();
    document.getElementById('stat-content').textContent = CATALOG.length;
    document.getElementById('stat-films').textContent   = CATALOG.filter(c => c.type==='film'||c.type==='documentaire'||c.type==='court-metrage').length;
    document.getElementById('stat-series').textContent  = CATALOG.filter(c => c.type==='serie').length;
  } catch(err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false; btnText.style.display = 'block'; spinner.style.display = 'none';
  }
}

async function deleteContent(id) {
  if (!confirm('Supprimer ce contenu ?')) return;
  try {
    const res  = await fetch(`/api/admin/content/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    CATALOG = data.catalog;
    showToast('Contenu supprimé');
    renderRows(); renderHero(); renderAdminContentList();
    document.getElementById('stat-content').textContent = CATALOG.length;
    document.getElementById('stat-films').textContent   = CATALOG.filter(c=>c.type==='film'||c.type==='documentaire'||c.type==='court-metrage').length;
    document.getElementById('stat-series').textContent  = CATALOG.filter(c=>c.type==='serie').length;
  } catch(err) { showToast(err.message, true); }
}

function resetForm() {
  document.getElementById('add-content-form').reset();
  document.getElementById('form-error').classList.add('hidden');
  document.getElementById('video-file-label-text').textContent = 'Choisir un fichier vidéo (mp4, mkv, avi…)';
  document.getElementById('video-upload-label').classList.remove('has-file');
  document.getElementById('f-video-url').value = '';
  document.getElementById('f-poster-url').value = '';
  document.getElementById('poster-preview-wrap').style.display = 'none';
  document.getElementById('poster-upload-label').style.display = 'flex';
  document.getElementById('tmdb-results').innerHTML = '';
  document.getElementById('tmdb-input').value = '';
  document.getElementById('tmdb-status').textContent = '';
  clearActors();
  tmdbSelected = null; tmdbDetail = null;
  window._ignoreWarnings = false;
  ['genre','duration','year','desc','trailer','poster','actors'].forEach(k => {
    const btn = document.getElementById(`fill-${k}-btn`);
    if (btn) btn.style.display = 'none';
  });
}

function updateDurationPlaceholder() {
  const type  = document.getElementById('f-type').value;
  const input = document.getElementById('f-duration');
  input.placeholder = type === 'serie' ? 'ex : 6 épisodes' : 'ex : 1h 52m';
}

// ── SEARCH ─────────────────────────────────────────────────────────────────────
let searchTimeout = null;
function toggleSearch() {
  const wrap   = document.getElementById('search-wrap');
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
    document.getElementById('search-overlay').classList.remove('hidden');
    document.getElementById('search-query-label').textContent = `"${q}"`;
    const ql = q.toLowerCase();
    const results = CATALOG.filter(c =>
      c.title.toLowerCase().includes(ql) || c.genre.toLowerCase().includes(ql) ||
      (c.description||'').toLowerCase().includes(ql) ||
      c.audio?.toLowerCase().includes(ql) || c.type?.toLowerCase().includes(ql)
    );
    document.getElementById('search-count').textContent =
      results.length ? ` — ${results.length} résultat${results.length > 1 ? 's' : ''}` : '';
    const track = document.getElementById('search-results-track');
    const empty = document.getElementById('search-empty');
    track.innerHTML = '';
    if (!results.length) empty.classList.remove('hidden');
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
    vx: (Math.random() - 0.5) * 0.00015, vy: (Math.random() - 0.5) * 0.00015,
    opacity: Math.random() * 0.6,
    color: ['#00d4ff','#bf40ff','#ff2d78','#7b2fff'][Math.floor(Math.random() * 4)],
    tw: Math.random() * Math.PI * 2,
  }));
  const orbs = [
    { x:0.72, y:0.32, r:0.24, c:'rgba(123,47,255,0.22)' },
    { x:0.88, y:0.62, r:0.16, c:'rgba(0,212,255,0.14)' },
  ];
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    orbs.forEach(o => {
      const grd = ctx.createRadialGradient(o.x*canvas.width, o.y*canvas.height, 0, o.x*canvas.width, o.y*canvas.height, o.r*canvas.width);
      grd.addColorStop(0, o.c); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd; ctx.beginPath();
      ctx.arc(o.x*canvas.width, o.y*canvas.height, o.r*canvas.width, 0, Math.PI*2); ctx.fill();
    });
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
      p.tw += 0.018;
      ctx.globalAlpha = p.opacity * (0.4 + 0.6 * Math.sin(p.tw));
      ctx.shadowBlur = 8; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
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
function scrollRow(trackId, dir) { const t = document.getElementById(trackId); if (t) t.scrollBy({ left: dir * 450, behavior: 'smooth' }); }
function toggleAvatarMenu() { document.getElementById('avatar-menu').classList.toggle('open'); }
function closeAvatarMenu()  { document.getElementById('avatar-menu').classList.remove('open'); }
document.addEventListener('click', e => { if (!document.getElementById('avatar-wrap')?.contains(e.target)) closeAvatarMenu(); });
async function logout() {
  // Admin can logout directly
  if (currentUser?.role === 'admin') {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
    return;
  }
  // Regular users must confirm their secret code
  closeAvatarMenu();
  document.getElementById('sc-logout-input').value = '';
  document.getElementById('sc-logout-error').style.display = 'none';
  document.getElementById('logout-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('sc-logout-input').focus(), 100);
}

async function submitLogoutCode() {
  const code = document.getElementById('sc-logout-input').value.trim();
  const errEl = document.getElementById('sc-logout-error');
  if (!code) { errEl.textContent = 'Veuillez saisir votre code secret.'; errEl.style.display = 'block'; return; }
  try {
    const res = await fetch('/api/verify-secret-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!data.valid) { errEl.textContent = 'Code secret incorrect. Réessayez.'; errEl.style.display = 'block'; return; }
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch { errEl.textContent = 'Erreur réseau. Réessayez.'; errEl.style.display = 'block'; }
}

async function showSecretCode() {
  try {
    const res = await fetch('/api/my-code');
    const data = await res.json();
    document.getElementById('sc-code-value').textContent = data.code || '—';
    document.getElementById('view-code-modal').style.display = 'flex';
  } catch { showToast('Impossible de charger le code', false); }
}

function showSetCodeModal() {
  document.getElementById('sc-set-input').value = '';
  document.getElementById('sc-set-error').style.display = 'none';
  document.getElementById('set-code-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('sc-set-input').focus(), 100);
}

async function submitSetCode() {
  const code = document.getElementById('sc-set-input').value.trim();
  const errEl = document.getElementById('sc-set-error');
  if (code.length < 3) { errEl.textContent = 'Code trop court (min. 3 caractères).'; errEl.style.display = 'block'; return; }
  try {
    const res = await fetch('/api/set-secret-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Erreur'; errEl.style.display = 'block'; return; }
    document.getElementById('set-code-modal').style.display = 'none';
    showToast('Code secret enregistré ! Gardez-le précieusement. 🔐');
    if (currentUser) currentUser.firstLogin = false;
  } catch { errEl.textContent = 'Erreur réseau.'; errEl.style.display = 'block'; }
}

// ── MODAL ──────────────────────────────────────────────────────────────────────
async function openModal(id) {
  const item = CATALOG.find(c => c.id === id);
  if (!item) return;
  currentModalId = id;

  document.getElementById('modal-title-text').textContent    = item.title;
  document.getElementById('modal-playing-title').textContent = item.title;
  document.getElementById('modal-desc-text').textContent     = item.description || '';
  document.getElementById('total-time').textContent          = item.duration || '—';

  const tags = document.getElementById('modal-tags');
  tags.innerHTML = [
    item.quality   ? `<span class="tag-badge">${item.quality}</span>` : '',
    `<span class="tag-badge">${item.audio}</span>`,
    item.year      ? `<span class="tag-badge">${item.year}</span>`    : '',
    item.genre     ? `<span class="tag-badge genre-badge">${item.genre}</span>` : '',
    item.duration  ? `<span class="tag-badge">${item.duration}</span>` : '',
  ].join('');

  document.getElementById('modal-watchlist-btn').textContent = watchlist.has(id) ? '✓ Dans ma liste' : '+ Ma liste';
  document.getElementById('video-modal').classList.remove('modal-hidden');
  document.body.style.overflow = 'hidden';

  // Actors
  const actorsWrap = document.getElementById('modal-actors-wrap');
  const actorsList = document.getElementById('modal-actors-list');
  if (item.actors && item.actors.length) {
    actorsWrap.style.display = '';
    actorsList.innerHTML = item.actors.map(a => `
      <div class="modal-actor">
        ${a.photo ? `<img src="${a.photo}" class="modal-actor-photo" alt="${a.name}" onerror="this.style.display='none'">` : `<div class="modal-actor-photo-placeholder">${a.name[0]}</div>`}
        <div class="modal-actor-name">${a.name}</div>
      </div>`).join('');
  } else {
    actorsWrap.style.display = 'none';
  }

  // Load user rating
  try {
    const rRes  = await fetch(`/api/rating/${id}`);
    const rData = await rRes.json();
    updateStarUI(rData.myRating, rData.avg, rData.count);
  } catch {}

  // Show tabs based on what's available
  const hasTrailer = !!item.trailerUrl;
  const hasVideo   = !!item.videoUrl;
  document.getElementById('tab-trailer').style.display = hasTrailer ? '' : 'none';
  document.getElementById('tab-watch').style.display   = hasVideo   ? '' : 'none';

  // Default tab
  if (hasTrailer) switchModalTab('trailer', item);
  else if (hasVideo) switchModalTab('watch', item);
  else switchModalTab('info', item);
}

function switchModalTab(tab, itemOverride) {
  currentModalTab = tab;
  const item = itemOverride || CATALOG.find(c => c.id === currentModalId);
  if (!item) return;

  // Update tab button states
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.getElementById(`tab-${tab}`);
  if (activeTab) activeTab.classList.add('active');

  // Stop current playback
  const videoEl = document.getElementById('player-video');
  if (videoEl && !videoEl.paused) videoEl.pause();
  if (playerRaf) { cancelAnimationFrame(playerRaf); playerRaf = null; }
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  isPlaying = false;

  const ytFrame   = document.getElementById('player-yt');
  const canvas    = document.getElementById('player-canvas');
  const overlay   = document.getElementById('player-overlay');
  const playerArea = document.getElementById('modal-player-area');
  const infoPanel = document.getElementById('modal-info-panel');

  if (tab === 'info') {
    // Hide player, show only info below
    playerArea.style.display = 'none';
    infoPanel.classList.add('info-expanded');
    ytFrame.style.display  = 'none';
    videoEl.style.display  = 'none';
    canvas.style.display   = 'none';
    if (overlay) overlay.style.display = 'none';
    ytFrame.src = '';
    return;
  }

  playerArea.style.display = '';
  infoPanel.classList.remove('info-expanded');

  if (tab === 'trailer' && item.trailerUrl) {
    ytFrame.style.display  = 'block';
    videoEl.style.display  = 'none';
    canvas.style.display   = 'none';
    if (overlay) overlay.style.display = 'none';
    const videoId = extractYouTubeId(item.trailerUrl);
    ytFrame.src = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : '';
  } else if (tab === 'watch') {
    ytFrame.src = '';
    ytFrame.style.display = 'none';
    const resume = loadResume();

    if (item.videoUrl) {
      videoEl.style.display = 'block';
      canvas.style.display  = 'none';
      if (overlay) overlay.style.display = 'none';
      videoEl.src = item.videoUrl;
      videoEl.controls = true;
      videoEl.load();
      videoEl.addEventListener('loadedmetadata', function onMeta() {
        videoEl.removeEventListener('loadedmetadata', onMeta);
        if (resume && resume.id === currentModalId && resume.currentTime > 3) {
          videoEl.currentTime = resume.currentTime;
          showToast(`Reprise à ${formatTime(Math.round(resume.currentTime))}`);
        }
        videoEl.play().catch(() => {});
      });
      if (videoEl._saveInterval) clearInterval(videoEl._saveInterval);
      videoEl._saveInterval = setInterval(() => { if (!videoEl.paused && videoEl.currentTime > 3) saveProgress(); }, 5000);
    } else {
      videoEl.style.display = 'none';
      canvas.style.display  = '';
      if (overlay) overlay.style.display = '';
      if (resume && resume.id === currentModalId && resume.progressPct > 1 && resume.progressPct < 98) {
        progressPct = resume.progressPct;
        showToast(`Reprise à ${Math.round(progressPct)}%`);
      } else { progressPct = 0; }
      setTimeout(() => { startPlayerCanvas(); startProgressTimer(item.duration); }, 100);
    }
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function closeModal() {
  saveProgress();
  const videoEl = document.getElementById('player-video');
  if (videoEl) {
    if (videoEl._saveInterval) { clearInterval(videoEl._saveInterval); videoEl._saveInterval = null; }
    if (!videoEl.paused) videoEl.pause();
    videoEl.src = ''; videoEl.controls = false;
  }
  const ytFrame = document.getElementById('player-yt');
  if (ytFrame) ytFrame.src = '';
  document.getElementById('video-modal').classList.add('modal-hidden');
  document.getElementById('modal-player-area').style.display = '';
  document.getElementById('modal-info-panel').classList.remove('info-expanded');
  document.body.style.overflow = '';
  isPlaying = false;
  if (playerRaf) cancelAnimationFrame(playerRaf);
  if (progressInterval) clearInterval(progressInterval);
  playerRaf = null; progressInterval = null; currentModalId = null;
  renderResumeRow();
}

// ── STAR RATING ───────────────────────────────────────────────────────────────
function updateStarUI(myRating, avg, count) {
  const stars = document.querySelectorAll('.star');
  stars.forEach(s => {
    const v = parseInt(s.dataset.v);
    s.classList.toggle('filled', v <= myRating);
  });
  const cr = document.getElementById('community-rating');
  if (cr) {
    cr.innerHTML = avg > 0
      ? `<span style="color:#ffd700">${renderStarsSmall(avg)}</span> ${avg}/5 <span style="color:var(--text-dim)">(${count} avis)</span>`
      : `<span style="color:var(--text-dim)">Pas encore noté</span>`;
  }
}

async function rateItem(value) {
  if (!currentModalId) return;
  try {
    const res  = await fetch(`/api/rating/${currentModalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    updateStarUI(data.myRating, data.avg, data.count);
    // Update catalog entry
    const item = CATALOG.find(c => c.id === currentModalId);
    if (item) item.communityRating = { avg: data.avg, count: data.count };
    renderRows();
    showToast(`Note enregistrée : ${value}/5`);
  } catch(e) { showToast(e.message, true); }
}

// Star hover effects
document.addEventListener('DOMContentLoaded', () => {});
document.addEventListener('mouseover', e => {
  if (!e.target.classList.contains('star')) return;
  const v = parseInt(e.target.dataset.v);
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('hover', parseInt(s.dataset.v) <= v);
  });
});
document.addEventListener('mouseout', e => {
  if (!e.target.classList.contains('star')) return;
  document.querySelectorAll('.star').forEach(s => s.classList.remove('hover'));
});

// ── PLAYER CANVAS ─────────────────────────────────────────────────────────────
function startPlayerCanvas() {
  const canvas = document.getElementById('player-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 860; canvas.height = canvas.offsetHeight || 484;
  const lines = Array.from({ length: 45 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    len: 30 + Math.random() * 100, speed: 1.5 + Math.random() * 5,
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
  } else { startPlayerCanvas(); }
}

function restartPlayer() {
  progressPct = 0;
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-thumb').style.left = '0%';
  document.getElementById('current-time').textContent  = '0:00';
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
  const fillEl  = document.getElementById('progress-fill');
  const thumbEl = document.getElementById('progress-thumb');
  const ctEl    = document.getElementById('current-time');
  if (fillEl)  fillEl.style.width   = progressPct + '%';
  if (thumbEl) thumbEl.style.left   = progressPct + '%';
  if (ctEl)    ctEl.textContent = formatTime(Math.floor((progressPct / 100) * totalSec));
  progressInterval = setInterval(() => {
    if (!isPlaying) return;
    progressPct += (100 / totalSec) * 0.25;
    if (progressPct >= 100) { progressPct = 0; clearResume(currentModalId); }
    const fill  = document.getElementById('progress-fill');
    const thumb = document.getElementById('progress-thumb');
    const ct    = document.getElementById('current-time');
    if (fill)  fill.style.width  = progressPct + '%';
    if (thumb) thumb.style.left  = progressPct + '%';
    if (ct)    ct.textContent = formatTime(Math.floor((progressPct / 100) * totalSec));
    if (++saveTick % 20 === 0) saveProgress();
  }, 250);
}

function parseDuration(str) {
  if (!str) return 5400;
  const hm = str.match(/(\d+)h\s*(\d+)m/);
  if (hm) return parseInt(hm[1]) * 3600 + parseInt(hm[2]) * 60;
  const m  = str.match(/(\d+)m/); if (m) return parseInt(m[1]) * 60;
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
  else navigator.clipboard.writeText(location.href).then(() => showToast('Lien copié'));
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' toast-error' : '');
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('video-modal').classList.contains('modal-hidden')) closeModal();
    else if (document.getElementById('search-wrap').classList.contains('search-open')) toggleSearch();
  }
  if (e.key === ' ' && !document.getElementById('video-modal').classList.contains('modal-hidden')) {
    e.preventDefault(); togglePlay();
  }
});

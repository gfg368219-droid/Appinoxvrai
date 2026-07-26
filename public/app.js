/* ═══════════════════════════════════════════════════════════
   APPINOX STREAMING — MAIN APPLICATION SCRIPT
═══════════════════════════════════════════════════════════ */

'use strict';

// ─── DATA ────────────────────────────────────────────────────────────────────

const CATALOG = {
  trending: [
    { title: 'Neon Horizon',    genre: 'Sci-Fi',    rating: 9.4, color1: '#0a0520', color2: '#1a0540' },
    { title: 'Void Protocol',   genre: 'Thriller',  rating: 8.9, color1: '#200505', color2: '#400510' },
    { title: 'Crimson Pulse',   genre: 'Action',    rating: 8.7, color1: '#050a20', color2: '#051a40' },
    { title: 'Echo Chamber',    genre: 'Drama',     rating: 9.1, color1: '#050a10', color2: '#0a2010' },
    { title: 'Phantom Grid',    genre: 'Mystery',   rating: 8.5, color1: '#1a0510', color2: '#200515' },
    { title: 'Dark Frequency',  genre: 'Sci-Fi',    rating: 8.8, color1: '#050520', color2: '#050a3a' },
    { title: 'Ultraviolet',     genre: 'Action',    rating: 9.0, color1: '#200a05', color2: '#3a1005' },
    { title: 'Quantum Drift',   genre: 'Sci-Fi',    rating: 8.6, color1: '#0a1020', color2: '#101530' },
    { title: 'Binary Storm',    genre: 'Thriller',  rating: 8.3, color1: '#10050a', color2: '#200510' },
    { title: 'Zenith Protocol', genre: 'Drama',     rating: 9.2, color1: '#050a15', color2: '#0a1520' },
  ],
  originals: [
    { title: 'Synthwave City',  genre: 'Original',  rating: 9.6, color1: '#1a0030', color2: '#30005a', original: true },
    { title: 'Apex Paradox',    genre: 'Original',  rating: 9.3, color1: '#001a30', color2: '#003060', original: true },
    { title: 'Mirage Protocol', genre: 'Original',  rating: 9.1, color1: '#2a0020', color2: '#450035', original: true },
    { title: 'Ghost Sequence',  genre: 'Original',  rating: 9.5, color1: '#00201a', color2: '#003530', original: true },
    { title: 'Fracture Zone',   genre: 'Original',  rating: 8.9, color1: '#200020', color2: '#350035', original: true },
    { title: 'Last Signal',     genre: 'Original',  rating: 9.0, color1: '#001520', color2: '#002535', original: true },
    { title: 'Neural Storm',    genre: 'Original',  rating: 9.4, color1: '#150020', color2: '#250035', original: true },
    { title: 'Arc Reactor',     genre: 'Original',  rating: 8.8, color1: '#001020', color2: '#001a35', original: true },
  ],
  continue: [
    { title: 'Dark Frequency',  genre: 'Sci-Fi',    rating: 8.8, color1: '#050520', color2: '#050a3a', progress: 68 },
    { title: 'Synthwave City',  genre: 'Original',  rating: 9.6, color1: '#1a0030', color2: '#30005a', progress: 23 },
    { title: 'Void Protocol',   genre: 'Thriller',  rating: 8.9, color1: '#200505', color2: '#400510', progress: 91 },
    { title: 'Apex Paradox',    genre: 'Original',  rating: 9.3, color1: '#001a30', color2: '#003060', progress: 45 },
    { title: 'Echo Chamber',    genre: 'Drama',     rating: 9.1, color1: '#050a10', color2: '#0a2010', progress: 12 },
    { title: 'Quantum Drift',   genre: 'Sci-Fi',    rating: 8.6, color1: '#0a1020', color2: '#101530', progress: 77 },
  ],
  toprated: [
    { title: 'Neon Horizon',    genre: 'Sci-Fi',    rating: 9.4, color1: '#0a0520', color2: '#1a0540' },
    { title: 'Synthwave City',  genre: 'Original',  rating: 9.6, color1: '#1a0030', color2: '#30005a' },
    { title: 'Ghost Sequence',  genre: 'Original',  rating: 9.5, color1: '#00201a', color2: '#003530' },
    { title: 'Neural Storm',    genre: 'Original',  rating: 9.4, color1: '#150020', color2: '#250035' },
    { title: 'Zenith Protocol', genre: 'Drama',     rating: 9.2, color1: '#050a15', color2: '#0a1520' },
    { title: 'Apex Paradox',    genre: 'Original',  rating: 9.3, color1: '#001a30', color2: '#003060' },
    { title: 'Echo Chamber',    genre: 'Drama',     rating: 9.1, color1: '#050a10', color2: '#0a2010' },
    { title: 'Mirage Protocol', genre: 'Original',  rating: 9.1, color1: '#2a0020', color2: '#450035' },
  ],
};

const DESCRIPTIONS = {
  'Neon Horizon':    'A rogue AI architect discovers a hidden signal beneath the Pacific — a message from a civilization that never existed.',
  'Void Protocol':   'Elite operatives descend into a classified facility where reality itself has begun to fracture.',
  'Crimson Pulse':   'A shadow organization threatens to collapse the global financial grid using weaponized algorithms.',
  'Echo Chamber':    'One physicist. Seven simultaneous quantum timelines. Only one version of her can survive.',
  'Phantom Grid':    'Someone is rewriting history from inside a neural network. The question is: who started first?',
  'Dark Frequency':  'Deep in Antarctica, a research station intercepts a signal that should not exist — from the future.',
  'Ultraviolet':     'An extinction-level solar event is 72 hours away. A rogue team races to deploy the last shield.',
  'Quantum Drift':   'Two entangled particles. Two parallel universes. One impossible love across the quantum foam.',
  'Binary Storm':    'Inside the world\'s most secure server farm, a single corrupted bit begins to evolve.',
  'Zenith Protocol': 'The pinnacle of human ambition reaches beyond the atmosphere — and something reaches back.',
  'Synthwave City':  'A neon-drenched megalopolis where corporate AI overlords and underground rebels clash in 2094.',
  'Apex Paradox':    'A time-loop thriller set in a collapsing space station where the survivors must outsmart causality.',
  'Mirage Protocol': 'In a world of perfect digital illusions, one detective can still smell a lie.',
  'Ghost Sequence':  'Classified government AI goes dark — only to resurface as something no one programmed.',
  'Fracture Zone':   'The great geological event of 2087 split California in two. The war for resources split humanity.',
  'Last Signal':     'Earth\'s final transmission to the stars returns — but it\'s been... changed.',
  'Neural Storm':    'A neurological experiment accidentally creates a shared dream between 200 million people.',
  'Arc Reactor':     'The inventor who changed the world must now unmake his greatest creation to save it.',
};

// ─── INTRO ANIMATION ─────────────────────────────────────────────────────────

(function initIntro() {
  const canvas = document.getElementById('streak-canvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Neon vertical streaks
  const streaks = [];
  const STREAK_COUNT = 60;

  function createStreak(delay = 0) {
    return {
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.5,
      speed: 4 + Math.random() * 12,
      width: 0.5 + Math.random() * 2.5,
      length: 40 + Math.random() * 200,
      opacity: 0,
      maxOpacity: 0.3 + Math.random() * 0.7,
      color: Math.random() > 0.5 ? '#00d4ff' : (Math.random() > 0.5 ? '#bf40ff' : '#ff2d78'),
      delay: delay,
      active: false,
    };
  }

  for (let i = 0; i < STREAK_COUNT; i++) {
    streaks.push(createStreak(i * 60));
  }

  let startTime = null;
  let burstTime = null;
  let animId;

  function drawStreaks(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gentle ambient phase (0–1400ms)
    const ambientPhase = elapsed < 1400;
    // Burst phase (1400ms+)
    if (elapsed > 1400 && !burstTime) burstTime = timestamp;

    streaks.forEach((s, i) => {
      if (elapsed < s.delay) return;

      if (!s.active) {
        s.active = true;
        s.x = Math.random() * canvas.width;
        s.y = -s.length;
      }

      // Burst mode: much faster
      const spd = burstTime ? s.speed * 4 : s.speed * 0.3;
      s.y += spd;

      // Fade in
      if (s.opacity < s.maxOpacity) s.opacity = Math.min(s.maxOpacity, s.opacity + 0.04);

      // Wrap
      if (s.y > canvas.height + s.length) {
        if (burstTime) {
          s.active = false;
          s.delay = timestamp + Math.random() * 100;
          s.y = -s.length;
          s.x = Math.random() * canvas.width;
        } else {
          s.y = -s.length;
          s.x = Math.random() * canvas.width;
        }
      }

      const gradient = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.length);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, s.color + Math.floor(s.opacity * 255).toString(16).padStart(2,'0'));
      gradient.addColorStop(1, 'transparent');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = burstTime ? s.width * 2 : s.width;
      ctx.shadowBlur = burstTime ? 20 : 8;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + s.length);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    animId = requestAnimationFrame(drawStreaks);
  }

  animId = requestAnimationFrame(drawStreaks);

  // Animate wordmark letters
  const letters = document.querySelectorAll('#intro-wordmark span');
  letters.forEach((letter, i) => {
    letter.style.animation = `letterReveal 0.5s ease ${1.2 + i * 0.08}s both`;
  });

  // Inject letter animation keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes letterReveal {
      from { opacity: 0; transform: translateY(30px) rotateX(90deg); }
      to   { opacity: 1; transform: translateY(0) rotateX(0deg); }
    }
  `;
  document.head.appendChild(style);

  // Transition to main app
  setTimeout(() => {
    const intro = document.getElementById('intro-screen');
    const app = document.getElementById('main-app');

    // Flash burst effect
    intro.style.transition = 'opacity 0.8s ease';
    intro.style.opacity = '0';

    setTimeout(() => {
      intro.style.display = 'none';
      cancelAnimationFrame(animId);
      app.classList.remove('hidden');
      app.style.opacity = '0';
      app.style.transition = 'opacity 0.6s ease';
      requestAnimationFrame(() => {
        app.style.opacity = '1';
      });
      initMainApp();
    }, 800);

  }, 4600);
})();

// ─── MAIN APP ────────────────────────────────────────────────────────────────

function initMainApp() {
  renderAllRows();
  initHeroCanvas();
  initNavbarScroll();
  initHeroThumbnails();
  initPlayButton();
}

// ─── RENDER CONTENT ROWS ─────────────────────────────────────────────────────

function renderAllRows() {
  Object.keys(CATALOG).forEach(rowKey => {
    renderRow(rowKey, CATALOG[rowKey]);
  });
}

function renderRow(rowKey, items) {
  const track = document.getElementById(`${rowKey}-track`);
  if (!track) return;

  track.innerHTML = '';

  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.setAttribute('tabindex', '0');

    // Generate abstract SVG art for each card
    const svgArt = generatePosterArt(item, idx);

    const progressHtml = item.progress
      ? `<div class="card-progress">
           <div class="card-progress-fill" style="width:${item.progress}%"></div>
         </div>`
      : '';

    const continueBadge = item.progress
      ? `<div class="continue-badge">${item.progress}% watched</div>`
      : '';

    const originalBadge = item.original
      ? `<div class="card-rating" style="color:var(--purple);border-color:rgba(191,64,255,0.4);background:rgba(191,64,255,0.15)">◆ ORIG</div>`
      : `<div class="card-rating">⭐ ${item.rating}</div>`;

    card.innerHTML = `
      <div class="card-thumb" style="background:linear-gradient(160deg,${item.color1} 0%,${item.color2} 40%,#000 100%)">
        <div class="card-art">${svgArt}</div>
        <div class="card-gradient-overlay"></div>
      </div>
      ${originalBadge}
      ${continueBadge}
      <div class="card-info">
        <div class="card-title">${item.title}</div>
        <div class="card-genre">${item.genre} ${item.progress ? '· ' + formatRemaining(item.progress) + ' remaining' : ''}</div>
      </div>
      <div class="card-hover-overlay">
        <button class="play-circle" onclick="openModal('${escStr(item.title)}')">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      ${progressHtml}
    `;

    card.addEventListener('dblclick', () => openModal(item.title));
    track.appendChild(card);
  });
}

function escStr(str) {
  return str.replace(/'/g, "\\'");
}

function formatRemaining(pct) {
  const totalMin = 130;
  const rem = Math.round((totalMin * (100 - pct)) / 100);
  return rem > 60
    ? `${Math.floor(rem/60)}h ${rem % 60}m`
    : `${rem}m`;
}

function generatePosterArt(item, idx) {
  const hue = [220, 280, 340, 160, 200, 260, 30, 180, 310, 120][idx % 10];
  const shapes = [
    `<circle cx="60" cy="60" r="40" fill="none" stroke="hsla(${hue},100%,70%,0.4)" stroke-width="1.5"/>
     <circle cx="60" cy="60" r="25" fill="hsla(${hue},100%,60%,0.15)"/>
     <line x1="20" y1="60" x2="100" y2="60" stroke="hsla(${hue},100%,70%,0.3)" stroke-width="1"/>
     <line x1="60" y1="20" x2="60" y2="100" stroke="hsla(${hue},100%,70%,0.3)" stroke-width="1"/>`,

    `<polygon points="60,15 100,85 20,85" fill="none" stroke="hsla(${hue},100%,70%,0.4)" stroke-width="1.5"/>
     <polygon points="60,35 85,75 35,75" fill="hsla(${hue},100%,60%,0.1)"/>`,

    `<rect x="20" y="20" width="80" height="80" fill="none" stroke="hsla(${hue},100%,70%,0.3)" stroke-width="1.5" rx="4" transform="rotate(45 60 60)"/>
     <rect x="35" y="35" width="50" height="50" fill="hsla(${hue},100%,60%,0.1)" rx="4" transform="rotate(45 60 60)"/>`,

    `<path d="M20,60 Q40,20 60,60 Q80,100 100,60" fill="none" stroke="hsla(${hue},100%,70%,0.5)" stroke-width="2"/>
     <path d="M20,60 Q40,100 60,60 Q80,20 100,60" fill="none" stroke="hsla(${hue+60},100%,70%,0.3)" stroke-width="1.5"/>`,

    `<circle cx="60" cy="60" r="35" fill="none" stroke="hsla(${hue},100%,70%,0.2)" stroke-width="1" stroke-dasharray="6 3"/>
     <circle cx="60" cy="60" r="20" fill="hsla(${hue},100%,60%,0.2)"/>
     <circle cx="60" cy="60" r="8" fill="hsla(${hue},100%,80%,0.4)"/>`,
  ];
  return `<svg viewBox="0 0 120 120" fill="none">${shapes[idx % shapes.length]}</svg>`;
}

// ─── HERO CANVAS ──────────────────────────────────────────────────────────────

function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Particle nebula system
  const particles = [];
  const PARTICLE_COUNT = 120;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 0.0002,
      speedY: (Math.random() - 0.5) * 0.0002,
      opacity: Math.random() * 0.6,
      color: ['#00d4ff', '#bf40ff', '#ff2d78', '#7b2fff'][Math.floor(Math.random() * 4)],
      twinkle: Math.random() * Math.PI * 2,
    });
  }

  // Floating orbs
  const orbs = [
    { x: 0.7, y: 0.3, r: 0.22, c1: 'rgba(123,47,255,0.25)', c2: 'transparent' },
    { x: 0.85, y: 0.6, r: 0.15, c1: 'rgba(0,212,255,0.15)', c2: 'transparent' },
    { x: 0.6, y: 0.7, r: 0.1,  c1: 'rgba(255,45,120,0.1)', c2: 'transparent' },
  ];

  let raf;
  function drawHero(ts) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Orbs
    orbs.forEach(orb => {
      const grd = ctx.createRadialGradient(
        orb.x * canvas.width, orb.y * canvas.height, 0,
        orb.x * canvas.width, orb.y * canvas.height, orb.r * canvas.width
      );
      grd.addColorStop(0, orb.c1);
      grd.addColorStop(1, orb.c2);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(orb.x * canvas.width, orb.y * canvas.height, orb.r * canvas.width, 0, Math.PI * 2);
      ctx.fill();
    });

    // Particles
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1;
      if (p.y > 1) p.y = 0;

      p.twinkle += 0.02;
      const flicker = 0.4 + 0.6 * Math.sin(p.twinkle);

      ctx.globalAlpha = p.opacity * flicker;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    raf = requestAnimationFrame(drawHero);
  }

  raf = requestAnimationFrame(drawHero);
}

// ─── PLAYER CANVAS ───────────────────────────────────────────────────────────

let playerRaf = null;
let isPlaying = false;

function initPlayerCanvas() {
  const canvas = document.getElementById('player-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.offsetWidth || 800;
  canvas.height = canvas.offsetHeight || 450;

  const lines = [];
  for (let i = 0; i < 40; i++) {
    lines.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len: 20 + Math.random() * 80,
      speed: 2 + Math.random() * 6,
      color: ['#00d4ff','#bf40ff','#ff2d78'][Math.floor(Math.random()*3)],
      opacity: 0.3 + Math.random() * 0.5,
    });
  }

  // Sci-fi grid
  function drawPlayer(ts) {
    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(191,64,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Moving lines
    lines.forEach(l => {
      l.y += l.speed;
      if (l.y > canvas.height) { l.y = -l.len; l.x = Math.random() * canvas.width; }

      const grd = ctx.createLinearGradient(l.x, l.y, l.x, l.y + l.len);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, l.color + Math.floor(l.opacity * 200).toString(16).padStart(2,'0'));
      grd.addColorStop(1, 'transparent');

      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = l.color;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x, l.y + l.len);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;

    // Center glow orb
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const pulse = 0.85 + 0.15 * Math.sin(ts * 0.002);
    const grd2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120 * pulse);
    grd2.addColorStop(0, 'rgba(191,64,255,0.3)');
    grd2.addColorStop(0.4, 'rgba(0,212,255,0.1)');
    grd2.addColorStop(1, 'transparent');
    ctx.fillStyle = grd2;
    ctx.beginPath();
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.fill();

    // "PLAYING" indicator
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = 'bold 11px "Exo 2", sans-serif';
    ctx.letterSpacing = '4px';
    ctx.textAlign = 'center';
    ctx.fillText('APPINOX ORIGINAL · 4K HDR · DOLBY ATMOS', cx, canvas.height - 20);

    if (isPlaying) playerRaf = requestAnimationFrame(drawPlayer);
  }

  isPlaying = true;
  playerRaf = requestAnimationFrame(drawPlayer);
}

function togglePlay() {
  isPlaying = !isPlaying;
  const icon = document.getElementById('play-icon');
  if (isPlaying) {
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    initPlayerCanvas();
  } else {
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    if (playerRaf) cancelAnimationFrame(playerRaf);
  }
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

function openModal(title) {
  const modal = document.getElementById('video-modal');
  const titleEl = document.getElementById('modal-title');
  const titleText = document.getElementById('modal-title-text');
  const descEl = document.getElementById('modal-desc');

  titleEl.textContent = title;
  titleText.textContent = title;
  descEl.textContent = DESCRIPTIONS[title] || 'An extraordinary cinematic experience awaits.';

  modal.classList.remove('modal-hidden');
  document.body.style.overflow = 'hidden';

  // Start player
  setTimeout(() => {
    initPlayerCanvas();

    // Progress simulation
    let pct = 0;
    const fill = document.getElementById('progress-fill');
    const currentTime = document.getElementById('current-time');
    const progressInterval = setInterval(() => {
      if (!document.body.contains(modal) || modal.classList.contains('modal-hidden')) {
        clearInterval(progressInterval);
        return;
      }
      pct += 0.05;
      if (pct >= 100) pct = 0;
      if (fill) fill.style.width = pct + '%';
      // Update thumb position
      const thumb = modal.querySelector('.progress-thumb');
      if (thumb) thumb.style.left = pct + '%';

      // Fake time display
      const totalSec = 8280;
      const elapsed = Math.floor((pct / 100) * totalSec);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      if (currentTime) {
        currentTime.textContent = h > 0
          ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
          : `${m}:${String(s).padStart(2,'0')}`;
      }
    }, 200);

    modal._progressInterval = progressInterval;
  }, 100);
}

function closeModal() {
  const modal = document.getElementById('video-modal');
  modal.classList.add('modal-hidden');
  document.body.style.overflow = '';
  isPlaying = false;
  if (playerRaf) cancelAnimationFrame(playerRaf);
  if (modal._progressInterval) clearInterval(modal._progressInterval);
}

// Keyboard close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── SCROLL ROW ──────────────────────────────────────────────────────────────

function scrollRow(rowKey, direction) {
  const track = document.getElementById(`${rowKey}-track`);
  if (!track) return;
  const scrollAmount = 440;
  track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// ─── NAVBAR SCROLL ───────────────────────────────────────────────────────────

function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });
}

// ─── HERO THUMBNAILS ─────────────────────────────────────────────────────────

function initHeroThumbnails() {
  const thumbs = document.querySelectorAll('.thumb-item');
  const titles = ['Neon Horizon', 'Void Protocol', 'Crimson Pulse', 'Echo Chamber', 'Phantom Grid'];
  const heroTitle = document.querySelector('.hero-title');
  const heroDesc = document.querySelector('.hero-desc');
  const heroGenre = document.querySelector('.hero-badge');

  const heroData = [
    { title: 'NEON\n<em>HORIZON</em>', desc: DESCRIPTIONS['Neon Horizon'], badge: 'APPINOX ORIGINAL', rating: '9.4' },
    { title: 'VOID\n<em>PROTOCOL</em>', desc: DESCRIPTIONS['Void Protocol'], badge: 'THRILLER', rating: '8.9' },
    { title: 'CRIMSON\n<em>PULSE</em>', desc: DESCRIPTIONS['Crimson Pulse'], badge: 'ACTION', rating: '8.7' },
    { title: 'ECHO\n<em>CHAMBER</em>', desc: DESCRIPTIONS['Echo Chamber'], badge: 'DRAMA', rating: '9.1' },
    { title: 'PHANTOM\n<em>GRID</em>', desc: DESCRIPTIONS['Phantom Grid'], badge: 'MYSTERY', rating: '8.5' },
  ];

  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');

      const data = heroData[i];
      if (heroTitle) {
        heroTitle.style.opacity = '0';
        heroTitle.style.transform = 'translateY(10px)';
        setTimeout(() => {
          heroTitle.innerHTML = data.title.replace('\n', '<br/>');
          heroTitle.style.transition = 'all 0.4s ease';
          heroTitle.style.opacity = '1';
          heroTitle.style.transform = 'translateY(0)';
        }, 200);
      }
      if (heroDesc) {
        heroDesc.style.opacity = '0';
        setTimeout(() => {
          heroDesc.textContent = data.desc;
          heroDesc.style.transition = 'opacity 0.4s ease';
          heroDesc.style.opacity = '1';
        }, 300);
      }
      if (heroGenre) {
        setTimeout(() => {
          heroGenre.innerHTML = `<span class="badge-icon">◆</span> ${data.badge}`;
        }, 200);
      }
    });
  });
}

// ─── HERO PLAY BUTTON ────────────────────────────────────────────────────────

function initPlayButton() {
  const playBtn = document.querySelector('.btn-play');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      openModal('Neon Horizon');
    });
  }

  const infoBtn = document.querySelector('.btn-info');
  if (infoBtn) {
    infoBtn.addEventListener('click', () => {
      openModal('Neon Horizon');
    });
  }
}

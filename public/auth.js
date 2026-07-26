/* ═══════════════════════════════════════════════════════════
   APPINOX — Auth pages shared script
═══════════════════════════════════════════════════════════ */

// Animated background canvas
(function initBg() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const streaks = Array.from({ length: 35 }, () => ({
    x: Math.random(),
    y: Math.random(),
    speed: 0.0003 + Math.random() * 0.0006,
    len: 0.04 + Math.random() * 0.12,
    w: 0.5 + Math.random() * 1.5,
    color: ['#00d4ff','#bf40ff','#ff2d78'][Math.floor(Math.random()*3)],
    opacity: 0.15 + Math.random() * 0.35,
  }));

  // Static orbs
  const orbs = [
    { x: 0.15, y: 0.3,  r: 0.35, c: 'rgba(123,47,255,0.12)' },
    { x: 0.85, y: 0.7,  r: 0.3,  c: 'rgba(0,212,255,0.08)' },
    { x: 0.5,  y: 0.9,  r: 0.25, c: 'rgba(255,45,120,0.06)' },
  ];

  function draw(ts) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Orbs
    orbs.forEach(o => {
      const grd = ctx.createRadialGradient(
        o.x * canvas.width, o.y * canvas.height, 0,
        o.x * canvas.width, o.y * canvas.height, o.r * Math.min(canvas.width, canvas.height)
      );
      grd.addColorStop(0, o.c);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(o.x * canvas.width, o.y * canvas.height, o.r * Math.min(canvas.width, canvas.height), 0, Math.PI*2);
      ctx.fill();
    });

    // Streaks
    streaks.forEach(s => {
      s.y += s.speed;
      if (s.y > 1 + s.len) { s.y = -s.len; s.x = Math.random(); }

      const x = s.x * canvas.width;
      const y0 = s.y * canvas.height;
      const y1 = y0 + s.len * canvas.height;

      const grd = ctx.createLinearGradient(x, y0, x, y1);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, s.color + Math.floor(s.opacity * 255).toString(16).padStart(2,'0'));
      grd.addColorStop(1, 'transparent');

      ctx.strokeStyle = grd;
      ctx.lineWidth = s.w;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();

// Toggle password visibility
function togglePwd(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.innerHTML = isText
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

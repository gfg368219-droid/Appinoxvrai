'use strict';
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./db');
const migrate = require('./migrate');

const app = express();
const PORT = process.env.PORT || 5000;
// Vercel (and any read-only serverless env) only allows writes to /tmp
const WRITABLE_ROOT = process.env.VERCEL ? '/tmp' : __dirname;
const VIDEOS_DIR = path.join(WRITABLE_ROOT, 'public', 'videos');
const IMAGES_DIR = path.join(WRITABLE_ROOT, 'public', 'images');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// ── Multer: video ─────────────────────────────────────────────────────────────
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEOS_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, 'v-' + uuidv4().slice(0, 8) + ext);
  },
});
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) return cb(null, true);
    cb(new Error('Format vidéo non supporté'));
  },
});

// ── Multer: image ─────────────────────────────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'img-' + uuidv4().slice(0, 8) + ext);
  },
});
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Format image non supporté'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Admin account (hardcoded — not in DB) ─────────────────────────────────────
const ADMIN = {
  id: 'admin-001',
  email: 'ysoeok@gmail.com',
  passwordHash: bcrypt.hashSync('#Real2012', 10),
  name: 'Admin',
  role: 'admin',
  createdAt: new Date().toISOString(),
  avatar: 'A',
};

// ── DB helpers ────────────────────────────────────────────────────────────────
function rowToCatalog(r) {
  return {
    id: r.id,
    title: r.title,
    genre: r.genre,
    type: r.type,
    duration: r.duration,
    year: r.year,
    audio: r.audio,
    quality: r.quality,
    description: r.description,
    trailerUrl: r.trailer_url,
    posterUrl: r.poster_url,
    videoUrl: r.video_url,
    actors: r.actors || [],
    rows: r.rows || [],
    seasons: r.seasons || [],
    addedAt: r.added_at,
    communityRating: (r.community_avg != null)
      ? { avg: parseFloat(r.community_avg), count: parseInt(r.community_count) || 0 }
      : null,
  };
}

async function getCatalogWithRatings() {
  const { rows } = await pool.query(`
    SELECT c.*,
      ROUND(AVG(r.rating)::numeric, 1)::float AS community_avg,
      COUNT(r.rating)::int                    AS community_count
    FROM catalog c
    LEFT JOIN ratings r ON r.item_id = c.id
    GROUP BY c.id
    ORDER BY c.added_at DESC
  `);
  return rows.map(rowToCatalog);
}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'appinox-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non authentifié' });
  res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (req.session?.role === 'admin') return next();
  res.status(403).json({ error: 'Accès refusé' });
}

// ── Static (public, no auth) ──────────────────────────────────────────────────
app.use('/auth.css',  express.static(path.join(__dirname, 'public', 'auth.css')));
app.use('/auth.js',   express.static(path.join(__dirname, 'public', 'auth.js')));
app.use('/style.css', express.static(path.join(__dirname, 'public', 'style.css')));
app.use('/logo.png',  express.static(path.join(__dirname, 'public', 'logo.png')));
// Serve uploaded images/videos from writable root (supports /tmp on Vercel)
app.use('/images', express.static(IMAGES_DIR));
app.use('/videos', express.static(VIDEOS_DIR));

// ── Auth pages ────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/forgot-password', (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

// ── API: Forgot password (public) ─────────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email, secretCode, newPassword } = req.body;
    if (!email || !secretCode || !newPassword)
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(email)=lower($1)', [email.trim()]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Aucun compte avec cet email' });
    if (!user.secret_code || user.secret_code.toLowerCase() !== secretCode.toLowerCase().trim())
      return res.status(401).json({ error: 'Code secret incorrect' });
    await pool.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2',
      [bcrypt.hashSync(newPassword, 10), user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Login ────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Champs manquants' });

    if (email.toLowerCase() === ADMIN.email.toLowerCase()) {
      if (!bcrypt.compareSync(password, ADMIN.passwordHash))
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      req.session.userId = ADMIN.id;
      req.session.role   = 'admin';
      req.session.name   = ADMIN.name;
      req.session.email  = ADMIN.email;
      return res.json({ success: true, role: 'admin', name: ADMIN.name });
    }

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(email)=lower($1)', [email.trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Aucun compte avec cet email' });
    if (!bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Mot de passe incorrect' });

    req.session.userId = user.id;
    req.session.role   = user.role || 'user';
    req.session.name   = user.name;
    req.session.email  = user.email;
    res.json({ success: true, role: user.role || 'user', name: user.name, firstLogin: !user.secret_code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Register ─────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
    if (email.toLowerCase() === ADMIN.email.toLowerCase())
      return res.status(400).json({ error: 'Email déjà utilisé' });

    const { rows: dup } = await pool.query(
      'SELECT id FROM users WHERE lower(email)=lower($1)', [email.trim()]
    );
    if (dup.length) return res.status(400).json({ error: 'Email déjà utilisé' });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, avatar, watchlist, secret_code, first_login)
       VALUES ($1,$2,$3,$4,'user',$5,'[]'::jsonb,NULL,true)`,
      [id, name.trim(), email.toLowerCase().trim(),
       bcrypt.hashSync(password, 10), name.trim()[0].toUpperCase()]
    );

    req.session.userId = id;
    req.session.role   = 'user';
    req.session.name   = name.trim();
    req.session.email  = email.toLowerCase().trim();
    res.json({ success: true, name: name.trim(), firstLogin: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Logout ───────────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── API: Me ───────────────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    let firstLogin = false;
    if (req.session.userId !== ADMIN.id) {
      const { rows } = await pool.query(
        'SELECT secret_code FROM users WHERE id=$1', [req.session.userId]
      );
      firstLogin = !rows[0]?.secret_code;
    }
    res.json({
      id:        req.session.userId,
      name:      req.session.name,
      email:     req.session.email,
      role:      req.session.role,
      avatar:    req.session.name?.[0]?.toUpperCase() || 'U',
      firstLogin,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Secret code management ───────────────────────────────────────────────
app.post('/api/set-secret-code', requireAuth, async (req, res) => {
  if (req.session.userId === ADMIN.id)
    return res.status(403).json({ error: 'Non applicable' });
  const { code } = req.body;
  if (!code || code.trim().length < 3)
    return res.status(400).json({ error: 'Code trop court (min. 3 caractères)' });
  try {
    await pool.query(
      'UPDATE users SET secret_code=$1, first_login=false WHERE id=$2',
      [code.trim(), req.session.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/my-code', requireAuth, async (req, res) => {
  if (req.session.userId === ADMIN.id) return res.json({ code: null });
  try {
    const { rows } = await pool.query(
      'SELECT secret_code FROM users WHERE id=$1', [req.session.userId]
    );
    res.json({ code: rows[0]?.secret_code || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/verify-secret-code', requireAuth, async (req, res) => {
  if (req.session.userId === ADMIN.id) return res.json({ valid: true });
  try {
    const { rows } = await pool.query(
      'SELECT secret_code FROM users WHERE id=$1', [req.session.userId]
    );
    const user = rows[0];
    if (!user || !user.secret_code) return res.json({ valid: false });
    res.json({ valid: user.secret_code.toLowerCase() === (req.body.code || '').toLowerCase().trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Catalog ──────────────────────────────────────────────────────────────
app.get('/api/catalog', requireAuth, async (req, res) => {
  try {
    res.json(await getCatalogWithRatings());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Ratings ──────────────────────────────────────────────────────────────
app.get('/api/ratings', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT item_id,
        ROUND(AVG(rating)::numeric, 1)::float AS avg,
        COUNT(*)::int                          AS count
      FROM ratings GROUP BY item_id
    `);
    const result = {};
    rows.forEach(r => { result[r.item_id] = { avg: r.avg, count: r.count }; });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rating/:id', requireAuth, async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.session.userId;
    const [myRow, aggRow] = await Promise.all([
      pool.query('SELECT rating FROM ratings WHERE item_id=$1 AND user_id=$2', [itemId, userId]),
      pool.query(
        'SELECT ROUND(AVG(rating)::numeric,1)::float AS avg, COUNT(*)::int AS count FROM ratings WHERE item_id=$1',
        [itemId]
      ),
    ]);
    res.json({
      myRating: parseFloat(myRow.rows[0]?.rating) || 0,
      avg:      parseFloat(aggRow.rows[0]?.avg)   || 0,
      count:    parseInt(aggRow.rows[0]?.count)   || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rating/:id', requireAuth, async (req, res) => {
  try {
    const r = parseFloat(req.body.rating);
    if (isNaN(r) || r < 1 || r > 5)
      return res.status(400).json({ error: 'Note invalide (1-5)' });
    const itemId = req.params.id;
    const userId = req.session.userId;
    await pool.query(
      `INSERT INTO ratings (item_id, user_id, rating) VALUES ($1,$2,$3)
       ON CONFLICT (item_id, user_id) DO UPDATE SET rating = EXCLUDED.rating`,
      [itemId, userId, r]
    );
    const { rows } = await pool.query(
      'SELECT ROUND(AVG(rating)::numeric,1)::float AS avg, COUNT(*)::int AS count FROM ratings WHERE item_id=$1',
      [itemId]
    );
    res.json({ success: true, avg: parseFloat(rows[0].avg), count: parseInt(rows[0].count), myRating: r });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Search ───────────────────────────────────────────────────────────────
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const { rows } = await pool.query(`
      SELECT * FROM catalog
      WHERE lower(title)       LIKE lower('%' || $1 || '%')
         OR lower(genre)       LIKE lower('%' || $1 || '%')
         OR lower(description) LIKE lower('%' || $1 || '%')
         OR lower(audio)       LIKE lower('%' || $1 || '%')
         OR lower(type)        LIKE lower('%' || $1 || '%')
      ORDER BY added_at DESC LIMIT 30
    `, [q]);
    res.json({ results: rows.map(r => rowToCatalog(r)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Watchlist ────────────────────────────────────────────────────────────
app.get('/api/watchlist', requireAuth, async (req, res) => {
  if (req.session.userId === ADMIN.id) return res.json({ watchlist: [] });
  try {
    const { rows } = await pool.query(
      'SELECT watchlist FROM users WHERE id=$1', [req.session.userId]
    );
    res.json({ watchlist: rows[0]?.watchlist || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/watchlist/:id', requireAuth, async (req, res) => {
  if (req.session.userId === ADMIN.id) return res.json({ success: true, inList: false });
  try {
    const { rows } = await pool.query(
      'SELECT watchlist FROM users WHERE id=$1', [req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const wl  = rows[0].watchlist || [];
    const id  = req.params.id;
    const idx = wl.indexOf(id);
    if (idx === -1) wl.push(id); else wl.splice(idx, 1);
    await pool.query(
      'UPDATE users SET watchlist=$1 WHERE id=$2',
      [JSON.stringify(wl), req.session.userId]
    );
    res.json({ success: true, inList: idx === -1 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Admin — Users ────────────────────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, avatar,
              created_at AS "createdAt", first_login AS "firstLogin"
       FROM users ORDER BY created_at DESC`
    );
    res.json({ users: rows, total: rows.length + 1 }); // +1 for hardcoded admin
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── API: Admin — Auto Search (TVmaze + iTunes) ────────────────────────────────
app.get('/api/admin/auto-search', requireAuth, requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const headers = { 'User-Agent': 'APPINOX/1.0' };
    const [moviesRes, tvRes] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=movie&entity=movie&limit=10&country=fr`, { headers }),
      fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { headers }),
    ]);
    const [moviesData, tvData] = await Promise.all([moviesRes.json(), tvRes.json()]);
    const seen = new Set();

    function mapMovie(x) {
      const title = (x.trackName || x.collectionName || '').trim();
      const key = title.toLowerCase() + 'film';
      if (!title || seen.has(key)) return null;
      seen.add(key);
      return {
        itunesId: 'itunes:' + String(x.trackId || x.collectionId),
        title, type: 'film',
        year: (x.releaseDate || '').slice(0, 4),
        overview: x.longDescription || x.description || '',
        poster: (x.artworkUrl100 || '').replace('100x100bb', '600x600bb') || null,
        genre: x.primaryGenreName || '',
        durationMs: x.trackTimeMillis || null,
      };
    }

    function mapTV(entry) {
      const show = entry.show || entry;
      const title = (show.name || '').trim();
      const key = title.toLowerCase() + 'serie';
      if (!title || seen.has(key)) return null;
      seen.add(key);
      const runtime = show.averageRuntime || show.runtime || null;
      return {
        itunesId: 'tvmaze:' + String(show.id),
        title, type: 'serie',
        year: (show.premiered || show.ended || '').slice(0, 4),
        overview: (show.summary || '').replace(/<[^>]*>/g, ''),
        poster: show.image?.original || show.image?.medium || null,
        genre: (show.genres || [])[0] || '',
        durationMs: runtime ? runtime * 60000 : null,
      };
    }

    const movies = (moviesData.results || []).map(mapMovie).filter(Boolean);
    const tv     = (Array.isArray(tvData) ? tvData : []).map(mapTV).filter(Boolean);
    const results = [];
    const max = Math.max(movies.length, tv.length);
    for (let i = 0; i < max && results.length < 10; i++) {
      if (movies[i]) results.push(movies[i]);
      if (tv[i] && results.length < 10) results.push(tv[i]);
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Erreur de recherche: ' + err.message });
  }
});

// ── API: Admin — Auto Detail ──────────────────────────────────────────────────
app.get('/api/admin/auto-detail/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const raw = req.params.id;
    if (raw.startsWith('tvmaze:')) {
      const tvId = raw.slice(7);
      const r = await fetch(`https://api.tvmaze.com/shows/${encodeURIComponent(tvId)}`, {
        headers: { 'User-Agent': 'APPINOX/1.0' },
      });
      const show = await r.json();
      const runtime = show.averageRuntime || show.runtime || null;
      const runtimeStr = runtime
        ? (runtime >= 60 ? `${Math.floor(runtime / 60)}h ${runtime % 60}min` : `${runtime}min`)
        : null;
      return res.json({ genre: (show.genres || [])[0] || '', runtime: runtimeStr });
    }
    const itunesId = raw.startsWith('itunes:') ? raw.slice(7) : raw;
    const r = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(itunesId)}`, {
      headers: { 'User-Agent': 'APPINOX/1.0' },
    });
    const data = await r.json();
    const item = (data.results || [])[0];
    if (!item) return res.json({});
    const durationMs = item.trackTimeMillis || null;
    let runtime = null;
    if (durationMs) {
      const mins = Math.round(durationMs / 60000);
      runtime = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`;
    }
    res.json({ genre: item.primaryGenreName || '', runtime });
  } catch (err) {
    res.status(500).json({ error: 'Erreur détail' });
  }
});

// ── API: Admin — Add content ──────────────────────────────────────────────────
app.post('/api/admin/content', requireAuth, requireAdmin, uploadImage.none(), async (req, res) => {
  try {
    const { title, genre, type, duration, year, audio, quality,
            description, trailerUrl, posterUrl, videoUrl } = req.body;
    let { rows, actors } = req.body;

    if (!title || !genre || !type || !audio)
      return res.status(400).json({ error: 'Titre, genre, type et audio sont obligatoires' });

    let parsedActors = [];
    if (actors) {
      try { parsedActors = typeof actors === 'string' ? JSON.parse(actors) : actors; } catch {}
    }
    const parsedRows = Array.isArray(rows) ? rows : (rows ? [rows] : []);

    let parsedSeasons = [];
    if (req.body.seasons) {
      try { parsedSeasons = typeof req.body.seasons === 'string' ? JSON.parse(req.body.seasons) : req.body.seasons; } catch {}
    }

    const id = 'c-' + uuidv4().slice(0, 8);
    await pool.query(
      `INSERT INTO catalog
         (id, title, genre, type, duration, year, audio, quality, description,
          trailer_url, poster_url, video_url, actors, rows, seasons)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id, title.trim(), genre.trim(), type,
        duration?.trim() || null,
        parseInt(year) || new Date().getFullYear(),
        audio, quality || null, (description || '').trim(),
        trailerUrl?.trim() || null, posterUrl?.trim() || null, videoUrl?.trim() || null,
        JSON.stringify(parsedActors), JSON.stringify(parsedRows), JSON.stringify(parsedSeasons),
      ]
    );
    const catalog = await getCatalogWithRatings();
    res.json({ success: true, item: catalog.find(c => c.id === id), catalog });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Admin — Edit content ─────────────────────────────────────────────────
app.patch('/api/admin/content/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM catalog WHERE id=$1', [req.params.id]
    );

    if (!existingRows.length) return res.status(404).json({ error: 'Contenu non trouvé' });
    const cur = existingRows[0];

    const { rows: updRows, actors: updActors, seasons: updSeasons, ...rest } = req.body;

    const parsedRows = updRows !== undefined
      ? (Array.isArray(updRows) ? updRows : (updRows ? [updRows] : []))
      : (cur.rows || []);

    let parsedActors = cur.actors || [];
    if (updActors !== undefined) {
      try { parsedActors = typeof updActors === 'string' ? JSON.parse(updActors) : updActors; } catch {}
    }

    let parsedSeasons = cur.seasons || [];
    if (updSeasons !== undefined) {
      try { parsedSeasons = typeof updSeasons === 'string' ? JSON.parse(updSeasons) : updSeasons; } catch {}
    }

    await pool.query(
      `UPDATE catalog SET
         title=$1, genre=$2, type=$3, duration=$4, year=$5, audio=$6, quality=$7,
         description=$8, trailer_url=$9, poster_url=$10, video_url=$11,
         actors=$12, rows=$13, seasons=$14
       WHERE id=$15`,
      [
        rest.title       ?? cur.title,
        rest.genre       ?? cur.genre,
        rest.type        ?? cur.type,
        rest.duration    ?? cur.duration,
        rest.year !== undefined ? (parseInt(rest.year) || cur.year) : cur.year,
        rest.audio       ?? cur.audio,
        rest.quality     ?? cur.quality,
        rest.description ?? cur.description,
        rest.trailerUrl  ?? cur.trailer_url,
        rest.posterUrl   ?? cur.poster_url,
        rest.videoUrl    ?? cur.video_url,
        JSON.stringify(parsedActors),
        JSON.stringify(parsedRows),
        JSON.stringify(parsedSeasons),
        req.params.id,
      ]
    );
    const catalog = await getCatalogWithRatings();
    res.json({ success: true, item: catalog.find(c => c.id === req.params.id), catalog });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Admin — Delete content ───────────────────────────────────────────────
app.delete('/api/admin/content/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM catalog WHERE id=$1', [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Contenu non trouvé' });
    const item = existing[0];
    if (item.video_url?.startsWith('/videos/')) {
      try { fs.unlinkSync(path.join(__dirname, 'public', item.video_url)); } catch {}
    }
    if (item.poster_url?.startsWith('/images/')) {
      try { fs.unlinkSync(path.join(__dirname, 'public', item.poster_url)); } catch {}
    }
    await pool.query('DELETE FROM ratings WHERE item_id=$1', [req.params.id]);
    await pool.query('DELETE FROM catalog WHERE id=$1', [req.params.id]);
    const catalog = await getCatalogWithRatings();
    res.json({ success: true, catalog });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── API: Suggestions ──────────────────────────────────────────────────────────
app.post('/api/suggestions', requireAuth, async (req, res) => {
  if (req.session.userId === ADMIN.id)
    return res.status(403).json({ error: 'Les admins ne peuvent pas faire de suggestions' });
  try {
    const { title, type, preferredVersion, note } = req.body;
    if (!title?.trim() || !preferredVersion)
      return res.status(400).json({ error: 'Titre et version audio sont requis' });
    const id = 's-' + uuidv4().slice(0, 8);
    await pool.query(
      `INSERT INTO suggestions (id, user_id, user_name, title, type, preferred_version, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, req.session.userId, req.session.name,
       title.trim(), type || '', preferredVersion, (note || '').trim()]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/suggestions', requireAuth, async (req, res) => {
  try {
    const q = req.session.role === 'admin'
      ? 'SELECT * FROM suggestions ORDER BY created_at DESC'
      : 'SELECT * FROM suggestions WHERE user_id=$1 ORDER BY created_at DESC';
    const params = req.session.role === 'admin' ? [] : [req.session.userId];
    const { rows } = await pool.query(q, params);
    res.json({ suggestions: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/admin/suggestions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status))
      return res.status(400).json({ error: 'Statut invalide' });
    await pool.query(
      'UPDATE suggestions SET status=$1, admin_note=$2 WHERE id=$3',
      [status, adminNote || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/suggestions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM suggestions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Protected static ──────────────────────────────────────────────────────────
app.use(requireAuth, express.static(path.join(__dirname, 'public')));

// ── Protected pages ───────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (req, res) => {
  if (req.session?.userId) res.sendFile(path.join(__dirname, 'public', 'index.html'));
  else res.redirect('/login');
});

migrate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`✦ APPINOX → port ${PORT}`));
  })
  .catch((err) => {
    console.error('✘ Startup migration failed:', err.message);
    process.exit(1);
  });

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = 5000;
const DATA_DIR   = path.join(__dirname, 'data');
const USERS_FILE   = path.join(DATA_DIR, 'users.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const RATINGS_FILE = path.join(DATA_DIR, 'ratings.json');
const PUBLIC_CATALOG = path.join(__dirname, 'public', 'data', 'catalog.json');
const VIDEOS_DIR = path.join(__dirname, 'public', 'videos');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'public', 'data'), { recursive: true });

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function loadUsers()   { return loadJSON(USERS_FILE, []); }
function saveUsers(u)  { saveJSON(USERS_FILE, u); }
function loadCatalog() { return loadJSON(CATALOG_FILE, []); }
function saveCatalog(c) {
  saveJSON(CATALOG_FILE, c);
  saveJSON(PUBLIC_CATALOG, c);
}
function loadRatings() { return loadJSON(RATINGS_FILE, {}); }
function saveRatings(r) { saveJSON(RATINGS_FILE, r); }

// Compute average ratings map { itemId -> { avg, count } }
function computeAvgRatings() {
  const raw = loadRatings();
  const result = {};
  for (const [itemId, votes] of Object.entries(raw)) {
    const vals = Object.values(votes);
    if (!vals.length) continue;
    result[itemId] = {
      avg: Math.round((vals.reduce((a,b) => a+b, 0) / vals.length) * 10) / 10,
      count: vals.length,
    };
  }
  return result;
}

// ── Admin account ─────────────────────────────────────────────────────────────
const ADMIN = {
  id: 'admin-001',
  email: 'ysoeok@gmail.com',
  passwordHash: bcrypt.hashSync('#Real2012', 10),
  name: 'Admin',
  role: 'admin',
  createdAt: new Date().toISOString(),
  avatar: 'A',
};

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
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

// ── Auth pages ────────────────────────────────────────────────────────────────
app.get('/login',    (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
  if (req.session?.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// ── API: Login ────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
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

  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Aucun compte avec cet email' });
  if (!bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: 'Mot de passe incorrect' });

  req.session.userId = user.id;
  req.session.role   = user.role || 'user';
  req.session.name   = user.name;
  req.session.email  = user.email;
  res.json({ success: true, role: user.role || 'user', name: user.name });
});

// ── API: Register ─────────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
  if (email.toLowerCase() === ADMIN.email.toLowerCase()) return res.status(400).json({ error: 'Email déjà utilisé' });

  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(400).json({ error: 'Email déjà utilisé' });

  const newUser = {
    id: uuidv4(), name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user', createdAt: new Date().toISOString(),
    avatar: name.trim()[0].toUpperCase(),
    watchlist: [],
  };
  users.push(newUser);
  saveUsers(users);

  req.session.userId = newUser.id;
  req.session.role   = 'user';
  req.session.name   = newUser.name;
  req.session.email  = newUser.email;
  res.json({ success: true, name: newUser.name });
});

// ── API: Logout ───────────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── API: Me ───────────────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId, name: req.session.name,
    email: req.session.email, role: req.session.role,
    avatar: req.session.name?.[0]?.toUpperCase() || 'U',
  });
});

// ── API: Catalog ──────────────────────────────────────────────────────────────
app.get('/api/catalog', requireAuth, (req, res) => {
  const catalog = loadCatalog();
  const avgRatings = computeAvgRatings();
  const result = catalog.map(item => ({
    ...item,
    communityRating: avgRatings[item.id] || null,
  }));
  res.json(result);
});

// ── API: Ratings ──────────────────────────────────────────────────────────────
app.get('/api/ratings', requireAuth, (req, res) => {
  res.json(computeAvgRatings());
});

app.get('/api/rating/:id', requireAuth, (req, res) => {
  const ratings = loadRatings();
  const itemRatings = ratings[req.params.id] || {};
  const myRating = itemRatings[req.session.userId] || 0;
  const vals = Object.values(itemRatings);
  const avg  = vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : 0;
  res.json({ myRating, avg, count: vals.length });
});

app.post('/api/rating/:id', requireAuth, (req, res) => {
  const { rating } = req.body;
  const r = parseFloat(rating);
  if (isNaN(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Note invalide (1-5)' });

  const ratings = loadRatings();
  if (!ratings[req.params.id]) ratings[req.params.id] = {};
  ratings[req.params.id][req.session.userId] = r;
  saveRatings(ratings);

  const vals = Object.values(ratings[req.params.id]);
  const avg  = Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10;
  res.json({ success: true, avg, count: vals.length, myRating: r });
});

// ── API: Search ───────────────────────────────────────────────────────────────
app.get('/api/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ results: [] });
  const catalog = loadCatalog();
  const results = catalog.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.genre.toLowerCase().includes(q) ||
    (c.description || '').toLowerCase().includes(q) ||
    (c.audio || '').toLowerCase().includes(q) ||
    (c.type || '').toLowerCase().includes(q)
  );
  res.json({ results: results.slice(0, 30) });
});

// ── API: Watchlist ────────────────────────────────────────────────────────────
app.get('/api/watchlist', requireAuth, (req, res) => {
  if (req.session.userId === ADMIN.id) return res.json({ watchlist: [] });
  const user = loadUsers().find(u => u.id === req.session.userId);
  res.json({ watchlist: user?.watchlist || [] });
});

app.post('/api/watchlist/:id', requireAuth, (req, res) => {
  if (req.session.userId === ADMIN.id) return res.json({ success: true, inList: false });
  const users = loadUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  if (!Array.isArray(user.watchlist)) user.watchlist = [];
  const id = req.params.id;
  const idx = user.watchlist.indexOf(id);
  if (idx === -1) user.watchlist.push(id);
  else user.watchlist.splice(idx, 1);
  saveUsers(users);
  res.json({ success: true, inList: idx === -1 });
});

// ── API: Admin — Users ────────────────────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = loadUsers().map(({ passwordHash, ...u }) => u);
  res.json({ users, total: users.length + 1 });
});

// ── API: Admin — Standalone video upload (background) ────────────────────────
app.post('/api/admin/upload-video', requireAuth, requireAdmin, uploadVideo.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier vidéo reçu' });
  res.json({ success: true, filename: req.file.filename, videoUrl: '/videos/' + req.file.filename });
});

// ── API: Admin — Standalone image upload ─────────────────────────────────────
app.post('/api/admin/upload-image', requireAuth, requireAdmin, uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image reçue' });
  res.json({ success: true, filename: req.file.filename, imageUrl: '/images/' + req.file.filename });
});

// ── API: Admin — Auto Search (iTunes, aucune clé requise) ────────────────────
app.get('/api/admin/auto-search', requireAuth, requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=all&entity=movie,tvSeason&limit=16&country=fr`;
    const r = await fetch(url, { headers: { 'User-Agent': 'APPINOX/1.0' } });
    const data = await r.json();
    const seen = new Set();
    const results = (data.results || [])
      .filter(x => x.kind === 'feature-movie' || x.collectionType === 'TV Season')
      .map(x => {
        const isTV = x.collectionType === 'TV Season';
        let title = isTV
          ? (x.artistName || (x.collectionName || '').replace(/,\s*(saison|season)\s*\d+/i, ''))
          : (x.trackName || '');
        title = title.trim();
        const key = title.toLowerCase() + isTV;
        if (!title || seen.has(key)) return null;
        seen.add(key);
        const poster = (x.artworkUrl100 || '').replace('100x100bb', '600x600bb');
        const year   = (x.releaseDate || '').slice(0, 4);
        const durationMs = x.trackTimeMillis || null;
        return {
          itunesId: isTV ? String(x.collectionId) : String(x.trackId),
          title,
          type: isTV ? 'serie' : 'film',
          year,
          overview: x.longDescription || x.description || '',
          poster:   poster || null,
          genre:    x.primaryGenreName || '',
          durationMs,
        };
      })
      .filter(Boolean)
      .slice(0, 8);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Erreur de recherche: ' + err.message });
  }
});

// ── API: Admin — Auto Detail (iTunes lookup) ──────────────────────────────────
app.get('/api/admin/auto-detail/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(req.params.id)}`, {
      headers: { 'User-Agent': 'APPINOX/1.0' },
    });
    const data = await r.json();
    const item = (data.results || [])[0];
    if (!item) return res.json({});
    const genre = item.primaryGenreName || '';
    const durationMs = item.trackTimeMillis || null;
    let runtime = null;
    if (durationMs) {
      const mins = Math.round(durationMs / 60000);
      runtime = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`;
    }
    res.json({ genre, runtime });
  } catch (err) {
    res.status(500).json({ error: 'Erreur détail' });
  }
});

// ── API: Admin — Add content ──────────────────────────────────────────────────
app.post('/api/admin/content', requireAuth, requireAdmin, (req, res) => {
  const { title, genre, type, duration, year, audio, quality, description, trailerUrl, posterUrl, videoUrl } = req.body;
  let { rows, actors } = req.body;

  if (!title || !genre || !type || !audio)
    return res.status(400).json({ error: 'Titre, genre, type et audio sont obligatoires' });

  let parsedActors = [];
  if (actors) {
    try { parsedActors = typeof actors === 'string' ? JSON.parse(actors) : actors; } catch {}
  }

  const catalog = loadCatalog();
  const newItem = {
    id:          'c-' + uuidv4().slice(0, 8),
    title:       title.trim(),
    genre:       genre.trim(),
    type,
    duration:    duration?.trim() || null,
    year:        parseInt(year) || new Date().getFullYear(),
    audio,
    quality:     quality || null,
    description: (description || '').trim(),
    trailerUrl:  trailerUrl?.trim() || null,
    posterUrl:   posterUrl?.trim() || null,
    videoUrl:    videoUrl?.trim() || null,
    actors:      parsedActors,
    rows:        Array.isArray(rows) ? rows : (rows ? [rows] : []),
    addedAt:     new Date().toISOString(),
  };

  catalog.unshift(newItem);
  saveCatalog(catalog);
  res.json({ success: true, item: newItem, catalog });
});

// ── API: Admin — Edit content ─────────────────────────────────────────────────
app.patch('/api/admin/content/:id', requireAuth, requireAdmin, (req, res) => {
  const catalog = loadCatalog();
  const idx = catalog.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contenu non trouvé' });
  const { rows, ...rest } = req.body;
  catalog[idx] = { ...catalog[idx], ...rest };
  if (rows !== undefined) catalog[idx].rows = Array.isArray(rows) ? rows : (rows ? [rows] : []);
  saveCatalog(catalog);
  res.json({ success: true, item: catalog[idx], catalog });
});

// ── API: Admin — Delete content ───────────────────────────────────────────────
app.delete('/api/admin/content/:id', requireAuth, requireAdmin, (req, res) => {
  let catalog = loadCatalog();
  const item = catalog.find(c => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Contenu non trouvé' });
  if (item.videoUrl && item.videoUrl.startsWith('/videos/')) {
    try { fs.unlinkSync(path.join(__dirname, 'public', item.videoUrl)); } catch {}
  }
  if (item.posterUrl && item.posterUrl.startsWith('/images/')) {
    try { fs.unlinkSync(path.join(__dirname, 'public', item.posterUrl)); } catch {}
  }
  catalog = catalog.filter(c => c.id !== req.params.id);
  saveCatalog(catalog);
  // Also remove ratings for this item
  const ratings = loadRatings();
  delete ratings[req.params.id];
  saveRatings(ratings);
  res.json({ success: true, catalog });
});

// ── Protected static ──────────────────────────────────────────────────────────
app.use(requireAuth, express.static(path.join(__dirname, 'public')));

// ── Protected pages ───────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (req, res) => {
  if (req.session?.userId) res.sendFile(path.join(__dirname, 'public', 'index.html'));
  else res.redirect('/login');
});

app.listen(PORT, '0.0.0.0', () => console.log(`✦ APPINOX → port ${PORT}`));

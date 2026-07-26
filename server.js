const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const PUBLIC_CATALOG = path.join(__dirname, 'public', 'data', 'catalog.json');

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function loadUsers() { return loadJSON(USERS_FILE, []); }
function saveUsers(u) { saveJSON(USERS_FILE, u); }
function loadCatalog() { return loadJSON(CATALOG_FILE, []); }
function saveCatalog(c) {
  saveJSON(CATALOG_FILE, c);
  saveJSON(PUBLIC_CATALOG, c); // keep public copy in sync
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
app.use('/auth.css', express.static(path.join(__dirname, 'public', 'auth.css')));
app.use('/auth.js',  express.static(path.join(__dirname, 'public', 'auth.js')));
app.use('/style.css',express.static(path.join(__dirname, 'public', 'style.css')));

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
  res.json(loadCatalog());
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
  res.json({ users, total: users.length + 1 }); // +1 for hardcoded admin
});

// ── API: Admin — Add content ──────────────────────────────────────────────────
app.post('/api/admin/content', requireAuth, requireAdmin, (req, res) => {
  const { title, genre, type, duration, year, rating, audio, quality, description, rows } = req.body;
  if (!title || !genre || !type || !audio)
    return res.status(400).json({ error: 'Titre, genre, type et audio sont obligatoires' });

  const catalog = loadCatalog();
  const newItem = {
    id: 'c-' + uuidv4().slice(0, 8),
    title: title.trim(),
    genre: genre.trim(),
    type,
    duration: duration?.trim() || null,
    year: year || new Date().getFullYear(),
    rating: rating ? parseFloat(rating) : null,
    audio,
    quality: quality || null,
    description: (description || '').trim(),
    rows: Array.isArray(rows) ? rows : (rows ? [rows] : []),
    addedAt: new Date().toISOString(),
  };

  catalog.unshift(newItem); // newest first
  saveCatalog(catalog);
  res.json({ success: true, item: newItem, catalog });
});

// ── API: Admin — Delete content ───────────────────────────────────────────────
app.delete('/api/admin/content/:id', requireAuth, requireAdmin, (req, res) => {
  let catalog = loadCatalog();
  const before = catalog.length;
  catalog = catalog.filter(c => c.id !== req.params.id);
  if (catalog.length === before) return res.status(404).json({ error: 'Contenu non trouvé' });
  saveCatalog(catalog);
  res.json({ success: true, catalog });
});

// ── Protected static ──────────────────────────────────────────────────────────
app.use(requireAuth, express.static(path.join(__dirname, 'public')));

// ── Protected pages ───────────────────────────────────────────────────────────
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('*', (req, res) => {
  if (req.session?.userId) res.sendFile(path.join(__dirname, 'public', 'index.html'));
  else res.redirect('/login');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✦ APPINOX → port ${PORT}`);
});

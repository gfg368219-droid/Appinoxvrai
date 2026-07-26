# APPINOX

A private media catalogue platform where admins manage the film/series library and authenticated users browse, search, and track their watchlist.

## Stack
- **Backend**: Node.js + Express (CommonJS)
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Storage**: JSON files in `data/` (`users.json`, `catalog.json`)
- **Auth**: `express-session` + `bcryptjs`
- **Entry point**: `server.js`, serves on port 5000

## Run
```bash
node server.js
```

## Admin account
- Email: `ysoeok@gmail.com`
- Password: set in `server.js` (hardcoded hash)

## Key features
- Intro animation with APPINOX logo on first load
- Admin panel: add/delete content (title, genre, type, year, audio format, quality, description)
- Persistent playback: progress saved to `localStorage` (`appinox_resume`), "Continue watching" row shown on home page after returning
- Watchlist per user
- Search across title, genre, description, audio

## Environment secrets
- `SESSION_SECRET` — used for `express-session`

## User preferences
- French UI throughout
- No "streaming" branding in taglines — just APPINOX
- Logo icon must match the reference image (3D "A" shape, cyan-blue left face, dark right face, diagonal purple-pink arrow)

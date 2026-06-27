# Speakly — AI English Coach

Friendly AI coach that helps non-native speakers correct mistakes, sound more
natural, practice speaking and build confidence. 100% free for students.

## 📁 Project structure

```
speakly/
├── index.html              # Marketing landing page
├── app.html                # The app (hash-router SPA: dashboard, chat, voice…)
├── assets/
│   ├── css/
│   │   ├── landing.css      # styles for index.html
│   │   └── app.css          # styles for app.html
│   ├── js/
│   │   ├── landing.js       # landing page interactivity + demo engine
│   │   └── app.js           # app router, pages, smart-correction & voice engine
│   └── img/                 # local images / icons / favicon (currently none —
│                            #   UI icons come from Lucide CDN, fonts from Google)
└── README.md
```

## 🧭 How it works

- **`index.html`** is the public landing page. Its CTAs link into the app
  (`app.html#/dashboard`, `app.html#/chat`, …).
- **`app.html`** is a single-page app with a hash router. Routes:
  `#/dashboard`, `#/chat`, `#/native`, `#/modes`, `#/voice`, `#/pronunciation`,
  `#/ielts`, `#/progress`.
- The theme system (light / dark / system) is applied before paint by a tiny
  inline script in `app.html`'s `<head>` (kept inline on purpose to avoid a
  flash of the wrong theme).

## 🔌 External dependencies (CDN)

- **Lucide** icons — `https://unpkg.com/lucide@latest`
- **Google Fonts** — Plus Jakarta Sans + Inter

> Needs an internet connection for icons/fonts. To go fully offline, vendor
> `lucide.min.js` and the font files into `assets/`.

## 🤖 AI engine

All AI logic in `assets/js/app.js` and `assets/js/landing.js` is currently a
smart **on-device demo engine** (`analyze()`, `naturalize()`, `coachReply()`,
the `runCorrect/runNative/runModes` functions). These are the exact spots to
replace with real **Claude API** calls when wiring the backend.

## 🔐 Auth & limits (Supabase + Google)

Login is rewarded with higher limits. Signed-in users (Google) get more than guests:

| Limit | Guest | Signed in (Google) |
|------|-------|--------------------|
| Characters per input (A) | **200** | **2000** |
| Checks per day (B) | 5 / day | unlimited |
| Voice / IELTS speaking time (C) | 30 s | 45 s |
| Saved history & progress (D) | not saved | saved to Supabase |

### One-time setup
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste `supabase/schema.sql` → **Run**
   (creates `profiles` + `history` tables, RLS policies and the signup trigger).
3. **Authentication → Providers → Google** → enable it, and paste a Google OAuth
   *Client ID* + *Client secret* (from Google Cloud Console). Add Supabase's
   callback URL (shown on that page) to Google's "Authorized redirect URIs".
4. **Authentication → URL Configuration** → add your site URLs to *Redirect URLs*
   (e.g. `http://localhost:5500/index.html`, `http://localhost:5500/app.html`,
   and later your production URLs).
5. Copy your **Project URL** and **anon/public key** (Project Settings → API)
   into `assets/js/config.js`.

> Until `config.js` holds real values, the app runs with **no limits** (so you can
> develop freely). The 200/2000 limits switch on automatically once it's configured.

### Where it lives in the code
- `assets/js/auth.js` — `window.Speakly`: Google login, the limit tiers, the daily
  counter, the live character counter (`bindLimit`) and history saving.
- `assets/js/config.js` — your Supabase URL + anon key (anon key is browser-safe).
- Limits are wired into `landing.js` (demo inputs) and `app.js` (Correct / Native /
  Modes / Pronunciation / Voice / IELTS).

## ▶️ Running locally

Voice features (speech-to-text / text-to-speech) need a real origin, so serve
the folder rather than opening the file directly:

```bash
# from inside the speakly/ folder
python -m http.server 5500
# then open http://localhost:5500/index.html
```

Use Chrome or Edge for the microphone features.

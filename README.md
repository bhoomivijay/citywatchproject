# CityWatch

Smart city issue management — citizens report problems on a map, AI rates severity, admins manage incidents in real time.

**Live app:** [https://project1-pulseai.web.app/](https://project1-pulseai.web.app/)

---

## Run it locally (verified steps)

These are the exact steps used to start the app. Everything runs from the **project root** (the folder that contains `package.json`). There is no `frontend/` subfolder.

### 1. Prerequisites

- **Node.js 20+** (required — Firebase breaks on Node 18). Check with `node --version`. If you use nvm: `nvm install 20 && nvm use`
- **npm** (included with Node)
- A **Firebase project** with Authentication + Firestore enabled
- A **Groq API key** (free at [console.groq.com/keys](https://console.groq.com/keys)) — needed for AI analysis

### 2. Clone and install

```bash
git clone <repository-url>
cd <repository-folder>

ls package.json          # must succeed — you are in the right folder
npm install
```

### 3. Create `.env.local`

```bash
cp env.example .env.local
```

Open `.env.local` and fill in your keys:

```env
# Firebase — Firebase Console → Project settings → Your apps → Web app
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=project1-pulseai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project1-pulseai
VITE_FIREBASE_STORAGE_BUCKET=project1-pulseai.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Groq — https://console.groq.com/keys
VITE_GROQ_API_KEY=gsk_your_key_here
```

Optional fallback AI (not required):

```env
VITE_GEMINI_API_KEY=your_gemini_key
VITE_GEMINI_MODEL=gemini-2.0-flash-lite
```

### 4. Start the dev server

```bash
npm run dev
```

Expected output:

```text
VITE v6.4.3  ready in ~130 ms

➜  Local:   http://localhost:8080/
```

Open **http://localhost:8080** in your browser.

> Restart `npm run dev` after changing `.env.local`.

### 5. First-time Firebase setup (browser)

In the [Firebase Console](https://console.firebase.google.com/) for your project:

1. **Authentication** → enable **Email/Password** and **Google**
2. **Firestore** → create a database
3. **Project settings** → register a Web app → copy values into `.env.local`

You do **not** need `firebase init`, Cloud Functions, or a global Firebase CLI install to run locally.

---

## What you can do in the app

| Page | URL | Who |
|------|-----|-----|
| Login / Sign up | `/login`, `/signup` | Everyone |
| Citizen dashboard (map + report) | `/dashboard` | Logged-in users |
| Track your reports | `/track` | Logged-in users |
| Admin panel | `/admin` | Users with `role: "admin"` in Firestore |

**Sign up** with email/password or Google → report an issue by clicking the map → AI suggests category and severity → admins update status.

Maps use **Leaflet + OpenStreetMap** (no Google Maps API key needed).

---

## Admin access

No shared admin password ships with this repo.

1. **Sign up** in the app with email/password (not Google — Google accounts are always `user`).
2. Open **Firebase Console → Firestore → `users` → your user document**.
3. Set the field `role` to `"admin"`.
4. Log out, then log in using the **Admin** tab on the login page.

---

## Deploy to production

Firebase CLI is already in the project — use `npx firebase`, not `npm install -g`.

```bash
# Link your Firebase project (one time)
cp .firebaserc.example .firebaserc
npx firebase login
npx firebase use project1-pulseai

# Production env vars (same keys as .env.local)
cp env.example .env.production.local
# edit .env.production.local with your keys

# Build and deploy hosting + Firestore rules
npm run deploy
```

This runs `npm run build` then deploys to **https://project1-pulseai.web.app/**.

---

## npm scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server at **http://localhost:8080** |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build + deploy to Firebase Hosting |
| `npm run firebase -- <cmd>` | Run Firebase CLI (e.g. `npm run firebase -- login`) |

---

## Tech stack

- **Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS, shadcn/ui
- **Maps:** Leaflet + OpenStreetMap
- **Backend:** Firebase Auth, Cloud Firestore, Firebase Hosting
- **AI:** Groq (primary) and optional Gemini — runs in the browser when reporting issues

There is no separate Python/Node backend server, no Docker, and no SQL database.

---

## Project layout

```text
.
├── src/                  # React app (pages, components, Firebase services)
├── public/               # Static assets
├── functions/            # Optional Cloud Functions (not needed for local dev)
├── firebase.json         # Hosting + Firestore config
├── firestore.rules       # Database security rules
├── env.example           # Environment variable template
├── vite.config.ts        # Dev server port 8080, Groq proxy
└── package.json          # Dependencies and scripts
```

---

## Troubleshooting

**`cd frontend` or `cd citywatch-app-master` fails**  
You are already in the project root if `ls package.json` works. Do not `cd` into another folder.

**`EACCES` installing Firebase globally**  
Skip global install. Use `npx firebase` or `npm run firebase --` after `npm install`.

**Port 8080 in use**

```bash
lsof -ti:8080 | xargs kill -9
```

**Environment variables not loading**  
File must be `.env.local` in the project root. All keys must start with `VITE_`. Restart `npm run dev`.

**AI analysis fails**  
Add `VITE_GROQ_API_KEY` to `.env.local` and restart the dev server.

**Firestore permission denied**  
Sign in first. Deploy rules if needed: `npx firebase deploy --only firestore:rules`

**Admin login fails**  
Confirm `role: "admin"` is set on your user document in Firestore. Use the **Admin** tab, not User.

**`EBADENGINE` warnings (Node 18)**  
Upgrade to Node 20: `nvm install 20 && nvm use`, then run `npm install` again.

**`npm audit` shows many vulnerabilities after `npm audit fix --force`**  
Do **not** run `npm audit fix --force` — it downgrades `firebase-tools` to a broken ancient version. Fix with:

```bash
npm install firebase-tools@15.22.4 --save-dev
```

If that does not help, delete `node_modules` and `package-lock.json`, then `npm install` again (on Node 20).

---

## License

No license file is included. Add one before public distribution.

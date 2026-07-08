# Deploy to project1-pulseai (Firebase Hosting)

Live URL: **https://project1-pulseai.web.app/**

All commands run from the **project root** (the folder with `package.json`).

## One-time setup

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Select project: `firebase use project1-pulseai`
4. Copy `env.example` → `.env.production.local` and fill in your keys (same as local `.env.local`)

Enable **Hosting** in [Firebase Console](https://console.firebase.google.com/) → project1-pulseai → Build → Hosting → Get started (if not already enabled).

## Deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

## Notes

- `.env.production.local` is gitignored — keys are baked into the build, not uploaded to GitHub.
- Groq AI calls run from the browser in production (no Vite dev proxy). Ensure your Groq key allows your hosting domain if restricted.
- Admin access: set `role: "admin"` in Firestore `users` collection (see ADMIN_CREDENTIALS.md).

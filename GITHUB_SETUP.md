# Upload to GitHub (safe setup)

## What stays private

These files are **gitignored** and will **not** be uploaded:

- `.env.local` — Firebase, Groq, and Gemini keys
- `node_modules/`, `dist/`, `.firebase/`

Copy `env.example` to `.env.local` locally after cloning. Never commit `.env.local`.

## First-time upload

From the project root (folder containing `package.json`):

```bash
# Initialize repo (only inside this project folder)
git init
git add .
git status   # confirm .env.local is NOT listed

git commit -m "Initial commit: CityWatch smart city issue management app"

# Create repo on GitHub (replace YOUR_USERNAME and REPO_NAME)
gh repo create REPO_NAME --public --source=. --remote=origin --push
```

Or create an empty repo on github.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

## After cloning on another machine

```bash
npm install
cp env.example .env.local
# Fill in your own Firebase / Groq keys in .env.local
npm run dev
```

## GitHub Actions (CI deploy)

If you use the workflows in `.github/workflows/`, add a repository secret named `FIREBASE_SERVICE_ACCOUNT_PROJECT1_PULSEAI` with your Firebase service account JSON for the `project1-pulseai` project.

## Rotate keys if exposed

If keys were ever pasted in chat or committed by mistake:

1. **Firebase** — Console → Project settings → regenerate config / restrict API key
2. **Groq** — [console.groq.com/keys](https://console.groq.com/keys) → delete old key, create new
3. **Gemini** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → revoke and create new

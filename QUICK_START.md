# 🚀 Quick Start Guide

## Your Project is Ready! Here's how to get it running:

All commands run from the **project root** (the folder with `package.json`). Check with `ls package.json`.

### 1. **Install dependencies**
```bash
npm install
```

### 2. **Environment variables**
```bash
cp env.example .env.local
# Fill in Firebase + Groq keys in .env.local (see env.example)
```

### 3. **Firebase setup** (one-time)
```bash
npm install -g firebase-tools
firebase login
firebase use project1-pulseai
```

If you need to initialize Firebase in a fresh clone:
```bash
firebase init
# Select: Firestore, Functions, Hosting
# Project: project1-pulseai
# Functions: JavaScript, ESLint: No
# Firestore: use existing rules and indexes
# Hosting: dist folder, SPA: Yes
```

### 4. **Deploy AI functions** (development version)
```bash
cd functions
npm install
npm run deploy:dev
cd ..
```

### 5. **Start the dev server**
```bash
npm run dev
```

### 6. **Open your browser**
Navigate to **http://localhost:8080**

---

## 🎯 **What You'll See:**

- **Login Page**: City-themed login with Google + Email auth
- **Dashboard**: Interactive map where citizens can report issues
- **Real-time Updates**: Live incident feed with AI analysis
- **Admin Panel**: Complete incident management system

## 🔧 **How It Works:**

1. **Citizens** report issues by clicking the map and describing problems
2. **AI Analysis** automatically assesses severity (1-5) and categorizes issues
3. **Real-time Updates** show all incidents live on the dashboard
4. **Admins** can approve, reject, and manage incident responses

## 🚨 **For Production:**

Production URL: **https://project1-pulseai.web.app/**

See **[DEPLOY.md](./DEPLOY.md)** for full deploy steps.

```bash
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

---

## ✨ **Your Project Features:**

- ✅ **Firebase Integration**: Complete backend with your project ID
- ✅ **AI Analysis**: Groq/Gemini integration for incident assessment
- ✅ **Modern UI**: shadcn/ui components with city theme
- ✅ **Real-time**: Live updates from Firestore
- ✅ **Authentication**: Google + Email/Password login
- ✅ **Admin Panel**: Complete incident management
- ✅ **Responsive**: Works on all devices

**Ready to go! 🎉**

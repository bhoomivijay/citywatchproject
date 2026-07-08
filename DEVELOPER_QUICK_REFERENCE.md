# 🚀 Developer Quick Reference

Quick commands and reference information for CityWatch development.

## 📁 Key File Locations

```
.
├── src/
│   ├── components/          # UI Components
│   │   ├── MapView.tsx     # Interactive map
│   │   ├── ReportIssueModal.tsx # Issue reporting
│   │   ├── IncidentsList.tsx    # Incidents display
│   │   ├── AdminDashboard.tsx   # Admin interface
│   │   └── ui/             # shadcn/ui components
│   ├── pages/              # Page components
│   ├── lib/                # Services & utilities
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom hooks
│   └── types/              # TypeScript types
├── functions/              # Firebase Cloud Functions
├── firebase.json          # Firebase config
└── tailwind.config.ts     # Tailwind configuration
```

## ⚡ Quick Commands

### Development
```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Build for production
npm run build:dev    # Build for development
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Firebase
```bash
firebase login       # Login to Firebase
firebase use         # Check current project
firebase init        # Initialize Firebase
firebase deploy      # Deploy everything
firebase deploy --only hosting    # Deploy only hosting
firebase deploy --only functions  # Deploy only functions
```

### Functions
```bash
cd functions
npm install          # Install dependencies
npm run deploy:dev  # Deploy development functions
firebase functions:log  # View function logs
```

## 🔧 Common Development Tasks

### 1. **Add New Component**
```bash
# Create component file
touch src/components/NewComponent.tsx

# Add to index for easy imports
echo "export { default as NewComponent } from './NewComponent';" >> src/components/index.ts
```

### 2. **Add New Page**
```bash
# Create page file
touch src/pages/NewPage.tsx

# Add route in App.tsx
# Add navigation link in relevant component
```

### 3. **Update Environment Variables**
```bash
# Edit .env.local
nano .env.local

# Restart dev server
npm run dev
```

### 4. **Check Firebase Status**
```bash
firebase projects:list
firebase use your-project-id
firebase functions:log
```

## 🚨 Troubleshooting Quick Fixes

### Port Already in Use
```bash
lsof -i :8080        # Find process
kill -9 <PID>        # Kill process
```

### Firebase Connection Issues
```bash
firebase logout       # Clear auth
firebase login        # Re-authenticate
firebase use          # Verify project
```

### Build Errors
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Functions Not Working
```bash
cd functions
npm run deploy:dev   # Redeploy functions
firebase functions:log  # Check logs
```

## 📱 Testing Checklist

### Before Committing
- [ ] Code runs without errors
- [ ] No console warnings
- [ ] Mobile responsive
- [ ] Forms validate correctly
- [ ] Real-time updates work
- [ ] Authentication flows work

### Browser Testing
- [ ] Chrome (desktop & mobile)
- [ ] Safari (desktop & mobile)
- [ ] Firefox
- [ ] Edge

## 🔑 Environment Variables

### Required (.env.local)
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Optional
```env
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
VITE_APP_ENV=development
```

## 📊 Performance Tips

### 1. **Bundle Size**
- Use dynamic imports for heavy components
- Implement code splitting by routes
- Optimize images and assets

### 2. **Real-time Updates**
- Clean up Firestore listeners
- Debounce search inputs
- Use optimistic updates

### 3. **Mobile Optimization**
- Lazy load non-critical components
- Optimize touch interactions
- Minimize bundle size

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Environment variables set
- [ ] Firebase functions deployed
- [ ] Database rules updated

### Deployment
```bash
npm run build
firebase deploy
```

### Post-deployment
- [ ] Verify live site loads
- [ ] Check authentication works
- [ ] Test incident reporting
- [ ] Verify admin functions
- [ ] Check mobile responsiveness

## 📚 Useful Resources

### Documentation
- [Firebase Docs](https://firebase.google.com/docs)
- [React Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### Tools
- [Firebase Console](https://console.firebase.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

### Community
- [Firebase Community](https://firebase.google.com/community)
- [React Community](https://reactjs.org/community)
- [Stack Overflow](https://stackoverflow.com/)

---

**💡 Tip**: Bookmark this file for quick access during development!

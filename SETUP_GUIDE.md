# 🚀 CityWatch Setup Guide

A comprehensive, step-by-step guide to get CityWatch running on your local machine with admin access.

## 🎯 **What You'll Get**

- ✅ **Complete CityWatch application** running locally
- ✅ **Admin dashboard** with full incident management
- ✅ **AI-powered incident analysis** using Gemini
- ✅ **Real-time updates** across all devices
- ✅ **Mobile-responsive design** for all screen sizes

## 👑 **Admin Access**

This project does not ship with shared admin credentials. After setup, create your own admin account:

1. Sign up in the app with any email/password.
2. In Firebase Console → Firestore → `users` → your user document, set `role` to `"admin"`.
3. Log out, then log in on the **Admin** tab.

See **[ADMIN_CREDENTIALS.md](./ADMIN_CREDENTIALS.md)** for full details.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository) - [Download here](https://git-scm.com/)
- **Firebase CLI** (we'll install this during setup)

### 🔍 **Check Your Setup**
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check Git version
git --version
```

## 🔧 Step-by-Step Setup

### **Step 1: Open the project root**

Run all commands from the folder that contains `package.json`. Verify:

```bash
ls package.json
```

If that fails, `cd` into the folder where you cloned or extracted this repo. **Do not** `cd` into a `frontend/` subfolder — there isn't one.

**✅ Expected**: `package.json` is listed.

### **Step 2: Install Dependencies**
```bash
npm install
```

**✅ Expected Output:**
```
added 1234 packages, and audited 1234 packages in 1m 23s
found 0 vulnerabilities
```

**⏱️ Time**: This may take 2-5 minutes depending on your internet speed.

### **Step 3: Install Firebase CLI**
```bash
npm install -g firebase-tools
```

**✅ Expected**: Firebase CLI installed globally on your system.

### **Step 4: Login to Firebase**
```bash
firebase login
```

**🌐 What happens:**
1. Your browser will open automatically
2. Sign in with your Google account
3. Grant permissions to Firebase CLI
4. Return to terminal when complete

**✅ Expected**: `✔  Logged in as your-email@gmail.com`

### **Step 5: Initialize Firebase Project**
```bash
firebase init
```

**📋 Select these options exactly:**

| Question | Answer |
|----------|---------|
| **Which Firebase features do you want to set up?** | ✅ Firestore, ✅ Functions, ✅ Hosting |
| **Please select an option:** | Use an existing project |
| **Select a default Firebase project:** | `project1-pulseai` |
| **What language would you like to use?** | JavaScript |
| **Do you want to use ESLint?** | No |
| **Install dependencies with npm now?** | Yes |
| **What do you want to use as your public directory?** | `dist` |
| **Configure as a single-page app?** | Yes |
| **Set up automatic builds and deploys with GitHub?** | No |
| **File dist/index.html already exists. Overwrite?** | No |

**✅ Expected**: Firebase project initialized successfully.

### **Step 6: Set Up Cloud Functions**
```bash
cd functions
npm install
```

**✅ Expected**: Functions dependencies installed.

### **Step 7: Deploy Development Functions**
```bash
npm run deploy:dev
```

**✅ Expected Output:**
```
✔  functions[analyzeIncident(us-central1)] Successful create operation.
```

**⏱️ Time**: This may take 2-3 minutes for the first deployment.

### **Step 8: Return to project root**
```bash
cd ..
```

### **Step 9: Start Development Server**
```bash
npm run dev
```

**✅ Expected Output:**
```
  VITE v5.4.19  ready in 199 ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: http://172.17.71.1:8080/
  ➜  press h + enter to show help
```

### **Step 10: Open Your Browser**
Navigate to: **http://localhost:8080**

## 🎯 What You Should See

### **🏠 Landing Page**
- CityWatch logo and branding
- Feature highlights
- Call-to-action buttons

### **🔐 Login Options**
- Google Sign-in button
- Email/Password forms
- Sign-up link

### **🗺️ Interactive Map**
- Google Maps integration
- City overlay
- Click-to-select functionality

### **📱 Modern UI**
- Clean, responsive design
- Tailwind CSS styling
- Professional city theme

## 🧪 Testing Your Setup

### **1. Test Authentication**
- [ ] Try logging in with Google
- [ ] Test email/password signup
- [ ] Verify login redirects to dashboard

### **2. Test Admin Access**
- [ ] Create an admin account (see [ADMIN_CREDENTIALS.md](./ADMIN_CREDENTIALS.md))
- [ ] Log in on the **Admin** tab and access `/admin`
- [ ] Verify admin permissions

### **3. Test Core Features**
- [ ] Click on map to select location
- [ ] Open issue reporting modal
- [ ] Submit a test incident
- [ ] Check real-time updates

### **4. Test Mobile Responsiveness**
- [ ] Resize browser window
- [ ] Test on mobile device
- [ ] Verify touch interactions

## 🚨 Troubleshooting

### **Issue: Port 8080 Already in Use**
```bash
# Find the process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### **Issue: Firebase Functions Not Deploying**
```bash
# Check Firebase project
firebase use

# Check function logs
firebase functions:log

# Redeploy functions
cd functions && npm run deploy:dev
```

### **Issue: Dependencies Not Installing**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### **Issue: Environment Variables Not Loading**
- Ensure you're in the project root (the folder containing `package.json`)
- Check that `.env.local` file exists
- Restart the development server after adding variables

### **Issue: Admin Login Not Working**
- See [ADMIN_CREDENTIALS.md](./ADMIN_CREDENTIALS.md) for setup steps
- Confirm `role: "admin"` is set on your user document in Firestore
- Check browser console for errors
- Verify Firebase connection

## 🔍 Verification Steps

After setup, verify everything is working:

- [ ] Development server starts without errors
- [ ] Browser opens to http://localhost:8080
- [ ] Landing page loads with CityWatch branding
- [ ] No console errors in browser developer tools
- [ ] Firebase functions are deployed successfully
- [ ] Admin login works after setting `role: "admin"` in Firestore

## 📱 Testing the Application

### **Citizen Features**
1. **Test Authentication**: Try logging in with Google or email
2. **Test Map Interaction**: Click on the map to see location selection
3. **Test Issue Reporting**: Open the report modal and fill out the form
4. **Test Real-time Updates**: Check if incidents appear in real-time

### **Admin Features**
1. **Admin Login**: Use your account with `role: "admin"` on the **Admin** tab
2. **Dashboard Access**: Navigate to `/admin`
3. **Incident Management**: View and manage reported incidents
4. **User Management**: Check user roles and permissions

## 🚀 Next Steps

Once the setup is complete:

1. **Explore the Code**: Check out the component structure in `src/components/`
2. **Customize the UI**: Modify colors and themes in `tailwind.config.ts`
3. **Add Features**: Extend functionality in the existing components
4. **Deploy to Production**: Use `firebase deploy` when ready

## 📞 Need Help?

If you encounter issues:

1. **Check the browser console** for error messages
2. **Verify Firebase project configuration**
3. **Ensure all dependencies are installed**
4. **Check the main README.md** for detailed information
5. **Review the troubleshooting section** above

## 🎉 **Congratulations!**

You've successfully set up CityWatch with:
- ✅ Local development environment
- ✅ Firebase backend integration
- ✅ AI-powered incident analysis
- ✅ Admin dashboard access
- ✅ Real-time functionality

**Your smart city management platform is ready to use!** 🏙️✨

---

**Happy coding! 🎉**

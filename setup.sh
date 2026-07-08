#!/bin/bash

echo "🚀 Setting up PulseAI - Smart City Management System"
echo "=================================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI found"
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase..."
    firebase login
else
    echo "✅ Already logged in to Firebase"
fi

echo ""
echo "📋 Next steps:"
echo "1. Initialize Firebase project: firebase init"
echo "2. Select your project: project1-pulseai"
echo "3. Enable: Firestore, Functions, Hosting"
echo "4. Deploy functions: cd functions && npm run deploy:dev"
echo "5. Start dev server: npm run dev"
echo ""
echo "🎯 For production deployment:"
echo "1. Set Gemini API secret: firebase functions:secrets:set GEMINI_API_KEY"
echo "2. Deploy production functions: firebase deploy --only functions"
echo ""
echo "✨ Setup complete! Follow the steps above to get started."

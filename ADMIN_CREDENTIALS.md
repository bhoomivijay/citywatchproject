# Admin access setup

This project does **not** ship with shared admin credentials. Each developer creates their own Firebase project and admin user.

## Create an admin account

1. Run the app and **Sign Up** with email/password.
2. Open [Firebase Console](https://console.firebase.google.com/) → your project → **Firestore**.
3. Open the `users` collection → your user document.
4. Set `role` to `"admin"`.
5. Log out, then log in on the **Admin** tab on the login page.

## Admin login

- Use the **Admin** tab (not User).
- Same email/password you registered with.
- You must have `role: "admin"` in Firestore.

Never commit real passwords or API keys to GitHub.

# Enable private cloud sync in BLD Memo

The app stays usable without cloud sync. This is a one-user, local-first sync feature for the existing GitHub Pages app.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com/ and create a project (e.g., "my-bld-memo").
   You do **not** need Analytics.
2. Open **Build → Authentication → Sign-in method**, enable **Google**, choose the project support email, and save.
3. Under **Authentication → Settings → Authorized domains**, add:
   `iallergic.github.io` (the hostname only, not `/BLD-memo`).
4. Open **Build → Firestore Database**, create a database in **production mode**, and choose a region.
   The **Spark** plan's free tier is sufficient for typical personal practice.
5. Under **Firestore Database → Rules**, replace the rules with the exact contents of `firestore.rules` in this repository, then **Publish** them.
   The rules restrict each data document to its authenticated Google-account UID.

## 2. Register the web app

In **Project overview → Add app → Web** (the `</>` icon), register a web app. Firebase Hosting is **not** required because the website stays on GitHub Pages.

Firebase will display an object called `firebaseConfig`. Copy its public fields into `firebase-config.js` in this repository, replacing `null`:

```js
window.BLD_FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  appId: '1:...:web:...'
};
```

These web configuration identifiers are not private administrator keys. **Never** put a Firebase service-account JSON, private key, or secret in the repository. Security is enforced by your Firestore rules, not by hiding the web config.

After editing the config, increment the cache version in `sw.js` so the already-installed phone app receives the new settings. Deploy the changes through GitHub Pages.

## 3. Migrate safely: the PHONE goes first

Your phone currently has the only real practice progress.

1. **On the phone**, open BLD Memo → Stats → **Export backup**. Save this file somewhere outside Safari storage (e.g., Files).
2. In the app's cloud bar, select **Sign in with Google**.
3. Confirm the account, then select **Upload this device** once. Wait for **Cloud synced**.
4. **On the computer**, open the same BLD Memo URL and sign in using the **same Google account**.
5. Since the computer has no training data, it will download the phone's progress. Check the Learning Path position and reviewed-pair count before doing new practice.
6. Subsequent saves sync automatically. Opening/focusing the app also checks for updated cloud progress. It still works locally when disconnected.

Do not upload an empty computer's progress before the phone has uploaded its real data.

## Conflict and backup behavior

- The default storage is still browser `localStorage`; the cloud stores a second copy of learning data.
- The published 576-pair Google Sheet is **not** synced to cloud; each device loads it separately, and exact-match local-word cleanup still applies.
- On a brand-new signed-in device with existing local practice, the app asks before replacing anything.
- If two devices both have unsynced changes, the app shows **Sync conflict** with explicit choices. It **never silently replaces** one changed copy. Export a backup before resolving a conflict.
- **Reset data** pauses cloud sync and does **not** delete the cloud copy.
- Cloud data consists of one Firestore document at `users/{uid}/appData/state`; writes use a monotonically increasing revision and a transaction to prevent lost updates.
- The app uses a Google sign-in popup. On iPhone, if an installed Home Screen app has problems displaying popups, **export its backup from inside that installed app first**. Safari may use a separate browser-storage area. Open the site in Safari, import the backup there, and only then upload that imported progress. Do not upload an empty Safari copy. Firebase's cross-site redirect flow can have problems on modern browsers, so the app deliberately uses popup sign-in.

## Troubleshooting

- **Cloud sync not configured:** `firebase-config.js` still contains `null`, or the old service-worker cache has not updated.
- **auth/unauthorized-domain:** Add `iallergic.github.io` to Firebase Auth authorized domains.
- **Missing permissions:** Publish the production Firestore rules provided in `firestore.rules`.
- **Popup blocked:** Allow the popup and try from Safari or a regular browser tab.
- **Offline / network error:** Local progress is preserved. Reopen the app online and use **Check now**.
- **Conflicting copies:** Export a backup of the current device, then explicitly choose which version to keep. Automatic merging of independent offline histories is **not** implemented in this version.


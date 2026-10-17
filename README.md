# BLD Memo — a mobile-first 3BLD memory trainer

## Features
- All 576 Speffz-style A–X letter pairs, each with a **starter mental image**. The suggestions are curated and rule-based, not AI-generated on the fly, and they're meant to be replaced when you have a better idea.
- Row-by-row mobile dictionary and scrollable complete 24 × 24 matrix.
- Edit any association and add optional visual detail.
- Weighted flashcard practice with Again / Hard / Got it feedback.
- Visual-sequence memorization and letter-pair recall drills.
- Progress dashboard, editable trouble pairs, JSON export/import, and device-local storage.
- Installable PWA, offline after initial hosted visit.

## Publish using GitHub Pages (no build system)
1. Make a GitHub repository, such as `bld-memo`.
2. Put the **files in this folder** in the repository root: `index.html`, `manifest.webmanifest`, `sw.js`, and three PNG icons. (README.md is optional.)
3. In GitHub, visit **Settings → Pages**, select **Deploy from a branch**, `main`, `/(root)`, and save.
4. When your site's URL is active, open it in **Safari** on your iPhone. Choose **Share → Add to Home Screen**, enable **Open as Web App**, and tap **Add**.

Notes:
- This download is the ready-to-publish website, not a hosted URL. GitHub Pages or another static host is needed for installation, reliable browser storage, and offline caching.
- Saved associations and review scores remain in the browser on the device, **not on GitHub**. Export a backup periodically. Installing the app in a separate browser context may result in separate storage; export/import is provided for migration.
- Do not use private/incognito browsing if you need data preserved.
- The suggestions are just mnemonic starting points; for blind memo, personal and vivid imagery beats any universal word list.
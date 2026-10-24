# BLD Memo — a mobile-first 3BLD memory trainer

## Google Sheets dictionary sync

The Google Sheet is the master dictionary. The app reads `sheet-dictionary.json` from the same GitHub Pages site when it opens or when you tap **Refresh Sheet** (Matrix or Stats). A GitHub Actions workflow (`.github/workflows/sync-sheet.yml`) checks the spreadsheet hourly and updates the JSON only when one or more of the 576 associations change. There is also a manual **Run workflow** action in GitHub Actions.

**One-time setup:** In the Google Sheet, select **Share → General access → Anyone with the link → Viewer → Done**. This is required because GitHub Actions cannot access the owner's private Google Drive credentials. Do not grant editing permission. The app's dictionary snapshot is already in this public repository, so dictionary words are public regardless of the original Sheet sharing.

**Phone edits are never pushed to the Sheet.** Local overrides and practice progress stay in browser storage and take priority over refreshed Sheet words. Stats → Google Sheet shows the snapshot timestamp, differing pairs, and possible conflicts when a pair has been changed both locally and in the Sheet. **Export differences CSV** downloads the pair, Sheet value, app value, and conflict indicator for manual review. A full JSON backup still includes training history, overrides, and the last cached Sheet snapshot. Offline use falls back to the cached snapshot or bundled starter dictionary.

## Features
- **Due-first guided learning (recommended for short daily sessions):** reviews that are due come first, with no word preview; when caught up, preview and learn up to six new associations. Failed/Hard pairs receive one extra in-session retrieval, then are scheduled again for later. Good recall uses expanding intervals of roughly 1, 3, 7, 14, 30 and 45 days; Hard returns in about a day and Again in about 10 minutes. These are simple adaptive intervals, not a validated optimization model. Sessions stop naturally after each group, suggest taking a break after six new pairs, show today's new/review counts, and save pause/return progress locally (including JSON backups). Unlimited cards remain optional.
- **Combined 92-pair guided pool:** the Top 48 edge and corner ranking lists now expose all 92 unique pair associations in guided sessions, not only the first 48.
- **Guided flashcard sessions (default):** preview six associations, test them once, retry Again/Hard cards one additional time, then pause at a natural end-of-group stopping point. The exact place and responses are automatically saved in device-local storage, survive app restarts, and are included in newer JSON backups. Supports all existing frequency categories, including Top 24 edges and corners. Guided sessions cover their practice pool in six-card groups (up to 24 from broad All-pairs sets, 48 for individual simulated sets, or 92 for the combined set). Optional Unlimited mode preserves endless adaptive flashcards. Paused sessions remain resumable if users switch to a different category or mode.
- **Matrix reading lists:** choose Top 24/48 M2 edges, Top 24/48 OP corners, or the deduplicated combined Top 48 set from the Matrix dropdown. In Browse, see all selected letter-pair associations together in frequency order, with no first-letter row switching; tap any association to edit it. The My Memo frequency list is available there too. The selected matrix filter persists locally.
- **Unobserved pairs on the matrix:** the full 576-pair coverage flags from the original 250,000 scrambles mark zero-observation edge pairs (125), corner pairs (184), and pairs unobserved in either (44). Browse and full matrix both show the event-specific flags; filter by each category. A zero count is empirical, not proof that the combination is impossible.
- **Combined Top 48** deduplicates overlapping edge and corner pair labels (BC, BD, CD, QC), for a total of 92 unique associations.
- **Realistic 3BLD frequency:** precomputed ranks from 250,000 seeded random 30-move scrambles with Speffz lettering, M2 edges using DF (U) and OP corners using ULB (A), tracing separate memo streams and breaking cycles alphabetically. Choose top 24, top 48, or a mixed top-48-each practice pool in Cards or Memo; view rankings in Stats. The random-move distribution approximates but is not identical to uniform random-state scrambles. M2's even-target execution adjustment does not change memo letter tracing.
- The frequency data was generated offline, not by storing your own memo or uploading any practice history. Your custom word edits and existing review progress remain local.

### Simulation basis
Uses the same Speffz face-letter layout and memo tracing convention as [blindcube](https://github.com/lukacslacko/blindcube) (MIT-licensed reference); cycle breaks always select the alphabetically earliest unsolved piece. Simulated percentages are share of complete memo pairs (not probability per solve); trailing odd targets are not paired. Ranking is not a guarantee of mathematical impossibility for unobserved or lower-ranked pairs.

- **Letter groups:** focus on one first-letter group (A through X; 24 pairs each) in Cards and Memo.
- **Most encountered:** log pairs from actual cube memos in Stats to build a personal top-48 practice set (not an unverified universal frequency list).
- All 576 Speffz-style A–X letter pairs, each with a **short, distinct, one-word starter image**. The suggestions are curated and rule-based, not AI-generated on the fly, and they're meant to be replaced when you have a better idea.
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
- The short suggestions are just mnemonic starting points; for blind memo, personal and vivid imagery beats any universal word list.
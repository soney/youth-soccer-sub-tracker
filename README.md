# Youth Soccer Sub Tracker

A small, dependency-free web app for tracking youth soccer substitutions, field time, and goalie time from a phone browser.

## Use It

Open `index.html` in a browser, or publish the repo with GitHub Pages. The app saves the roster, jersey numbers, lineup, timer state, and accumulated time in `localStorage` on the device.

## Features

- Add players one at a time or paste a list.
- Store names, jersey numbers, lineup state, and game times locally.
- Track total game clock, each player's field time, and each player's goalie time.
- Start, stop, reset times, bench everyone, and change the allowed players on the field.
- Sort bench players by lowest field time so the next player to sub in rises to the top, and mark the next non-keeper to sub out by highest field time.
- Set a substitution interval, get repeating loud sound alerts when it is time to sub, and reset the alert with **Sub Done** or by benching a player.
- Mobile-first layout for iPhone browser use.
- PWA metadata and a service worker for add-to-home-screen behavior on supported browsers.

## Deploy To GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

1. Push the repo to GitHub.
2. In the GitHub repo, go to **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`, or run the **Deploy GitHub Pages** workflow manually.

No build command is needed. The workflow uploads only the static app files.

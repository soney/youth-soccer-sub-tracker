# Youth Soccer Sub Tracker

A small, dependency-free web app for tracking youth soccer substitutions, field time, and goalie time from a phone browser.

## Use It

Open `index.html` in a browser, or publish the repo with GitHub Pages. The app saves the roster, jersey numbers, lineup, timer state, and accumulated time in `localStorage` on the device.

Roster import links use the same format as **Paste List** inside a URL-encoded `roster` query parameter, for example `?roster=Mia%20%238%0AAva%20%2312%0ALiam`.

## Features

- Add players one at a time or paste a list.
- Mark players absent from the roster so they stay out of the field and bench lists.
- Copy/export the current roster as a paste-friendly text list.
- Copy a roster import link, or import one from `?roster=` using the same line-based name/number format, with duplicate name/number pairs skipped.
- Store names, jersey numbers, lineup state, and game times locally.
- Track total game clock, each player's field time, and each player's goalie time.
- Start, stop, reset times, bench everyone, and change the allowed players on the field.
- Show compact two-column tap-to-toggle **On Field** and **Bench** rows with jersey number, first name, and field time.
- Keep setup, sound, reset, and sub interval controls tucked behind a collapsible match controls panel.
- Keep manual `+1m` / `-1m` field-time corrections tucked inside the collapsible controls.
- Sort field players by highest field time and bench players by lowest field time.
- Prevent bench taps from adding players when the field is already full.
- Keep a substitution history log for subs and time adjustments.
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

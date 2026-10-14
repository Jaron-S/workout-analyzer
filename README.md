# Setsmith

**Forge your training week.** Plan hypertrophy training with live volume analysis for every muscle, build routines with Claude, and push them straight to Hevy.

[**Open Setsmith**](https://workout-analyzer.netlify.app/)

## Features

  * **Routine builder:** multi-day splits with drag-to-reorder exercises and days, duplicate days, per-exercise reps, rest and notes (falling back to your own defaults), and one-tap set steppers. Works on phones, tablets and desktops.
  * **Live analysis:**
      * **Body map:** front and back figures coloured by each muscle's weekly volume status.
      * **Volume:** every muscle's weighted weekly sets against its landmarks (MV, MEV, MAV, MRV).
      * **Priorities:** rank muscles S to F; each is checked against the range its tier calls for, with one-tap suggestions for whatever is short.
      * **Fatigue:** session size, junk-volume risk and training frequency.
  * **Hevy exercise library:** Hevy's 451 built-in exercises plus your own custom exercises once you connect Hevy, each with curated muscle weightings you can override to match how an exercise feels for you.
  * **Push to Hevy:** push a routine as a Hevy folder with one routine per day, including rep ranges, rest and notes. Pushing again updates the same routines in place.
  * **Claude connector:** use Setsmith from claude.ai or the Claude apps on your own Claude plan. Claude reads your routine and its analysis and drafts changes; the draft appears live in Setsmith, and applies when you agree in the chat or tap Apply.
  * **Claude in the app:** or chat with Claude inside Setsmith using your own Anthropic API key. Its edits appear inline as a draft you apply, discard or undo.
  * **Import:** bring in a routine from Hevy (each Hevy routine becomes a day, linked so pushing back updates it) or paste one from your notes.
  * **Share:** a link that carries the whole routine and previews as an image of it on Reddit, Discord and elsewhere; recipients can import it in one tap. Or download the image.
  * **Templates, command menu (Cmd/Ctrl+K), light and dark themes.**
  * **Accounts optional:** everything works as a guest in the browser; signing in (Firebase) auto-saves to your account and syncs devices.

-----

## Tech Stack

| Category      | Technology                                                                                                                                                                                           |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework** | [Next.js](https://nextjs.org/)                                                                                                                                                        |
| **Backend** | [Firebase](https://firebase.google.com/) (Auth, Firestore)                                                                                                                                           |
| **Language** | [TypeScript](https://www.typescriptlang.org/)                                                                                                                                                        |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/)                                                                                                                                                             |
| **UI/UX** | [shadcn/ui](https://ui.shadcn.com/), [Framer Motion](https://www.framer.com/motion/), [dnd-kit](https://dndkit.com/), [Recharts](https://recharts.org/)                                                   |
| **Deployment** | [Netlify](https://www.netlify.com/)                                                                                                                                                                        |

-----

## Technical Deep Dive

This project presented several interesting technical challenges that required thoughtful architectural decisions.

### 1\. Real-Time Performance Optimization

The core feature of the app is its "live" analysis engine. Every user interaction—from changing the number of sets on an exercise to dragging it to a different day—triggers a complete recalculation of dozens of data points across all three analysis tabs.

  * **Challenge:** Naively recalculating on every render would lead to significant UI lag and a poor user experience, especially on lower-end devices.
  * **Solution:** React's `useMemo` hook was leveraged extensively to create a memoized dependency graph. Complex calculations (like `calculateMuscleVolumes`) are only re-run when their direct dependencies (`routine`, `exercises`) change. Downstream transformations in each analysis tab are then memoized based on the result of these core calculations. This ensures a highly performant and fluid user experience, even with frequent and rapid state updates.

### 2\. Complex Drag-and-Drop State Management

The routine builder is built around a sophisticated drag-and-drop system that allows users to reorder exercises within a day, move them between days, and add new exercises from a library.

  * **Challenge:** Managing the state for a multi-container drag-and-drop system is notoriously complex and prone to bugs.
  * **Solution:** The `dnd-kit` library was chosen for its robust, headless architecture. A deep understanding of its sensors, collision detection algorithms, and event listeners was required to implement a predictable and intuitive state management solution that correctly handles all user interactions and edge cases, ensuring the `routine` object remains consistent and accurate at all times.

### 3\. Iterative Design of Data Visualizations

The goal was to present complex scientific training data in a way that was immediately understandable and actionable. This required a deliberate and iterative design process for the data visualizations.

  * **Challenge:** Initial designs, such as using a simple progress bar for fatigue, proved to be confusing and failed to communicate the intended meaning.
  * **Solution:** Each visualization was refined through multiple iterations. The "Fatigue Meter" evolved from a simple progress bar into a more effective segmented bar to show the crossing of thresholds. The "Priority Analysis" bar was redesigned from a progress indicator into a "Target Zone" visual to better represent the goal of landing within a specific range. This iterative process was crucial for achieving the app's goal of providing clear, at-a-glance coaching.

-----

## Hevy and Claude

Hevy and the in-app Claude run entirely in your browser with your own keys, which are stored only in that browser (never in your account or on a server).

  * **Hevy:** Settings → Hevy. API keys are a Hevy Pro feature; get yours at [hevy.com/settings?developer](https://hevy.com/settings?developer). Hevy's API cannot delete routines, folders or custom exercises, so anything pushed has to be removed in the Hevy app. The app asks before creating a custom exercise for that reason.
  * **Claude connector:** sign in to Setsmith, then in Claude open Settings → Connectors → Add custom connector and use `https://<your-site>/api/mcp`. Claude sends you to Setsmith to allow access. It works on routines saved to your account. The server needs `SETSMITH_CONNECTOR_SECRET` (32+ random characters), which encrypts its OAuth tokens; nothing else is stored.
  * **Claude in the app:** Settings → Claude in Setsmith. Create a key at [console.anthropic.com](https://console.anthropic.com/settings/keys); usage is billed to that Anthropic account. The coach uses Claude Opus 5.5.

### Maintaining the exercise library

`data/hevy-exercises.json` is a snapshot of Hevy's built-in exercises and `data/exercise-weightings.json` holds the muscle weightings for each one, keyed by Hevy ID.

```bash
npm run sync:hevy          # refresh the snapshot (needs HEVY_API_KEY in .env.local); reports added, removed and renamed exercises
npm run check:exercises    # validate the weightings; also runs at the start of every build
npm test                   # unit tests
```

Each weighting entry records the title it was checked against, so if Hevy renames an exercise the check fails until its weightings are re-verified.

## Getting Started

To run this project locally, follow these steps:

### Prerequisites

  * **Node.js v20.9 or later** (required by Next.js 16). Check with `node -v`.
  * npm 10 or later. This repo uses npm and ships a `package-lock.json`; use `npm install` rather than another package manager so the lockfile stays authoritative.
  * A Firebase project is **optional** — see step 3.

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/Jaron-S/workout-analyzer.git
    cd workout-analyzer
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  (Optional) Enable user accounts and cross-device sync.

    The app is fully functional without this step: it runs in guest mode and
    persists your routines to `localStorage`. Skip to step 4 if that is all you need.

    To enable sign-in, create a Firebase project with **Authentication
    (Email/Password)** and **Firestore** enabled, then copy the env template and
    fill in your project's config values:

    ```bash
    cp .env.example .env.local
    ```

    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```

4.  Run the development server:

    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Troubleshooting (npm 12)

npm 12 introduced two security defaults that show up with this dependency tree.
A normal `npm install` or `npm ci` works fine on the defaults; these only matter
in the cases described below.

**`EALLOWREMOTE` when regenerating the lockfile.** Commands that rebuild the
dependency tree from scratch (`npm install --package-lock-only`, `npm install
--dry-run`, or any install against an out-of-sync lockfile) fail with:

```
npm error code EALLOWREMOTE
npm error Refusing to fetch "https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/..."
```

`@tailwindcss/oxide-wasm32-wasi` is the only package in the tree that uses
`bundleDependencies`, so npm has to download its tarball to enumerate them, and
that fetch is classified as a `remote` spec. npm 12 defaults `allow-remote` to
`none`, and the documented "same hostname as the registry" exemption is not
applied on this code path even though the URL is `registry.npmjs.org`. Pass the
flag explicitly when you need to regenerate the lockfile:

```bash
npm install --package-lock-only --allow-remote=all
```

The package is an optional `wasm32` fallback, so it is never installed on a
normal x64/arm64 machine — this only affects building the tree, not the install.

**Blocked install scripts.** `npm install` warns that `sharp`, `protobufjs`, and
`@firebase/util` had install scripts blocked. This is expected and safe to
ignore: the production build succeeds without them. `sharp` in particular is only
needed for Next.js image optimization, which is disabled via
`images.unoptimized` in `next.config.mjs`.

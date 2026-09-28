# Aerie

A calm, browser-based glider game. Explore a procedurally generated open landscape, steer with gentle turns, and watch the terrain unfold beneath you. Runs on Linux and Windows in a modern browser with WebGL.

## Run locally

Requires Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `W` / `Up` to climb, `S` / `Down` to descend, and `A` / `Left` or `D` / `Right` to bank. `P` pauses and `R` resets the flight. Touch controls are available on touch screens.

## Verify and build

```sh
npm test
npm run build
npm run preview
```

The production build is a static site in `dist/`; it can be hosted by any static web server. Use the same commands in PowerShell on Windows. No native OS-specific binary or remote game asset is required.

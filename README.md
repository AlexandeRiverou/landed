# landed

A calm, browser-based glider game. Every launch gets a different procedurally generated world of mountains, forests, rivers, lakes, grassland, and snow. Valleys may contain small towns, roads, houses, shops, and moving cars. Runs on Linux and Windows in a modern browser with WebGL.

## Run locally

Requires Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `W` / `Up` to climb, `S` / `Down` to descend, and `A` / `Left` or `D` / `Right` to bank. Hold `Shift` or `Space` to boost. `P` pauses and `R` resets the flight. The on-screen boost button also supports press-and-hold; flight controls are available on touch screens.

Wayfinder field notes are optional scenic objectives. Follow the bearing arrow and fly through the amber ring to save a note; each one rolls a different sky-and-terrain event, such as moonrise, lunar mail, aurora, rain, sunset, or the clouds' proud smile. Event changes and flower patches remain until another objective changes the world. There is no timer or penalty for taking your time. Cannons sit on dry mountain slopes, while birds, airplanes, gliders, kites, and balloons move through the sky.

## Verify and build

```sh
npm test
npm run build
npm run preview
```

The production build is a static site in `dist/`; it can be hosted by any static web server. Use the same commands in PowerShell on Windows. No native OS-specific binary or remote game asset is required.

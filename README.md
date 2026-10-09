# landed

A calm, browser-based glider game. Every launch gets a different procedurally generated world of mountains, forests, rivers, lakes, grassland, and snow. Valleys may contain small towns, roads, houses, shops, and moving cars. Runs on Linux and Windows in a modern browser with WebGL.

## Run locally

Requires Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `W` / `Up` to climb, `S` / `Down` to descend, and `A` / `Left` or `D` / `Right` to bank. Hold `Shift` or `Space` to boost. `P` pauses and `R` resets the flight. The on-screen boost button also supports press-and-hold; flight controls are available on touch screens.

Wayfinder field notes are optional scenic objectives. Follow the bearing arrow and fly through the amber ring to save a note; each one rolls a different sky-and-terrain event, such as moonrise, lunar mail, aurora, rain, sunset, the clouds' proud smile, or a gravity-free asteroid drift. Event changes and flower patches remain until another objective changes the world. There are 26 of them, each unique: snow globes, confetti parades with double points, a blood moon, a moon parked far too close, ember and ash falls, firefly strikes, cherry blossom blizzards, bubble baths, meteor showers, a color-cycling disco floor, sepia photographs, pink candy rain, a gold rush, a peace treaty that puts the enemies to sleep, ghost hour, and more. There is no timer or penalty for taking your time, but if you keep ignoring the ring it escalates step by step, picking random tricks from a pool of ten (funny messages, a bigger ring, color changes, respawns near you, a beacon, guide arrows, sparkles, strobing, a tunnel of rings, a trembling HUD, a glowing horizon) until you fly through. Shots and collisions make things explode: trees, rocks, houses, cars, cannons, aircraft, balloons, and asteroids all blow up when hit, and flying into airborne objects, towers, or sheer cliffs damages you with a small HUD warning (a red status light and "HULL HIT") plus a few sparks and a thin side smoke trail that never covers the view ahead. The land has real obstacles: seeded mega mountains, winding canyons with waterfalls on their walls, and tall striped radio towers with blinking lights. Cannons sit on dry mountain slopes, while birds, airplanes, gliders, kites, and balloons move through the sky. Red hunter drones spawn ahead of you, chase at a gentle pace, and occasionally fire small, slow shots you can dodge; each takes two hits, and more arrive as your popped count grows. The terrain is textured (grass tufts, soil grain, rock strata, snow) so its shape reads at a glance. Blue interceptors (fast, one hit) join after a few pops and green gunships (slow, four hits, three-shot spreads) after more. Drones chase for a while, then drift in slow circles. The game plays generated ambient music (a calm chord progression in a key picked by the world seed, plus soft bells) and sound effects for shots, explosions, hits, and ring chimes; all audio is synthesized in the browser with no audio files. Press `M` or the SOUND button to mute. Your score rises for shooting enemies (drones 150, interceptors 275, gunships 600), hitting airborne targets and scenery, and clearing rings (500 plus bonuses for a quick or boosted pass); quick kills chain into a combo up to x2, while enemy hits, midair bumps, ramming, tower taps, and cliff scrapes cost points. After every third ring a boss arrives and the next ring waits until it falls: Emberwing the Sky Dragon (fan-shaped fireballs), the Mothership (wide volleys), then Stormray the Thunder Manta (fast lightning bursts), repeating tougher each cycle. Bosses circle you, show a health bar, enrage below half health, and are worth 2,500+ points. Hold `F` or the on-screen FIRE button to pop balloons, kites, and drifting asteroids for fun; boost now charges faster and reaches a higher top speed.

## Verify and build

```sh
npm test
npm run build
npm run preview
```

The production build is a static site in `dist/`; it can be hosted by any static web server. Use the same commands in PowerShell on Windows. No native OS-specific binary or remote game asset is required.

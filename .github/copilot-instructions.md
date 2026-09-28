# landed project guidance

- This is a browser-based, cross-platform Three.js flight game. Keep the first screen inside the playable world; avoid adding a landing page or blocking start flow.
- Keep flight simulation and deterministic procedural terrain in `src/flight.ts` and `src/world.ts`, separate from rendering in `src/main.ts`.
- Preserve relaxed controls, procedural scenery, keyboard support, and touch controls. Any flight or terrain change should include focused tests.
- Run `npm test` and `npm run build` for gameplay changes. The production build is a static site in `dist/` and can be served on Linux or Windows.
- Use the focused agents in `.github/agents/` for implementation, testing, deployment, security review, and reference/licensing review when those tasks apply.
- Do not add external runtime assets without verifying their source, license, and offline/build behavior.

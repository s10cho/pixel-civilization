# Pixel Civilization

HTML-based Pixel Art Idle Civilization Builder (TypeScript + Phaser + Vite).

## Scripts

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Structure

```
src/
  main.ts          entry point, switches between screens
  config/          engine/presentation constants (gameConfig) and gameplay balance (balance)
  screens/         MenuScreen, CityScreen
  render3d/        Three.js city view: stage, camera, ground, buildings, citizens, picking
  simulation/      game state, fixed-step tick, player actions (no rendering code)
  world/           tiles, territory, placement rules
  citizen/         simulated citizens: assignment, daily routine, occupancy
  building/        building types and level rules
  economy/         production and happiness
  progression/     city level, unlocks, eras (later)
  research/        research tree (later)
  ui/              DOM overlay UI (HUD, build dock, building card, main menu)
  persistence/     IndexedDB save slots, localStorage preferences (later)
  audio/           BGM and sound effects (later)
docs/              design notes (3D transition plan)
```

Rendering quality can be forced with `?quality=high|medium|low` (default high).

## UI libraries

The city is rendered with [Three.js](https://threejs.org/) (MIT) as a low-poly isometric scene;
see `docs/3d-transition-plan.md`. The DOM UI uses system fonts and
[Lucide](https://lucide.dev/) icons (ISC, license under `public/licenses/`).

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to
GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to
**GitHub Actions**.

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
  main.ts          entry point, creates the Phaser game
  config/          tunable constants and Phaser game config
  scenes/          BootScene, MenuScene, CityScene (EraTransitionScene later)
  simulation/      pure gameplay logic, independent of Phaser
  world/           tiles, regions, placement, expansion
  citizen/         citizen entities and behavior
  building/        building definitions, upgrades, evolution
  progression/     city level, unlocks, eras
  research/        research tree
  economy/         resources and offline production
  rendering/       Phaser-side presentation helpers (placeholder textures for now)
  ui/              DOM overlay UI (HUD, build bar, panels, main menu)
  persistence/     IndexedDB save slots, localStorage preferences
  audio/           BGM and sound effects
```

## UI libraries

The DOM UI uses [NES.css](https://github.com/nostalgic-css/NES.css) (MIT) for pixel-art
components, the [Galmuri](https://github.com/quiple/galmuri) pixel font (SIL OFL 1.1, with Hangul)
and [pixelarticons](https://github.com/halfmage/pixelarticons) (MIT). Their licenses ship with the
build under `public/licenses/`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to
GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to
**GitHub Actions**.

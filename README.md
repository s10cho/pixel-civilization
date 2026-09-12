# Pixel Civilization

An idle civilization builder in the browser: grow a tiny settlement through the Ancient,
Medieval and Industrial eras. The city is a low-poly isometric 3D scene (Three.js) with a
card-style DOM interface, generative music and synthesized sound — no image or audio assets.

**Play:** https://s10cho.github.io/pixel-civilization/

## Features

- **Build and grow**: homes, shops, parks, power, research and factories on a tile grid.
  Citizens are simulated: they move in, walk to work and to parks, and show their mood.
- **City management**: power supply and demand, staffing, adjacency bonuses (shops next to
  homes, parks around homes, factories near power), pollution and happiness. Problems are
  flagged in the HUD and tapping one focuses the camera on it.
- **Progression**: city XP and levels unlock buildings; a research tree with branch choices;
  eras need population, city level and a key research.
- **Era transitions**: every building, the sky, the ground, the scenery and the music change
  with the era, in a short transformation sequence.
- **Rearrange**: drag a building (or long-press on touch) to move it.
- **Saves**: three IndexedDB save slots with autosave. Time away is credited for up to 8 hours
  (resources only).
- **Settings**: music and effect volume, graphics quality (Auto adapts to the frame rate).
- First-time tutorial, pause menu, PC and mobile layouts.

## Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Select / place | click | tap |
| Pan | left drag | one-finger drag |
| Rotate | right drag | two-finger twist |
| Zoom | wheel | pinch |
| Move a building | drag it | long-press, then drag |
| Cancel tool / open pause menu | Esc | Menu button |

## Scripts

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # simulation unit tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

Rendering quality can be forced with `?quality=high|medium|low`.

## Structure

Gameplay logic is plain TypeScript with no rendering code; the 3D view and DOM UI only read
the state and send player actions.

```
src/
  main.ts          entry point: screen switching, audio unlock
  config/          presentation constants (gameConfig), gameplay balance (balance), research tree
  simulation/      game state, fixed-step tick, player actions, offline progress
  world/           territory and placement rules
  building/        building types, costs, levels, unlocks
  citizen/         simulated citizens: assignment, daily routine, occupancy
  economy/         city report (power, staffing, adjacency, pollution), production, happiness,
                   problems
  progression/     eras, city level, research, era requirements
  tutorial/        first-time tutorial steps
  storage/         IndexedDB save slots and migrations, localStorage preferences
  audio/           WebAudio engine: generative per-era music, sound effects
  render3d/        Three.js view: stage, camera, models, ground, buildings, scenery, citizens,
                   smoke, picking, quality
  screens/         MenuScreen, CityScreen (input, simulation loop, view/UI sync)
  ui/              DOM overlay: HUD, build dock, panels, research, modals, main menu
docs/              design notes
```

## Credits

[Three.js](https://threejs.org/) (MIT) and [Lucide](https://lucide.dev/) icons (ISC); license
texts are in `public/licenses/` and in the in-game Credits.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/`
to GitHub Pages (Pages source: **GitHub Actions**).

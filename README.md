# Pixel Civilization

A calm idle civilization builder in the browser: grow a tiny settlement through the Ancient,
Medieval, Industrial and Modern eras. The city is a low-poly isometric 3D scene (Three.js) with a
card-style DOM interface, generative music and synthesized sound — no image or audio assets.
Nothing in the game can be lost or destroyed: shortages only slow the city down gently.

**Play:** https://s10cho.github.io/pixel-civilization/

## Features

- **Build and grow**: a hundred kinds of building, grouped into category tabs (homes, food,
  trade, industry, power, utilities, transport, leisure, culture, science, civic) and unlocked
  by era and city level. The oldest twelve are renamed and remodelled in every era; later eras
  bring their own — from pottery kilns and bathhouses to steel mills, subway stations and
  space centers. Citizens are simulated: they move in, walk to work and to parks, and show
  their mood.
- **Roads**: cheap paving that connects to its neighbours, with trade and industry beside it
  earning more. Markings follow how wide the road is — a single tile has a dashed centre line,
  a wider one gets edge lines and an amber centre — cars keep to the right-hand lane, and people
  cross at the zebra crossings instead of walking into the traffic.
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
- **Auto-grow**: an optional advisor tends the city on its own — slower than you, always
  leaving gold to spend — so the city keeps growing a little between visits. Its level is up to
  you: off, advice only, small things automatic, or mostly self-tending. Widening the territory
  and entering an era stay your decisions.
- **Growth pace**: Relaxed, Standard or Fast. Pace changes speed only — nothing can fail or be
  lost at any setting (see `docs/phase2-design.md`).
- **AI consulting**: reads the city, points at what stands out, and offers a few plans —
  candidate places for new homes or trade, more land, or a large project — which it carries out
  once you accept. It never decides for you.
- **Your decisions stay yours**: the territory grows towards the side you choose, and large
  projects (a railway across the city, a tunnel through the rock, a central park) are
  commissioned and then visibly built.
- **A city with a history**: rocky ridges to grow around, an old quarter that keeps its
  original era while the rest modernises, and a City history card comparing the beginning with
  now.
- **Something always moving**: day turns to night and the windows light up, cars run the roads
  and a train runs the rails.
- **Achievements**: nineteen gentle milestones with progress bars and small gold rewards.
- **Small gifts**: a traveling merchant, a good harvest, a village festival or a wandering
  scholar drops by now and then. No event ever sets the city back.
- **Languages**: English and Korean, following the browser by default and switchable in
  Settings.
- **Settings**: music and effect volume, growth pace, auto-grow level, language, graphics
  quality (Auto adapts to the frame rate).
- First-time how-to-play card, tutorial, pause menu, PC and mobile layouts.

## Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Select / place | click | tap |
| Pan | drag, or a two-finger trackpad swipe | one-finger drag |
| Zoom | pinch, or ctrl+wheel | pinch |
| Move a building | drag it | long-press, then drag |
| Cancel tool / open pause menu | Esc | Menu button |
| Let the city grow by itself | Auto-grow button (top bar) | Auto-grow button (top bar) |

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
  i18n/            message catalogs (English defines the keys) and display names
  simulation/      game state, fixed-step tick, player actions, offline progress, auto-grow
                   advisor, happy events
  world/           territory and placement rules
  building/        building types, costs, levels, unlocks
  citizen/         simulated citizens: assignment, daily routine, occupancy
  economy/         city report (power, staffing, adjacency, pollution), production, happiness,
                   problems
  progression/     eras, city level, research, era requirements, achievements
  tutorial/        first-time tutorial steps
  storage/         IndexedDB save slots and migrations, localStorage preferences
  audio/           WebAudio engine: generative per-era music, sound effects
  render3d/        Three.js view: stage, camera, hand-made and data-driven models, ground,
                   buildings, scenery, citizens, smoke, picking, quality
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

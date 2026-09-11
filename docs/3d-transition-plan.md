# 3D Transition Plan

Decided 2026-09-11: the world moves from 2D Phaser pixel art to **Three.js low-poly isometric 3D**
(flat-shaded standard materials, soft sun shadows, orthographic camera with a locked pitch).
A spike (commit `f9e6902`, `spike3d.html`) confirmed the existing simulation runs unchanged under
Three.js, and that the low-poly style reads better than a pixelated toon style at similar cost.

## Scope

| Keep | Replace | Add |
| --- | --- | --- |
| simulation, economy, citizen, building, world, balance config | Phaser → Three.js | camera yaw rotation (right drag / two-finger twist) |
| TypeScript + Vite, GitHub Pages | `scenes/` → `screens/` (plain screen switcher) | pinch zoom on touch (via OrbitControls) |
| DOM UI structure (HUD, build bar, building panel, toast) | `rendering/` → `render3d/` | 3D placement preview (ghost building + tile tint) |
| | pixel UI (NES.css, Galmuri, pixelarticons) → soft card UI, system Korean fonts, rounded icons | |

## Steps

Each step is implemented, run, browser-tested (console clean) and verified before the next.

- **T0 · 3D foundation** — remove Phaser; screen switcher (Menu → City); Three.js stage with
  ground and Town Hall; camera pan/zoom/rotate; production build.
- **T1 · Core loop parity (= Milestone 1)** — tile picking, placement preview, placement,
  selection + building panel, upgrades (taller models), territory expansion with camera auto
  focus. Buildings are instanced per (type, level) from the start.
- **T2 · Citizen parity (= Milestone 2)** — instanced citizens with walking bob and facing,
  mood markers, park leisure.
- **T3 · UI redesign** — card-style UI that suits the 3D city; portrait framing on mobile;
  remove the pixel UI libraries.
- **T4 · Performance baseline** — stress measurement (target: < 100 draw calls on a full map),
  quality presets (shadows, render resolution, rendered citizens) ready for Slice 16.

Afterwards the original roadmap resumes (Slice 04 rearrangement, then Milestone 3).

## Status (2026-09-12)

T0–T4 are implemented and browser-verified on branch `3d-transition` (desktop Chrome and a
390px-wide viewport; real touch devices still untested).

| Measure (389 buildings, 50 citizens, full map) | high | low |
| --- | --- | --- |
| Draw calls | 27 | 15 |
| Render time per frame (desktop) | 0.13 ms | 0.03 ms |
| Shadows / pixel ratio / citizens drawn | on / 2 / 50 | off / 1 / 20 |

For comparison, the per-mesh spike needed 5,853 draw calls for the same city. The production
bundle is 603 KB JS (153 KB gzip) + 7 KB CSS, down from 1.4 MB with Phaser and 670 KB of fonts.

## Design brief changes

- §19 Visual Direction: Pixel Art → low-poly isometric 3D; "cozy + civilization-scale" stays.
- §24 Asset Strategy: AI-generated 2D sprites → procedural low-poly models first, glTF models
  later (CC0 packs are candidates; check licenses).
- §25 Pixel Art Style Guide → 3D Style Guide: 1 tile = 1 world unit, fixed camera pitch, light
  direction, palette, per-building polygon budget, citizen height ≈ 0.25 tile.
- §26–28 Tech / Rendering / Architecture: Phaser → Three.js; Scenes → Screens.
- §13 Controls: camera rotation added.
- §32 Performance: quality levels also scale shadows and render resolution.
- §12 Era Visual Transformation: eras swap model sets (timber → stone → brick and chimneys),
  lighting and palette.
- The project name "Pixel Civilization" is kept for now; revisit later.

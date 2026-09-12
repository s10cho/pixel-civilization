# Phase 2 design: a growth game, not a building game

Agreed with the player on 2026-09-12. This is the reference for Phase 2 work; the MVP notes
live in `3d-transition-plan.md`.

## Identity

> A healing growth game where the AI and the city grow on their own, and the player picks the
> direction at the right moments, watching their own civilization become something bigger.

Placing buildings is not the point. The loop is:

```
auto-growth -> watching -> a choice -> the city changes -> auto-growth
```

The three pleasures to protect, in order:

1. **Growth** — it must always feel like the city is further along than before, and that has to
   be *visible*: buildings change, citizens multiply, roads spread, night lights appear,
   territory reaches past the hills.
2. **Watching** — time spent not playing is part of the experience. Something small should
   always be moving.
3. **Intervention** — the player still makes the decisions that make the city theirs.

## Principles

- **Remove the labour, keep the decisions.** Automation handles "a house is needed", "power is
  a little short", "connect this road". The player keeps "where does the city grow?", "what
  shape should it take?", "which research path?", "which plan do we follow?".
- **Micro vs Macro.** Micro decisions (one house, a well, a short road, a park) may be
  automatic. Macro decisions (new region, mountain development, tunnels, rail lines, an
  industrial district, redevelopment, an era change) belong to the player.
- **Growth pace, not difficulty.** Relaxed / Standard / Fast change *speed*, never the chance
  of failing. Later, optional difficulty changes how much optimisation is rewarded — never
  whether the city can be lost. No game over, no destroyed city.
- **The first release is deliberately easy.** None of these may happen in the default pace:
  broke and stuck, blackout stopping the city, a misplaced building blocking progress, a
  research order that dead-ends, roads that trap citizens. Every mistake is recoverable.
- **AI helps, it does not play.** "AI consulting" (AI 컨설팅) is the name for this: analysis ->
  options -> the player chooses -> automatic execution. The always-on part that builds small
  things by itself keeps its own name, auto-grow (자동 성장).
- **Don't erase the past.** Later eras leave some quarters as they were: an old town, the old
  market street, the first industrial district. (No religious buildings, ever.)
- **The city remembers.** Long-lived places earn small notes: "this is where the village
  started", "this road has been here since the medieval era".

## Slices

| Slice | Content | Brief | State |
| --- | --- | --- | --- |
| A | Growth pace (relaxed/standard/fast) and automation level (off/low/medium/high) | §3, §7 | done |
| B | Growth feedback: city history against the beginning, richer welcome-back summary | §9 | done |
| C | AI consulting: advice with a place to look, three candidate plans, one-tap execution | §6, §8 | done |
| D | Macro decisions: the side the territory grows towards, rocky terrain, large projects | §1.3, §8 | done |
| E | Keeping the past: the oldest quarter stays in its own era, and any building can be kept | §11 | done |
| F | Milestones: gentle long-term goals (1,000 citizens, first railway, 1,000 tiles) | §12 | done |
| G | Visible growth: night lighting, traffic on the roads, rails, tunnels through the hills | §1.1 | done |

Still open for later: automatic traffic planning and district tidying (§0), difficulty levels
beyond the growth pace (§5), and city memory notes beyond "standing here since the ..." (§10).

Automation must never swallow the game: above a certain size, a change asks the player first.

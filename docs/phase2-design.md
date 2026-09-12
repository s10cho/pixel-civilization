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
- **AI helps, it does not play.** Analysis -> options -> the player chooses -> automatic
  execution.
- **Don't erase the past.** Later eras leave some quarters as they were: an old town, the old
  market street, the first industrial district. (No religious buildings, ever.)
- **The city remembers.** Long-lived places earn small notes: "this is where the village
  started", "this road has been here since the medieval era".

## Slices

| Slice | Content | Brief |
| --- | --- | --- |
| A | Growth pace (relaxed/standard/fast) and automation level (off/low/medium/high) | §3, §7 |
| B | Growth feedback: city history against day one, and a "since your last visit" summary | §9 |
| C | The advisor: small advice, three-candidate proposals, city-scale plans | §6, §8 |
| D | Macro decisions: choosing the direction the territory grows, large projects | §1.3, §8 |
| E | Keeping the past: districts that stay in an older era's clothes | §11 |
| F | Milestones: gentle long-term goals (1,000 citizens, first railway, 10,000 tiles) | §12 |
| G | Visible growth: night lighting, traffic, hills, tunnels, railways, new towns | §1.1 |

Automation must never swallow the game: above a certain size, a change asks the player first.

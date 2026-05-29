# Toontown Online — Cog Battle System (recreation)

A complete, playable recreation of the classic Toontown Online turn-based Cog
battle, in plain HTML/CSS/vanilla JS. No build step, no dependencies — just open
`index.html` in a modern browser (or serve the folder, e.g.
`python -m http.server`).

## Run it
```
cd ToontownBattle
python -m http.server 8099
# open http://localhost:8099
```

## How to play
1. **Gag Selection** — each Toon, in turn, picks a gag track and a gag. A shared
   30-second timer counts down; when it expires, undecided Toons auto-pass.
2. **Target Selection** — single-target gags prompt you to click a Cog (or a Toon
   for single Toon-up heals). Group gags / group heals auto-target.
3. **FIGHT** — gags resolve in the canonical priority order, then the Cogs
   counterattack. Floating combat text shows damage, misses, heals, lures,
   knockback and combo bonuses.
4. **Status Update** — laff, Cog HP, lure timers, traps and ammo all update; the
   next round begins. Win by defeating all Cogs; lose if all Toons go sad.

## Architecture (clean separation of concerns)
| File | Responsibility |
|------|----------------|
| `js/data.js` | **All authentic data**, transcribed 1:1 from the Anesidora source (gag damage/accuracy tables, lure durations, bonus tables, cog defense/HP). |
| `js/calculator.js` | **Battle Calculation Engine** — a faithful port of `BattleCalculatorAI.py`. Hit/miss, damage, accuracy bonuses, combos, knockback, lures, traps, cog AI. Pure logic, no DOM. |
| `js/gamestate.js` | **Game State** — Toons, Cogs, inventory, lure/trap status, round housekeeping. |
| `js/ui.js` | **UI Render Engine** — battlefield (CSS/SVG Toons & Cogs), HP/laff meters, status chips, gag menu, timer, floating text. No battle logic. |
| `js/main.js` | **Controller** — the four-phase state machine and player input. |

## Source-accuracy notes
The following are ported directly from `Anesidora/toontown/src`:

- **Gag execution order:** Toon-up → Trap → Lure → Sound → Throw → Squirt → Drop
  (`TRACK_ORDER`).
- **Cog HP:** `(level + 1) × (level + 2)` for actual levels 1–12 (`cogHpForLevel`).
- **Damage:** `getAvPropDamage` interpolates a gag's `[min,max]` damage across the
  Toon's track experience between the relevant `Levels[]` thresholds.
- **Accuracy:** `propAcc + trackExp + (-cogDef) + prevHitBonus`, capped at 95
  (`MaxToonAcc`). Lured cogs raise accuracy by `100 × luredRatio`; all-lured =
  guaranteed hit. Trap always hits; Drop misses lured cogs.
- **Lure:** no direct damage; springs any trap in front of the cog (dealing the
  trap's damage and waking the cog); otherwise lures for `NumRoundsLured[level]`
  rounds with a per-round wake-up chance of `100 − 2×acc`.
- **Knockback bonus:** Throw/Squirt on a lured cog deal `+50%` of total track
  damage (placed on the last attacker), per `__processBonuses`.
- **Combo (HP) bonus:** 2+ same-track hits on one cog add
  `ceil(total × DamageBonuses[n-1]/100)` to the last attacker.
- **Accuracy bonus:** previous different-track hits on a shared target give
  `AccuracyBonuses = [0,20,40,60]`.
- **Cog AI:** attacks the Toon that dealt it the most damage 75% of the time,
  else random; group/single targeting per attack.

### Intentional scoping simplification
Cog attack **selection** uses a uniform pick among that cog's attack set rather
than the per-level `freq` weighting (the per-attack **damage and accuracy**
values themselves are the authentic source values). Everything else follows the
source math. The cog roster ships the Bossbot ladder (Flunky → Big Cheese); the
defense/HP model is generic across tracks, so adding the other three tracks is
just more `COG_TYPES` entries.

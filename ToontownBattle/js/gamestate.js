/* =============================================================================
 * gamestate.js  —  Game State Logic
 * -----------------------------------------------------------------------------
 * Owns the canonical battle state: toons (laff, gag inventory, track exp),
 * cogs (hp, level, defense, lure/trap status), and round bookkeeping.
 *
 * Pure data + mutation helpers. No DOM, no math beyond inventory/lure ticking.
 * The Calculator reads & mutates HP/lure/trap here; the UI reads it to render.
 * ===========================================================================*/

const GameState = (() => {
  "use strict";

  const D = TTData;
  let _uid = 1;
  const nextId = () => _uid++;

  /* ----- Toon factory ------------------------------------------------------*/
  function makeToon(name, color, trackLoadouts) {
    // trackLoadouts: { [trackIndex]: { maxLevel, exp, organic? } }
    const tracks = {};
    const inventory = {}; // inventory[track][level] = ammo count
    for (const trackStr in trackLoadouts) {
      const track = Number(trackStr);
      const lo = trackLoadouts[track];
      tracks[track] = { exp: lo.exp || 0, maxLevel: lo.maxLevel, organic: !!lo.organic };
      inventory[track] = {};
      // Give the toon a generous starting stock of every gag tier they own.
      for (let lvl = 0; lvl <= lo.maxLevel; lvl++) {
        // higher tiers get less ammo, mimicking carry limits
        inventory[track][lvl] = Math.max(2, 12 - lvl * 2);
      }
    }
    const maxLaff = 50;
    return {
      id: nextId(),
      name,
      color,
      laff: maxLaff,
      maxLaff,
      tracks,
      inventory,
      roundExp: {},
    };
  }

  /* ----- Cog factory -------------------------------------------------------*/
  function makeCog(typeKey, relLevel) {
    const type = D.COG_TYPES[typeKey];
    // actual cog level (1..12): position base level + relative level. The
    // source uses pos as a 0-based base; displayed levels start at 1.
    const actualLevel = type.pos + relLevel + 1;
    const maxHp = D.cogHpForLevel(actualLevel);
    const def = D.COG_DEF_BY_POSITION[type.pos][relLevel];
    return {
      id: nextId(),
      typeKey,
      name: type.name,
      track: type.track,
      level: actualLevel,
      relLevel,
      maxHp,
      hp: maxHp,
      def,
      lured: null,         // { rounds, wakeupChance, lurerId, level }
      trap: null,          // { level, damage, creatorId }
      trapConflict: false,
      attackers: {},       // toonId -> total damage dealt (for target picking)
      removed: false,
    };
  }

  /* ----- The state object --------------------------------------------------*/
  function create(toons, cogs) {
    return {
      toons,
      cogs,
      round: 0,

      getToon(id) { return this.toons.find((t) => t.id === id) || null; },
      getCog(id) { return this.cogs.find((c) => c.id === id) || null; },
      toonIndex(id) { return this.toons.findIndex((t) => t.id === id); },
      cogIndex(id) { return this.cogs.findIndex((c) => c.id === id); },
      aliveToons() { return this.toons.filter((t) => t.laff > 0); },
      aliveCogs() { return this.cogs.filter((c) => c.hp > 0 && !c.removed); },

      // Spend one unit of ammo for a chosen gag.
      spendGag(toonId, track, level) {
        const t = this.getToon(toonId);
        if (t && t.inventory[track] && t.inventory[track][level] > 0) {
          t.inventory[track][level]--;
          return true;
        }
        return false;
      },

      // Record damage a toon dealt to a cog (for cog target selection).
      recordAttacker(cogId, toonId, dmg) {
        const c = this.getCog(cogId);
        if (!c) return;
        c.attackers[toonId] = (c.attackers[toonId] || 0) + dmg;
      },

      // End-of-round housekeeping: clear trap conflicts, tick lure timers
      // (with wakeup chance), commit per-round exp, remove dead cogs.
      endRound() {
        // commit roundExp into track exp (capped per battle by ExperienceCap)
        for (const t of this.toons) {
          if (!t.roundExp) continue;
          for (const trackStr in t.roundExp) {
            const track = Number(trackStr);
            if (t.tracks[track]) {
              t.tracks[track].exp += t.roundExp[trackStr];
            }
          }
          t.roundExp = {};
        }
        // lure ticking
        for (const c of this.cogs) {
          c.trapConflict = false;
          if (c.lured) {
            // mark that the lure has survived into a new round
            c.lured.prevRound = true;
            c.lured.rounds -= 1;
            if (c.lured.rounds <= 0 || BattleCalculator.randInt(0, 99) < c.lured.wakeupChance) {
              c.lured = null;
            }
          }
        }
        // mark dead cogs removed
        for (const c of this.cogs) {
          if (c.hp <= 0) c.removed = true;
        }
        this.round++;
      },

      isVictory() { return this.aliveCogs().length === 0; },
      isDefeat() { return this.aliveToons().length === 0; },
    };
  }

  return { create, makeToon, makeCog };
})();

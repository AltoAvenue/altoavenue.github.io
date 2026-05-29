/* =============================================================================
 * calculator.js  —  Battle Calculation Engine
 * -----------------------------------------------------------------------------
 * A faithful port of the relevant pieces of BattleCalculatorAI.py.
 *
 * Public entry point:  BattleCalculator.calculateRound(state, toonChoices)
 *   - state:       the GameState (toons + cogs + lure/trap status)
 *   - toonChoices: array of { toonId, track, level, targetCogId } (a "gag")
 *
 * Returns a structured "round result" describing, in resolution order, every
 * gag's outcome (hit/miss, per-target damage, lure applied, trap sprung,
 * knockback/combo bonuses, deaths). The UI/animation layer consumes this; it
 * does NOT do any math itself.
 *
 * The engine mutates cog HP / lure / trap status as it resolves, exactly like
 * the AI does, so ordering effects (lure-then-throw, trap-then-lure, combos)
 * come out correct.
 * ===========================================================================*/

const BattleCalculator = (() => {
  "use strict";

  const D = TTData;
  const T = D.TRACK;

  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  /* --- getAvPropDamage: exp-interpolated base damage (ToontownBattleGlobals) */
  function getAvPropDamage(track, level, exp, organicBonus) {
    const entry = D.AvPropDamage[track][level];
    const minD = entry[0][0], maxD = entry[0][1];
    const minE = entry[1][0], maxE = entry[1][1];
    const expVal = Math.min(exp, maxE);
    const expPerHp = (maxE - minE + 1) / (maxD - minD + 1);
    let damage = Math.floor((expVal - minE) / expPerHp) + minD;
    if (damage <= 0) damage = minD;
    if (organicBonus) {
      let bonus = Math.floor(damage * 0.1);
      if (bonus < 1 && damage > 0) bonus = 1;
      damage += bonus;
    }
    return damage;
  }

  // Accuracy bonus a toon gets from its experience level in a track.
  // (track exp level = highest threshold index passed in Levels[track])
  function toonTrackExpLevel(exp, track) {
    const thresholds = D.Levels[track];
    let lvl = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (exp >= thresholds[i]) lvl = i;
    }
    return lvl;
  }

  function toonTrackExpAccBonus(toon, track) {
    const lvl = toonTrackExpLevel(toon.tracks[track] ? toon.tracks[track].exp : 0, track);
    let exp = D.AttackExpPerTrack[lvl];
    if (track === T.HEAL) exp = exp * 0.5;
    return exp;
  }

  // Suit defense for a target (negative number, as in __targetDefense).
  function targetDefense(cog, atkTrack) {
    if (atkTrack === T.HEAL) return 0;
    return -cog.def;
  }

  /* ===========================================================================
   * Main per-round resolution.
   * =========================================================================*/
  function calculateRound(state, toonChoices) {
    // Build the ordered attack list. Resolution order follows TRACK_ORDER
    // (Toon-up -> Trap -> Lure -> Sound -> Throw -> Squirt -> Drop). Within a
    // track, attacks keep the toon's seating order.
    const attacks = toonChoices
      .filter((c) => c && c.track !== null && c.track !== undefined)
      .map((c) => ({
        toonId: c.toonId,
        toon: state.getToon(c.toonId),
        track: c.track,
        level: c.level,
        targetCogId: c.targetCogId,          // null for group gags / heals
        targetToonId: c.targetToonId || null, // for single-target heals
        // outcome fields filled in below:
        hit: false,
        accUsed: 0,
        group: D.isGroup(c.track, c.level),
        perTarget: [],   // [{cogId, damage, lured, trapSprung, died, kb, combo}]
        healAmount: 0,
        healTargets: [],
        luredCogIds: [],
        trapPlaced: null,
      }));

    attacks.sort((a, b) => {
      const ta = D.TRACK_ORDER.indexOf(a.track);
      const tb = D.TRACK_ORDER.indexOf(b.track);
      if (ta !== tb) return ta - tb;
      return state.toonIndex(a.toonId) - state.toonIndex(b.toonId);
    });

    // successfulLures (this round) and combo bookkeeping.
    // For accuracy "previous track hit" bonus we track, per cogId, how many
    // distinct earlier tracks have already landed a hit on it this round.
    const prevTrackHitsByCog = {};   // cogId -> Set(track)
    const groupPrevTrackHits = [];   // list of tracks that hit via group atk

    // For combo (hp) bonus and knockback (kb) bonus: collect damage grouped by
    // (cogId, track) as we resolve, then apply bonuses at the end.
    const damageGroups = {}; // key `${cogId}|${track}` -> [{attackRef, dmg}]

    // We resolve track-by-track so that lures/traps set up before throws etc.
    for (let i = 0; i < attacks.length; i++) {
      const atk = attacks[i];
      const toon = atk.toon;
      if (!toon || toon.laff <= 0) continue; // dead toon can't attack

      if (atk.track === T.HEAL) {
        resolveHeal(state, atk);
        continue;
      }
      if (atk.track === T.TRAP) {
        resolveTrap(state, atk);
        continue;
      }
      if (atk.track === T.LURE) {
        resolveLure(state, atk, prevTrackHitsByCog);
        continue;
      }

      // Damage tracks: SOUND, THROW, SQUIRT, DROP
      resolveDamage(state, atk, prevTrackHitsByCog, groupPrevTrackHits, damageGroups);
    }

    // Apply combo (HP) bonuses and knockback (KB) bonuses, then commit damage.
    applyBonusesAndCommit(state, damageGroups, attacks);

    // Build a record of cog deaths after all damage applied.
    const result = {
      attacks,
      deadCogIds: state.cogs.filter((c) => c.hp <= 0 && !c.removed).map((c) => c.id),
    };
    return result;
  }

  /* ----- Heal (Toon-up) ----------------------------------------------------*/
  function resolveHeal(state, atk) {
    const toon = atk.toon;
    const exp = toon.tracks[T.HEAL] ? toon.tracks[T.HEAL].exp : 0;
    const organic = toon.tracks[T.HEAL] && toon.tracks[T.HEAL].organic;
    // base accuracy roll
    const propAcc = D.AvPropAccuracy[T.HEAL][atk.level];
    const acc = Math.min(propAcc + toonTrackExpAccBonus(toon, T.HEAL), D.MaxToonAcc);
    const hit = randInt(0, 99) < acc;
    atk.hit = hit;
    atk.accUsed = acc;

    let amount = getAvPropDamage(T.HEAL, atk.level, exp, organic);

    // group vs single
    const group = D.isGroup(T.HEAL, atk.level);
    let targets;
    if (group) {
      targets = state.aliveToons().filter((t) => t.id !== toon.id);
    } else {
      const tgt = state.getToon(atk.targetToonId);
      targets = tgt ? [tgt] : [];
    }
    if (targets.length === 0) {
      atk.hit = false;
      return;
    }
    // heals that "miss" only do 1/5 the amount
    if (!hit) amount = amount * 0.2;
    if (group) amount = amount / targets.length;
    amount = Math.floor(amount);

    atk.healAmount = amount;
    for (const t of targets) {
      const before = t.laff;
      t.laff = Math.min(t.maxLaff, t.laff + amount);
      atk.healTargets.push({ toonId: t.id, healed: t.laff - before });
    }
  }

  /* ----- Trap --------------------------------------------------------------*/
  function resolveTrap(state, atk) {
    const cog = state.getCog(atk.targetCogId);
    if (!cog || cog.hp <= 0) { atk.hit = false; return; }

    // Trap always "hits" (it just gets placed). It fails if the cog is lured
    // or already has a trap (trap conflict -> both removed).
    if (cog.lured) {
      atk.hit = false;
      atk.trapFailed = "lured";
      return;
    }
    const toon = atk.toon;
    const exp = toon.tracks[T.TRAP] ? toon.tracks[T.TRAP].exp : 0;
    const organic = toon.tracks[T.TRAP] && toon.tracks[T.TRAP].organic;
    const damage = getAvPropDamage(T.TRAP, atk.level, exp, organic);

    if (cog.trap) {
      // Second trap this round -> conflict, both disappear.
      cog.trap = null;
      cog.trapConflict = true;
      atk.hit = false;
      atk.trapFailed = "conflict";
      return;
    }
    cog.trap = { level: atk.level, damage, creatorId: toon.id };
    atk.hit = true;
    atk.trapPlaced = { cogId: cog.id, level: atk.level, damage };
  }

  /* ----- Lure --------------------------------------------------------------*/
  function resolveLure(state, atk, prevTrackHitsByCog) {
    const toon = atk.toon;
    const organic = toon.tracks[T.LURE] && toon.tracks[T.LURE].organic;
    // Lure accuracy: organic toons use the bonus table.
    let propAcc = organic ? D.AvLureBonusAccuracy[atk.level] : D.AvPropAccuracy[T.LURE][atk.level];
    const group = D.isGroup(T.LURE, atk.level);

    let targets;
    if (group) targets = state.aliveCogs();
    else {
      const c = state.getCog(atk.targetCogId);
      targets = c && c.hp > 0 ? [c] : [];
    }
    if (targets.length === 0) { atk.hit = false; return; }

    // Single accuracy roll governs the whole lure (group lures all hit/miss
    // together). Defense is the min (best) defense among targets.
    let tgtDef = 0;
    for (const c of targets) tgtDef = Math.min(targetDefense(c, T.LURE), tgtDef);
    const acc = Math.min(propAcc + toonTrackExpAccBonus(toon, T.LURE) + tgtDef, D.MaxToonAcc);
    const hit = randInt(0, 99) < acc;
    atk.hit = hit;
    atk.accUsed = acc;
    if (!hit) return;

    const rounds = D.NumRoundsLured[atk.level];
    const wakeupChance = 100 - acc * 2;

    for (const c of targets) {
      if (c.trap) {
        // Lured onto a trap: the trap springs, dealing its damage; cog is NOT
        // left lured (the trap "wakes" it). Trap creator gets credit (exp).
        const trap = c.trap;
        c.trap = null;
        const before = c.hp;
        c.hp = Math.max(0, c.hp - trap.damage);
        atk.perTarget.push({
          cogId: c.id, damage: trap.damage, trapSprung: true,
          died: c.hp <= 0, lured: false, before, after: c.hp,
        });
        // mark this cog as having been hit (for combo accuracy) by trap
        markCogHit(prevTrackHitsByCog, c.id, T.TRAP);
        // exp credit to trap creator + lure
        creditExp(state, trap.creatorId, T.TRAP, trap.level, trap.damage);
        creditExp(state, toon.id, T.LURE, atk.level, trap.damage);
      } else {
        // Normal lure: cog becomes lured for `rounds` rounds.
        c.lured = { rounds, wakeupChance, lurerId: toon.id, level: atk.level, prevRound: false };
        atk.luredCogIds.push(c.id);
        atk.perTarget.push({ cogId: c.id, damage: 0, lured: true, before: c.hp, after: c.hp });
      }
    }
  }

  /* ----- Damage tracks: SOUND, THROW, SQUIRT, DROP -------------------------*/
  function resolveDamage(state, atk, prevTrackHitsByCog, groupPrevTrackHits, damageGroups) {
    const toon = atk.toon;
    const track = atk.track;
    const organic = toon.tracks[track] && toon.tracks[track].organic;
    const exp = toon.tracks[track] ? toon.tracks[track].exp : 0;

    const group = D.isGroup(track, atk.level);
    let targets;
    if (group) targets = state.aliveCogs();
    else {
      const c = state.getCog(atk.targetCogId);
      targets = c && c.hp > 0 ? [c] : [];
    }
    if (targets.length === 0) { atk.hit = false; return; }

    // --- Accuracy (per __calcToonAtkHit) ---
    let tgtDef = 0;
    let numLured = 0;
    for (const c of targets) {
      tgtDef = Math.min(targetDefense(c, track), tgtDef);
      if (c.lured) numLured++;
    }
    const propAcc = D.AvPropAccuracy[track][atk.level];
    const trackExp = toonTrackExpAccBonus(toon, track);
    const attackAcc = propAcc + trackExp + tgtDef;

    // accuracy bonus from previous DIFFERENT-track hits on shared target(s)
    const accBonus = previousHitAccBonus(atk, targets, prevTrackHitsByCog, group, groupPrevTrackHits);
    let acc = attackAcc + accBonus;

    let hit;
    if (track === T.DROP) {
      // Drop misses lured cogs. If ALL targets are lured -> automatic miss.
      if (numLured === targets.length) {
        hit = false;
      } else {
        acc = Math.min(acc, D.MaxToonAcc);
        hit = randInt(0, 99) < acc;
      }
    } else {
      // SOUND/THROW/SQUIRT: if all targets lured -> guaranteed hit; otherwise
      // lured ratio improves accuracy.
      if (numLured === targets.length) {
        hit = true;
        acc = 100;
      } else {
        const luredRatio = numLured / targets.length;
        acc += 100 * luredRatio;
        acc = Math.min(acc, D.MaxToonAcc);
        hit = randInt(0, 99) < acc;
      }
    }
    atk.hit = hit;
    atk.accUsed = Math.round(acc);
    if (!hit) return;

    // --- Damage ---
    const baseDamage = getAvPropDamage(track, atk.level, exp, organic);
    for (const c of targets) {
      // Drop on a lured cog does no damage (and shouldn't reach here because
      // the all-lured case already missed; but a mixed group could).
      if (track === T.DROP && c.lured) {
        atk.perTarget.push({ cogId: c.id, damage: 0, lured: true, dodgedDrop: true });
        continue;
      }
      const pt = {
        cogId: c.id,
        damage: baseDamage,
        base: baseDamage,
        lured: !!c.lured,
        kb: 0,
        combo: 0,
        before: c.hp,
      };
      atk.perTarget.push(pt);
      // record for combo/kb bonus processing
      const key = `${c.id}|${track}`;
      (damageGroups[key] = damageGroups[key] || []).push({ atk, pt, cogId: c.id, track });
      // mark hit for subsequent accuracy bonuses
      markCogHit(prevTrackHitsByCog, c.id, track);
      if (group) groupPrevTrackHits.push(track);
    }
  }

  /* ----- previous-hit accuracy bonus (AccuracyBonuses table) ---------------*/
  function previousHitAccBonus(atk, targets, prevTrackHitsByCog, group, groupPrevTrackHits) {
    // Count distinct earlier tracks (different from this one) that have hit a
    // target this attack shares. For group attacks, any group/shared hit counts.
    const tracksSeen = new Set();
    if (group) {
      // consider all tracks that landed on any of our targets
      for (const c of targets) {
        const s = prevTrackHitsByCog[c.id];
        if (s) for (const tr of s) if (tr !== atk.track) tracksSeen.add(tr);
      }
    } else {
      const c = targets[0];
      const s = prevTrackHitsByCog[c.id];
      if (s) for (const tr of s) if (tr !== atk.track) tracksSeen.add(tr);
    }
    const n = Math.min(tracksSeen.size, D.AccuracyBonuses.length - 1);
    return D.AccuracyBonuses[n];
  }

  function markCogHit(map, cogId, track) {
    (map[cogId] = map[cogId] || new Set()).add(track);
  }

  /* ----- Combo (HP) + Knockback (KB) bonuses, then commit damage -----------*/
  function applyBonusesAndCommit(state, damageGroups, attacks) {
    // First compute bonuses per (cog, track) group.
    for (const key in damageGroups) {
      const grp = damageGroups[key];
      const track = grp[0].track;
      const cog = state.getCog(grp[0].cogId);

      // --- Knockback bonus: THROW/SQUIRT on a lured cog get +50% total dmg,
      //     placed on the LAST attacker in the group (matches __processBonuses).
      const luredHits = grp.filter((g) => g.pt.lured);
      if ((track === T.THROW || track === T.SQUIRT) && luredHits.length > 0) {
        let total = 0;
        for (const g of grp) total += g.pt.base;
        const kb = total * 0.5;
        grp[grp.length - 1].pt.kb = kb;
      }

      // --- Combo (HP) bonus: 2+ same-track hits on same cog. Bonus =
      //     ceil(totalDamage * DamageBonuses[n-1]/100) on the last attacker.
      if (grp.length > 1) {
        let total = 0;
        for (const g of grp) total += g.pt.base;
        const n = Math.min(grp.length - 1, D.DamageBonuses.length - 1);
        const combo = Math.ceil(total * (D.DamageBonuses[n] * 0.01));
        grp[grp.length - 1].pt.combo = combo;
      }
    }

    // Now commit all damage to cog HP, summing base + kb + combo per hit, and
    // award exp / detect lured-knockback unlure.
    for (const atk of attacks) {
      for (const pt of atk.perTarget) {
        if (pt.trapSprung) continue; // trap damage already applied during lure
        const cog = state.getCog(pt.cogId);
        if (!cog) continue;
        const total = Math.round((pt.damage || 0) + (pt.kb || 0) + (pt.combo || 0));
        pt.damage = total;
        if (total > 0) {
          pt.before = cog.hp;
          cog.hp = Math.max(0, cog.hp - total);
          pt.after = cog.hp;
          pt.died = cog.hp <= 0;
          // award exp to attacker (capped per source via ExperienceCap elsewhere)
          creditExp(state, atk.toonId, atk.track, atk.level, total);
        }
        // THROW/SQUIRT/SOUND unlure the cog after hitting it.
        if (cog.lured && (atk.track === T.THROW || atk.track === T.SQUIRT || atk.track === T.SOUND)) {
          cog.lured = null;
          pt.unlured = true;
        }
      }
    }
  }

  /* ----- exp credit (simplified; tracks per-battle gain) -------------------*/
  function creditExp(state, toonId, track, level, damage) {
    const toon = state.getToon(toonId);
    if (!toon || !toon.tracks[track]) return;
    // In the real game you earn the gag's level+1 skill points on a hit.
    const gain = level + 1;
    toon.roundExp = toon.roundExp || {};
    toon.roundExp[track] = (toon.roundExp[track] || 0) + gain;
  }

  /* ===========================================================================
   * COG TURN — pick attack + target + resolve (port of __calcSuitAtk*).
   * Returns array of { cogId, attackName, group, hit, perTarget:[{toonId,dmg}] }
   * =========================================================================*/
  function calculateCogTurn(state) {
    const results = [];
    for (const cog of state.aliveCogs()) {
      // Lured cogs skip their turn.
      if (cog.lured) {
        results.push({ cogId: cog.id, lured: true });
        // tick down lure wakeups handled in state.endRound
        continue;
      }
      const type = D.COG_TYPES[cog.typeKey];
      const rel = cog.relLevel; // 0..4
      // pick attack by frequency (uniform-ish fallback: weight unknown -> equal)
      const choice = type.attacks[randInt(0, type.attacks.length - 1)];
      const acc = choice.acc[rel];
      const dmg = choice.dmg[rel];
      const group = choice.group;

      let targets;
      if (group) targets = state.aliveToons();
      else {
        // attack the toon that did the most damage 75% of the time, else random
        let target = null;
        if (Math.random() < 0.75 && cog.attackers && Object.keys(cog.attackers).length) {
          target = pickWeightedAttacker(state, cog);
        }
        if (!target) {
          const alive = state.aliveToons();
          target = alive.length ? alive[randInt(0, alive.length - 1)] : null;
        }
        targets = target ? [target] : [];
      }
      if (targets.length === 0) continue;

      const hit = randInt(0, 99) < acc;
      const perTarget = [];
      for (const t of targets) {
        if (hit) {
          const before = t.laff;
          t.laff = Math.max(0, t.laff - dmg);
          perTarget.push({ toonId: t.id, dmg, before, after: t.laff, died: t.laff <= 0 });
        } else {
          perTarget.push({ toonId: t.id, dmg: 0, missed: true });
        }
      }
      results.push({ cogId: cog.id, attackName: choice.name, group, hit, perTarget });
    }
    return results;
  }

  function pickWeightedAttacker(state, cog) {
    const ids = Object.keys(cog.attackers).filter((id) => {
      const t = state.getToon(Number(id));
      return t && t.laff > 0;
    });
    if (!ids.length) return null;
    let total = 0;
    for (const id of ids) total += cog.attackers[id];
    if (total <= 0) return state.getToon(Number(ids[randInt(0, ids.length - 1)]));
    let roll = Math.random() * total;
    for (const id of ids) {
      roll -= cog.attackers[id];
      if (roll <= 0) return state.getToon(Number(id));
    }
    return state.getToon(Number(ids[0]));
  }

  return {
    calculateRound,
    calculateCogTurn,
    getAvPropDamage,
    toonTrackExpLevel,
    randInt,
  };
})();

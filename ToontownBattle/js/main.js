/* =============================================================================
 * main.js  —  Battle Controller / State Machine
 * -----------------------------------------------------------------------------
 * Drives the four classic phases:
 *     1. Gag Selection (with countdown timer)
 *     2. Target Selection
 *     3. Animation / Resolution  (toon gags, then cog counterattack)
 *     4. Rewards / Status Update
 *
 * It owns no battle math (Calculator) and no rendering (UI) — it only sequences
 * them and manages player input.
 * ===========================================================================*/

(() => {
  "use strict";
  const D = TTData;
  const T = D.TRACK;

  // ---- tunables ----
  const SELECT_SECONDS = 30;   // shared team gag-selection timer
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- runtime ----
  let state = null;
  let choices = {};          // toonId -> { track, level, targetCogId, targetToonId, pass }
  let selectIndex = 0;       // which alive toon is currently choosing
  let activeTrack = null;    // track tab open in the menu
  let pendingGag = null;     // gag awaiting a target { track, level }
  let phase = "select";
  let timerHandle = null;
  let timeLeft = 0;

  /* ===========================================================================
   * SETUP
   * =========================================================================*/
  function newGame() {
    // Build a team of four toons with varied gag loadouts and experience.
    const L = (maxLevel, exp, organic) => ({ maxLevel, exp, organic });
    const toons = [
      GameState.makeToon("Pluto", "#ff7b54", {
        [T.THROW]: L(4, 2000), [T.SQUIRT]: L(3, 400), [T.TRAP]: L(3, 800),
        [T.HEAL]: L(2, 200),
      }),
      GameState.makeToon("Daisy", "#9b7bff", {
        [T.LURE]: L(4, 2000, true), [T.SOUND]: L(3, 1000), [T.THROW]: L(2, 50),
        [T.HEAL]: L(3, 800),
      }),
      GameState.makeToon("Goofy", "#4fc3f7", {
        [T.DROP]: L(4, 2000), [T.THROW]: L(3, 400), [T.SQUIRT]: L(2, 50),
      }),
      GameState.makeToon("Minnie", "#ff5fa2", {
        [T.SQUIRT]: L(4, 2000, true), [T.SOUND]: L(2, 200), [T.LURE]: L(2, 100),
        [T.HEAL]: L(3, 800),
      }),
    ];

    // Build four cogs of escalating threat.
    const cogs = [
      GameState.makeCog("flunky", 1),
      GameState.makeCog("pencilpusher", 2),
      GameState.makeCog("yesman", 1),
      GameState.makeCog("micromanager", 0),
    ];

    state = GameState.create(toons, cogs);
    choices = {};
    UI.hideOverlay();
    startSelection();
  }

  /* ===========================================================================
   * PHASE 1 & 2 — GAG + TARGET SELECTION
   * =========================================================================*/
  function startSelection() {
    phase = "select";
    choices = {};
    selectIndex = 0;
    pendingGag = null;
    UI.setPhase(`Round ${state.round + 1} — Choose Gags`);
    UI.showMenu(true);
    startTimer();
    focusCurrentToon();
  }

  function aliveToonList() { return state.aliveToons(); }

  function currentSelectingToon() {
    const alive = aliveToonList();
    return alive[selectIndex] || null;
  }

  function focusCurrentToon() {
    pendingGag = null;
    const toon = currentSelectingToon();
    if (!toon) { // everyone has chosen
      promptReady();
      return;
    }
    // default the open track to the toon's first owned track
    activeTrack = Number(Object.keys(toon.tracks)[0]);
    UI.setPrompt(`${toon.name}, pick a gag  (${selectIndex + 1}/${aliveToonList().length})`);
    UI.renderTrackTabs(toon, activeTrack);
    UI.renderGagGrid(toon, activeTrack);
    UI.setActions({ back: selectIndex > 0, pass: true, fight: allChosen() });
    render();
  }

  function promptReady() {
    UI.setPrompt("All gags chosen — press FIGHT!");
    UI.setActions({ back: true, pass: false, fight: true });
    render();
  }

  function allChosen() {
    return aliveToonList().every((t) => choices[t.id]);
  }

  // ---- input handlers ----
  function onTrackPick(track) {
    activeTrack = track;
    const toon = currentSelectingToon();
    if (!toon) return;
    UI.renderTrackTabs(toon, activeTrack);
    UI.renderGagGrid(toon, activeTrack);
  }

  function onGagPick(track, level) {
    const toon = currentSelectingToon();
    if (!toon) return;

    // Group gags / Toon-up auto-resolve their targeting.
    if (track === T.HEAL && D.isGroup(track, level)) {
      commitChoice(toon.id, { track, level, targetToonId: null });
      return;
    }
    if (track === T.HEAL) {
      // single-target heal: choose a toon
      pendingGag = { track, level, kind: "toon" };
      enterTargetMode("Pick a Toon to heal");
      return;
    }
    if (D.isGroup(track, level)) {
      commitChoice(toon.id, { track, level, targetCogId: null });
      return;
    }
    // single-target offensive gag: choose a cog
    pendingGag = { track, level, kind: "cog" };
    enterTargetMode("Pick a Cog to target");
  }

  function enterTargetMode(prompt) {
    phase = "target";
    UI.setPrompt(prompt);
    UI.setActions({ back: true, pass: false, fight: false });
    render();
  }

  function onTargetCog(cogId) {
    if (phase !== "target" || !pendingGag || pendingGag.kind !== "cog") return;
    const toon = currentSelectingToon();
    commitChoice(toon.id, { track: pendingGag.track, level: pendingGag.level, targetCogId: cogId });
  }

  function onTargetToon(toonId) {
    if (phase !== "target" || !pendingGag || pendingGag.kind !== "toon") return;
    const toon = currentSelectingToon();
    commitChoice(toon.id, { track: pendingGag.track, level: pendingGag.level, targetToonId: toonId });
  }

  function commitChoice(toonId, choice) {
    choices[toonId] = choice;
    phase = "select";
    pendingGag = null;
    selectIndex++;
    focusCurrentToon();
  }

  function onPass() {
    const toon = currentSelectingToon();
    if (!toon) return;
    choices[toon.id] = { pass: true, track: null };
    selectIndex++;
    focusCurrentToon();
  }

  function onBack() {
    if (phase === "target") {
      // cancel targeting, stay on same toon
      phase = "select";
      pendingGag = null;
      focusCurrentToon();
      return;
    }
    if (selectIndex > 0) {
      selectIndex--;
      const toon = currentSelectingToon();
      delete choices[toon.id];
      focusCurrentToon();
    }
  }

  /* ===== selection timer ===== */
  function startTimer() {
    stopTimer();
    timeLeft = SELECT_SECONDS;
    UI.setTimer(100, `${timeLeft}s`);
    timerHandle = setInterval(() => {
      timeLeft -= 0.1;
      const pct = (timeLeft / SELECT_SECONDS) * 100;
      UI.setTimer(pct, `${Math.max(0, Math.ceil(timeLeft))}s`);
      if (timeLeft <= 0) {
        stopTimer();
        autoPassRemaining();
        onFight();
      }
    }, 100);
  }
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }
  function autoPassRemaining() {
    aliveToonList().forEach((t) => { if (!choices[t.id]) choices[t.id] = { pass: true, track: null }; });
  }

  /* ===========================================================================
   * PHASE 3 — RESOLUTION
   * =========================================================================*/
  async function onFight() {
    if (phase === "resolve") return;
    if (!allChosen()) { autoPassRemaining(); }
    stopTimer();
    phase = "resolve";
    UI.showMenu(false);
    UI.setActions({ back: false, pass: false, fight: false });

    // Spend ammo for committed gags.
    for (const t of aliveToonList()) {
      const c = choices[t.id];
      if (c && !c.pass && c.track != null) state.spendGag(t.id, c.track, c.level);
    }

    // Build the choice list for the calculator.
    const toonChoices = aliveToonList()
      .map((t) => choices[t.id])
      .filter((c) => c && !c.pass && c.track != null)
      .map((c) => ({
        toonId: ownerOf(c),
        track: c.track, level: c.level,
        targetCogId: c.targetCogId != null ? c.targetCogId : null,
        targetToonId: c.targetToonId != null ? c.targetToonId : null,
      }));

    // Snapshot -> compute (mutates to final) -> snapshot final -> restore -> replay.
    const before = snapshot();
    const result = BattleCalculator.calculateRound(state, toonChoices);
    const final = snapshot();
    restore(before);
    render();

    UI.setPhase(`Round ${state.round + 1} — Gags!`);
    await sleep(400);
    await animateToonAttacks(result);

    // commit exact final state
    restore(final);
    render();
    await sleep(300);

    if (state.isVictory()) { endRound(); return finish(true); }

    // ---- Cog counterattack ----
    await cogTurn();

    endRound();
    render();

    if (state.isDefeat()) return finish(false);
    if (state.isVictory()) return finish(true);

    await sleep(400);
    startSelection();
  }

  function ownerOf(choice) {
    // find which toon this choice object belongs to
    for (const id in choices) if (choices[id] === choice) return Number(id);
    return null;
  }

  async function animateToonAttacks(result) {
    for (const atk of result.attacks) {
      const toonNode = UI.toonEl(atk.toonId);
      if (toonNode) { toonNode.classList.add("active-selector"); }
      await sleep(250);

      if (atk.track === T.HEAL) {
        if (atk.healTargets.length === 0) {
          UI.floatText(toonNode, "MISS!", "ft-miss");
        }
        for (const ht of atk.healTargets) {
          const t = state.getToon(ht.toonId);
          if (t) t.laff = Math.min(t.maxLaff, t.laff + ht.healed);
          render();
          UI.floatText(UI.toonEl(ht.toonId), `+${ht.healed}`, "ft-heal");
        }
      } else if (atk.track === T.TRAP) {
        const cog = state.getCog(atk.targetCogId);
        if (atk.trapPlaced && cog) {
          cog.trap = { level: atk.trapPlaced.level, damage: atk.trapPlaced.damage };
          render();
          UI.floatText(UI.cogEl(atk.targetCogId), "TRAP SET", "ft-lure");
        } else {
          UI.floatText(UI.cogEl(atk.targetCogId), "FIZZLE", "ft-miss");
        }
      } else if (atk.track === T.LURE) {
        if (!atk.hit) {
          UI.floatText(toonNode, "MISS!", "ft-miss");
        }
        for (const pt of atk.perTarget) {
          const cog = state.getCog(pt.cogId);
          const cnode = UI.cogEl(pt.cogId);
          if (pt.trapSprung) {
            if (cog) { cog.trap = null; cog.hp = pt.after; }
            render(); UI.shake(cnode);
            UI.floatText(cnode, `-${pt.damage}`, "ft-damage");
            UI.floatText(cnode, "TRAP!", "ft-bonus", 30);
          } else if (pt.lured) {
            if (cog) cog.lured = { rounds: D.NumRoundsLured[atk.level] };
            render();
            UI.floatText(cnode, "LURED", "ft-lure");
          }
        }
      } else {
        // damage tracks
        if (!atk.hit) {
          const tgt = atk.group ? null : atk.targetCogId;
          if (atk.group) {
            for (const c of state.aliveCogs()) UI.floatText(UI.cogEl(c.id), "MISS!", "ft-miss");
          } else {
            UI.floatText(UI.cogEl(tgt), "MISS!", "ft-miss");
          }
        } else {
          for (const pt of atk.perTarget) {
            const cog = state.getCog(pt.cogId);
            const cnode = UI.cogEl(pt.cogId);
            if (pt.dodgedDrop) { UI.floatText(cnode, "MISS!", "ft-miss"); continue; }
            if (cog) {
              cog.hp = pt.after;
              if (pt.unlured) cog.lured = null;
            }
            state.recordAttacker(pt.cogId, atk.toonId, pt.damage);
            render(); UI.shake(cnode);
            UI.floatText(cnode, `-${pt.damage}`, "ft-damage");
            if (pt.kb > 0) UI.floatText(cnode, `LURE +${Math.round(pt.kb)}`, "ft-bonus", 36);
            if (pt.combo > 0) UI.floatText(cnode, `COMBO +${pt.combo}`, "ft-bonus", -36);
            if (pt.died) UI.floatText(cnode, "DEFEATED!", "ft-lure", 0);
          }
        }
      }
      await sleep(700);
      if (toonNode) toonNode.classList.remove("active-selector");
    }
  }

  async function cogTurn() {
    phase = "cog";
    UI.setPhase(`Round ${state.round + 1} — Cogs Attack!`);
    const before = snapshot();
    const result = BattleCalculator.calculateCogTurn(state);
    const final = snapshot();
    restore(before);
    render();
    await sleep(400);

    for (const r of result) {
      if (r.lured) {
        UI.floatText(UI.cogEl(r.cogId), "ZZZ", "ft-lure");
        await sleep(350);
        continue;
      }
      const cnode = UI.cogEl(r.cogId);
      if (cnode) cnode.classList.add("selected-target");
      await sleep(250);
      UI.floatText(cnode, r.attackName || "Attack", "ft-bonus");
      if (!r.hit) {
        for (const pt of r.perTarget) UI.floatText(UI.toonEl(pt.toonId), "MISS!", "ft-miss");
      } else {
        for (const pt of r.perTarget) {
          const t = state.getToon(pt.toonId);
          if (t) t.laff = pt.after;
          render(); UI.shake(UI.toonEl(pt.toonId));
          UI.floatText(UI.toonEl(pt.toonId), `-${pt.dmg}`, "ft-laff");
          if (pt.died) UI.floatText(UI.toonEl(pt.toonId), "SAD!", "ft-miss", 0);
        }
      }
      await sleep(650);
      if (cnode) cnode.classList.remove("selected-target");
    }
    restore(final);
    render();
  }

  /* ===========================================================================
   * PHASE 4 — REWARDS / STATUS
   * =========================================================================*/
  function endRound() {
    state.endRound();
  }

  function finish(victory) {
    phase = "over";
    UI.showMenu(false);
    if (victory) {
      UI.setPhase("Victory!");
      const survivors = state.aliveToons().map((t) => t.name).join(", ");
      UI.showOverlay("🎉 TOONS WIN! 🎉",
        `The Cogs have been defeated!<br><br>Toons still standing: <b>${survivors || "none"}</b>.<br>Toontown is safe… for now.`,
        "Battle Again");
    } else {
      UI.setPhase("Defeated…");
      UI.showOverlay("💀 The Cogs Win 💀",
        "All your Toons went sad and fled to a Playground to recover.<br><br>Better luck next time!",
        "Try Again");
    }
  }

  /* ===========================================================================
   * SNAPSHOT / RESTORE (so resolution can be replayed as animation)
   * =========================================================================*/
  function snapshot() {
    return {
      cogs: state.cogs.map((c) => ({
        id: c.id, hp: c.hp, removed: c.removed,
        lured: c.lured ? { ...c.lured } : null,
        trap: c.trap ? { ...c.trap } : null,
        attackers: { ...c.attackers },
      })),
      toons: state.toons.map((t) => ({ id: t.id, laff: t.laff })),
    };
  }
  function restore(snap) {
    snap.cogs.forEach((s) => {
      const c = state.getCog(s.id);
      c.hp = s.hp; c.removed = s.removed;
      c.lured = s.lured ? { ...s.lured } : null;
      c.trap = s.trap ? { ...s.trap } : null;
      c.attackers = { ...s.attackers };
    });
    snap.toons.forEach((s) => { state.getToon(s.id).laff = s.laff; });
  }

  /* ===========================================================================
   * RENDER — chooses the right options for the current phase
   * =========================================================================*/
  function render() {
    const opts = { choices };
    if (phase === "select") {
      const toon = currentSelectingToon();
      if (toon) opts.activeToonId = toon.id;
    } else if (phase === "target" && pendingGag) {
      if (pendingGag.kind === "cog") {
        opts.targetableCogs = true;
      } else if (pendingGag.kind === "toon") {
        opts.healTargets = true;
      }
      const toon = currentSelectingToon();
      if (toon) opts.activeToonId = toon.id;
    }
    UI.renderField(state, opts);
  }

  /* ===========================================================================
   * BOOT
   * =========================================================================*/
  UI.init({
    onTrackPick, onGagPick, onBack, onPass, onFight,
    onTargetCog, onTargetToon, onRestart: newGame,
  });
  newGame();
})();

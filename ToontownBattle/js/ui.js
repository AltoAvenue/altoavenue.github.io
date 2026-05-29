/* =============================================================================
 * ui.js  —  UI Render Engine
 * -----------------------------------------------------------------------------
 * Pure presentation. Reads GameState and draws the battlefield, health/laff
 * meters, status chips, the gag menu, the timer, and floating combat text.
 * It exposes callbacks (onTrackPick / onGagPick / onTargetPick ...) that the
 * controller (main.js) wires up; the UI itself contains no battle logic.
 * ===========================================================================*/

const UI = (() => {
  "use strict";
  const D = TTData;

  // DOM handles
  const el = {};
  function cache() {
    [
      "phase-text", "cog-row", "toon-row", "fx-layer", "battlefield",
      "select-prompt", "timer-bar", "timer-label", "track-tabs", "gag-grid",
      "btn-back", "btn-pass", "btn-fight", "battle-menu",
      "overlay", "overlay-title", "overlay-body", "overlay-btn",
    ].forEach((id) => { el[id] = document.getElementById(id); });
  }

  // controller callbacks (assigned by main.js)
  const handlers = {
    onTrackPick: null, onGagPick: null, onBack: null, onPass: null,
    onFight: null, onTargetCog: null, onTargetToon: null, onRestart: null,
  };

  /* ===================== SVG ART ===================== */
  // A simple, stylized cog robot built from SVG primitives.
  function cogSVG(color) {
    return `
    <svg class="cog-svg" viewBox="0 0 96 132" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="48" cy="126" rx="26" ry="5" fill="rgba(0,0,0,.3)"/>
      <rect x="30" y="78" width="14" height="40" rx="5" fill="#3a3f4b"/>
      <rect x="52" y="78" width="14" height="40" rx="5" fill="#3a3f4b"/>
      <rect x="24" y="46" width="48" height="44" rx="9" fill="${color}" stroke="#222" stroke-width="3"/>
      <rect x="40" y="40" width="16" height="12" fill="#2b2f3a"/>
      <rect x="10" y="50" width="14" height="34" rx="6" fill="#4a4f5b"/>
      <rect x="72" y="50" width="14" height="34" rx="6" fill="#4a4f5b"/>
      <circle cx="48" cy="22" r="18" fill="#8a909c" stroke="#222" stroke-width="3"/>
      <circle cx="41" cy="20" r="3.4" fill="#111"/>
      <circle cx="55" cy="20" r="3.4" fill="#111"/>
      <rect x="40" y="29" width="16" height="3" rx="1.5" fill="#111"/>
      <rect x="38" y="56" width="20" height="8" rx="2" fill="#fff" opacity=".85"/>
      <polygon points="44,46 52,46 48,40" fill="#c0392b"/>
    </svg>`;
  }

  // A stylized toon (dog/cat-ish) built from SVG primitives.
  function toonSVG(color) {
    return `
    <svg class="toon-svg" viewBox="0 0 92 120" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="46" cy="115" rx="24" ry="5" fill="rgba(0,0,0,.3)"/>
      <rect x="34" y="74" width="10" height="34" rx="5" fill="${color}"/>
      <rect x="48" y="74" width="10" height="34" rx="5" fill="${color}"/>
      <ellipse cx="46" cy="62" rx="24" ry="26" fill="${color}" stroke="#222" stroke-width="3"/>
      <rect x="16" y="50" width="10" height="30" rx="5" fill="${color}"/>
      <rect x="66" y="50" width="10" height="30" rx="5" fill="${color}"/>
      <circle cx="46" cy="26" r="20" fill="#f7e2b8" stroke="#222" stroke-width="3"/>
      <ellipse cx="22" cy="14" rx="8" ry="12" fill="${color}" stroke="#222" stroke-width="2"/>
      <ellipse cx="70" cy="14" rx="8" ry="12" fill="${color}" stroke="#222" stroke-width="2"/>
      <circle cx="39" cy="24" r="3.4" fill="#111"/>
      <circle cx="53" cy="24" r="3.4" fill="#111"/>
      <ellipse cx="46" cy="31" rx="4" ry="3" fill="#111"/>
      <path d="M38 36 Q46 42 54 36" stroke="#111" stroke-width="2" fill="none"/>
    </svg>`;
  }

  /* ===================== BATTLEFIELD RENDER ===================== */
  function renderField(state, opts = {}) {
    renderCogs(state, opts);
    renderToons(state, opts);
  }

  function renderCogs(state, opts) {
    const row = el["cog-row"];
    row.innerHTML = "";
    state.cogs.forEach((cog) => {
      const div = document.createElement("div");
      div.className = "cog";
      div.dataset.cogId = cog.id;
      if (cog.hp <= 0) div.classList.add("dead");

      const hpPct = Math.max(0, (cog.hp / cog.maxHp) * 100);
      const trackColor = cogTrackColor(cog.track);

      const statusChips = [];
      if (cog.lured) statusChips.push(`<span class="status-chip chip-lured">LURED ${cog.lured.rounds}</span>`);
      if (cog.trap) statusChips.push(`<span class="status-chip chip-trap">TRAP</span>`);

      div.innerHTML = `
        <div class="cog-level">${cog.level}</div>
        <div class="cog-body">${cogSVG(trackColor)}</div>
        <div class="cog-name">${cog.name}</div>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div>
          <div class="hp-text">${Math.max(0, cog.hp)}/${cog.maxHp}</div></div>
        <div class="status-row">${statusChips.join("")}</div>
        ${cog.trap ? `<div class="trap-marker" title="${D.GAG_NAMES[D.TRACK.TRAP][cog.trap.level]}">${D.GAG_ICONS[D.TRACK.TRAP][cog.trap.level]}</div>` : ""}
      `;

      if (opts.targetableCogs && cog.hp > 0) {
        div.classList.add("targetable");
        if (opts.selectedCogId === cog.id) div.classList.add("selected-target");
        div.addEventListener("click", () => handlers.onTargetCog && handlers.onTargetCog(cog.id));
      }
      row.appendChild(div);
    });
  }

  function renderToons(state, opts) {
    const row = el["toon-row"];
    row.innerHTML = "";
    state.toons.forEach((toon) => {
      const div = document.createElement("div");
      div.className = "toon";
      div.dataset.toonId = toon.id;
      if (toon.laff <= 0) div.classList.add("defeated");
      if (opts.activeToonId === toon.id) div.classList.add("active-selector");

      const laffPct = Math.max(0, (toon.laff / toon.maxLaff) * 100);
      const chosen = opts.choices && opts.choices[toon.id];
      const gagBubble = chosen && chosen.track != null
        ? `<div class="chosen-gag" title="${D.GAG_NAMES[chosen.track][chosen.level]}">${D.GAG_ICONS[chosen.track][chosen.level]}</div>`
        : (chosen && chosen.pass ? `<div class="chosen-gag" title="Pass">✋</div>` : "");

      div.innerHTML = `
        ${gagBubble}
        <div class="toon-body">${toonSVG(toon.color)}</div>
        <div class="toon-name">${toon.name}</div>
        <div class="laff-meter"><div class="laff-fill" style="width:${laffPct}%"></div>
          <div class="laff-text">${Math.max(0, toon.laff)}/${toon.maxLaff}</div></div>
      `;

      if (opts.healTargets && toon.laff > 0) {
        div.classList.add("heal-target");
        div.addEventListener("click", () => handlers.onTargetToon && handlers.onTargetToon(toon.id));
      }
      row.appendChild(div);
    });
  }

  function cogTrackColor(track) {
    return { Bossbot: "#8a6d3b", Lawbot: "#5a6b8a", Cashbot: "#3b7a5a", Sellbot: "#7a3b6b" }[track] || "#6b7280";
  }

  /* ===================== GAG MENU ===================== */
  function renderTrackTabs(toon, activeTrack) {
    const wrap = el["track-tabs"];
    wrap.innerHTML = "";
    D.TRACK_NAMES.forEach((name, track) => {
      const tab = document.createElement("div");
      const owned = toon.tracks[track] !== undefined;
      tab.className = "track-tab" + (owned ? "" : " locked") + (track === activeTrack ? " active" : "");
      tab.style.background = D.TRACK_COLORS[track];
      tab.textContent = name;
      if (owned) tab.addEventListener("click", () => handlers.onTrackPick && handlers.onTrackPick(track));
      wrap.appendChild(tab);
    });
  }

  function renderGagGrid(toon, track) {
    const grid = el["gag-grid"];
    grid.innerHTML = "";
    if (track == null || !toon.tracks[track]) {
      grid.innerHTML = `<div class="gag-empty-msg">Select a gag track above.</div>`;
      return;
    }
    const maxLevel = toon.tracks[track].maxLevel;
    const exp = toon.tracks[track].exp;
    const organic = toon.tracks[track].organic;
    for (let level = 0; level <= maxLevel; level++) {
      const ammo = (toon.inventory[track] && toon.inventory[track][level]) || 0;
      const item = document.createElement("div");
      item.className = "gag-item" + (ammo <= 0 ? " empty" : "");

      // preview damage / accuracy for this gag
      let statLine;
      if (track === D.TRACK.LURE) {
        statLine = `Lure ${D.NumRoundsLured[level]}r`;
      } else if (track === D.TRACK.HEAL) {
        statLine = `+${BattleCalculator.getAvPropDamage(track, level, exp, organic)} laff`;
      } else {
        const dmg = BattleCalculator.getAvPropDamage(track, level, exp, organic);
        statLine = `${dmg} dmg`;
      }
      const acc = D.AvPropAccuracy[track][level];
      const accStr = track === D.TRACK.TRAP ? "100%" : `${acc}%`;

      item.innerHTML = `
        <div class="gag-icon">${D.GAG_ICONS[track][level]}</div>
        <div class="gag-name">${D.GAG_NAMES[track][level]}</div>
        <div class="gag-stats">${statLine} · ${accStr}</div>
        <div class="gag-ammo">x${ammo}</div>
      `;
      if (ammo > 0) {
        item.addEventListener("click", () => handlers.onGagPick && handlers.onGagPick(track, level));
      }
      grid.appendChild(item);
    }
  }

  function setPrompt(text) { el["select-prompt"].textContent = text; }
  function setPhase(text) { el["phase-text"].textContent = text; }

  function setTimer(pct, label) {
    el["timer-bar"].style.width = `${Math.max(0, pct)}%`;
    el["timer-label"].textContent = label || "";
    el["timer-bar"].style.background = pct < 25
      ? "linear-gradient(#e74c3c,#a82315)" : "linear-gradient(#6dd36d,#2e9e2e)";
  }

  function setActions({ back, pass, fight }) {
    el["btn-back"].disabled = !back;
    el["btn-pass"].disabled = !pass;
    el["btn-fight"].disabled = !fight;
  }

  function showMenu(show) { el["battle-menu"].style.visibility = show ? "visible" : "hidden"; }

  /* ===================== FLOATING TEXT ===================== */
  // Spawn floating combat text anchored over a combatant element.
  function floatText(targetEl, text, cls, offset = 0) {
    if (!targetEl) return;
    const fx = el["fx-layer"];
    const fieldRect = el["battlefield"].getBoundingClientRect();
    const r = targetEl.getBoundingClientRect();
    const span = document.createElement("div");
    span.className = `float-text ${cls}`;
    span.textContent = text;
    span.style.left = `${r.left - fieldRect.left + r.width / 2 - 20 + offset}px`;
    span.style.top = `${r.top - fieldRect.top + 10}px`;
    fx.appendChild(span);
    setTimeout(() => span.remove(), 1300);
  }

  function cogEl(cogId) { return el["cog-row"].querySelector(`[data-cog-id="${cogId}"]`); }
  function toonEl(toonId) { return el["toon-row"].querySelector(`[data-toon-id="${toonId}"]`); }

  function shake(node) {
    if (!node) return;
    node.classList.add("hurt");
    setTimeout(() => node.classList.remove("hurt"), 360);
  }

  /* ===================== OVERLAY ===================== */
  function showOverlay(title, body, btnLabel) {
    el["overlay-title"].textContent = title;
    el["overlay-body"].innerHTML = body;
    el["overlay-btn"].textContent = btnLabel || "Play Again";
    el["overlay"].classList.remove("hidden");
  }
  function hideOverlay() { el["overlay"].classList.add("hidden"); }

  /* ===================== INIT ===================== */
  function init(callbacks) {
    cache();
    Object.assign(handlers, callbacks);
    el["btn-back"].addEventListener("click", () => handlers.onBack && handlers.onBack());
    el["btn-pass"].addEventListener("click", () => handlers.onPass && handlers.onPass());
    el["btn-fight"].addEventListener("click", () => handlers.onFight && handlers.onFight());
    el["overlay-btn"].addEventListener("click", () => handlers.onRestart && handlers.onRestart());
  }

  return {
    init, renderField, renderTrackTabs, renderGagGrid,
    setPrompt, setPhase, setTimer, setActions, showMenu,
    floatText, cogEl, toonEl, shake, showOverlay, hideOverlay,
  };
})();

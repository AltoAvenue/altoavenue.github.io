/* Name, personality and chemistry randomizer. */
(function () {
  "use strict";

  var NAMES = window.TS2_NAMES, CHEM = window.TS2_CHEMISTRY;
  var SCALES = window.TS2_SCALES, ZODIAC = window.TS2_ZODIAC;
  var PERSONALITY_TOTAL = 25, SCALE_MAX = 10;

  /* ---------- randomness ---------- */
  function randInt(n) { // uniform integer in [0, n)
    var buf = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n, x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- names ---------- */
  function pool(kind) {
    var seen = {}, out = [];
    Object.keys(NAMES[kind]).forEach(function (pack) {
      NAMES[kind][pack].forEach(function (n) {
        if (!seen[n]) { seen[n] = true; out.push(n); }
      });
    });
    return out;
  }
  var POOLS = { male: pool("male"), female: pool("female"), last: pool("last") };

  function randomName(genderChoice) {
    var gender = genderChoice === "male" || genderChoice === "female"
      ? genderChoice : pick(["male", "female"]);
    return { gender: gender, first: pick(POOLS[gender]), last: pick(POOLS.last) };
  }

  /* ---------- personality + zodiac ---------- */
  // Draw four scales, derive the fifth; retry until it fits 0-10 (uniform over all splits).
  function randomPoints() {
    for (;;) {
      var p = [], sum = 0;
      for (var i = 0; i < 4; i++) { p[i] = randInt(SCALE_MAX + 1); sum += p[i]; }
      var last = PERSONALITY_TOTAL - sum;
      if (last >= 0 && last <= SCALE_MAX) { p[4] = last; return shuffle(p); }
    }
  }
  // Nearest preset by squared distance; ties broken at random.
  function nearestSign(pts) {
    var best = [], bestD = Infinity;
    Object.keys(ZODIAC).forEach(function (k) {
      var d = 0;
      for (var i = 0; i < 5; i++) { var x = pts[i] - ZODIAC[k].pts[i]; d += x * x; }
      if (d < bestD) { bestD = d; best = [k]; } else if (d === bestD) { best.push(k); }
    });
    return pick(best);
  }
  function randomPersonality() {
    var pts = randomPoints();
    return { pts: pts, sign: nearestSign(pts) };
  }

  /* ---------- chemistry (turn-ons / turn-offs) ---------- */
  function randomChemistry() {
    var s = shuffle(CHEM);
    return { turnOns: [s[0], s[1]], turnOff: s[2] };
  }

  /* ---------- state + rendering ---------- */
  var state = { name: null, personality: null, chemistry: null };
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function img(src, alt, cls) {
    var i = new Image(); i.src = src; i.alt = alt || ""; if (cls) i.className = cls; return i;
  }

  function renderName() {
    var n = state.name, box = $("name-out");
    box.textContent = "";
    box.appendChild(el("div", "sim-name", n.first + " " + n.last));
    box.appendChild(el("div", "sub", (n.gender === "male" ? "Male" : "Female")));
  }

  function renderPersonality() {
    var p = state.personality, z = ZODIAC[p.sign], box = $("personality-out");
    box.textContent = "";
    var head = el("div", "zodiac");
    head.appendChild(img("assets/wiki/zodiac/" + p.sign + ".png", z.name, "zodiac-icon"));
    head.appendChild(el("div", "zodiac-name", z.name));
    head.appendChild(el("div", "sub", PERSONALITY_TOTAL + " personality points"));
    box.appendChild(head);

    var table = el("table", "personality");
    SCALES.forEach(function (s, i) {
      var v = p.pts[i], tr = el("tr");
      tr.appendChild(el("td", "lo", s.low));
      var bar = el("td", "bar");
      bar.appendChild(img("assets/wiki/personality/" + (v < 10 ? "0" : "") + v + ".png", v + " of 10"));
      tr.appendChild(bar);
      tr.appendChild(el("td", "hi", s.high));
      tr.appendChild(el("td", "val", String(v)));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }

  function chemCard(trait, kind) {
    var c = el("div", "chem " + kind);
    c.appendChild(el("div", "kind", kind === "on" ? "Turn-On" : "Turn-Off"));
    var ic = el("div", "icon" + (trait.skillIcon ? " skill" : ""));
    ic.appendChild(img("assets/wiki/chemistry/" + trait.id + ".png", trait.name));
    c.appendChild(ic);
    c.appendChild(el("div", "trait", trait.name));
    c.appendChild(el("div", "pack", trait.pack));
    return c;
  }
  function renderChemistry() {
    var ch = state.chemistry, box = $("chemistry-out");
    box.textContent = "";
    var row = el("div", "chem-row");
    row.appendChild(chemCard(ch.turnOns[0], "on"));
    row.appendChild(chemCard(ch.turnOns[1], "on"));
    row.appendChild(chemCard(ch.turnOff, "off"));
    box.appendChild(row);
  }

  /* ---------- actions ---------- */
  function genderChoice() { return $("gender").value; }
  var actions = {
    name:        function () { state.name = randomName(genderChoice()); renderName(); },
    personality: function () { state.personality = randomPersonality(); renderPersonality(); },
    chemistry:   function () { state.chemistry = randomChemistry(); renderChemistry(); },
    all:         function () { actions.name(); actions.personality(); actions.chemistry(); }
  };

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action]");
    if (!t) return;
    e.preventDefault();
    var fn = actions[t.getAttribute("data-action")];
    if (fn) fn();
  });

  // Picking a gender re-rolls the name if the one on screen no longer matches.
  $("gender").addEventListener("change", function () {
    var g = genderChoice();
    if (g !== "random" && state.name && state.name.gender !== g) actions.name();
  });

  window.TS2_RANDOMIZER = {
    randomName: randomName, randomPoints: randomPoints, nearestSign: nearestSign,
    randomPersonality: randomPersonality, randomChemistry: randomChemistry,
    pools: POOLS, state: state
  };

  actions.all();
})();

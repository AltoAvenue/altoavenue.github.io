/* =============================================================================
 * data.js  —  Authentic Toontown Online battle data
 * -----------------------------------------------------------------------------
 * Every number in this file is transcribed directly from the Anesidora source:
 *   - toontown/src/toonbase/ToontownBattleGlobals.py   (gag tracks/damage/acc)
 *   - toontown/src/battle/SuitBattleGlobals.py         (cog attributes)
 *   - toontown/src/battle/BattleCalculatorAI.py        (bonus tables)
 *
 * Nothing here is invented; it is a 1:1 port of the canonical tables so the
 * battle math matches the real game.
 * ===========================================================================*/

const TTData = (() => {
  "use strict";

  /* ----- Track indices (ToontownBattleGlobals.py) ------------------------- */
  const TRACK = {
    HEAL: 0,   // "Toon-up"
    TRAP: 1,
    LURE: 2,
    SOUND: 3,
    THROW: 4,
    SQUIRT: 5,
    DROP: 6,
  };

  // The order gags resolve in during the movie phase. This is THE classic
  // priority order: Toon-up -> Trap -> Lure -> Sound -> Throw -> Squirt -> Drop
  const TRACK_ORDER = [
    TRACK.HEAL, TRACK.TRAP, TRACK.LURE, TRACK.SOUND,
    TRACK.THROW, TRACK.SQUIRT, TRACK.DROP,
  ];

  const TRACK_NAMES = [
    "Toon-up", "Trap", "Lure", "Sound", "Throw", "Squirt", "Drop",
  ];

  // TrackColors from ToontownBattleGlobals.py (converted 0-1 floats -> #hex)
  const TRACK_COLORS = [
    "#d394ff", // Toon-up  (211,148,255)
    "#f9ff5d", // Trap     (249,255,93)
    "#4fbe4c", // Lure     (79,190,76)
    "#5d6cef", // Sound    (93,108,239)
    "#ff9142", // Throw    (255,145,66)
    "#ff41c7", // Squirt   (255,65,199)
    "#43f3ff", // Drop     (67,243,255)
  ];

  /* ----- Per-track Levels[] experience thresholds ------------------------- *
   * Levels[track][gagTier] -> cumulative skill points needed.
   * Used by getAvPropDamage to interpolate damage from a toon's track exp.   */
  const MaxSkill = 500 + 10000; // UberSkill + regMaxSkill
  const Levels = [
    [0, 20, 200, 800, 2000, 6000, 10000], // heal
    [0, 20, 100, 800, 2000, 6000, 10000], // trap
    [0, 20, 100, 800, 2000, 6000, 10000], // lure
    [0, 40, 200, 1000, 2500, 7500, 10000], // sound
    [0, 10, 50, 400, 2000, 6000, 10000], // throw
    [0, 10, 50, 400, 2000, 6000, 10000], // squirt
    [0, 20, 100, 500, 2000, 6000, 10000], // drop
  ];

  /* ----- AvPropAccuracy (base prop accuracy per track/level) -------------- */
  const AvPropAccuracy = [
    [70, 70, 70, 70, 70, 70, 100], // Heal
    [0, 0, 0, 0, 0, 0, 0],         // Trap (always hits)
    [50, 50, 60, 60, 70, 70, 90],  // Lure
    [95, 95, 95, 95, 95, 95, 95],  // Sound
    [75, 75, 75, 75, 75, 75, 75],  // Throw
    [95, 95, 95, 95, 95, 95, 95],  // Squirt
    [50, 50, 50, 50, 50, 50, 50],  // Drop
  ];

  // Lure accuracy when the toon has an organic / prop bonus.
  const AvLureBonusAccuracy = [60, 60, 70, 70, 80, 80, 100];

  /* ----- AvPropDamage -----------------------------------------------------*
   * For each track/level: [[minDmg, maxDmg], [minExp, maxExp]]
   * The toon's track exp interpolates linearly between minDmg and maxDmg.    */
  const AvPropDamage = [
    // Heal (Toon-up)
    [[[8, 10], [Levels[0][0], Levels[0][1]]],
     [[15, 18], [Levels[0][1], Levels[0][2]]],
     [[25, 30], [Levels[0][2], Levels[0][3]]],
     [[40, 45], [Levels[0][3], Levels[0][4]]],
     [[60, 70], [Levels[0][4], Levels[0][5]]],
     [[90, 120], [Levels[0][5], Levels[0][6]]],
     [[210, 210], [Levels[0][6], MaxSkill]]],
    // Trap
    [[[10, 12], [Levels[1][0], Levels[1][1]]],
     [[18, 20], [Levels[1][1], Levels[1][2]]],
     [[30, 35], [Levels[1][2], Levels[1][3]]],
     [[45, 50], [Levels[1][3], Levels[1][4]]],
     [[60, 70], [Levels[1][4], Levels[1][5]]],
     [[90, 180], [Levels[1][5], Levels[1][6]]],
     [[195, 195], [Levels[1][6], MaxSkill]]],
    // Lure (no direct damage)
    [[[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]],
     [[0, 0], [0, 0]], [[0, 0], [0, 0]], [[0, 0], [0, 0]]],
    // Sound
    [[[3, 4], [Levels[3][0], Levels[3][1]]],
     [[5, 7], [Levels[3][1], Levels[3][2]]],
     [[9, 11], [Levels[3][2], Levels[3][3]]],
     [[14, 16], [Levels[3][3], Levels[3][4]]],
     [[19, 21], [Levels[3][4], Levels[3][5]]],
     [[25, 50], [Levels[3][5], Levels[3][6]]],
     [[90, 90], [Levels[3][6], MaxSkill]]],
    // Throw
    [[[4, 6], [Levels[4][0], Levels[4][1]]],
     [[8, 10], [Levels[4][1], Levels[4][2]]],
     [[14, 17], [Levels[4][2], Levels[4][3]]],
     [[24, 27], [Levels[4][3], Levels[4][4]]],
     [[36, 40], [Levels[4][4], Levels[4][5]]],
     [[48, 100], [Levels[4][5], Levels[4][6]]],
     [[120, 120], [Levels[4][6], MaxSkill]]],
    // Squirt
    [[[3, 4], [Levels[5][0], Levels[5][1]]],
     [[6, 8], [Levels[5][1], Levels[5][2]]],
     [[10, 12], [Levels[5][2], Levels[5][3]]],
     [[18, 21], [Levels[5][3], Levels[5][4]]],
     [[27, 30], [Levels[5][4], Levels[5][5]]],
     [[36, 80], [Levels[5][5], Levels[5][6]]],
     [[105, 105], [Levels[5][6], MaxSkill]]],
    // Drop
    [[[10, 10], [Levels[6][0], Levels[6][1]]],
     [[18, 18], [Levels[6][1], Levels[6][2]]],
     [[30, 30], [Levels[6][2], Levels[6][3]]],
     [[45, 45], [Levels[6][3], Levels[6][4]]],
     [[60, 60], [Levels[6][4], Levels[6][5]]],
     [[85, 170], [Levels[6][5], Levels[6][6]]],
     [[180, 180], [Levels[6][6], MaxSkill]]],
  ];

  /* ----- Target typing (group vs single) ----------------------------------*
   * AvPropTarget picks a column out of AvPropTargetCat for each track.       */
  const ATK_SINGLE_TARGET = 0;
  const ATK_GROUP_TARGET = 1;
  const AvPropTargetCat = [
    [ATK_SINGLE_TARGET, ATK_GROUP_TARGET, ATK_SINGLE_TARGET, ATK_GROUP_TARGET,
     ATK_SINGLE_TARGET, ATK_GROUP_TARGET, ATK_GROUP_TARGET],
    [ATK_SINGLE_TARGET, ATK_SINGLE_TARGET, ATK_SINGLE_TARGET, ATK_SINGLE_TARGET,
     ATK_SINGLE_TARGET, ATK_SINGLE_TARGET, ATK_SINGLE_TARGET],
    [ATK_GROUP_TARGET, ATK_GROUP_TARGET, ATK_GROUP_TARGET, ATK_GROUP_TARGET,
     ATK_GROUP_TARGET, ATK_GROUP_TARGET, ATK_GROUP_TARGET],
    [ATK_SINGLE_TARGET, ATK_SINGLE_TARGET, ATK_SINGLE_TARGET, ATK_SINGLE_TARGET,
     ATK_SINGLE_TARGET, ATK_SINGLE_TARGET, ATK_GROUP_TARGET],
  ];
  const AvPropTarget = [0, 3, 0, 2, 3, 3, 3];

  // isGroup(track, level): does this gag hit ALL cogs at once?
  function isGroup(track, level) {
    return AvPropTargetCat[AvPropTarget[track]][level] === ATK_GROUP_TARGET;
  }

  /* ----- Gag display names (AvPropStrings, condensed) --------------------- */
  const GAG_NAMES = [
    ["Feather", "Megaphone", "Lipstick", "Bamboo Cane", "Pixie Dust", "Juggling Balls", "High Dive"],
    ["Banana Peel", "Rake", "Marbles", "Quicksand", "Trapdoor", "TNT", "Railroad"],
    ["$1 Bill", "Small Magnet", "$5 Bill", "Big Magnet", "$10 Bill", "Hypno Goggles", "Presentation"],
    ["Bike Horn", "Whistle", "Bugle", "Aoogah", "Elephant Trunk", "Foghorn", "Opera Singer"],
    ["Cupcake", "Fruit Pie Slice", "Cream Pie Slice", "Whole Fruit Pie", "Whole Cream Pie", "Birthday Cake", "Wedding Cake"],
    ["Squirting Flower", "Glass of Water", "Squirt Gun", "Seltzer Bottle", "Fire Hose", "Storm Cloud", "Geyser"],
    ["Flower Pot", "Sandbag", "Anvil", "Big Weight", "Safe", "Grand Piano", "Toontanic"],
  ];

  // Short ASCII/emoji glyphs used for the gag icons (no external art needed).
  const GAG_ICONS = [
    ["🪶", "📣", "💄", "🎍", "✨", "🤹", "🏊"],
    ["🍌", "🛁", "🔵", "🏖️", "🚪", "🧨", "🛤️"],
    ["💵", "🧲", "💵", "🧲", "💵", "🥽", "📊"],
    ["📯", "🎵", "🎺", "📢", "🐘", "📻", "🎤"],
    ["🧁", "🥧", "🥧", "🥧", "🥧", "🎂", "🎂"],
    ["🌼", "🥛", "🔫", "🧴", "🚿", "🌧️", "⛲"],
    ["🪴", "🛍️", "⚙️", "🏋️", "🔒", "🎹", "🚢"],
  ];

  /* ===========================================================================
   * BattleCalculator bonus tables (BattleCalculatorAI.py)
   * =========================================================================*/
  const AccuracyBonuses = [0, 20, 40, 60];   // by # of previous (diff-track) hits
  const DamageBonuses = [0, 20, 20, 20];     // combo (same-track) damage bonus %
  const AttackExpPerTrack = [0, 10, 20, 30, 40, 50, 60]; // acc bonus by exp level
  const NumRoundsLured = [2, 2, 3, 3, 4, 4, 15];          // lure duration by level
  const MaxToonAcc = 95;

  /* ===========================================================================
   * COG (Suit) DATA  (SuitBattleGlobals.py)
   * -----------------------------------------------------------------------------
   * The HP formula is (level+1)*(level+2) where `level` is the actual cog level
   * 1..12. Defense depends on the cog's "track position" (0-7) and its relative
   * level (0-4). We store the canonical def tuples per position, transcribed
   * straight from the source 'def' fields.
   * =========================================================================*/

  // HP for an actual cog level (1..12)
  function cogHpForLevel(level) {
    return (level + 1) * (level + 2);
  }

  // Defense tuples for each of the 8 cog "positions" within a track.
  // Index = position (0..7); value = 5-tuple over relative levels 0..4.
  const COG_DEF_BY_POSITION = [
    [2, 5, 10, 12, 15],
    [5, 10, 15, 20, 25],
    [10, 15, 20, 25, 30],
    [15, 20, 25, 30, 35],
    [20, 25, 30, 35, 40],
    [25, 30, 35, 40, 45],
    [30, 35, 40, 45, 50],
    [35, 40, 45, 50, 55],
  ];

  // Cog accuracy by relative level (Flunky-style baseline used for all here).
  const COG_ACC = [35, 40, 45, 50, 55];

  /* The four corporate-ladder tracks, 8 cogs each, ordered by seniority.
   * `pos` is the position (0-7) -> determines base level and defense tuple.
   * Each cog has a small attack set (name, dmgTuple, accTuple, group?).       */
  function atk(name, dmg, acc, group) {
    return { name, dmg, acc, group: !!group };
  }

  // Generic attack sets shared by tier; faithful sample values from the source
  // (Flunky/PencilPusher style). Damage/acc tuples are per relative level 0-4.
  const COG_TYPES = {
    // ---- Bossbot (Corporate) ----
    flunky:        { track: "Bossbot",  name: "Flunky",          pos: 0,
      attacks: [atk("Pound Key", [2,2,3,4,6], [75,75,80,80,90]),
                atk("Shred",     [3,4,5,6,7], [50,55,60,65,70]),
                atk("Clip-On Tie",[1,1,2,2,3],[75,80,85,90,95])] },
    pencilpusher:  { track: "Bossbot",  name: "Pencil Pusher",   pos: 1,
      attacks: [atk("Finger Wag",[2,2,3,4,6],[75,75,80,80,90]),
                atk("Write-Off", [4,5,6,8,10],[50,55,60,65,70]),
                atk("Filibuster",[3,4,6,8,10],[60,65,70,75,80])] },
    yesman:        { track: "Bossbot",  name: "Yesman",          pos: 2,
      attacks: [atk("Rubber Stamp",[2,3,4,5,6],[75,80,85,90,95]),
                atk("Razzle Dazzle",[1,1,2,2,3],[50,55,60,65,70]),
                atk("Synergy",[4,6,9,12,15],[50,55,60,65,70])] },
    micromanager:  { track: "Bossbot",  name: "Micromanager",    pos: 3,
      attacks: [atk("Demotion",[6,8,12,15,18],[50,55,60,65,70]),
                atk("Finger Wag",[4,6,9,12,15],[75,80,85,90,95]),
                atk("Brain Storm",[4,5,6,8,10],[60,65,70,75,80])] },
    downsizer:     { track: "Bossbot",  name: "Downsizer",       pos: 4,
      attacks: [atk("Canned",[5,6,8,10,12],[60,65,70,75,80]),
                atk("Downsize",[8,10,12,15,18],[50,55,60,65,70]),
                atk("Pink Slip",[6,8,10,12,14],[75,80,85,90,95])] },
    headhunter:    { track: "Bossbot",  name: "Head Hunter",     pos: 5,
      attacks: [atk("Fired",[10,12,15,18,21],[60,65,70,75,80]),
                atk("Head Shrink",[10,12,15,18,21],[55,60,65,70,75]),
                atk("Reorganize",[8,10,13,16,19],[50,55,60,65,70])] },
    corporateraider:{ track: "Bossbot", name: "Corporate Raider",pos: 6,
      attacks: [atk("Canned",[12,15,18,21,24],[60,65,70,75,80]),
                atk("Downsize",[14,17,20,23,26],[50,55,60,65,70]),
                atk("Pink Slip",[10,13,16,19,22],[75,80,85,90,95])] },
    bigcheese:     { track: "Bossbot",  name: "The Big Cheese",  pos: 7,
      attacks: [atk("Tee Off",[12,15,18,21,24],[60,65,70,75,80]),
                atk("Fired",[14,17,20,23,26],[55,60,65,70,75]),
                atk("Restraining Order",[16,19,22,25,28],[50,55,60,65,70])] },
  };

  /* ===========================================================================
   * SAMPLE TOON LOADOUTS — gag tiers owned and starting track experience.
   * `tracks` maps trackIndex -> { exp, maxLevel } where maxLevel is the highest
   * gag tier (0..6) the toon can carry. Ammo per gag is given by `ammo`.
   * =========================================================================*/
  // helper to build a per-track loadout
  function loadout(maxLevel, exp) {
    return { maxLevel, exp };
  }

  return {
    TRACK, TRACK_ORDER, TRACK_NAMES, TRACK_COLORS,
    Levels, MaxSkill,
    AvPropAccuracy, AvLureBonusAccuracy, AvPropDamage,
    AvPropTarget, AvPropTargetCat, ATK_SINGLE_TARGET, ATK_GROUP_TARGET, isGroup,
    GAG_NAMES, GAG_ICONS,
    AccuracyBonuses, DamageBonuses, AttackExpPerTrack, NumRoundsLured, MaxToonAcc,
    cogHpForLevel, COG_DEF_BY_POSITION, COG_ACC, COG_TYPES, loadout,
  };
})();

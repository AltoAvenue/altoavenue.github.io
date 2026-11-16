/* Trait, personality and zodiac data.

   Terminology: turn-ons and turn-offs are "chemistry" in code (the wiki's term).
   Chemistry icons are a mix: bespoke art (Cologne, Glasses, ...) plus the stock skill
   icons reused for the skill traits (skillIcon: true). Wiki filenames differ from the
   ids here; see tools/fetch-assets.sh for the mapping.

   `name` is the label shown in the Create-a-Sim picker. `id` only names the icon file. */
window.TS2_CHEMISTRY = [
  { id: "black-hair",   name: "Black Hair",   pack: "Nightlife" },
  { id: "blonde-hair",  name: "Blonde Hair",  pack: "Nightlife" },
  { id: "brown-hair",   name: "Brown Hair",   pack: "Nightlife" },
  { id: "red-hair",     name: "Red Heads",    pack: "Nightlife" },
  { id: "grey-hair",    name: "Grey Hair",    pack: "Nightlife" },
  { id: "custom-hair",  name: "Custom Hair",  pack: "Nightlife" },
  { id: "facial-hair",  name: "Facial Hair",  pack: "Nightlife" },
  { id: "swim-wear",    name: "Swim Wear",    pack: "Nightlife" },
  { id: "underwear",    name: "Under Wear",   pack: "Nightlife" },
  { id: "formal-wear",  name: "Formal Wear",  pack: "Nightlife" },
  { id: "glasses",      name: "Glasses",      pack: "Nightlife" },
  { id: "hats",         name: "Hats",         pack: "Nightlife" },
  { id: "jewelry",      name: "Jewelry",     pack: "Bon Voyage" },
  { id: "makeup",       name: "Make-Up",      pack: "Nightlife" },
  { id: "full-face-makeup", name: "Face Paint", pack: "Nightlife" },
  { id: "fatness",      name: "Fat Sims",     pack: "Nightlife" },
  { id: "fitness",      name: "Muscles",      pack: "Nightlife" },
  { id: "cologne",      name: "Cologne",      pack: "Nightlife" },
  { id: "stink",        name: "Stink",        pack: "Nightlife" },
  { id: "vampirism",    name: "Vampires",     pack: "Nightlife" },
  { id: "lycanthropy",  name: "Furries",      pack: "Bon Voyage" },
  { id: "plantsimism",  name: "Plant Sims",   pack: "Bon Voyage" },
  { id: "zombiism",     name: "Zombies",      pack: "Bon Voyage" },
  { id: "robots",       name: "Robots",       pack: "Bon Voyage" },
  { id: "witchiness",   name: "Witches",      pack: "Apartment Life" },
  { id: "unemployed",   name: "Unemployed",   pack: "Bon Voyage" },
  { id: "hard-worker",  name: "Hard Worker",  pack: "Bon Voyage" },
  { id: "great-cook",       name: "Good Cook",  pack: "Bon Voyage", skillIcon: true },
  { id: "good-at-cleaning", name: "Cleans",     pack: "Bon Voyage", skillIcon: true },
  { id: "creative",         name: "Artist",     pack: "Bon Voyage", skillIcon: true },
  { id: "athletic",         name: "Athletic",   pack: "Bon Voyage", skillIcon: true },
  { id: "logical",          name: "Logic",      pack: "Bon Voyage", skillIcon: true },
  { id: "charismatic",      name: "Charisma",   pack: "Bon Voyage", skillIcon: true },
  { id: "mechanical",       name: "Mechanist",  pack: "Bon Voyage", skillIcon: true }
];

/* The five personality scales; adults always total 25, each scale 0-10. */
window.TS2_SCALES = [
  { key: "neat",     low: "Sloppy",  high: "Neat" },
  { key: "outgoing", low: "Shy",     high: "Outgoing" },
  { key: "active",   low: "Lazy",    high: "Active" },
  { key: "playful",  low: "Serious", high: "Playful" },
  { key: "nice",     low: "Grouchy", high: "Nice" }
];

/* Preset personality per sign, in the same order as TS2_SCALES. */
window.TS2_ZODIAC = {
  aries:       { name: "Aries",       pts: [5, 8, 6, 3, 3] },
  taurus:      { name: "Taurus",      pts: [5, 5, 3, 8, 4] },
  gemini:      { name: "Gemini",      pts: [4, 7, 8, 3, 3] },
  cancer:      { name: "Cancer",      pts: [6, 3, 6, 4, 6] },
  leo:         { name: "Leo",         pts: [4, 10, 4, 4, 3] },
  virgo:       { name: "Virgo",       pts: [9, 2, 6, 3, 5] },
  libra:       { name: "Libra",       pts: [2, 8, 2, 6, 7] },
  scorpio:     { name: "Scorpio",     pts: [6, 5, 8, 3, 3] },
  sagittarius: { name: "Sagittarius", pts: [2, 3, 9, 7, 4] },
  capricorn:   { name: "Capricorn",   pts: [7, 4, 1, 8, 5] },
  aquarius:    { name: "Aquarius",    pts: [4, 4, 4, 7, 6] },
  pisces:      { name: "Pisces",      pts: [5, 3, 7, 3, 7] }
};

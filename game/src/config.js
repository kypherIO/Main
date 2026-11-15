// Skyfold — core game constants and tuning tables.

export const MAP = 64;              // tiles per side
export const N = MAP * MAP;
export const FLOOR = 0.22;          // world height of one storey

export const DAYS_PER_MONTH = 30;
export const SIM_DAY_SECONDS = 0.2; // real seconds per sim day at 1x
export const SPEEDS = [0, 1, 2, 4];

// Tile kinds
export const K = { EMPTY: 0, ROAD: 1, RES: 2, COM: 3, IND: 4, SERVICE: 5 };
export const ZONES = [K.RES, K.COM, K.IND];

export const ZONE_INFO = {
  [K.RES]: { key: 'res', name: 'Residential', pop: [0, 10, 48, 220], power: [0, 1, 3, 8], color: '#5fd068' },
  [K.COM]: { key: 'com', name: 'Commercial', jobs: [0, 6, 30, 120], power: [0, 2, 5, 12], color: '#4aa8ff' },
  [K.IND]: { key: 'ind', name: 'Industrial', jobs: [0, 12, 40, 100], power: [0, 3, 7, 12], pollution: [0, 16, 26, 38], color: '#ffc547' },
};

// Service buildings. `unlock` = peak population required.
export const SERVICES = {
  wind:     { name: 'Wind Turbine',    size: 1, cost: 800,   upkeep: 15,  power: 60,  unlock: 0,     desc: 'Clean power. Small output.' },
  tower:    { name: 'Water Tower',     size: 1, cost: 600,   upkeep: 20,  waterRadius: 9, unlock: 0, desc: 'Supplies water nearby. Needs power.' },
  park:     { name: 'Park',            size: 1, cost: 150,   upkeep: 4,   lv: 14, lvRadius: 5, unlock: 0, desc: 'Raises land value, cleans air.' },
  police:   { name: 'Police Station',  size: 1, cost: 1500,  upkeep: 45,  radius: 11, unlock: 0,  desc: 'Reduces crime.' },
  fire:     { name: 'Fire Station',    size: 1, cost: 1500,  upkeep: 45,  radius: 11, unlock: 0,  desc: 'Protects buildings. Boosts land value.' },
  gas:      { name: 'Gas Power Plant', size: 2, cost: 6000,  upkeep: 120, power: 900, pollution: 45, unlock: 300, desc: 'Big output. Pollutes.' },
  school:   { name: 'School',          size: 2, cost: 3500,  upkeep: 80,  radius: 13, unlock: 300, desc: 'Education lets towers and hi-tech industry grow.' },
  solar:    { name: 'Solar Farm',      size: 2, cost: 4000,  upkeep: 40,  power: 320, unlock: 1200, desc: 'Clean, mid-size power.' },
  hospital: { name: 'Hospital',        size: 2, cost: 5000,  upkeep: 110, radius: 14, unlock: 1200, desc: 'Health raises happiness and land value.' },
  stadium:  { name: 'Stadium',         size: 3, cost: 20000, upkeep: 250, lv: 25, lvRadius: 16, unlock: 5000, desc: 'Landmark. Huge happiness & land value.' },
};
export const SERVICE_IDS = Object.keys(SERVICES);           // index stored per tile (+1)
export const svcIndex = (id) => SERVICE_IDS.indexOf(id) + 1;
export const svcId = (n) => SERVICE_IDS[n - 1];

export const COST = { road: 15, zone: 25, bulldoze: 10 };
export const ROAD_UPKEEP = 0.5;

export const MILESTONES = [
  { pop: 0, name: 'Hamlet' },
  { pop: 300, name: 'Village' },
  { pop: 1200, name: 'Town' },
  { pop: 5000, name: 'City' },
  { pop: 15000, name: 'Metropolis' },
  { pop: 40000, name: 'Megalopolis' },
];

// Tool palette (order = UI order)
export const TOOLS = [
  { id: 'inspect', label: 'Inspect', group: 'Core' },
  { id: 'bulldoze', label: 'Bulldoze', group: 'Core', cost: COST.bulldoze, drag: 'rect' },
  { id: 'road', label: 'Road', group: 'Core', cost: COST.road, drag: 'line' },
  { id: 'res', label: 'Residential', group: 'Zones', cost: COST.zone, drag: 'rect', zone: K.RES },
  { id: 'com', label: 'Commercial', group: 'Zones', cost: COST.zone, drag: 'rect', zone: K.COM },
  { id: 'ind', label: 'Industrial', group: 'Zones', cost: COST.zone, drag: 'rect', zone: K.IND },
  { id: 'wind', group: 'Utilities', service: 'wind' },
  { id: 'solar', group: 'Utilities', service: 'solar' },
  { id: 'gas', group: 'Utilities', service: 'gas' },
  { id: 'tower', group: 'Utilities', service: 'tower' },
  { id: 'police', group: 'Services', service: 'police' },
  { id: 'fire', group: 'Services', service: 'fire' },
  { id: 'school', group: 'Services', service: 'school' },
  { id: 'hospital', group: 'Services', service: 'hospital' },
  { id: 'park', group: 'Leisure', service: 'park' },
  { id: 'stadium', group: 'Leisure', service: 'stadium' },
];
for (const t of TOOLS) {
  if (t.service) { const s = SERVICES[t.service]; t.label = s.name; t.cost = s.cost; }
}

export const OVERLAYS = [
  { id: 'none', label: 'Off' },
  { id: 'power', label: 'Power' },
  { id: 'water', label: 'Water' },
  { id: 'lv', label: 'Land value' },
  { id: 'pollution', label: 'Pollution' },
  { id: 'crime', label: 'Crime' },
];

// Deterministic hash → [0,1)
export function hash01(a, b = 0) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

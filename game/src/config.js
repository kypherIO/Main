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

// Tile flags
export const F = { ABANDONED: 1, BURNING: 2, RUBBLE: 4 };

export const ZONE_INFO = {
  [K.RES]: { key: 'res', name: 'Residential', pop: [0, 10, 48, 220], power: [0, 1, 3, 8], garbage: [0, 1, 2, 4], color: '#5fd068' },
  [K.COM]: { key: 'com', name: 'Commercial', jobs: [0, 6, 30, 120], high: [0, 0, 0.4, 0.8], power: [0, 2, 5, 12], garbage: [0, 1, 2, 4], color: '#4aa8ff' },
  [K.IND]: { key: 'ind', name: 'Industrial', jobs: [0, 12, 40, 100], high: [0, 0, 0, 0.7], power: [0, 3, 7, 12], garbage: [0, 2, 3, 4], pollution: [0, 16, 26, 38], color: '#ffc547' },
};

// Road classes: capacity in commuter trips per month-equivalent
export const ROADS = [
  { name: 'Street', cap: 220, cost: 15, upkeep: 0.5 },
  { name: 'Avenue', cap: 600, cost: 40, upkeep: 1.2 },
];

// Departments with adjustable funding
export const DEPTS = { police: 'Police', fire: 'Fire', health: 'Health', edu: 'Education', transit: 'Transit' };

// Service buildings. `unlock` = peak population required.
export const SERVICES = {
  wind:      { name: 'Wind Turbine',    size: 1, cost: 800,   upkeep: 15,  power: 60,  unlock: 0,    desc: 'Clean power. Small output.' },
  solar:     { name: 'Solar Farm',      size: 2, cost: 4000,  upkeep: 40,  power: 320, unlock: 1200, desc: 'Clean, mid-size power.' },
  gas:       { name: 'Gas Power Plant', size: 2, cost: 6000,  upkeep: 120, power: 900, pollution: 45, unlock: 300, desc: 'Big output. Pollutes.' },
  tower:     { name: 'Water Tower',     size: 1, cost: 600,   upkeep: 20,  waterRadius: 9, unlock: 0, desc: 'Supplies water nearby. Needs power.' },
  landfill:  { name: 'Landfill',        size: 2, cost: 2500,  upkeep: 55,  garbage: 2400, radius: 20, pollution: 22, unlock: 0, desc: 'Collects garbage. Smelly — keep it away from homes.' },
  recycling: { name: 'Recycling Center', size: 2, cost: 7000, upkeep: 110, garbage: 2600, radius: 18, unlock: 3000, desc: 'Clean garbage collection with no pollution.' },
  police:    { name: 'Police Station',  size: 1, cost: 1500,  upkeep: 45,  radius: 11, dept: 'police', unlock: 0, desc: 'Reduces crime.' },
  fire:      { name: 'Fire Station',    size: 1, cost: 1500,  upkeep: 45,  radius: 11, dept: 'fire', unlock: 0, desc: 'Puts out fires and prevents them.' },
  clinic:    { name: 'Clinic',          size: 1, cost: 900,   upkeep: 30,  radius: 7,  strength: 0.6, dept: 'health', unlock: 0, desc: 'Basic local healthcare.' },
  hospital:  { name: 'Hospital',        size: 2, cost: 5000,  upkeep: 110, radius: 15, dept: 'health', unlock: 1200, desc: 'Strong healthcare over a wide area.' },
  school:    { name: 'School',          size: 2, cost: 3500,  upkeep: 80,  radius: 13, dept: 'edu', unlock: 300, desc: 'Educated workers fill office and hi-tech jobs.' },
  university:{ name: 'University',      size: 2, cost: 12000, upkeep: 220, radius: 22, dept: 'edu', uni: true, unlock: 4000, desc: 'Higher education city-wide. Unlocks skyscraper offices.' },
  bus:       { name: 'Bus Stop',        size: 1, cost: 350,   upkeep: 12,  radius: 6,  transit: 0.3, dept: 'transit', unlock: 0, desc: 'Takes cars off nearby roads.' },
  metro:     { name: 'Metro Station',   size: 1, cost: 6500,  upkeep: 140, radius: 11, transit: 0.55, dept: 'transit', unlock: 5000, desc: 'Moves masses underground. Big traffic relief.' },
  park:      { name: 'Park',            size: 1, cost: 150,   upkeep: 4,   lv: 14, lvRadius: 5, unlock: 0, desc: 'Raises land value, cleans air.' },
  stadium:   { name: 'Stadium',         size: 3, cost: 20000, upkeep: 250, lv: 25, lvRadius: 16, tourism: 900, unlock: 5000, desc: 'Landmark. Happiness, land value and tourists.' },
};
export const SERVICE_IDS = Object.keys(SERVICES);           // index stored per tile (+1)
export const svcIndex = (id) => SERVICE_IDS.indexOf(id) + 1;
export const svcId = (n) => SERVICE_IDS[n - 1];

export const COST = { road: 15, avenue: 40, upgrade: 28, zone: 25, bulldoze: 10 };

// City ordinances. cost = flat + perCap * population, per month.
export const POLICIES = {
  smoke:     { name: 'Smoke Detector Mandate', flat: 50, perCap: 0.03, desc: 'Fire risk −45%.' },
  watch:     { name: 'Neighborhood Watch',     flat: 80, perCap: 0.04, desc: 'Crime −20%.' },
  freebus:   { name: 'Free Public Transit',    flat: 300, perCap: 0.02, desc: 'Transit ridership +50%. No fare income.' },
  recycle:   { name: 'Recycling Program',      flat: 100, perCap: 0.05, desc: 'Garbage produced −35%.' },
  rooftop:   { name: 'Rooftop Solar Subsidy',  flat: 150, perCap: 0.06, desc: 'Each home adds 0.5 MW of clean power.' },
  taxbreak:  { name: 'Industrial Tax Break',   flat: 0, perCap: 0, desc: 'Industry demand up, industrial tax income −30%.' },
  tourism:   { name: 'Tourism Campaign',       flat: 400, perCap: 0, desc: 'Commercial demand up; landmarks and waterfront draw visitors.' },
  highrise:  { name: 'High-rise Ban',          flat: 0, perCap: 0, desc: 'No towers. Residents +4 happiness, land value +6.' },
  curfew:    { name: 'Night Curfew',           flat: 60, perCap: 0, desc: 'Crime −15%, commercial income −12%, happiness −3.' },
};

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
  { id: 'road', label: 'Street', group: 'Core', cost: COST.road, drag: 'line' },
  { id: 'avenue', label: 'Avenue', group: 'Core', cost: COST.avenue, drag: 'line' },
  { id: 'res', label: 'Residential', group: 'Zones', cost: COST.zone, drag: 'rect', zone: K.RES },
  { id: 'com', label: 'Commercial', group: 'Zones', cost: COST.zone, drag: 'rect', zone: K.COM },
  { id: 'ind', label: 'Industrial', group: 'Zones', cost: COST.zone, drag: 'rect', zone: K.IND },
  { id: 'wind', group: 'Utilities', service: 'wind' },
  { id: 'solar', group: 'Utilities', service: 'solar' },
  { id: 'gas', group: 'Utilities', service: 'gas' },
  { id: 'tower', group: 'Utilities', service: 'tower' },
  { id: 'landfill', group: 'Utilities', service: 'landfill' },
  { id: 'recycling', group: 'Utilities', service: 'recycling' },
  { id: 'police', group: 'Services', service: 'police' },
  { id: 'fire', group: 'Services', service: 'fire' },
  { id: 'clinic', group: 'Services', service: 'clinic' },
  { id: 'hospital', group: 'Services', service: 'hospital' },
  { id: 'school', group: 'Services', service: 'school' },
  { id: 'university', group: 'Services', service: 'university' },
  { id: 'bus', group: 'Transit', service: 'bus' },
  { id: 'metro', group: 'Transit', service: 'metro' },
  { id: 'park', group: 'Leisure', service: 'park' },
  { id: 'stadium', group: 'Leisure', service: 'stadium' },
];
for (const t of TOOLS) {
  if (t.service) { const s = SERVICES[t.service]; t.label = s.name; t.cost = s.cost; }
}

export const OVERLAYS = [
  { id: 'none', label: 'Off' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'power', label: 'Power' },
  { id: 'water', label: 'Water' },
  { id: 'lv', label: 'Land value' },
  { id: 'happy', label: 'Happiness' },
  { id: 'edu', label: 'Education' },
  { id: 'pollution', label: 'Pollution' },
  { id: 'crime', label: 'Crime' },
  { id: 'garbage', label: 'Garbage' },
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

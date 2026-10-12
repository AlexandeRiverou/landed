import { biomeAt, terrainHeight, terrainNormalAt, waterCoverage, worldHash } from './world'

export type LandmarkKind =
  | 'windmill' | 'wind-turbine' | 'lighthouse' | 'pyramid' | 'obelisk' | 'crystal' | 'mushroom' | 'stone-arch'
  | 'ferris-wheel' | 'castle' | 'ice-spire' | 'sunflower' | 'tiki' | 'observatory' | 'floating-island' | 'cactus'
  | 'water-tower' | 'silo-farm' | 'stone-circle' | 'geyser' | 'statue' | 'pagoda' | 'clock-tower' | 'radar-dish' | 'ancient-tree' | 'mini-volcano'

export interface LandmarkInfo {
  name: string
  height: number
  radius: number
}

export const LANDMARKS: Record<LandmarkKind, LandmarkInfo> = {
  windmill: { name: 'Windmill', height: 58, radius: 24 },
  'wind-turbine': { name: 'Wind turbine', height: 130, radius: 30 },
  lighthouse: { name: 'Lighthouse', height: 80, radius: 14 },
  pyramid: { name: 'Pyramid', height: 90, radius: 60 },
  obelisk: { name: 'Obelisk', height: 140, radius: 10 },
  crystal: { name: 'Crystal cluster', height: 70, radius: 24 },
  mushroom: { name: 'Giant mushroom', height: 52, radius: 24 },
  'stone-arch': { name: 'Stone arch', height: 70, radius: 36 },
  'ferris-wheel': { name: 'Ferris wheel', height: 100, radius: 46 },
  castle: { name: 'Castle ruin', height: 56, radius: 50 },
  'ice-spire': { name: 'Ice spire', height: 95, radius: 24 },
  sunflower: { name: 'Giant sunflower', height: 80, radius: 20 },
  tiki: { name: 'Tiki totem', height: 66, radius: 12 },
  observatory: { name: 'Observatory', height: 52, radius: 22 },
  'floating-island': { name: 'Floating island', height: 40, radius: 38 },
  cactus: { name: 'Giant cactus', height: 56, radius: 14 },
  'water-tower': { name: 'Water tower', height: 72, radius: 18 },
  'silo-farm': { name: 'Silo farm', height: 48, radius: 32 },
  'stone-circle': { name: 'Stone circle', height: 30, radius: 40 },
  geyser: { name: 'Geyser', height: 90, radius: 20 },
  statue: { name: 'Giant statue', height: 100, radius: 20 },
  pagoda: { name: 'Pagoda', height: 82, radius: 26 },
  'clock-tower': { name: 'Clock tower', height: 92, radius: 14 },
  'radar-dish': { name: 'Radar dish', height: 64, radius: 26 },
  'ancient-tree': { name: 'Ancient tree', height: 112, radius: 40 },
  'mini-volcano': { name: 'Mini volcano', height: 72, radius: 50 },
}

export const LANDMARK_KINDS = Object.keys(LANDMARKS) as LandmarkKind[]
export const LANDMARK_CAP = 48
export const MAX_ACTIVE_KINDS = 5

export interface LandmarkSite {
  kind: LandmarkKind
  x: number
  z: number
  y: number
  scale: number
  rotation: number
}

interface SiteContext {
  height: number
  flat: number
  nearWater: boolean
  desert: number
  frost: number
}

const fits: Record<LandmarkKind, (site: SiteContext) => boolean> = {
  windmill: (s) => s.flat > 0.93 && s.height > 90 && s.height < 450 && s.desert < 0.4 && s.frost < 0.4,
  'wind-turbine': (s) => s.flat > 0.9 && s.height > 150 && s.height < 1000,
  lighthouse: (s) => s.nearWater && s.height < 420 && s.flat > 0.85,
  pyramid: (s) => s.flat > 0.92 && s.height > 100 && s.height < 700,
  obelisk: (s) => s.flat > 0.88 && s.height > 100 && s.height < 1100,
  crystal: (s) => s.height > 450,
  mushroom: (s) => s.flat > 0.88 && s.height > 100 && s.height < 700 && s.frost < 0.5,
  'stone-arch': (s) => s.flat > 0.8 && s.height > 150 && s.height < 1100,
  'ferris-wheel': (s) => s.flat > 0.95 && s.height > 100 && s.height < 450 && s.desert < 0.5 && s.frost < 0.5,
  castle: (s) => s.flat > 0.9 && s.height > 200 && s.height < 900,
  'ice-spire': (s) => (s.frost > 0.25 || s.height > 900) && s.flat > 0.7,
  sunflower: (s) => s.flat > 0.93 && s.height > 100 && s.height < 500 && s.desert < 0.5 && s.frost < 0.6,
  tiki: (s) => s.flat > 0.9 && s.height > 100 && s.height < 600,
  observatory: (s) => s.height > 400 && s.flat > 0.9,
  'floating-island': (s) => s.height > 100 && s.height < 1200,
  cactus: (s) => s.desert > 0.4 && s.flat > 0.85 && s.height < 700,
  'water-tower': (s) => s.flat > 0.9 && s.height > 100 && s.height < 700,
  'silo-farm': (s) => s.flat > 0.93 && s.height > 100 && s.height < 450 && s.frost < 0.5 && s.desert < 0.6,
  'stone-circle': (s) => s.flat > 0.9 && s.height > 150 && s.height < 900,
  geyser: (s) => s.flat > 0.85 && s.height > 100 && s.height < 800,
  statue: (s) => s.flat > 0.88 && s.height > 100 && s.height < 900,
  pagoda: (s) => s.flat > 0.88 && s.height > 150 && s.height < 800 && s.frost < 0.6,
  'clock-tower': (s) => s.flat > 0.93 && s.height > 100 && s.height < 500 && s.desert < 0.7,
  'radar-dish': (s) => s.flat > 0.88 && s.height > 300 && s.height < 1200,
  'ancient-tree': (s) => s.flat > 0.85 && s.height > 100 && s.height < 600 && s.desert < 0.5,
  'mini-volcano': (s) => s.flat > 0.7 && s.height > 200 && s.height < 1100,
}

export function landmarkFits(kind: LandmarkKind, site: SiteContext): boolean {
  return fits[kind](site)
}

export function landmarkDensity(kindCount: number): number {
  return kindCount === 0 ? 0 : Math.min(0.45, 0.2 + 0.06 * kindCount)
}

// Deterministic landmark layout for one region, always capped.
export function generateLandmarks(centerX: number, centerZ: number, kinds: readonly LandmarkKind[], maximum = LANDMARK_CAP): LandmarkSite[] {
  const sites: LandmarkSite[] = []
  if (kinds.length === 0) return sites
  const perKindCap = Math.ceil(maximum / Math.min(kinds.length, 3))
  const perKind = new Map<LandmarkKind, number>()
  const density = landmarkDensity(kinds.length)
  const spacing = 480
  const halfSize = 3000
  for (let cellX = Math.floor((centerX - halfSize) / spacing); cellX <= Math.floor((centerX + halfSize) / spacing) && sites.length < maximum; cellX += 1) {
    for (let cellZ = Math.floor((centerZ - halfSize) / spacing); cellZ <= Math.floor((centerZ + halfSize) / spacing) && sites.length < maximum; cellZ += 1) {
      if (worldHash(cellX + 913.4, cellZ + 27.1) > density) continue
      const x = (cellX + 0.15 + worldHash(cellX + 61.7, cellZ + 508.3) * 0.7) * spacing
      const z = (cellZ + 0.15 + worldHash(cellX + 307.9, cellZ + 44.6) * 0.7) * spacing
      const height = terrainHeight(x, z)
      if (waterCoverage(x, z) > 0.05) continue
      const biome = biomeAt(x, z)
      const site: SiteContext = {
        height,
        flat: terrainNormalAt(x, z).y,
        nearWater: [[150, 0], [-150, 0], [0, 150], [0, -150]].some(([dx, dz]) => waterCoverage(x + dx, z + dz) > 0.3),
        desert: biome.desert,
        frost: biome.frost,
      }
      const options = kinds.filter((kind) => landmarkFits(kind, site) && (perKind.get(kind) ?? 0) < perKindCap)
      if (options.length === 0) continue
      const kind = options[Math.floor(worldHash(cellX + 19.2, cellZ + 733.8) * options.length) % options.length]
      perKind.set(kind, (perKind.get(kind) ?? 0) + 1)
      sites.push({
        kind,
        x,
        z,
        y: kind === 'floating-island' ? height + 380 + worldHash(cellX + 5.5, cellZ + 91.2) * 220 : height,
        scale: 0.85 + worldHash(cellX + 144.1, cellZ + 12.9) * 0.5,
        rotation: worldHash(cellX + 78.3, cellZ + 276.4) * Math.PI * 2,
      })
    }
  }
  return sites
}

export interface LandscapeState {
  treeDensity: number
  rockDensity: number
  towerDensity: number
  cannonDensity: number
  kinds: LandmarkKind[]
  version: number
}

export function createLandscape(): LandscapeState {
  return { treeDensity: 1, rockDensity: 1, towerDensity: 1, cannonDensity: 1, kinds: [], version: 0 }
}

export interface LandscapeChange {
  id: string
  title: string
  blurb: string
  trees?: number
  rocks?: number
  towers?: number
  cannons?: number
  add?: LandmarkKind[]
  clear?: boolean
}

export const LANDSCAPE_CHANGES: readonly LandscapeChange[] = [
  { id: 'forest-sprint', title: 'FOREST GROWTH SPURT', blurb: 'The land added a lot more trees. Please do not hug them all.', trees: 1.5 },
  { id: 'timber-time', title: 'TIMBER TIME', blurb: 'Half the trees left without saying goodbye. Boulders moved in.', trees: 0.5, rocks: 1.3 },
  { id: 'rock-garden', title: 'ROCK GARDEN BLOOM', blurb: 'Boulders and crystal clusters are sprouting on the high ground.', rocks: 1.8, add: ['crystal'] },
  { id: 'wind-farm', title: 'WIND FARM FRENZY', blurb: 'Windmills and turbines moved in overnight.', trees: 0.85, add: ['windmill', 'wind-turbine'] },
  { id: 'retro-resort', title: 'RETRO RESORT OPENS', blurb: 'Ferris wheels and tiki totems appeared. Nobody approved this.', add: ['ferris-wheel', 'tiki'] },
  { id: 'pyramid-scheme', title: 'PYRAMID SCHEME', blurb: 'Pyramids and obelisks are popping up. They call it an investment.', add: ['pyramid', 'obelisk'] },
  { id: 'spore-season', title: 'SPORE SEASON', blurb: 'Giant mushrooms are up and the trees look nervous.', trees: 0.7, add: ['mushroom'] },
  { id: 'ice-spires', title: 'ICE SPIRE SURPRISE', blurb: 'Pointy ice has appeared in the cold places and in the high ones.', add: ['ice-spire'] },
  { id: 'castle-creep', title: 'CASTLE CREEP', blurb: 'Ruined castles wandered in with extra cannons.', cannons: 1.8, add: ['castle'] },
  { id: 'antenna-boom', title: 'ANTENNA BOOM', blurb: 'So many towers. The birds are filing complaints.', towers: 2.2 },
  { id: 'tower-topple', title: 'TOWER TOPPLE', blurb: 'The towers went on strike and left. The sky is roomier.', towers: 0.2 },
  { id: 'cannon-festival', title: 'CANNON FESTIVAL', blurb: 'Cannons are everywhere and slightly excited.', cannons: 2.5 },
  { id: 'cannon-nap', title: 'CANNON NAP TIME', blurb: 'Most cannons are asleep. Do not poke them.', cannons: 0.2 },
  { id: 'sunflower-shout', title: 'SUNFLOWER SHOUT', blurb: 'Gigantic sunflowers are watching you fly by.', add: ['sunflower'] },
  { id: 'lighthouse-league', title: 'LIGHTHOUSE LEAGUE', blurb: 'Lighthouses by the water and observatories on the hills.', add: ['lighthouse', 'observatory'] },
  { id: 'arch-enthusiast', title: 'ARCH ENTHUSIAST', blurb: 'Stone arches are springing up. Wave as you pass.', add: ['stone-arch'] },
  { id: 'sky-islands', title: 'THE LAND LOST A BET WITH GRAVITY', blurb: 'Little islands are floating in the air now.', add: ['floating-island'] },
  { id: 'cactus-craze', title: 'CACTUS CRAZE', blurb: 'Huge cacti in the dry places. Do not hug.', add: ['cactus'] },
  { id: 'bumper-crop', title: 'BUMPER CROP', blurb: 'Trees and rocks both thickened up a little.', trees: 1.3, rocks: 1.3 },
  { id: 'farm-fever', title: 'FARM FEVER', blurb: 'Silos and water towers rose from the fields like very practical mushrooms.', add: ['silo-farm', 'water-tower'] },
  { id: 'standing-stones', title: 'STANDING STONES CLUB', blurb: 'Stone circles and giant statues showed up. They are not talking.', add: ['stone-circle', 'statue'] },
  { id: 'geyser-season', title: 'GEYSER SEASON', blurb: 'The ground is steaming on purpose. Do not ask it to stop.', add: ['geyser'] },
  { id: 'pagoda-parade', title: 'PAGODA PARADE', blurb: 'Tiered pagodas are lining up neatly on the hills.', add: ['pagoda'] },
  { id: 'clock-oclock', title: "CLOCK O'CLOCK", blurb: 'Clock towers and radar dishes disagree about what time it is.', add: ['clock-tower', 'radar-dish'] },
  { id: 'old-growth', title: 'OLD GROWTH SURPRISE', blurb: 'A few enormous ancient trees pushed the regular ones aside.', trees: 0.8, add: ['ancient-tree'] },
  { id: 'volcano-hobby', title: 'VOLCANO HOBBYISTS', blurb: 'Tiny volcanoes are glowing on the slopes. Rocks are involved.', rocks: 1.4, add: ['mini-volcano'] },
  { id: 'great-tidy', title: 'THE GREAT TIDY', blurb: 'Someone cleaned up: landmarks are gone and everything is back to normal.', clear: true },
]

const MIN_DENSITY = 0.15
const MAX_DENSITY = 2.5

function clampDensity(value: number): number {
  return Math.max(MIN_DENSITY, Math.min(MAX_DENSITY, value))
}

// Newer landmark kinds push the oldest out so the world never gets crowded.
export function applyLandscapeChange(state: LandscapeState, change: LandscapeChange): void {
  if (change.clear) {
    state.kinds = []
    state.treeDensity = 1
    state.rockDensity = 1
    state.towerDensity = 1
    state.cannonDensity = 1
  }
  state.treeDensity = clampDensity(state.treeDensity * (change.trees ?? 1))
  state.rockDensity = clampDensity(state.rockDensity * (change.rocks ?? 1))
  state.towerDensity = clampDensity(state.towerDensity * (change.towers ?? 1))
  state.cannonDensity = clampDensity(state.cannonDensity * (change.cannons ?? 1))
  for (const kind of change.add ?? []) {
    state.kinds = state.kinds.filter((existing) => existing !== kind)
    state.kinds.push(kind)
  }
  while (state.kinds.length > MAX_ACTIVE_KINDS) state.kinds.shift()
  state.version += 1
}

function changeDeck(cycle: number, seed: number): LandscapeChange[] {
  const deck = [...LANDSCAPE_CHANGES]
  let state = (seed ^ Math.imul(cycle + 7, 0x85ebca6b)) >>> 0 || 1
  for (let index = deck.length - 1; index > 0; index -= 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    const other = state % (index + 1)
    ;[deck[index], deck[other]] = [deck[other], deck[index]]
  }
  if (deck[0].id === 'great-tidy') [deck[0], deck[1]] = [deck[1], deck[0]]
  return deck
}

export function landscapeChangeFor(objectiveIndex: number, seed = 0x4c414e44): LandscapeChange {
  const index = Math.max(0, objectiveIndex)
  return changeDeck(Math.floor(index / LANDSCAPE_CHANGES.length), seed)[index % LANDSCAPE_CHANGES.length]
}

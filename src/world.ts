const DEFAULT_WORLD_SEED = 0x4c414e44
let worldSeed = DEFAULT_WORLD_SEED

export function createWorldSeed(): number {
  const values = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else values[0] = Math.floor(Math.random() * 0x1_0000_0000)
  return values[0]
}

export function setWorldSeed(seed: number): void {
  worldSeed = seed >>> 0
}

function hash(x: number, z: number): number {
  const offsetX = (worldSeed & 0xffff) * 0.0137
  const offsetZ = (worldSeed >>> 16) * 0.0171
  const value = Math.sin((x + offsetX) * 127.1 + (z + offsetZ) * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value)
}

function noise(x: number, z: number): number {
  const cellX = Math.floor(x)
  const cellZ = Math.floor(z)
  const partX = smooth(x - cellX)
  const partZ = smooth(z - cellZ)
  const lower = hash(cellX, cellZ) * (1 - partX) + hash(cellX + 1, cellZ) * partX
  const upper = hash(cellX, cellZ + 1) * (1 - partX) + hash(cellX + 1, cellZ + 1) * partX
  return lower * (1 - partZ) + upper * partZ
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return amount * amount * (3 - 2 * amount)
}

function rawTerrainHeight(x: number, z: number): number {
  const broad = noise(x * 0.00008, z * 0.00008) * 170
  const foothills = noise(x * 0.00022, z * 0.00022) * 110
  const ridgeShape = 1 - Math.abs(noise(x * 0.00058, z * 0.00058) * 2 - 1)
  const ridges = ridgeShape ** 1.7 * 1150
  const detail = noise(x * 0.0024, z * 0.0024) * 36
  return 35 + broad + foothills + ridges + detail
}

export interface WaterSample {
  coverage: number
  level: number
}

function waterAt(x: number, z: number): WaterSample {
  const riverX = Math.sin(z * 0.00072) * 550 + Math.sin(z * 0.00024) * 750
  const riverWidth = 86 + noise(z * 0.0006, 0.19) * 20
  let coverage = 1 - smoothstep(riverWidth, riverWidth + 78, Math.abs(x - riverX))
  let level = 216 + Math.sin(z * 0.00013) * 28 + noise(x * 0.00017, z * 0.00017) * 14

  const cellSize = 5200
  const cellX = Math.floor(x / cellSize)
  const cellZ = Math.floor(z / cellSize)
  for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
      const lakeX = cellX + offsetX
      const lakeZ = cellZ + offsetZ
      if (hash(lakeX + 17.3, lakeZ + 29.7) < 0.71) continue

      const centerX = (lakeX + 0.14 + hash(lakeX + 43.1, lakeZ + 7.2) * 0.72) * cellSize
      const centerZ = (lakeZ + 0.14 + hash(lakeX + 11.8, lakeZ + 61.4) * 0.72) * cellSize
      const radius = 310 + hash(lakeX + 83.2, lakeZ + 13.9) * 210
      const lakeCoverage = 1 - smoothstep(radius * 0.82, radius * 1.12, Math.hypot(x - centerX, z - centerZ))
      if (lakeCoverage > coverage) {
        coverage = lakeCoverage
        level = 205 + hash(lakeX + 18.4, lakeZ + 73.6) * 40
      }
    }
  }

  return { coverage, level }
}

export function waterCoverage(x: number, z: number): number {
  return waterAt(x, z).coverage
}

export function terrainHeight(x: number, z: number): number {
  const ground = rawTerrainHeight(x, z)
  const water = waterAt(x, z)
  return ground * (1 - water.coverage) + water.level * water.coverage
}

export function terrainGridOrigin(position: number): number {
  const spacing = 12000 / 190
  return Math.round(position / spacing) * spacing
}

export interface TerrainNormal {
  x: number
  y: number
  z: number
}

export function terrainNormalAt(x: number, z: number): TerrainNormal {
  const sampleDistance = 24
  const horizontal = terrainHeight(x - sampleDistance, z) - terrainHeight(x + sampleDistance, z)
  const depth = terrainHeight(x, z - sampleDistance) - terrainHeight(x, z + sampleDistance)
  const length = Math.hypot(horizontal, sampleDistance * 2, depth)
  return { x: horizontal / length, y: sampleDistance * 2 / length, z: depth / length }
}

export function highestTerrainAlongPath(startX: number, startZ: number, endX: number, endZ: number): number {
  const distance = Math.hypot(endX - startX, endZ - startZ)
  const samples = Math.max(2, Math.ceil(distance / 18))
  let highest = Number.NEGATIVE_INFINITY
  for (let index = 0; index <= samples; index += 1) {
    const amount = index / samples
    const x = startX + (endX - startX) * amount
    const z = startZ + (endZ - startZ) * amount
    highest = Math.max(highest, terrainHeight(x, z))
  }
  return highest
}

export type FlyingThingKind = 'birds' | 'airplane' | 'balloon' | 'kite' | 'glider'

export interface FlyingThingSpawn {
  x: number
  y: number
  z: number
  heading: number
  speed: number
  phase: number
  kind: FlyingThingKind
}

export function generateFlyingThings(centerX: number, centerZ: number, count = 8): FlyingThingSpawn[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = index + 1
    const x = centerX + (hash(seed + centerX * 0.013, centerZ * 0.017 + 31.7) - 0.5) * 7600
    const z = centerZ - 1600 - hash(seed + centerZ * 0.011, centerX * 0.019 + 69.3) * 8200
    const kind: FlyingThingKind = index % 11 === 8
      ? 'balloon'
      : index % 7 === 4
        ? 'kite'
        : index % 5 === 2
          ? 'glider'
          : index % 3 === 0
            ? 'airplane'
            : 'birds'
    const clearance = kind === 'balloon' ? 850 : kind === 'airplane' ? 550 : kind === 'kite' ? 620 : kind === 'glider' ? 480 : 300
    const speed = kind === 'balloon' ? 7 : kind === 'kite' ? 20 : kind === 'glider' ? 58 : kind === 'airplane' ? 74 : 28

    return {
      x,
      y: terrainHeight(x, z) + clearance + hash(seed + 44.1, centerX + centerZ) * 130,
      z,
      heading: (hash(seed + 8.5, centerX * 0.003 + centerZ) - 0.5) * 0.8,
      speed,
      phase: hash(seed + 71.2, centerZ * 0.007 + centerX) * Math.PI * 2,
      kind,
    }
  })
}

export interface TreePosition {
  x: number
  z: number
  height: number
  scale: number
  rotation: number
  kind: 'pine' | 'broadleaf'
}

export function generateForest(centerX: number, centerZ: number, maximum = 1600): TreePosition[] {
  const trees: TreePosition[] = []
  const spacing = 76
  const halfSize = 3000
  const startX = Math.floor((centerX - halfSize) / spacing)
  const endX = Math.floor((centerX + halfSize) / spacing)
  const startZ = Math.floor((centerZ - halfSize) / spacing)
  const endZ = Math.floor((centerZ + halfSize) / spacing)

  for (let cellX = startX; cellX <= endX && trees.length < maximum; cellX += 1) {
    for (let cellZ = startZ; cellZ <= endZ && trees.length < maximum; cellZ += 1) {
      const x = (cellX + 0.12 + hash(cellX + 129.8, cellZ + 17.3) * 0.76) * spacing
      const z = (cellZ + 0.12 + hash(cellX + 43.6, cellZ + 341.2) * 0.76) * spacing
      if (noise(x * 0.00048, z * 0.00048) < 0.43 || hash(cellX + 73.4, cellZ + 918.7) < 0.47) continue

      const height = terrainHeight(x, z)
      if (height < 130 || height > 600 || waterCoverage(x, z) > 0.05) continue

      const slope = Math.abs(terrainHeight(x + 18, z) - terrainHeight(x - 18, z))
        + Math.abs(terrainHeight(x, z + 18) - terrainHeight(x, z - 18))
      if (slope > 60) continue

      trees.push({
        x,
        z,
        height,
        scale: 0.65 + hash(cellX + 12.2, cellZ + 451.8) * 1.0,
        rotation: hash(cellX + 421.7, cellZ + 92.3) * Math.PI * 2,
        kind: hash(cellX + 201.2, cellZ + 88.7) < 0.22 ? 'broadleaf' : 'pine',
      })
    }
  }

  return trees
}

export interface RockPosition {
  x: number
  z: number
  height: number
  scale: number
  rotation: number
}

export function generateRockField(centerX: number, centerZ: number, maximum = 420): RockPosition[] {
  const rocks: RockPosition[] = []
  const spacing = 148
  const halfSize = 3000
  const startX = Math.floor((centerX - halfSize) / spacing)
  const endX = Math.floor((centerX + halfSize) / spacing)
  const startZ = Math.floor((centerZ - halfSize) / spacing)
  const endZ = Math.floor((centerZ + halfSize) / spacing)

  for (let cellX = startX; cellX <= endX && rocks.length < maximum; cellX += 1) {
    for (let cellZ = startZ; cellZ <= endZ && rocks.length < maximum; cellZ += 1) {
      const x = (cellX + 0.16 + hash(cellX + 73.8, cellZ + 91.3) * 0.68) * spacing
      const z = (cellZ + 0.16 + hash(cellX + 37.5, cellZ + 128.6) * 0.68) * spacing
      if (noise(x * 0.0008, z * 0.0008) < 0.56 || hash(cellX + 344.9, cellZ + 54.1) < 0.38) continue

      const height = terrainHeight(x, z)
      if (height < 520 || height > 1420 || waterCoverage(x, z) > 0.05) continue

      rocks.push({
        x,
        z,
        height,
        scale: 0.6 + hash(cellX + 515.2, cellZ + 36.3) * 1.4,
        rotation: hash(cellX + 201.8, cellZ + 19.6) * Math.PI * 2,
      })
    }
  }

  return rocks
}

export interface CannonSite {
  x: number
  z: number
  height: number
  scale: number
  rotation: number
}

export function generateCannons(centerX: number, centerZ: number, maximum = 12): CannonSite[] {
  const cannons: CannonSite[] = []
  const spacing = 980
  const halfSize = 3000
  const startX = Math.floor((centerX - halfSize) / spacing)
  const endX = Math.floor((centerX + halfSize) / spacing)
  const startZ = Math.floor((centerZ - halfSize) / spacing)
  const endZ = Math.floor((centerZ + halfSize) / spacing)

  for (let cellX = startX; cellX <= endX && cannons.length < maximum; cellX += 1) {
    for (let cellZ = startZ; cellZ <= endZ && cannons.length < maximum; cellZ += 1) {
      if (noise(cellX + 82.7, cellZ + 19.3) < 0.38) continue
      const x = (cellX + 0.18 + hash(cellX + 731.2, cellZ + 51.8) * 0.64) * spacing
      const z = (cellZ + 0.18 + hash(cellX + 31.4, cellZ + 743.6) * 0.64) * spacing
      const height = terrainHeight(x, z)
      if (height < 780 || height > 1500 || waterCoverage(x, z) > 0.05) continue

      const slope = Math.abs(terrainHeight(x + 24, z) - terrainHeight(x - 24, z))
        + Math.abs(terrainHeight(x, z + 24) - terrainHeight(x, z - 24))
      if (slope > 150) continue

      cannons.push({
        x,
        z,
        height,
        scale: 0.8 + hash(cellX + 429.6, cellZ + 177.2) * 0.7,
        rotation: hash(cellX + 214.5, cellZ + 517.9) * Math.PI * 2,
      })
    }
  }

  return cannons
}

export interface SettlementRoad {
  x: number
  z: number
  height: number
  rotation: number
  length: number
  width: number
}

export interface BuildingSite {
  x: number
  z: number
  height: number
  scale: number
  rotation: number
  kind: 'cottage' | 'house' | 'shop' | 'barn'
}

export interface RoadCarSite {
  x: number
  z: number
  height: number
  rotation: number
  phase: number
  speed: number
  color: number
}

export interface SettlementLayout {
  centerX: number
  centerZ: number
  rotation: number
  roads: SettlementRoad[]
  buildings: BuildingSite[]
  cars: RoadCarSite[]
}

export function generateSettlement(centerX: number, centerZ: number): SettlementLayout {
  let townX = centerX
  let townZ = centerZ
  for (let candidate = 0; candidate < 100; candidate += 1) {
    const x = centerX + (hash(candidate + centerX * 0.007, centerZ * 0.011 + 701.3) - 0.5) * 5200
    const z = centerZ + (hash(candidate + centerZ * 0.009, centerX * 0.013 + 119.6) - 0.5) * 5200
    const normal = terrainNormalAt(x, z)
    if (terrainHeight(x, z) < 680 && waterCoverage(x, z) < 0.04 && normal.y > 0.91) {
      townX = x
      townZ = z
      break
    }
  }

  const rotation = (hash(townX * 0.013 + 83.7, townZ * 0.017 + 209.4) - 0.5) * Math.PI * 0.4
  const toWorld = (localX: number, localZ: number) => ({
    x: townX + localX * Math.cos(rotation) + localZ * Math.sin(rotation),
    z: townZ - localX * Math.sin(rotation) + localZ * Math.cos(rotation),
  })
  const roads: SettlementRoad[] = []
  const roadLength = 120
  const roadWidth = 15

  const addStreet = (localX: number, localZ: number, angle: number) => {
    const position = toWorld(localX, localZ)
    const halfLength = roadLength * 0.48
    const xA = position.x - Math.cos(angle) * halfLength
    const zA = position.z + Math.sin(angle) * halfLength
    const xB = position.x + Math.cos(angle) * halfLength
    const zB = position.z - Math.sin(angle) * halfLength
    const startHeight = terrainHeight(xA, zA)
    const endHeight = terrainHeight(xB, zB)
    const height = terrainHeight(position.x, position.z)
    if (height > 760 || waterCoverage(position.x, position.z) > 0.04 || Math.abs(startHeight - endHeight) > 28) return
    roads.push({ x: position.x, z: position.z, height, rotation: angle, length: roadLength, width: roadWidth })
  }

  for (const streetZ of [-300, -150, 0, 150, 300]) {
    for (let streetX = -360; streetX <= 360; streetX += roadLength) addStreet(streetX, streetZ, rotation)
  }
  for (const streetX of [-300, -150, 0, 150, 300]) {
    for (let streetZ = -360; streetZ <= 360; streetZ += roadLength) addStreet(streetX, streetZ, rotation + Math.PI / 2)
  }

  const buildings: BuildingSite[] = []
  const buildingKinds: BuildingSite['kind'][] = ['cottage', 'house', 'shop', 'barn']
  for (let localZ = -390; localZ <= 390; localZ += 130) {
    for (let localX = -390; localX <= 390; localX += 130) {
      if (hash(localX + townX * 0.01, localZ + townZ * 0.01) < 0.42) continue
      const position = toWorld(localX + (hash(localX + 43.5, localZ + 87.2) - 0.5) * 32, localZ)
      const height = terrainHeight(position.x, position.z)
      const normal = terrainNormalAt(position.x, position.z)
      if (height > 700 || normal.y < 0.86 || waterCoverage(position.x, position.z) > 0.04) continue
      const variant = Math.floor(hash(localX + townX * 0.013 + 12.7, localZ + townZ * 0.015 + 5.8) * buildingKinds.length)
      buildings.push({
        x: position.x,
        z: position.z,
        height,
        scale: 0.7 + hash(localX + 19.3, localZ + 61.8) * 0.7,
        rotation: rotation + (hash(localX + 711.1, localZ + 32.4) - 0.5) * 0.22,
        kind: buildingKinds[variant],
      })
    }
  }

  const cars: RoadCarSite[] = []
  for (let index = 0; index < 8; index += 1) {
    const localX = -315 + index * 90
    const position = toWorld(localX, -7 + (index % 2) * 14)
    const height = terrainHeight(position.x, position.z)
    if (waterCoverage(position.x, position.z) > 0.04 || height > 760) continue
    cars.push({
      x: position.x,
      z: position.z,
      height,
      rotation: rotation + Math.PI / 2,
      phase: hash(index + townX * 0.03, townZ * 0.02 + 33.3),
      speed: 12 + hash(index + townZ * 0.017, townX * 0.021 + 16.9) * 22,
      color: [0xc7543f, 0x477b8f, 0xd2a74f, 0x455b49][Math.floor(hash(index + 319.5, townX * 0.001 + townZ) * 4)],
    })
  }

  return { centerX: townX, centerZ: townZ, rotation, roads, buildings, cars }
}

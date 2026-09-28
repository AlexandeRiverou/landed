function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
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
  const broad = noise(x * 0.00016, z * 0.00016) * 195
  const foothills = noise(x * 0.00035, z * 0.00035) * 90
  const ridgeShape = 1 - Math.abs(noise(x * 0.00062, z * 0.00062) * 2 - 1)
  const ridges = ridgeShape ** 2 * 500
  const detail = noise(x * 0.0024, z * 0.0024) * 28
  return 55 + broad + foothills + ridges + detail
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

export interface TreePosition {
  x: number
  z: number
  height: number
  scale: number
  rotation: number
}

export function generateForest(centerX: number, centerZ: number, maximum = 1600): TreePosition[] {
  const trees: TreePosition[] = []
  const spacing = 96
  const halfSize = 3000
  const startX = Math.floor((centerX - halfSize) / spacing)
  const endX = Math.floor((centerX + halfSize) / spacing)
  const startZ = Math.floor((centerZ - halfSize) / spacing)
  const endZ = Math.floor((centerZ + halfSize) / spacing)

  for (let cellX = startX; cellX <= endX && trees.length < maximum; cellX += 1) {
    for (let cellZ = startZ; cellZ <= endZ && trees.length < maximum; cellZ += 1) {
      const x = (cellX + 0.12 + hash(cellX + 129.8, cellZ + 17.3) * 0.76) * spacing
      const z = (cellZ + 0.12 + hash(cellX + 43.6, cellZ + 341.2) * 0.76) * spacing
      if (noise(x * 0.00048, z * 0.00048) < 0.5 || hash(cellX + 73.4, cellZ + 918.7) < 0.58) continue

      const height = terrainHeight(x, z)
      if (height < 140 || height > 520 || waterCoverage(x, z) > 0.05) continue

      const slope = Math.abs(terrainHeight(x + 18, z) - terrainHeight(x - 18, z))
        + Math.abs(terrainHeight(x, z + 18) - terrainHeight(x, z - 18))
      if (slope > 54) continue

      trees.push({
        x,
        z,
        height,
        scale: 0.7 + hash(cellX + 12.2, cellZ + 451.8) * 0.85,
        rotation: hash(cellX + 421.7, cellZ + 92.3) * Math.PI * 2,
      })
    }
  }

  return trees
}

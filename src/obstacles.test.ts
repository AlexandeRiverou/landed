import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveTowerCollision } from './obstacles'
import { CANYON_WALL_HALF, MASSIF_CELL, canyonCenterX, canyonInLane, canyonPresence, generateTowers, generateWaterfalls, massifInCell, setWorldSeed, terrainHeight, waterCoverage } from './world'

const tower = { x: 100, z: 100, base: 200, top: 700, radius: 20 }

describe('resolveTowerCollision', () => {
  it('pushes a point inside the shaft out to the tower surface', () => {
    const point = { x: 110, y: 400, z: 100 }
    assert.equal(resolveTowerCollision(point, [tower]), tower)
    assert.ok(Math.hypot(point.x - tower.x, point.z - tower.z) >= tower.radius)
  })

  it('lets a point fly over the top and past the side', () => {
    assert.equal(resolveTowerCollision({ x: 100, y: 900, z: 100 }, [tower]), null)
    assert.equal(resolveTowerCollision({ x: 200, y: 400, z: 100 }, [tower]), null)
  })

  it('handles a point exactly on the axis', () => {
    const point = { x: 100, y: 400, z: 100 }
    assert.equal(resolveTowerCollision(point, [tower]), tower)
    assert.ok(Math.hypot(point.x - tower.x, point.z - tower.z) >= tower.radius)
  })
})

describe('terrain obstacles', () => {
  it('generates towers on dry, reasonably flat ground', () => {
    setWorldSeed(0x4c414e44)
    const towers = Array.from({ length: 9 }, (_, index) => generateTowers(index * 6000, -index * 3000)).flat()
    assert.ok(towers.length > 3)
    assert.ok(towers.every((site) => site.top - site.base >= 380 && site.radius >= 16))
  })

  it('raises mega massifs far above the old ridge height', () => {
    setWorldSeed(0x4c414e44)
    let highest = 0
    for (let cellX = -6; cellX < 6; cellX += 1) {
      for (let cellZ = -6; cellZ < 6; cellZ += 1) {
        const massif = massifInCell(cellX, cellZ)
        if (massif) highest = Math.max(highest, terrainHeight(massif.x, massif.z))
      }
    }
    assert.ok(highest > 2200)
    assert.equal(MASSIF_CELL, 8000)
  })

  it('carves canyons far below the surrounding mesa', () => {
    setWorldSeed(0x4c414e44)
    let checked = 0
    for (let lane = -8; lane < 8; lane += 1) {
      const canyon = canyonInLane(lane)
      if (!canyon) continue
      for (let z = -9000; z < 9000; z += 200) {
        if (canyonPresence(canyon, z) < 0.99) continue
        const centerX = canyonCenterX(canyon, z)
        if (waterCoverage(centerX, z) > 0.01 || waterCoverage(centerX + CANYON_WALL_HALF + 40, z) > 0.01) continue
        const floor = terrainHeight(centerX, z)
        const rim = terrainHeight(centerX + CANYON_WALL_HALF + 40, z)
        assert.ok(floor < 130 && rim > 400 && rim - floor > 300)
        checked += 1
      }
    }
    assert.ok(checked > 3)
  })

  it('places waterfalls on canyon walls and changes with the seed', () => {
    setWorldSeed(0x4c414e44)
    const falls = Array.from({ length: 25 }, (_, index) => generateWaterfalls((index % 5) * 6000 - 12000, Math.floor(index / 5) * 6000 - 12000)).flat()
    assert.ok(falls.length > 0)
    assert.ok(falls.every((fall) => fall.topY - fall.bottomY >= 250))
    const before = terrainHeight(1500, 1500)
    setWorldSeed(0x12345678)
    assert.notEqual(before, terrainHeight(1500, 1500))
    setWorldSeed(0x4c414e44)
  })
})

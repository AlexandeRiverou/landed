import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  generateFlyingThings,
  generateCannons,
  generateForest,
  generateRockField,
  highestTerrainAlongPath,
  terrainGridOrigin,
  terrainHeight,
  terrainNormalAt,
  waterCoverage,
} from './world'

describe('terrainHeight', () => {
  it('is deterministic for the same world position', () => {
    assert.equal(terrainHeight(128.5, -920.25), terrainHeight(128.5, -920.25))
  })

  it('produces finite, varied terrain within the expected elevation range', () => {
    const heights = Array.from({ length: 40 }, (_, index) => terrainHeight(index * 180, index * -97))
    assert.ok(heights.every(Number.isFinite))
    assert.ok(Math.min(...heights) >= 35)
    assert.ok(Math.max(...heights) <= 1600)
    assert.ok(Math.max(...heights) - Math.min(...heights) > 30)
  })

  it('raises mountain ridges above the surrounding terrain', () => {
    let highestPoint = 0
    for (let x = -6000; x <= 6000; x += 350) {
      for (let z = -6000; z <= 6000; z += 350) highestPoint = Math.max(highestPoint, terrainHeight(x, z))
    }
    assert.ok(highestPoint > 600)
  })

  it('finds the highest mountain across a swept flight path', () => {
    const start = terrainHeight(-5000, 0)
    const end = terrainHeight(5000, 0)
    const pathPeak = highestTerrainAlongPath(-5000, 0, 5000, 0)
    assert.ok(pathPeak >= start)
    assert.ok(pathPeak >= end)
  })

  it('keeps terrain vertices on fixed world-space grid coordinates', () => {
    const spacing = 12000 / 190
    assert.equal(terrainGridOrigin(10), 0)
    assert.equal(terrainGridOrigin(30), 0)
    assert.equal(terrainGridOrigin(45), spacing)
    assert.equal(terrainGridOrigin(90), terrainGridOrigin(45))
  })

  it('returns normalized surface directions for slope-aligned assets', () => {
    const normal = terrainNormalAt(-1800, 920)
    assert.ok(Math.abs(Math.hypot(normal.x, normal.y, normal.z) - 1) < 1e-9)
    assert.ok(normal.y > 0)
  })

  it('cuts a river and places lakes across the open world', () => {
    assert.ok(waterCoverage(0, 0) > 0.99)
    let foundLake = false
    for (let x = -10000; x <= 10000 && !foundLake; x += 250) {
      for (let z = -10000; z <= 10000; z += 250) {
        const riverX = Math.sin(z * 0.00072) * 550 + Math.sin(z * 0.00024) * 750
        if (Math.abs(x - riverX) > 300 && waterCoverage(x, z) > 0.95) {
          foundLake = true
          break
        }
      }
    }
    assert.ok(foundLake)
  })

  it('generates repeatable forest stands on dry, moderate slopes', () => {
    const forest = generateForest(0, 0, 400)
    assert.deepEqual(forest, generateForest(0, 0, 400))
    assert.ok(forest.length > 40)
    assert.ok(forest.every((tree) => tree.height >= 130 && tree.height <= 600))
    assert.ok(forest.every((tree) => waterCoverage(tree.x, tree.z) <= 0.05))
    assert.ok(new Set(forest.map((tree) => tree.kind)).size > 1)
  })

  it('scatters repeatable rock outcrops across high ground', () => {
    const rocks = generateRockField(0, 0, 320)
    assert.deepEqual(rocks, generateRockField(0, 0, 320))
    assert.ok(rocks.length > 8)
    assert.ok(rocks.every((rock) => rock.height >= 520 && waterCoverage(rock.x, rock.z) <= 0.05))
  })

  it('places repeatable cannons on dry high ground', () => {
    const cannons = generateCannons(0, 0, 12)
    assert.deepEqual(cannons, generateCannons(0, 0, 12))
    assert.ok(cannons.length > 0)
    assert.ok(cannons.every((cannon) => cannon.height >= 780 && waterCoverage(cannon.x, cannon.z) <= 0.05))
  })

  it('spawns deterministic flying traffic clear of terrain', () => {
    const traffic = generateFlyingThings(0, 0, 12)
    assert.deepEqual(traffic, generateFlyingThings(0, 0, 12))
    assert.ok(traffic.some((thing) => thing.kind === 'birds'))
    assert.ok(traffic.some((thing) => thing.kind === 'airplane'))
    assert.ok(traffic.some((thing) => thing.kind === 'balloon'))
    assert.ok(traffic.every((thing) => thing.y > terrainHeight(thing.x, thing.z)))
  })
})

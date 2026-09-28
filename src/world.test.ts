import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateForest, generateRockField, terrainHeight, waterCoverage } from './world'

describe('terrainHeight', () => {
  it('is deterministic for the same world position', () => {
    assert.equal(terrainHeight(128.5, -920.25), terrainHeight(128.5, -920.25))
  })

  it('produces finite, varied terrain within the expected elevation range', () => {
    const heights = Array.from({ length: 40 }, (_, index) => terrainHeight(index * 180, index * -97))
    assert.ok(heights.every(Number.isFinite))
    assert.ok(Math.min(...heights) >= 35)
    assert.ok(Math.max(...heights) <= 1080)
    assert.ok(Math.max(...heights) - Math.min(...heights) > 30)
  })

  it('raises mountain ridges above the surrounding terrain', () => {
    let highestPoint = 0
    for (let x = -6000; x <= 6000; x += 350) {
      for (let z = -6000; z <= 6000; z += 350) highestPoint = Math.max(highestPoint, terrainHeight(x, z))
    }
    assert.ok(highestPoint > 600)
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
})

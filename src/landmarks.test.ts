import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyLandscapeChange, createLandscape, generateLandmarks, LANDMARK_CAP, LANDMARK_KINDS, LANDMARKS, LANDSCAPE_CHANGES, landscapeChangeFor, MAX_ACTIVE_KINDS,
} from './landmarks'
import { generateCannons, generateForest, generateRockField, generateTowers, setWorldSeed, terrainHeight } from './world'

describe('landscape changes', () => {
  it('has many unique changes and a catalog of landmark kinds', () => {
    assert.ok(LANDSCAPE_CHANGES.length >= 20)
    assert.equal(new Set(LANDSCAPE_CHANGES.map((change) => change.id)).size, LANDSCAPE_CHANGES.length)
    assert.equal(new Set(LANDSCAPE_CHANGES.map((change) => change.title)).size, LANDSCAPE_CHANGES.length)
    assert.ok(LANDMARK_KINDS.length >= 16)
    assert.ok(LANDMARK_KINDS.every((kind) => LANDMARKS[kind].height > 0 && LANDMARKS[kind].radius > 0))
  })

  it('plays every change once per cycle in a repeatable order and never opens with the tidy-up', () => {
    const cycle = Array.from({ length: LANDSCAPE_CHANGES.length }, (_, index) => landscapeChangeFor(index, 99))
    assert.equal(new Set(cycle.map((change) => change.id)).size, LANDSCAPE_CHANGES.length)
    assert.deepEqual(cycle, Array.from({ length: LANDSCAPE_CHANGES.length }, (_, index) => landscapeChangeFor(index, 99)))
    assert.notEqual(cycle[0].id, 'great-tidy')
  })

  it('keeps densities and active kinds inside hard limits however long you play', () => {
    const state = createLandscape()
    for (let index = 0; index < 400; index += 1) {
      applyLandscapeChange(state, landscapeChangeFor(index, 7))
      assert.ok(state.kinds.length <= MAX_ACTIVE_KINDS)
      for (const density of [state.treeDensity, state.rockDensity, state.towerDensity, state.cannonDensity]) assert.ok(density >= 0.15 && density <= 2.5)
    }
    assert.equal(state.version, 400)
  })

  it('swaps out the oldest kind when a new one arrives and clears on the great tidy', () => {
    const state = createLandscape()
    const adds = LANDSCAPE_CHANGES.filter((change) => change.add)
    for (const change of adds) applyLandscapeChange(state, change)
    assert.equal(state.kinds.length, MAX_ACTIVE_KINDS)
    applyLandscapeChange(state, LANDSCAPE_CHANGES.find((change) => change.id === 'great-tidy')!)
    assert.deepEqual(state.kinds, [])
    assert.equal(state.treeDensity, 1)
  })
})

describe('landmark layout', () => {
  it('is empty with no active kinds, repeatable, capped, and uses only active kinds', () => {
    setWorldSeed(0x4c414e44)
    assert.equal(generateLandmarks(0, 0, []).length, 0)
    const kinds = LANDMARK_KINDS.slice(0, MAX_ACTIVE_KINDS)
    const total = Array.from({ length: 12 }, (_, index) => generateLandmarks(index * 6000, -index * 4000, kinds))
    assert.deepEqual(total[0], generateLandmarks(0, 0, kinds))
    assert.ok(total.every((sites) => sites.length <= LANDMARK_CAP))
    assert.ok(total.some((sites) => sites.length > 4))
    assert.ok(total.flat().every((site) => kinds.includes(site.kind)))
  })

  it('keeps one kind from taking over a region', () => {
    setWorldSeed(0x4c414e44)
    const kinds = ['floating-island', 'windmill', 'pyramid', 'obelisk', 'tiki'] as const
    for (let index = 0; index < 8; index += 1) {
      const sites = generateLandmarks(index * 6000, index * 2500, kinds)
      const counts = new Map<string, number>()
      for (const site of sites) counts.set(site.kind, (counts.get(site.kind) ?? 0) + 1)
      assert.ok([...counts.values()].every((count) => count <= Math.ceil(LANDMARK_CAP / 3)))
    }
  })

  it('stands landmarks on the ground and floats only the islands', () => {
    setWorldSeed(0x4c414e44)
    const sites = Array.from({ length: 12 }, (_, index) => generateLandmarks(index * 6000, index * 3000, LANDMARK_KINDS)).flat()
    assert.ok(sites.length > 10)
    for (const site of sites) {
      const ground = terrainHeight(site.x, site.z)
      if (site.kind === 'floating-island') assert.ok(site.y > ground + 300)
      else assert.equal(site.y, ground)
    }
  })

  it('lets density multipliers thin and thicken the existing assets', () => {
    setWorldSeed(0x4c414e44)
    const count = (build: (density: number) => unknown[]) => [build(0.3).length, build(1).length, build(2).length]
    const trees = count((density) => generateForest(0, 0, 2400, density))
    assert.ok(trees[0] < trees[1] && trees[1] < trees[2])
    const rocks = count((density) => generateRockField(0, 0, 420, density))
    assert.ok(rocks[0] <= rocks[1] && rocks[1] <= rocks[2])
    const towers = Array.from({ length: 6 }, (_, index) => [generateTowers(index * 6000, 0, 40, 0.2).length, generateTowers(index * 6000, 0, 40, 2.2).length])
    assert.ok(towers.reduce((sum, pair) => sum + pair[1], 0) > towers.reduce((sum, pair) => sum + pair[0], 0))
    const cannons = Array.from({ length: 6 }, (_, index) => [generateCannons(index * 6000, 0, 40, 0.2).length, generateCannons(index * 6000, 0, 40, 2.5).length])
    assert.ok(cannons.reduce((sum, pair) => sum + pair[1], 0) >= cannons.reduce((sum, pair) => sum + pair[0], 0))
  })
})

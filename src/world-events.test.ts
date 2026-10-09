import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { worldEventCount, worldEventForObjective } from './world-events'

describe('objective world events', () => {
  it('cycles through every event in a deterministic shuffled order', () => {
    const eventCount = worldEventCount()
    const firstCycle = Array.from({ length: eventCount }, (_, index) => worldEventForObjective(index))
    assert.deepEqual(firstCycle, Array.from({ length: eventCount }, (_, index) => worldEventForObjective(index)))
    assert.equal(new Set(firstCycle.map((event) => event.id)).size, eventCount)
    assert.equal(new Set(firstCycle.map((event) => event.title)).size, eventCount)
  })

  it('avoids repeating the last scene when a new event cycle begins', () => {
    const eventCount = worldEventCount()
    assert.notEqual(
      worldEventForObjective(eventCount - 1).id,
      worldEventForObjective(eventCount).id,
    )
  })

  it('offers a big roster where every event is visually and verbally unique', () => {
    const events = Array.from({ length: worldEventCount() }, (_, index) => worldEventForObjective(index))
    assert.ok(events.length >= 24)
    assert.equal(new Set(events.map((event) => event.message)).size, events.length)
    const looks = events.map((event) => [event.skyTop, event.skyHorizon, event.groundTint, event.waterTint, event.particles, event.moonColor, event.moonScale, event.rainColor, event.disco].join('|'))
    assert.equal(new Set(looks).size, events.length)
  })

  it('keeps the special effects valid and a few events with real gameplay twists', () => {
    const events = Array.from({ length: worldEventCount() }, (_, index) => worldEventForObjective(index))
    for (const event of events) {
      assert.ok(event.scoreMultiplier >= 1 && event.scoreMultiplier <= 3)
      assert.ok(event.moonScale >= 1 && event.moonScale <= 5)
      assert.ok(event.night >= 0 && event.night <= 1 && event.storm >= 0 && event.storm <= 1)
      if (event.rainColor !== null) assert.equal(event.rain, true)
      if (event.moonColor !== null) assert.equal(event.moon, true)
    }
    assert.ok(events.some((event) => event.scoreMultiplier > 1))
    assert.ok(events.some((event) => event.peace))
    assert.ok(events.some((event) => event.disco))
    assert.ok(new Set(events.map((event) => event.particles).filter(Boolean)).size >= 8)
  })

  it('includes both night skies and weather events', () => {
    const events = Array.from({ length: worldEventCount() }, (_, index) => worldEventForObjective(index))
    assert.ok(events.some((event) => event.night > 0 && event.moon))
    assert.ok(events.some((event) => event.rain && event.storm > 0))
    assert.ok(events.some((event) => event.aurora > 0))
    assert.ok(events.some((event) => event.asteroids))
  })
})
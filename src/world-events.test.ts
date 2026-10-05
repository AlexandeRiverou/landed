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

  it('includes both night skies and weather events', () => {
    const events = Array.from({ length: worldEventCount() }, (_, index) => worldEventForObjective(index))
    assert.ok(events.some((event) => event.night > 0 && event.moon))
    assert.ok(events.some((event) => event.rain && event.storm > 0))
    assert.ok(events.some((event) => event.aurora > 0))
    assert.ok(events.some((event) => event.asteroids))
  })
})
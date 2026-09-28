import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFlightState, stepFlight } from './flight'
import { terrainHeight } from './world'

describe('flight state', () => {
  it('cruises forward without input', () => {
    const flight = createFlightState()
    const startZ = flight.z
    stepFlight(flight, { roll: 0, pitch: 0 }, 0.05)
    assert.ok(flight.z < startZ)
    assert.equal(flight.heading, 0)
  })

  it('banks into a turn and changes heading', () => {
    const flight = createFlightState()
    for (let frame = 0; frame < 30; frame += 1) stepFlight(flight, { roll: -1, pitch: 0 }, 0.05)
    assert.ok(flight.bank < 0)
    assert.ok(flight.heading > 0)
    assert.ok(flight.x < 0)
  })

  it('keeps the glider above terrain and below its ceiling', () => {
    const flight = createFlightState()
    flight.y = 0
    stepFlight(flight, { roll: 0, pitch: -1 }, 1)
    assert.ok(flight.y >= terrainHeight(flight.x, flight.z) + 170)
    flight.y = 3000
    stepFlight(flight, { roll: 0, pitch: 0 }, 0.05)
    assert.ok(flight.y <= 2400)
  })

  it('caps a large frame delta to keep control motion stable', () => {
    const flight = createFlightState()
    stepFlight(flight, { roll: 1, pitch: 1 }, 5)
    assert.ok(flight.z > -3)
    assert.ok(flight.bank < 0.1)
  })
})

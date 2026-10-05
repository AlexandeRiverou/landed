import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFlightState, stepFlight } from './flight'
import { highestTerrainAlongPath, terrainHeight } from './world'

describe('flight state', () => {
  it('reports a cliff scrape when a sheer wall forces the glider upward', () => {
    const low = createFlightState()
    low.y = 0
    assert.equal(stepFlight(low, { roll: 0, pitch: 0, boost: false }, 0.05), true)
    assert.ok(low.y > terrainHeight(low.x, low.z))
    assert.equal(stepFlight(createFlightState(), { roll: 0, pitch: 0, boost: false }, 0.05), false)
  })
  it('cruises forward without input', () => {
    const flight = createFlightState()
    const startZ = flight.z
    stepFlight(flight, { roll: 0, pitch: 0, boost: false }, 0.05)
    assert.ok(flight.z < startZ)
    assert.equal(flight.heading, 0)
  })

  it('banks into a turn and changes heading', () => {
    const flight = createFlightState()
    for (let frame = 0; frame < 30; frame += 1) stepFlight(flight, { roll: -1, pitch: 0, boost: false }, 0.05)
    assert.ok(flight.bank > 0)
    assert.ok(flight.heading > 0)
    assert.ok(flight.x < 0)
  })

  it('banks right and turns toward the right side of the world', () => {
    const flight = createFlightState()
    for (let frame = 0; frame < 30; frame += 1) stepFlight(flight, { roll: 1, pitch: 0, boost: false }, 0.05)
    assert.ok(flight.bank < 0)
    assert.ok(flight.heading < 0)
    assert.ok(flight.x > 0)
  })

  it('keeps the glider above terrain and below its ceiling', () => {
    const flight = createFlightState()
    flight.y = 0
    stepFlight(flight, { roll: 0, pitch: -1, boost: false }, 1)
    assert.ok(flight.y >= terrainHeight(flight.x, flight.z) + 170)
    flight.y = 3000
    stepFlight(flight, { roll: 0, pitch: 0, boost: false }, 0.05)
    assert.ok(flight.y <= 2400)
  })

  it('starts with gentle climb and descent, then builds authority while held', () => {
    const flight = createFlightState()
    const startY = flight.y
    for (let frame = 0; frame < 10; frame += 1) stepFlight(flight, { roll: 0, pitch: 1, boost: false }, 0.05)
    const initialClimb = flight.y - startY
    assert.ok(initialClimb > 0)
    assert.ok(initialClimb < 10)

    for (let frame = 0; frame < 40; frame += 1) stepFlight(flight, { roll: 0, pitch: 1, boost: false }, 0.05)
    const climbedY = flight.y
    assert.ok(climbedY - startY > initialClimb + 30)
    assert.ok(flight.pitch <= 0.48)

    for (let frame = 0; frame < 10; frame += 1) stepFlight(flight, { roll: 0, pitch: 0, boost: false }, 0.05)
    const beforeDescent = flight.y
    for (let frame = 0; frame < 10; frame += 1) stepFlight(flight, { roll: 0, pitch: -1, boost: false }, 0.05)
    const initialDescent = beforeDescent - flight.y
    assert.ok(Math.abs(initialDescent) < 10)
    for (let frame = 0; frame < 40; frame += 1) stepFlight(flight, { roll: 0, pitch: -1, boost: false }, 0.05)
    assert.ok(flight.y < beforeDescent - initialDescent - 30)
    assert.ok(flight.pitch >= -0.48)
  })

  it('clears mountain ridges along the full swept flight segment', () => {
    const flight = createFlightState()
    flight.x = -5000
    flight.heading = -Math.PI / 2
    flight.y = 500
    const startX = flight.x
    const startZ = flight.z
    stepFlight(flight, { roll: 0, pitch: 0, boost: true }, 0.05)
    assert.ok(flight.y >= highestTerrainAlongPath(startX, startZ, flight.x, flight.z) + 170)
  })

  it('caps a large frame delta to keep control motion stable', () => {
    const flight = createFlightState()
    stepFlight(flight, { roll: 1, pitch: 1, boost: false }, 5)
    assert.ok(flight.z > -3.5)
    assert.ok(flight.bank < 0.2)
  })

  it('builds boost over several seconds, caps at a higher speed limit, then coasts to cruise', () => {
    const flight = createFlightState()
    for (let frame = 0; frame < 20; frame += 1) stepFlight(flight, { roll: 0, pitch: 0, boost: true }, 0.05)
    const firstSecondSpeed = flight.speed
    assert.ok(firstSecondSpeed > 95)
    assert.ok(firstSecondSpeed < 110)

    for (let frame = 0; frame < 80; frame += 1) stepFlight(flight, { roll: 0, pitch: 0, boost: true }, 0.05)
    assert.ok(flight.speed > firstSecondSpeed)
    assert.equal(flight.speed, 192)

    for (let frame = 0; frame < 100; frame += 1) stepFlight(flight, { roll: 0, pitch: 0, boost: false }, 0.05)
    assert.equal(flight.speed, 64)
  })
})

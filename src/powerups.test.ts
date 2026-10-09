import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activatePowerUp, createEffects, drainPowerUps, enemyTimeScale, fireCooldownScale, inPickupRange, isPowerUpActive, nextSpawnDelayMs, pickPowerUpKind,
  pickupExpired, pickupFading, POWERUP_HIT_PENALTY_MS, POWERUP_KINDS, POWERUP_LIFETIME_MS, powerUpRemaining, powerUpSpawnPoint, POWERUPS, scoreBoost, shiftPowerUpTimers, shotFan,
} from './powerups'

const sequence = (values: number[]) => {
  let index = 0
  return () => values[index++ % values.length]
}

describe('power-ups', () => {
  it('offers a varied roster with unique names and colors', () => {
    assert.ok(POWERUP_KINDS.length >= 8)
    assert.equal(new Set(POWERUP_KINDS.map((kind) => POWERUPS[kind].name)).size, POWERUP_KINDS.length)
    assert.equal(new Set(POWERUP_KINDS.map((kind) => POWERUPS[kind].color)).size, POWERUP_KINDS.length)
    assert.ok(POWERUP_KINDS.some((kind) => POWERUPS[kind].seconds === 0))
  })

  it('picks every kind eventually and favors common ones', () => {
    const counts = Object.fromEntries(POWERUP_KINDS.map((kind) => [kind, 0]))
    for (let index = 0; index < 2000; index += 1) counts[pickPowerUpKind(() => (index * 0.61803398875) % 1)] += 1
    assert.ok(POWERUP_KINDS.every((kind) => counts[kind] > 0))
    assert.ok(counts.shield > counts.nova)
  })

  it('spawns ahead of the player, then expires and warns before leaving', () => {
    const player = { x: 0, y: 1500, z: 0, heading: 0 }
    const pickup = powerUpSpawnPoint(player, 'shield', 1000, sequence([0.5, 0.5, 0.5]))
    assert.ok(pickup.z < -1000)
    assert.equal(pickup.expiresAt, 1000 + POWERUP_LIFETIME_MS)
    assert.equal(pickupFading(pickup, 1000), false)
    assert.equal(pickupFading(pickup, pickup.expiresAt - 1000), true)
    assert.equal(pickupExpired(pickup, pickup.expiresAt - 1), false)
    assert.equal(pickupExpired(pickup, pickup.expiresAt), true)
  })

  it('can be taken only from close by', () => {
    const pickup = { kind: 'rapid' as const, x: 0, y: 0, z: -500, expiresAt: 1 }
    assert.equal(inPickupRange(pickup, { x: 0, y: 0, z: -450 }), true)
    assert.equal(inPickupRange(pickup, { x: 0, y: 0, z: 0 }), false)
  })

  it('activates timed effects, refreshes them, and treats instant ones as one-shots', () => {
    const effects = createEffects()
    assert.equal(activatePowerUp(effects, 'nova', 0), false)
    assert.equal(isPowerUpActive(effects, 'nova', 1), false)
    assert.equal(activatePowerUp(effects, 'rapid', 0), true)
    assert.equal(isPowerUpActive(effects, 'rapid', POWERUPS.rapid.seconds * 1000 - 1), true)
    assert.equal(isPowerUpActive(effects, 'rapid', POWERUPS.rapid.seconds * 1000), false)
    activatePowerUp(effects, 'rapid', 8000)
    assert.equal(powerUpRemaining(effects, 'rapid', 8000), POWERUPS.rapid.seconds)
  })

  it('lasts five times longer than the original timings', () => {
    assert.equal(POWERUPS.rapid.seconds, 60)
    assert.equal(POWERUPS.turbo.seconds, 30)
    assert.equal(POWERUPS.goose.seconds, 75)
  })

  it('loses time on every running effect after an enemy hit and expires short ones', () => {
    const effects = createEffects()
    activatePowerUp(effects, 'rapid', 0)
    activatePowerUp(effects, 'turbo', 0)
    assert.equal(drainPowerUps(effects, 1000, POWERUP_HIT_PENALTY_MS), true)
    assert.equal(powerUpRemaining(effects, 'rapid', 1000), POWERUPS.rapid.seconds - 1 - POWERUP_HIT_PENALTY_MS / 1000)
    assert.equal(drainPowerUps(effects, 1000, 100000), true)
    assert.equal(isPowerUpActive(effects, 'turbo', 1000), false)
    assert.equal(drainPowerUps(effects, 1000, POWERUP_HIT_PENALTY_MS), false)
  })

  it('exposes gameplay modifiers only while active', () => {
    const effects = createEffects()
    assert.deepEqual([fireCooldownScale(effects, 0), scoreBoost(effects, 0), enemyTimeScale(effects, 0), shotFan(effects, 0)], [1, 1, 1, [0]])
    for (const kind of ['rapid', 'goose', 'slowmo', 'spread'] as const) activatePowerUp(effects, kind, 0)
    assert.ok(fireCooldownScale(effects, 1) < 0.5)
    assert.equal(scoreBoost(effects, 1), 2)
    assert.ok(enemyTimeScale(effects, 1) < 0.5)
    assert.equal(shotFan(effects, 1).length, 3)
  })

  it('freezes timers while paused and spaces spawns sensibly', () => {
    const effects = createEffects()
    activatePowerUp(effects, 'turbo', 0)
    const pickup = { kind: 'shield' as const, x: 0, y: 0, z: 0, expiresAt: 5000 }
    shiftPowerUpTimers(effects, [pickup], 3000)
    assert.equal(effects.turbo, POWERUPS.turbo.seconds * 1000 + 3000)
    assert.equal(pickup.expiresAt, 8000)
    assert.equal(effects.shield, 0)
    for (const roll of [0, 0.5, 0.999]) assert.ok(nextSpawnDelayMs(() => roll) >= 12000 && nextSpawnDelayMs(() => roll) < 26000)
  })
})

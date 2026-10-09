import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEnemy, ENEMY_KINDS, ENEMY_STATS, maxConcurrentEnemies, pickEnemyKind, stepEnemy } from './enemies'

const target = { x: 0, y: 1500, z: 0 }

describe('enemy roster', () => {
  it('has many distinct kinds with unlocks that rise with pops', () => {
    assert.ok(ENEMY_KINDS.length >= 8)
    assert.equal(new Set(ENEMY_KINDS.map((kind) => ENEMY_STATS[kind].name)).size, ENEMY_KINDS.length)
    const unlocks = ENEMY_KINDS.map((kind) => ENEMY_STATS[kind].unlockAt)
    assert.equal(Math.min(...unlocks), 0)
    assert.ok(new Set(unlocks).size >= 7)
    assert.ok(new Set(ENEMY_KINDS.map((kind) => ENEMY_STATS[kind].pattern)).size >= 5)
  })

  it('keeps the crowd small and grows it slowly', () => {
    assert.deepEqual([0, 9, 10, 25, 99].map(maxConcurrentEnemies), [1, 1, 2, 3, 4])
  })

  it('only offers unlocked kinds and respects per-kind limits', () => {
    let seed = 1
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let index = 0; index < 200; index += 1) assert.equal(pickEnemyKind(0, {}, random), 'drone')
    const seen = new Set<string>()
    for (let index = 0; index < 600; index += 1) seen.add(pickEnemyKind(60, {}, random))
    assert.equal(seen.size, ENEMY_KINDS.length)
    for (let index = 0; index < 200; index += 1) assert.notEqual(pickEnemyKind(60, { sniper: 1, spinner: 1 }, random) === 'sniper', true)
    assert.equal(pickEnemyKind(60, Object.fromEntries(ENEMY_KINDS.map((kind) => [kind, 9])), random), 'drone')
  })

  it('snipers telegraph before firing and keep their distance', () => {
    const sniper = createEnemy(0, 1500, 900, 0, 'sniper')
    sniper.cooldown = 0
    assert.equal(stepEnemy(sniper, target, 0.05), false)
    assert.ok(sniper.charge > 1)
    let fired = false
    for (let frame = 0; frame < 40 && !fired; frame += 1) fired = stepEnemy(sniper, target, 0.05)
    assert.equal(fired, true)
    assert.equal(sniper.charge, 0)
    const far = createEnemy(900, 1500, 0, 0, 'sniper')
    for (let frame = 0; frame < 600; frame += 1) stepEnemy(far, target, 0.05)
    assert.ok(Math.hypot(far.x, far.z) > 400)
  })

  it('spinners and minelayers fire without needing to face the player', () => {
    const spinner = createEnemy(0, 1500, -500, 0, 'spinner')
    spinner.heading = 0
    spinner.cooldown = 0
    assert.equal(stepEnemy(spinner, target, 0.016), true)
    const mine = createEnemy(0, 1500, 300, 0, 'minelayer')
    mine.cooldown = 0
    assert.equal(stepEnemy(mine, target, 0.016), true)
  })

  it('kamikazes never shoot and close in quickly', () => {
    const kamikaze = createEnemy(1500, 1500, 0, 0, 'kamikaze')
    kamikaze.cooldown = 0
    for (let frame = 0; frame < 100; frame += 1) assert.equal(stepEnemy(kamikaze, target, 0.05), false)
    assert.ok(Math.hypot(kamikaze.x, kamikaze.z) < 1000)
  })

  it('weavers sway from side to side while chasing', () => {
    const weaver = createEnemy(0, 1500, 2000, 0, 'weaver')
    const headings: number[] = []
    for (let frame = 0; frame < 120; frame += 1) {
      stepEnemy(weaver, target, 0.05)
      headings.push(weaver.heading)
    }
    assert.ok(Math.max(...headings) - Math.min(...headings) > 0.05)
  })
})

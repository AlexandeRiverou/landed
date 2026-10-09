import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BOSS_STATS, bossDue, bossEnraged, bossKindFor, createBoss, damageBoss, stepBoss } from './bosses'
import { terrainHeight } from './world'

const target = { x: 0, y: 1500, z: 0 }

describe('bosses', () => {
  it('arrives after every third ring', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 6].map(bossDue), [false, false, false, true, false, true])
  })

  it('cycles through dragon, mothership, and manta and returns tougher', () => {
    assert.deepEqual([0, 1, 2, 3].map(bossKindFor), ['dragon', 'mothership', 'manta', 'dragon'])
    assert.ok(createBoss(3, 0, 0, 0).maxHealth > createBoss(0, 0, 0, 0).maxHealth)
  })

  it('orbits the player at its own radius and stays above the ground', () => {
    for (const index of [0, 1, 2]) {
      const boss = createBoss(index, 2000, 1500, 0)
      for (let frame = 0; frame < 2400; frame += 1) {
        stepBoss(boss, target, 0.05)
        assert.ok(boss.y >= terrainHeight(boss.x, boss.z) + 220)
      }
      const radius = BOSS_STATS[boss.kind].orbit
      assert.ok(Math.abs(Math.hypot(boss.x - target.x, boss.z - target.z) - radius) < 120)
    }
  })

  it('fires on its interval and attacks faster and wider once enraged', () => {
    const boss = createBoss(0, 700, 1500, 0)
    let first = 0
    let calm = 0
    for (let frame = 0; frame < 400; frame += 1) {
      const attack = stepBoss(boss, target, 0.05)
      if (attack) {
        first += 1
        assert.equal(attack.count, BOSS_STATS.dragon.count)
      }
    }
    assert.ok(first >= 4 && first <= 6)
    damageBoss(boss, boss.maxHealth / 2)
    assert.equal(bossEnraged(boss), true)
    for (let frame = 0; frame < 400; frame += 1) {
      const attack = stepBoss(boss, target, 0.05)
      if (attack) {
        calm += 1
        assert.equal(attack.count, BOSS_STATS.dragon.count + 2)
      }
    }
    assert.ok(calm > first)
  })

  it('is defeated when its health runs out', () => {
    const boss = createBoss(2, 0, 0, 0)
    for (let hit = 0; hit < boss.maxHealth - 1; hit += 1) assert.equal(damageBoss(boss), false)
    assert.equal(damageBoss(boss), true)
    assert.equal(boss.health, 0)
  })
})

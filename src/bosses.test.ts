import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BOSS_ORDER, BOSS_STATS, bossDue, bossEnraged, bossKindFor, createBoss, damageBoss, stepBoss, type BossAttack } from './bosses'
import { terrainHeight } from './world'

const target = { x: 0, y: 1500, z: 0 }

function runFor(boss: ReturnType<typeof createBoss>, seconds: number): BossAttack[] {
  const attacks: BossAttack[] = []
  for (let frame = 0; frame < seconds * 20; frame += 1) {
    const attack = stepBoss(boss, target, 0.05)
    if (attack) attacks.push(attack)
  }
  return attacks
}

describe('bosses', () => {
  it('arrives after every third ring', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 6].map(bossDue), [false, false, false, true, false, true])
  })

  it('has seven different bosses that cycle and return tougher', () => {
    assert.equal(BOSS_ORDER.length, 7)
    assert.equal(new Set(BOSS_ORDER.map((kind) => BOSS_STATS[kind].name)).size, 7)
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(bossKindFor), [...BOSS_ORDER, 'dragon'])
    assert.ok(createBoss(7, 0, 0, 0).maxHealth > createBoss(0, 0, 0, 0).maxHealth)
    assert.equal(createBoss(7, 0, 0, 0).tier, 1)
  })

  it('gives bosses different attack mixes', () => {
    const mixes = BOSS_ORDER.map((kind) => [...new Set(BOSS_STATS[kind].patterns)].sort().join('+'))
    assert.ok(new Set(mixes).size >= 5)
    const all = new Set(BOSS_ORDER.flatMap((kind) => BOSS_STATS[kind].patterns))
    assert.deepEqual([...all].sort(), ['fan', 'ring', 'rocks', 'spiral', 'stream'])
  })

  it('orbits the player at its own radius and stays above the ground', () => {
    for (let index = 0; index < BOSS_ORDER.length; index += 1) {
      const boss = createBoss(index, 2000, 1500, 0)
      for (let frame = 0; frame < 2400; frame += 1) {
        stepBoss(boss, target, 0.05)
        assert.ok(boss.y >= terrainHeight(boss.x, boss.z) + 220)
      }
      assert.ok(Math.abs(Math.hypot(boss.x - target.x, boss.z - target.z) - BOSS_STATS[boss.kind].orbit) < 140)
    }
  })

  it('cycles its attack patterns in order', () => {
    const boss = createBoss(0, 750, 1500, 0)
    const patterns = runFor(boss, 40).map((attack) => attack.pattern)
    assert.deepEqual(patterns.slice(0, 3), ['fan', 'fan', 'ring'])
  })

  it('fires sustained bursts for streams and spirals', () => {
    const manta = createBoss(2, 900, 1500, 0)
    const attacks = runFor(manta, 6)
    assert.ok(attacks.filter((attack) => attack.pattern === 'stream').length >= 6)
    const eye = createBoss(6, 1050, 1500, 0)
    assert.ok(runFor(eye, 8).filter((attack) => attack.pattern === 'spiral').length >= 18)
  })

  it('attacks faster and harder once enraged', () => {
    const calm = createBoss(0, 750, 1500, 0)
    const enraged = createBoss(0, 750, 1500, 0)
    damageBoss(enraged, enraged.maxHealth / 2)
    assert.equal(bossEnraged(enraged), true)
    const calmAttacks = runFor(calm, 40)
    const angryAttacks = runFor(enraged, 40)
    assert.ok(angryAttacks.length > calmAttacks.length)
    const calmFan = calmAttacks.find((attack) => attack.pattern === 'fan')!
    const angryFan = angryAttacks.find((attack) => attack.pattern === 'fan')!
    assert.equal(angryFan.count, calmFan.count + 2)
  })

  it('makes rock volleys big and slow and rings wide', () => {
    const colossus = createBoss(4, 1000, 1500, 0)
    const attacks = runFor(colossus, 20)
    const rock = attacks.find((attack) => attack.pattern === 'rocks')!
    assert.ok(rock.size > 1.5 && rock.speed < BOSS_STATS.colossus.bulletSpeed)
    assert.ok(attacks.find((attack) => attack.pattern === 'ring')!.count >= 12)
  })

  it('is defeated when its health runs out', () => {
    const boss = createBoss(2, 0, 0, 0)
    for (let hit = 0; hit < boss.maxHealth - 1; hit += 1) assert.equal(damageBoss(boss), false)
    assert.equal(damageBoss(boss), true)
    assert.equal(boss.health, 0)
  })
})

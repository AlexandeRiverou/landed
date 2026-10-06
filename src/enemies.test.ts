import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createEnemy, ENEMY_FIRE_INTERVAL, ENEMY_LOITER_TIME, stepEnemy } from './enemies'
import { terrainHeight } from './world'

describe('enemy chaser', () => {
  it('turns toward a target and closes the distance', () => {
    const enemy = createEnemy(3000, 1500, 0)
    const target = { x: 0, y: 1500, z: 0 }
    const start = Math.hypot(enemy.x - target.x, enemy.z - target.z)
    for (let frame = 0; frame < 200; frame += 1) stepEnemy(enemy, target, 0.05)
    assert.ok(Math.hypot(enemy.x - target.x, enemy.z - target.z) < start)
  })

  it('fires only when aimed, in range, and off cooldown', () => {
    const target = { x: 0, y: 1500, z: 0 }
    const aimed = createEnemy(0, 1500, 600)
    aimed.cooldown = 0
    assert.equal(stepEnemy(aimed, target, 0.016), true)
    assert.equal(stepEnemy(aimed, target, 0.016), false)
    assert.ok(aimed.cooldown > ENEMY_FIRE_INTERVAL - 0.1)

    const faraway = createEnemy(0, 1500, 5000)
    faraway.cooldown = 0
    assert.equal(stepEnemy(faraway, target, 0.016), false)

    const facingAway = createEnemy(0, 1500, -600)
    facingAway.cooldown = 0
    assert.equal(stepEnemy(facingAway, target, 0.016), false)
  })

  it('stops chasing and firing for a while, then resumes', () => {
    const target = { x: 0, y: 1500, z: 0 }
    const enemy = createEnemy(0, 1500, 600)
    enemy.chasing = false
    enemy.modeTimer = ENEMY_LOITER_TIME
    enemy.cooldown = 0
    let fired = false
    for (let frame = 0; frame < 100; frame += 1) fired = stepEnemy(enemy, target, 0.05) || fired
    assert.equal(fired, false)
    assert.ok(enemy.speed < 30)
    for (let frame = 0; frame < 200; frame += 1) stepEnemy(enemy, target, 0.05)
    assert.equal(enemy.chasing, true)
  })

  it('stays above the terrain', () => {
    const enemy = createEnemy(0, 0, 0)
    for (let frame = 0; frame < 20; frame += 1) {
      stepEnemy(enemy, { x: 500, y: 0, z: -500 }, 0.05)
      assert.ok(enemy.y >= terrainHeight(enemy.x, enemy.z) + 90)
    }
  })
})

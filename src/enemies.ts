import { terrainHeight } from './world'

export interface Enemy {
  x: number
  y: number
  z: number
  heading: number
  speed: number
  cooldown: number
  phase: number
  health: number
  chasing: boolean
  modeTimer: number
  kind: EnemyKind
}

export type EnemyKind = 'drone' | 'interceptor' | 'gunship'

export interface EnemyStats {
  health: number
  turnRate: number
  far: number
  mid: number
  near: number
  fireInterval: number
  burst: number
  hitRadius: number
}

// Interceptors are quick and fragile, gunships are slow, tough, and fire spreads.
export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  drone: { health: 2, turnRate: 1.1, far: 95, mid: 70, near: 45, fireInterval: 5, burst: 1, hitRadius: 36 },
  interceptor: { health: 1, turnRate: 1.7, far: 125, mid: 100, near: 70, fireInterval: 6, burst: 1, hitRadius: 28 },
  gunship: { health: 4, turnRate: 0.55, far: 60, mid: 45, near: 30, fireInterval: 7, burst: 3, hitRadius: 58 },
}

export interface EnemyTarget {
  x: number
  y: number
  z: number
}

export const ENEMY_FIRE_RANGE = 1100
export const ENEMY_MIN_FIRE_RANGE = 180
export const ENEMY_FIRE_INTERVAL = 5
export const ENEMY_CHASE_TIME = 12
export const ENEMY_LOITER_TIME = 9
const ENEMY_MAX_AIM_ERROR = 0.22

export function createEnemy(x: number, y: number, z: number, phase = 0, kind: EnemyKind = 'drone'): Enemy {
  const stats = ENEMY_STATS[kind]
  return { x, y, z, heading: 0, speed: stats.far, cooldown: stats.fireInterval, phase, health: stats.health, chasing: true, modeTimer: ENEMY_CHASE_TIME, kind }
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

// Chases the target for a while, then loiters harmlessly; returns true on the frame it fires.
export function stepEnemy(enemy: Enemy, target: EnemyTarget, elapsed: number): boolean {
  const delta = Math.min(Math.max(elapsed, 0), 0.05)
  const stats = ENEMY_STATS[enemy.kind]
  enemy.modeTimer -= delta
  if (enemy.modeTimer <= 0) {
    enemy.chasing = !enemy.chasing
    enemy.modeTimer = enemy.chasing ? ENEMY_CHASE_TIME : ENEMY_LOITER_TIME
    enemy.cooldown = Math.max(enemy.cooldown, 2)
  }
  const dx = target.x - enemy.x
  const dz = target.z - enemy.z
  const distance = Math.hypot(dx, dz)
  const aimError = wrapAngle(Math.atan2(-dx, -dz) - enemy.heading)
  if (enemy.chasing) {
    const maxTurn = stats.turnRate * delta
    enemy.heading += Math.max(-maxTurn, Math.min(maxTurn, aimError))
    enemy.speed = distance > 700 ? stats.far : distance < 300 ? stats.near : stats.mid
  } else {
    enemy.heading += 0.4 * delta
    enemy.speed = 22
  }
  enemy.x -= Math.sin(enemy.heading) * enemy.speed * delta
  enemy.z -= Math.cos(enemy.heading) * enemy.speed * delta
  enemy.phase += delta
  const goal = enemy.chasing ? Math.max(target.y + Math.sin(enemy.phase * 0.7) * 70, terrainHeight(enemy.x, enemy.z) + 110) : enemy.y
  enemy.y += Math.max(-45 * delta, Math.min(45 * delta, goal - enemy.y))
  enemy.y = Math.max(enemy.y, terrainHeight(enemy.x, enemy.z) + 90)

  if (!enemy.chasing) return false
  enemy.cooldown -= delta
  if (enemy.cooldown > 0 || distance < ENEMY_MIN_FIRE_RANGE || distance > ENEMY_FIRE_RANGE || Math.abs(aimError) > ENEMY_MAX_AIM_ERROR) return false
  enemy.cooldown = stats.fireInterval
  return true
}

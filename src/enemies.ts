import { terrainHeight } from './world'

export type EnemyKind = 'drone' | 'interceptor' | 'weaver' | 'sniper' | 'spinner' | 'minelayer' | 'kamikaze' | 'gunship'
export type EnemyPattern = 'aimed' | 'spread' | 'snipe' | 'ring' | 'mine' | 'none'

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
  charge: number
}

export interface EnemyStats {
  name: string
  health: number
  turnRate: number
  far: number
  mid: number
  near: number
  fireInterval: number
  burst: number
  hitRadius: number
  pattern: EnemyPattern
  telegraph: number
  hold: number
  weave: number
  chase: number
  loiter: number
  unlockAt: number
  maxAlive: number
  weight: number
  bulletSpeed: number
  bulletSize: number
}

const base = { telegraph: 0, hold: 0, weave: 0, chase: 12, loiter: 9, bulletSpeed: 240, bulletSize: 2.5 }

// Tougher or stranger kinds unlock as the pop count grows, and most are limited to one at a time.
export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  drone: { ...base, name: 'DRONE', health: 2, turnRate: 1.1, far: 95, mid: 70, near: 45, fireInterval: 5, burst: 1, hitRadius: 36, pattern: 'aimed', unlockAt: 0, maxAlive: 2, weight: 4 },
  interceptor: { ...base, name: 'INTERCEPTOR', health: 1, turnRate: 1.7, far: 125, mid: 100, near: 70, fireInterval: 6, burst: 1, hitRadius: 28, pattern: 'aimed', unlockAt: 3, maxAlive: 1, weight: 3, bulletSpeed: 280 },
  weaver: { ...base, name: 'WEAVER', health: 2, turnRate: 1.4, far: 90, mid: 80, near: 60, fireInterval: 4.5, burst: 2, hitRadius: 32, pattern: 'spread', unlockAt: 6, maxAlive: 1, weight: 3, weave: 1.3 },
  sniper: { ...base, name: 'SNIPER', health: 2, turnRate: 0.9, far: 80, mid: 60, near: 45, fireInterval: 7, burst: 1, hitRadius: 30, pattern: 'snipe', unlockAt: 9, maxAlive: 1, weight: 2, telegraph: 1.4, hold: 1000, bulletSpeed: 560, bulletSize: 1.8, chase: 14, loiter: 7 },
  spinner: { ...base, name: 'SPINNER', health: 3, turnRate: 0.7, far: 70, mid: 55, near: 40, fireInterval: 8, burst: 10, hitRadius: 44, pattern: 'ring', unlockAt: 12, maxAlive: 1, weight: 2, hold: 650, bulletSpeed: 150, bulletSize: 3 },
  minelayer: { ...base, name: 'MINELAYER', health: 3, turnRate: 0.9, far: 80, mid: 70, near: 60, fireInterval: 2.6, burst: 1, hitRadius: 46, pattern: 'mine', unlockAt: 15, maxAlive: 1, weight: 2 },
  kamikaze: { ...base, name: 'KAMIKAZE', health: 1, turnRate: 2, far: 150, mid: 150, near: 150, fireInterval: 99, burst: 0, hitRadius: 30, pattern: 'none', unlockAt: 18, maxAlive: 1, weight: 2, chase: 7, loiter: 6 },
  gunship: { ...base, name: 'GUNSHIP', health: 4, turnRate: 0.55, far: 60, mid: 45, near: 30, fireInterval: 7, burst: 3, hitRadius: 58, pattern: 'spread', unlockAt: 24, maxAlive: 1, weight: 2 },
}

export const ENEMY_KINDS = Object.keys(ENEMY_STATS) as EnemyKind[]

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

// Few enemies at once: one at the start, one more for every ten pops, never above four.
export function maxConcurrentEnemies(pops: number): number {
  return Math.min(4, 1 + Math.floor(Math.max(0, pops) / 10))
}

export function pickEnemyKind(pops: number, alive: Partial<Record<EnemyKind, number>>, random: () => number): EnemyKind {
  const options = ENEMY_KINDS.filter((kind) => ENEMY_STATS[kind].unlockAt <= pops && (alive[kind] ?? 0) < ENEMY_STATS[kind].maxAlive)
  if (options.length === 0) return 'drone'
  const total = options.reduce((sum, kind) => sum + ENEMY_STATS[kind].weight, 0)
  let roll = random() * total
  for (const kind of options) {
    roll -= ENEMY_STATS[kind].weight
    if (roll < 0) return kind
  }
  return options[options.length - 1]
}

export function createEnemy(x: number, y: number, z: number, phase = 0, kind: EnemyKind = 'drone'): Enemy {
  const stats = ENEMY_STATS[kind]
  return { x, y, z, heading: 0, speed: stats.far, cooldown: stats.fireInterval, phase, health: stats.health, chasing: true, modeTimer: stats.chase, kind, charge: 0 }
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

// Chases for a while, then loiters harmlessly; returns true on the frame it fires.
export function stepEnemy(enemy: Enemy, target: EnemyTarget, elapsed: number): boolean {
  const delta = Math.min(Math.max(elapsed, 0), 0.05)
  const stats = ENEMY_STATS[enemy.kind]
  enemy.modeTimer -= delta
  if (enemy.modeTimer <= 0) {
    enemy.chasing = !enemy.chasing
    enemy.modeTimer = enemy.chasing ? stats.chase : stats.loiter
    enemy.cooldown = Math.max(enemy.cooldown, 2)
    enemy.charge = 0
  }
  const dx = target.x - enemy.x
  const dz = target.z - enemy.z
  const distance = Math.hypot(dx, dz)
  const bearing = Math.atan2(-dx, -dz)
  const aimError = wrapAngle(bearing - enemy.heading)
  if (enemy.chasing) {
    const holding = stats.hold > 0 && distance < stats.hold
    const desired = holding ? wrapAngle(bearing + (distance < stats.hold * 0.8 ? 2.2 : Math.PI / 2) - enemy.heading) : aimError
    const maxTurn = stats.turnRate * delta
    enemy.heading += Math.max(-maxTurn, Math.min(maxTurn, desired))
    if (stats.weave > 0) enemy.heading += Math.sin(enemy.phase * 2.4) * stats.weave * delta
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

  if (!enemy.chasing || stats.pattern === 'none') return false
  if (enemy.charge > 0) {
    enemy.charge -= delta
    if (enemy.charge > 0) return false
    enemy.charge = 0
    enemy.cooldown = stats.fireInterval
    return true
  }
  enemy.cooldown -= delta
  if (enemy.cooldown > 0) return false
  const aimless = stats.pattern === 'snipe' || stats.pattern === 'ring' || stats.pattern === 'mine'
  const range = stats.pattern === 'snipe' ? 1500 : ENEMY_FIRE_RANGE
  if (distance > range || (stats.pattern !== 'mine' && distance < ENEMY_MIN_FIRE_RANGE) || (!aimless && Math.abs(aimError) > ENEMY_MAX_AIM_ERROR)) return false
  if (stats.telegraph > 0) {
    enemy.charge = stats.telegraph
    return false
  }
  enemy.cooldown = stats.fireInterval
  return true
}

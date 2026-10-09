import { terrainHeight } from './world'

export type BossKind = 'dragon' | 'mothership' | 'manta'

export interface BossStats {
  name: string
  health: number
  hitRadius: number
  orbit: number
  speed: number
  count: number
  spread: number
  interval: number
  bulletSpeed: number
}

export const BOSS_EVERY = 3
export const BOSS_ORDER: readonly BossKind[] = ['dragon', 'mothership', 'manta']

export const BOSS_STATS: Record<BossKind, BossStats> = {
  dragon: { name: 'EMBERWING THE SKY DRAGON', health: 36, hitRadius: 110, orbit: 750, speed: 120, count: 5, spread: 0.11, interval: 3.4, bulletSpeed: 230 },
  mothership: { name: 'THE MOTHERSHIP "MILDLY HOSTILE"', health: 52, hitRadius: 210, orbit: 1150, speed: 70, count: 9, spread: 0.09, interval: 5, bulletSpeed: 220 },
  manta: { name: 'STORMRAY THE THUNDER MANTA', health: 44, hitRadius: 165, orbit: 900, speed: 95, count: 3, spread: 0.04, interval: 2.7, bulletSpeed: 260 },
}

export interface Boss {
  kind: BossKind
  index: number
  x: number
  y: number
  z: number
  heading: number
  health: number
  maxHealth: number
  angle: number
  cooldown: number
  phase: number
}

export interface BossAttack {
  count: number
  spread: number
  speed: number
}

export function bossDue(ringsKept: number): boolean {
  return ringsKept > 0 && ringsKept % BOSS_EVERY === 0
}

export function bossKindFor(index: number): BossKind {
  return BOSS_ORDER[index % BOSS_ORDER.length]
}

// Each full cycle of three bosses comes back tougher.
export function createBoss(index: number, x: number, y: number, z: number): Boss {
  const kind = bossKindFor(index)
  const maxHealth = Math.round(BOSS_STATS[kind].health * (1 + 0.25 * Math.floor(index / BOSS_ORDER.length)))
  return { kind, index, x, y, z, heading: 0, health: maxHealth, maxHealth, angle: 0, cooldown: 3, phase: 0 }
}

export function bossEnraged(boss: Boss): boolean {
  return boss.health <= boss.maxHealth / 2
}

// Returns true when the boss is defeated.
export function damageBoss(boss: Boss, amount = 1): boolean {
  boss.health = Math.max(0, boss.health - amount)
  return boss.health === 0
}

export function stepBoss(boss: Boss, target: { x: number; y: number; z: number }, elapsed: number): BossAttack | null {
  const delta = Math.min(Math.max(elapsed, 0), 0.05)
  const stats = BOSS_STATS[boss.kind]
  boss.phase += delta
  boss.angle += (stats.speed / stats.orbit) * delta * (bossEnraged(boss) ? 1.3 : 1)

  const goalX = target.x + Math.cos(boss.angle) * stats.orbit
  const goalZ = target.z + Math.sin(boss.angle) * stats.orbit
  const goalY = Math.max(target.y + 120 + Math.sin(boss.phase * 0.6) * 90, terrainHeight(goalX, goalZ) + 260)
  const dx = goalX - boss.x
  const dy = goalY - boss.y
  const dz = goalZ - boss.z
  const gap = Math.hypot(dx, dy, dz)
  const travel = Math.min(gap, (gap > 1500 ? 230 : stats.speed * 1.4) * delta)
  if (gap > 1e-6) {
    boss.x += (dx / gap) * travel
    boss.y += (dy / gap) * travel
    boss.z += (dz / gap) * travel
  }
  boss.y = Math.max(boss.y, terrainHeight(boss.x, boss.z) + 220)
  boss.heading = Math.atan2(boss.x - target.x, boss.z - target.z)

  boss.cooldown -= delta
  if (boss.cooldown > 0 || Math.hypot(target.x - boss.x, target.z - boss.z) > 1700) return null
  const enraged = bossEnraged(boss)
  boss.cooldown = stats.interval * (enraged ? 0.7 : 1)
  return { count: stats.count + (enraged ? 2 : 0), spread: stats.spread, speed: stats.bulletSpeed }
}

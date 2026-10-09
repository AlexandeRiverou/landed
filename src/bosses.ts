import { terrainHeight } from './world'

export type BossKind = 'dragon' | 'mothership' | 'manta' | 'phoenix' | 'colossus' | 'hydra' | 'eye'
export type BossPattern = 'fan' | 'ring' | 'stream' | 'spiral' | 'rocks'

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
  patterns: readonly BossPattern[]
}

export const BOSS_EVERY = 3
export const BOSS_ORDER: readonly BossKind[] = ['dragon', 'mothership', 'manta', 'phoenix', 'colossus', 'hydra', 'eye']

export const BOSS_STATS: Record<BossKind, BossStats> = {
  dragon: { name: 'EMBERWING THE SKY DRAGON', health: 36, hitRadius: 110, orbit: 750, speed: 120, count: 5, spread: 0.11, interval: 3.4, bulletSpeed: 230, patterns: ['fan', 'fan', 'ring'] },
  mothership: { name: 'THE MOTHERSHIP "MILDLY HOSTILE"', health: 52, hitRadius: 210, orbit: 1150, speed: 70, count: 9, spread: 0.09, interval: 5, bulletSpeed: 220, patterns: ['fan', 'ring', 'spiral'] },
  manta: { name: 'STORMRAY THE THUNDER MANTA', health: 44, hitRadius: 165, orbit: 900, speed: 95, count: 3, spread: 0.04, interval: 2.7, bulletSpeed: 260, patterns: ['stream', 'fan', 'stream'] },
  phoenix: { name: 'FLAREWING THE PHOENIX', health: 40, hitRadius: 130, orbit: 800, speed: 140, count: 7, spread: 0.1, interval: 3.2, bulletSpeed: 240, patterns: ['ring', 'fan', 'ring', 'stream'] },
  colossus: { name: 'THE STONE SENTINEL', health: 60, hitRadius: 230, orbit: 1000, speed: 55, count: 3, spread: 0.12, interval: 4.6, bulletSpeed: 200, patterns: ['rocks', 'ring', 'rocks', 'fan'] },
  hydra: { name: 'HYDRA THE THREE-HEADED', health: 56, hitRadius: 190, orbit: 950, speed: 85, count: 4, spread: 0.06, interval: 2.4, bulletSpeed: 250, patterns: ['stream', 'stream', 'fan'] },
  eye: { name: 'THE WATCHER', health: 48, hitRadius: 175, orbit: 1050, speed: 100, count: 5, spread: 0.08, interval: 4, bulletSpeed: 230, patterns: ['spiral', 'fan', 'spiral', 'rocks'] },
}

export interface Boss {
  kind: BossKind
  index: number
  tier: number
  x: number
  y: number
  z: number
  heading: number
  health: number
  maxHealth: number
  angle: number
  cooldown: number
  phase: number
  attackIndex: number
  burstLeft: number
  burstTimer: number
  burstPattern: BossPattern
  burstShot: number
}

export interface BossAttack {
  pattern: BossPattern
  count: number
  spread: number
  speed: number
  size: number
  angle: number
  lane: number
}

export const PATTERN_BULLET: Record<BossPattern, { speed: number; size: number }> = {
  fan: { speed: 1, size: 1 },
  ring: { speed: 0.62, size: 0.9 },
  stream: { speed: 1.1, size: 0.8 },
  spiral: { speed: 0.7, size: 0.85 },
  rocks: { speed: 0.6, size: 2.2 },
}

export function bossDue(ringsKept: number): boolean {
  return ringsKept > 0 && ringsKept % BOSS_EVERY === 0
}

export function bossKindFor(index: number): BossKind {
  return BOSS_ORDER[index % BOSS_ORDER.length]
}

// Each full cycle of bosses comes back tougher and re-tinted.
export function createBoss(index: number, x: number, y: number, z: number): Boss {
  const kind = bossKindFor(index)
  const tier = Math.floor(index / BOSS_ORDER.length)
  const maxHealth = Math.round(BOSS_STATS[kind].health * (1 + 0.25 * tier))
  return { kind, index, tier, x, y, z, heading: 0, health: maxHealth, maxHealth, angle: 0, cooldown: 3, phase: 0, attackIndex: 0, burstLeft: 0, burstTimer: 0, burstPattern: 'stream', burstShot: 0 }
}

export function bossEnraged(boss: Boss): boolean {
  return boss.health <= boss.maxHealth / 2
}

// Returns true when the boss is defeated.
export function damageBoss(boss: Boss, amount = 1): boolean {
  boss.health = Math.max(0, boss.health - amount)
  return boss.health === 0
}

function attackFor(boss: Boss, pattern: BossPattern, count: number, spread: number, angle: number, lane: number): BossAttack {
  const stats = BOSS_STATS[boss.kind]
  const bullet = PATTERN_BULLET[pattern]
  return { pattern, count, spread, speed: stats.bulletSpeed * bullet.speed, size: bullet.size, angle, lane }
}

export function stepBoss(boss: Boss, target: { x: number; y: number; z: number }, elapsed: number): BossAttack | null {
  const delta = Math.min(Math.max(elapsed, 0), 0.05)
  const stats = BOSS_STATS[boss.kind]
  const enraged = bossEnraged(boss)
  boss.phase += delta
  boss.angle += (stats.speed / stats.orbit) * delta * (enraged ? 1.3 : 1)

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

  if (boss.burstLeft > 0) {
    boss.burstTimer -= delta
    if (boss.burstTimer > 0) return null
    boss.burstLeft -= 1
    boss.burstShot += 1
    boss.burstTimer = boss.burstPattern === 'spiral' ? 0.11 : 0.17
    const angle = boss.burstShot * 0.55
    return attackFor(boss, boss.burstPattern, 1, boss.burstPattern === 'spiral' ? 0.09 : stats.spread, angle, boss.burstShot % 3)
  }

  boss.cooldown -= delta
  if (boss.cooldown > 0 || Math.hypot(target.x - boss.x, target.z - boss.z) > 1700) return null
  boss.cooldown = stats.interval * (enraged ? 0.7 : 1)
  const pattern = stats.patterns[boss.attackIndex % stats.patterns.length]
  boss.attackIndex += 1
  const extra = enraged ? 2 : 0
  if (pattern === 'fan') return attackFor(boss, 'fan', stats.count + extra, stats.spread, 0, 0)
  if (pattern === 'ring') return attackFor(boss, 'ring', 12 + extra * 2, 0, boss.attackIndex * 0.37, 0)
  if (pattern === 'rocks') return attackFor(boss, 'rocks', 3 + (enraged ? 1 : 0), 0.14, 0, 0)
  boss.burstPattern = pattern
  boss.burstShot = 0
  boss.burstLeft = (pattern === 'spiral' ? 20 : 6) + (enraged ? 4 : 0) - 1
  boss.burstTimer = pattern === 'spiral' ? 0.11 : 0.17
  return attackFor(boss, pattern, 1, pattern === 'spiral' ? 0.09 : stats.spread, 0, 0)
}

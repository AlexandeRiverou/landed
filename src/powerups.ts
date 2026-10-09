export type PowerUpKind = 'shield' | 'rapid' | 'spread' | 'goose' | 'slowmo' | 'turbo' | 'nova' | 'ghost'

export interface PowerUpDef {
  name: string
  blurb: string
  color: number
  seconds: number
  weight: number
}

// A duration of zero means the effect fires once on pickup.
export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  shield: { name: 'BUBBLE SHIELD', blurb: 'The next hit bounces off.', color: 0x66e6ff, seconds: 100, weight: 3 },
  rapid: { name: 'HYPER POP', blurb: 'Your gun forgot how to rest.', color: 0xffd24a, seconds: 60, weight: 3 },
  spread: { name: 'TRIPLE TROUBLE', blurb: 'Three shots for the price of one.', color: 0xff8a3d, seconds: 70, weight: 3 },
  goose: { name: 'GOLDEN GOOSE', blurb: 'All points are doubled.', color: 0xffe066, seconds: 75, weight: 2 },
  slowmo: { name: 'CALM CLOCK', blurb: 'Enemies and shots slow to a stroll.', color: 0xb07dff, seconds: 40, weight: 2 },
  turbo: { name: 'TAILWIND TICKET', blurb: 'Free boost, no questions asked.', color: 0x5dffb0, seconds: 30, weight: 2 },
  nova: { name: 'POP-O-NOVA', blurb: 'A shockwave clears the nearby sky.', color: 0xff4fd8, seconds: 0, weight: 1.5 },
  ghost: { name: 'GHOST WINGS', blurb: 'Walk through towers, rocks, and rams.', color: 0xe8f4ff, seconds: 45, weight: 1.5 },
}

export const POWERUP_KINDS = Object.keys(POWERUPS) as PowerUpKind[]
export const POWERUP_LIFETIME_MS = 32000
export const POWERUP_WARNING_MS = 7000
export const POWERUP_MAX_PICKUPS = 3
export const PICKUP_RADIUS = 60
export const POWERUP_HIT_PENALTY_MS = 8000

export interface PowerUpPickup {
  kind: PowerUpKind
  x: number
  y: number
  z: number
  expiresAt: number
}

export type PowerUpEffects = Record<PowerUpKind, number>

export function createEffects(): PowerUpEffects {
  return Object.fromEntries(POWERUP_KINDS.map((kind) => [kind, 0])) as PowerUpEffects
}

export function pickPowerUpKind(random: () => number): PowerUpKind {
  const total = POWERUP_KINDS.reduce((sum, kind) => sum + POWERUPS[kind].weight, 0)
  let roll = random() * total
  for (const kind of POWERUP_KINDS) {
    roll -= POWERUPS[kind].weight
    if (roll < 0) return kind
  }
  return POWERUP_KINDS[POWERUP_KINDS.length - 1]
}

export function nextSpawnDelayMs(random: () => number): number {
  return 12000 + random() * 14000
}

// Spawns somewhere in the player's forward cone so it is easy to spot.
export function powerUpSpawnPoint(player: { x: number; y: number; z: number; heading: number }, kind: PowerUpKind, now: number, random: () => number): PowerUpPickup {
  const bearing = player.heading + (random() - 0.5) * 0.9
  const distance = 1100 + random() * 900
  return {
    kind,
    x: player.x - Math.sin(bearing) * distance,
    y: player.y + (random() - 0.5) * 240,
    z: player.z - Math.cos(bearing) * distance,
    expiresAt: now + POWERUP_LIFETIME_MS,
  }
}

export function pickupExpired(pickup: PowerUpPickup, now: number): boolean {
  return now >= pickup.expiresAt
}

export function pickupFading(pickup: PowerUpPickup, now: number): boolean {
  return pickup.expiresAt - now < POWERUP_WARNING_MS
}

export function inPickupRange(pickup: PowerUpPickup, player: { x: number; y: number; z: number }): boolean {
  return (pickup.x - player.x) ** 2 + (pickup.y - player.y) ** 2 + (pickup.z - player.z) ** 2 <= PICKUP_RADIUS ** 2
}

// Timed effects refresh to a full duration when taken again.
export function activatePowerUp(effects: PowerUpEffects, kind: PowerUpKind, now: number): boolean {
  const seconds = POWERUPS[kind].seconds
  if (seconds === 0) return false
  effects[kind] = now + seconds * 1000
  return true
}

// Enemy hits shorten every running timed effect; returns true if any was active.
export function drainPowerUps(effects: PowerUpEffects, now: number, milliseconds: number): boolean {
  let drained = false
  for (const kind of POWERUP_KINDS) {
    if (effects[kind] <= now) continue
    drained = true
    effects[kind] = Math.max(0, effects[kind] - milliseconds)
  }
  return drained
}

export function isPowerUpActive(effects: PowerUpEffects, kind: PowerUpKind, now: number): boolean {
  return effects[kind] > now
}

export function powerUpRemaining(effects: PowerUpEffects, kind: PowerUpKind, now: number): number {
  return Math.max(0, (effects[kind] - now) / 1000)
}

export function fireCooldownScale(effects: PowerUpEffects, now: number): number {
  return isPowerUpActive(effects, 'rapid', now) ? 0.35 : 1
}

export function scoreBoost(effects: PowerUpEffects, now: number): number {
  return isPowerUpActive(effects, 'goose', now) ? 2 : 1
}

export function enemyTimeScale(effects: PowerUpEffects, now: number): number {
  return isPowerUpActive(effects, 'slowmo', now) ? 0.45 : 1
}

export function shotFan(effects: PowerUpEffects, now: number): number[] {
  return isPowerUpActive(effects, 'spread', now) ? [-0.09, 0, 0.09] : [0]
}

// Moves every timer forward, used to freeze power-ups while the game is paused.
export function shiftPowerUpTimers(effects: PowerUpEffects, pickups: PowerUpPickup[], milliseconds: number): void {
  for (const kind of POWERUP_KINDS) if (effects[kind] > 0) effects[kind] += milliseconds
  for (const pickup of pickups) pickup.expiresAt += milliseconds
}

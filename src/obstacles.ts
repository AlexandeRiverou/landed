import type { TowerSite } from './world'

export interface Point3 {
  x: number
  y: number
  z: number
}

// Pushes the point out of the first tower it overlaps and returns that tower.
export function resolveTowerCollision(point: Point3, towers: readonly TowerSite[], clearance = 12): TowerSite | null {
  for (const tower of towers) {
    if (point.y < tower.base || point.y > tower.top + clearance) continue
    const dx = point.x - tower.x
    const dz = point.z - tower.z
    const reach = tower.radius + clearance
    const distance = Math.hypot(dx, dz)
    if (distance >= reach) continue
    const scale = distance > 1e-6 ? reach / distance : 0
    point.x = distance > 1e-6 ? tower.x + dx * scale : tower.x + reach
    point.z = distance > 1e-6 ? tower.z + dz * scale : tower.z
    return tower
  }
  return null
}

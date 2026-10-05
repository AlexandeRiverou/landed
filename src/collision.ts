// True when the segment A->B passes within `radius` of the sphere centre (catches fast projectiles that skip over a target).
export function segmentHitsSphere(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  radius: number,
): boolean {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const lengthSquared = dx * dx + dy * dy + dz * dz
  let amount = 0
  if (lengthSquared > 0) {
    amount = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / lengthSquared
    amount = Math.max(0, Math.min(1, amount))
  }
  const px = ax + dx * amount - cx
  const py = ay + dy * amount - cy
  const pz = az + dz * amount - cz
  return px * px + py * py + pz * pz <= radius * radius
}

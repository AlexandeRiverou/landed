import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { segmentHitsSphere } from './collision'

describe('segmentHitsSphere', () => {
  it('hits a target the projectile would tunnel through in one step', () => {
    assert.ok(segmentHitsSphere(0, 0, 0, 0, 0, -40, 0, 0, -20, 5))
  })

  it('misses a target that the segment passes outside of', () => {
    assert.ok(!segmentHitsSphere(0, 0, 0, 0, 0, -40, 30, 0, -20, 5))
  })

  it('does not hit targets beyond either end of the segment', () => {
    assert.ok(!segmentHitsSphere(0, 0, 0, 0, 0, -10, 0, 0, -60, 5))
    assert.ok(!segmentHitsSphere(0, 0, 0, 0, 0, -10, 0, 0, 40, 5))
  })

  it('handles a zero-length segment as a point test', () => {
    assert.ok(segmentHitsSphere(1, 1, 1, 1, 1, 1, 2, 1, 1, 2))
    assert.ok(!segmentHitsSphere(1, 1, 1, 1, 1, 1, 9, 1, 1, 2))
  })
})

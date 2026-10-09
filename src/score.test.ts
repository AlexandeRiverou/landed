import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyScore, COMBO_WINDOW_MS, createScore, MAX_COMBO, ringBonus, SCORE_RULES } from './score'

describe('score', () => {
  it('rewards harder enemies more than easy targets', () => {
    assert.ok(SCORE_RULES.gunship.points > SCORE_RULES.interceptor.points)
    assert.ok(SCORE_RULES.interceptor.points > SCORE_RULES.drone.points)
    assert.ok(SCORE_RULES.drone.points > SCORE_RULES.tree.points)
  })

  it('chains quick kills into a combo that caps and expires', () => {
    const state = createScore()
    assert.equal(applyScore(state, 'drone', 0).delta, 150)
    assert.equal(applyScore(state, 'drone', 1000).delta, Math.round(150 * 1.25))
    for (let index = 0; index < 8; index += 1) applyScore(state, 'drone', 2000 + index * 100)
    assert.equal(state.combo, MAX_COMBO)
    assert.equal(applyScore(state, 'drone', 2800 + COMBO_WINDOW_MS + 1).delta, 150)
  })

  it('subtracts points for mistakes, breaks the combo, and never goes below zero', () => {
    const state = createScore()
    applyScore(state, 'drone', 0)
    applyScore(state, 'drone', 500)
    const before = state.score
    assert.equal(applyScore(state, 'hit-by-shot', 800).delta, -100)
    assert.equal(state.score, before - 100)
    assert.equal(state.combo, 0)
    const poor = createScore()
    assert.equal(applyScore(poor, 'ram-enemy', 0).delta, 0)
    assert.equal(poor.score, 0)
  })

  it('applies a world-event boost to gains but never to losses', () => {
    const state = createScore()
    assert.equal(applyScore(state, 'drone', 0, 0, 2).delta, 300)
    assert.equal(applyScore(state, 'hit-by-shot', 10, 0, 2).delta, -100)
  })

  it('adds a ring bonus that shrinks as the ring is ignored and grows with boost', () => {
    assert.ok(ringBonus(0, false) > ringBonus(5, false))
    assert.equal(ringBonus(20, false), 0)
    assert.equal(ringBonus(0, true), ringBonus(0, false) + 150)
    const state = createScore()
    assert.equal(applyScore(state, 'ring', 0, ringBonus(0, true)).delta, 500 + 300 + 150)
  })
})

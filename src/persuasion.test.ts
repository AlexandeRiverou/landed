import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createPersuasion,
  persuasionLook,
  persuasionStageCount,
  stepPersuasion,
  type PersuasionEffect,
  type PersuasionEvent,
} from './persuasion'

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function ignoreEntirely(seed: number, seconds = 260): { events: PersuasionEvent[]; state: ReturnType<typeof createPersuasion> } {
  const random = seeded(seed)
  const state = createPersuasion(2000)
  const events: PersuasionEvent[] = []
  for (let tick = 0; tick < seconds; tick += 1) {
    const event = stepPersuasion(state, 2000, 1, random)
    if (event) events.push(event)
  }
  return { events, state }
}

describe('objective persuasion', () => {
  it('offers many persuasion steps', () => {
    assert.ok(persuasionStageCount >= 12)
    assert.equal(ignoreEntirely(7).events.length, persuasionStageCount)
  })

  it('stays quiet until the player has ignored the ring for a while', () => {
    const random = seeded(1)
    const state = createPersuasion(2000)
    for (let tick = 0; tick < 5; tick += 1) assert.equal(stepPersuasion(state, 2000, 1, random), null)
    assert.equal(state.stage, 0)
  })

  it('picks effects in a random order that depends on the seed', () => {
    const orderA = ignoreEntirely(11).events.map((event) => event.effect)
    const orderB = ignoreEntirely(12).events.map((event) => event.effect)
    assert.deepEqual(orderA, ignoreEntirely(11).events.map((event) => event.effect))
    assert.notDeepEqual(orderA, orderB)
  })

  it('never exceeds an effect limit and uses a wide mix of effects', () => {
    const { events } = ignoreEntirely(23)
    const counts = new Map<PersuasionEffect, number>()
    for (const event of events) counts.set(event.effect, (counts.get(event.effect) ?? 0) + 1)
    assert.ok((counts.get('grow') ?? 0) <= 3)
    assert.ok((counts.get('recolor') ?? 0) <= 3)
    assert.ok((counts.get('relocate') ?? 0) <= 2)
    for (const effect of ['beacon', 'guides', 'sparkles', 'strobe', 'tunnel', 'hud-pulse', 'sky-glow'] as const) {
      assert.ok((counts.get(effect) ?? 0) <= 1)
    }
    assert.ok(counts.size >= 8)
  })

  it('gives every step a message and avoids repeating the previous title', () => {
    const { events } = ignoreEntirely(31)
    assert.ok(events.every((event) => event.message.title.length > 0 && event.message.copy.length > 0))
    for (let index = 1; index < events.length; index += 1) {
      assert.notEqual(events[index].message.title, events[index - 1].message.title)
    }
  })

  it('moves the ring closer each time it relocates and picks fresh colors', () => {
    const { events } = ignoreEntirely(5)
    const relocations = events.filter((event) => event.relocateTo !== null).map((event) => event.relocateTo as number)
    assert.deepEqual(relocations, [...relocations].sort((a, b) => b - a))
    const colors = events.filter((event) => event.color !== null).map((event) => event.color)
    colors.forEach((color, index) => {
      if (index > 0) assert.notEqual(color, colors[index - 1])
    })
  })

  it('holds back escalation while the player is closing in', () => {
    const random = seeded(3)
    const state = createPersuasion(2000)
    let distance = 2000
    for (let tick = 0; tick < 200; tick += 1) {
      distance -= 30
      stepPersuasion(state, distance, 1, random)
    }
    assert.equal(state.stage, 0)
  })

  it('nudges less when the player is close and keeps the original pace when far', () => {
    const idle = createPersuasion(2000)
    const close = createPersuasion(300)
    const leaving = createPersuasion(2000)
    let away = 2000
    for (let tick = 0; tick < 20; tick += 1) {
      away += 60
      stepPersuasion(idle, 2000, 1, seeded(1))
      stepPersuasion(close, 300, 1, seeded(1))
      stepPersuasion(leaving, away, 1, seeded(1))
    }
    assert.ok(close.ignored < idle.ignored)
    assert.equal(leaving.ignored, idle.ignored)
  })

  it('reflects applied effects in the ring look', () => {
    const { state } = ignoreEntirely(9)
    const look = persuasionLook(state)
    assert.ok(look.scale >= 1)
    assert.equal(persuasionLook(createPersuasion()).scale, 1)
    assert.ok(look.beacon && look.guides && look.sparkles && look.strobe && look.tunnel && look.hudPulse && look.skyGlow)
  })
})

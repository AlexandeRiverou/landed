import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFieldNote, fieldNoteBearing, fieldNoteDistance, fieldNoteProgress, reachedFieldNote, relocateFieldNote } from './objectives'
import { terrainHeight } from './world'

describe('Wayfinder field notes', () => {
  it('places a repeatable gate ahead and above the terrain', () => {
    const note = createFieldNote(0, 0, 1320, 0, 0)
    assert.deepEqual(note, createFieldNote(0, 0, 1320, 0, 0))
    assert.ok(note.z < 0)
    assert.ok(Math.abs(Math.hypot(note.x, note.z) - note.range) < 1e-8)
    assert.ok(note.y >= terrainHeight(note.x, note.z) + 380)
    assert.ok(note.y <= terrainHeight(note.x, note.z) + 760)
  })

  it('tracks approach progress and recognizes the calm arrival radius', () => {
    const note = createFieldNote(2, 0, 1320, 0, 0)
    assert.equal(fieldNoteProgress(note, 0, 0), 0)
    assert.equal(fieldNoteProgress(note, note.x, note.z), 1)
    assert.ok(fieldNoteDistance(note, note.x, note.y, note.z) < 0.001)
    assert.ok(reachedFieldNote(note, note.x, note.y, note.z))
    assert.ok(!reachedFieldNote(note, note.x + 300, note.y, note.z))
  })

  it('points the objective indicator toward gates on either side or behind', () => {
    const note = createFieldNote(0, 0, 1320, 0, 0)
    assert.ok(Math.abs(fieldNoteBearing({ ...note, x: 0, z: -100 }, 0, 0, 0)) < 1e-8)
    assert.ok(fieldNoteBearing({ ...note, x: -100, z: -100 }, 0, 0, 0) > 0)
    assert.ok(fieldNoteBearing({ ...note, x: 100, z: -100 }, 0, 0, 0) < 0)
    assert.ok(Math.abs(fieldNoteBearing({ ...note, x: 0, z: 100 }, 0, 0, 0)) > 3)
  })

  it('rotates through different field-note titles', () => {
    const first = createFieldNote(0, 0, 1320, 0, 0)
    const next = createFieldNote(1, 0, 1320, 0, 0)
    assert.notEqual(first.title, next.title)
    assert.notEqual(first.heading, next.heading)
  })

  it('relocates the same note to a chosen range ahead of the player', () => {
    const note = createFieldNote(1, 0, 1320, 0, 0)
    const moved = relocateFieldNote(note, 500, 1200, -300, 0.5, 450)
    assert.equal(moved.number, note.number)
    assert.equal(moved.title, note.title)
    assert.equal(moved.range, 450)
    assert.ok(Math.abs(Math.hypot(moved.x - 500, moved.z + 300) - 450) < 1e-8)
    assert.ok(moved.y >= terrainHeight(moved.x, moved.z) + 300)
  })
})
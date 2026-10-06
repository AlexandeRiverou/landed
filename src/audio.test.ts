import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bellFrequency, chordFor, noteFrequency } from './audio'

describe('procedural music', () => {
  it('maps semitones to frequencies', () => {
    assert.equal(noteFrequency(0), 220)
    assert.ok(Math.abs(noteFrequency(12) - 440) < 1e-9)
  })

  it('builds repeatable four-voice chords that cycle through the progression', () => {
    const chord = chordFor(0, 42)
    assert.equal(chord.length, 4)
    assert.deepEqual(chord, chordFor(0, 42))
    assert.deepEqual(chordFor(4, 42), chord)
    assert.notDeepEqual(chordFor(1, 42), chord)
    assert.ok(chord.every((frequency, index) => index === 0 || frequency > chord[index - 1]))
  })

  it('picks a different key for different seeds and keeps bells audible and calm', () => {
    assert.notDeepEqual(chordFor(0, 1), chordFor(0, 2))
    for (let step = 0; step < 40; step += 1) {
      const bell = bellFrequency(step, 7)
      assert.ok(bell > 400 && bell < 3000)
    }
  })
})

const PROGRESSION: ReadonlyArray<{ root: number; third: number }> = [
  { root: 0, third: 4 },
  { root: -5, third: 4 },
  { root: -3, third: 3 },
  { root: -7, third: 4 },
]
const PENTATONIC = [0, 2, 4, 7, 9]

export function noteFrequency(semitonesFromA3: number): number {
  return 220 * 2 ** (semitonesFromA3 / 12)
}

function keyShift(seed: number): number {
  return (seed >>> 0) % 7
}

// Soft I-V-vi-IV pads (root, third, fifth, ninth) in a key chosen by the world seed.
export function chordFor(step: number, seed: number): number[] {
  const entry = PROGRESSION[((step % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length]
  const root = entry.root + keyShift(seed)
  return [root, root + entry.third, root + 7, root + 14].map(noteFrequency)
}

export function bellFrequency(step: number, seed: number): number {
  const chord = PROGRESSION[((step % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length]
  const degree = PENTATONIC[(Math.imul(step + 7, 2654435761) >>> 0) % PENTATONIC.length]
  return noteFrequency(chord.root + keyShift(seed) + degree + 24)
}

export interface AudioEngine {
  start: () => void
  toggleMute: () => boolean
  shot: () => void
  enemyShot: () => void
  explosion: (size: number) => void
  hit: () => void
  chime: () => void
  pickup: () => void
}

const CHORD_SECONDS = 9

export function createAudio(seed: number): AudioEngine {
  let context: AudioContext | null = null
  let master: GainNode
  let sfxBus: GainNode
  let musicBus: GainNode
  let noise: AudioBuffer
  let step = 0
  let muted = false

  const build = (ctx: AudioContext): void => {
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.7
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.55
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.2
    musicBus.connect(master)

    const length = Math.floor(ctx.sampleRate * 2.4)
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel)
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2.4
    }
    const reverb = ctx.createConvolver()
    reverb.buffer = impulse
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = 0.7
    musicBus.connect(reverb)
    reverb.connect(reverbGain)
    reverbGain.connect(master)

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const noiseData = noise.getChannelData(0)
    for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1
  }

  const voice = (frequency: number, when: number, duration: number, level: number, type: OscillatorType, bus: AudioNode): void => {
    const ctx = context!
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.linearRampToValueAtTime(level, when + duration * 0.35)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(bus)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.05)
  }

  const scheduleChord = (): void => {
    const ctx = context!
    const when = ctx.currentTime + 0.1
    chordFor(step, seed).forEach((frequency, index) => {
      voice(frequency, when + index * 0.25, CHORD_SECONDS + 3, 0.09, index === 0 ? 'sine' : 'triangle', musicBus)
    })
    for (let note = 0; note < 4; note += 1) {
      if (Math.random() < 0.7) voice(bellFrequency(step * 4 + note + Math.floor(Math.random() * 3), seed), when + 1 + note * 2.2 + Math.random(), 3.2, 0.05, 'sine', musicBus)
    }
    step += 1
  }

  const burst = (duration: number, frequency: number, level: number, sweepTo: number): void => {
    const ctx = context!
    const source = ctx.createBufferSource()
    source.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(frequency, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), ctx.currentTime + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(sfxBus)
    source.start()
    source.stop(ctx.currentTime + duration + 0.05)
  }

  const blip = (from: number, to: number, duration: number, level: number, type: OscillatorType): void => {
    const ctx = context!
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration)
    gain.gain.setValueAtTime(level, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(sfxBus)
    oscillator.start()
    oscillator.stop(ctx.currentTime + duration + 0.05)
  }

  return {
    start() {
      if (context) {
        if (context.state === 'suspended') void context.resume()
        return
      }
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      context = new AudioContextClass()
      build(context)
      scheduleChord()
      window.setInterval(() => {
        if (context && context.state === 'running') scheduleChord()
      }, CHORD_SECONDS * 1000)
    },
    toggleMute() {
      muted = !muted
      if (context) master.gain.setTargetAtTime(muted ? 0 : 0.7, context.currentTime, 0.05)
      return muted
    },
    shot() {
      if (context && !muted) blip(880, 260, 0.12, 0.12, 'triangle')
    },
    enemyShot() {
      if (context && !muted) blip(300, 140, 0.22, 0.08, 'sine')
    },
    explosion(size) {
      if (!context || muted) return
      const scale = Math.min(1.6, 0.6 + size / 90)
      burst(0.5 * scale + 0.3, 1400, 0.45, 80)
      blip(110, 40, 0.5 * scale, 0.3, 'sine')
    },
    hit() {
      if (!context || muted) return
      burst(0.3, 700, 0.35, 120)
      blip(160, 60, 0.3, 0.3, 'sawtooth')
    },
    pickup() {
      if (!context || muted) return
      blip(520, 1040, 0.16, 0.14, 'sine')
      voice(1318, context.currentTime + 0.1, 0.5, 0.1, 'triangle', sfxBus)
    },
    chime() {
      if (!context || muted) return
      const when = context.currentTime
      for (const [index, semitone] of [0, 4, 7, 12].entries()) voice(noteFrequency(semitone + 24), when + index * 0.12, 1.6, 0.12, 'sine', sfxBus)
    },
  }
}

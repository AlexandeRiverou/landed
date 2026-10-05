export type WorldEventId = 'cloud-party' | 'moonrise' | 'lunar-mail' | 'rain-check' | 'aurora' | 'golden-hour' | 'asteroid-drift'

export interface WorldEvent {
  id: WorldEventId
  title: string
  message: string
  skyTop: number
  skyHorizon: number
  groundTint: number
  waterTint: number
  night: number
  storm: number
  aurora: number
  moon: boolean
  rain: boolean
  asteroids: boolean
}

const events: readonly WorldEvent[] = [
  {
    id: 'cloud-party',
    title: 'THE SKY IS SMILING',
    message: 'The clouds are extremely pleased with themselves.',
    skyTop: 0x427a8a,
    skyHorizon: 0xe4c995,
    groundTint: 0xc4d087,
    waterTint: 0x93e2d7,
    night: 0,
    storm: 0,
    aurora: 0,
    moon: false,
    rain: false,
    asteroids: false,
  },
  {
    id: 'moonrise',
    title: 'NIGHT SHIFT APPROVED',
    message: 'The moon requested a fly-by. It has no runway.',
    skyTop: 0x142544,
    skyHorizon: 0x765b78,
    groundTint: 0x94a0bd,
    waterTint: 0x9dc8e9,
    night: 0.78,
    storm: 0,
    aurora: 0,
    moon: true,
    rain: false,
    asteroids: false,
  },
  {
    id: 'lunar-mail',
    title: 'MOON MAIL',
    message: 'Earth says it misses you. No reply is required.',
    skyTop: 0x090e20,
    skyHorizon: 0x25314d,
    groundTint: 0xcac5bb,
    waterTint: 0x809db7,
    night: 1,
    storm: 0,
    aurora: 0,
    moon: true,
    rain: false,
    asteroids: false,
  },
  {
    id: 'rain-check',
    title: 'FREE SHOWER, NO RESERVATION',
    message: 'The clouds would like to discuss your altitude.',
    skyTop: 0x455b6a,
    skyHorizon: 0x93a9a8,
    groundTint: 0x9aac9f,
    waterTint: 0xb4d9ed,
    night: 0.12,
    storm: 1,
    aurora: 0,
    moon: false,
    rain: true,
    asteroids: false,
  },
  {
    id: 'aurora',
    title: 'THE SKY FOUND THE HIGH-VIS PEN',
    message: 'It says these colors are temporary. It is lying.',
    skyTop: 0x163355,
    skyHorizon: 0x4c8991,
    groundTint: 0xc5d38b,
    waterTint: 0x92e1e2,
    night: 0.74,
    storm: 0,
    aurora: 1,
    moon: false,
    rain: false,
    asteroids: false,
  },
  {
    id: 'golden-hour',
    title: 'GOLDEN HOUR IS ON THE HOUSE',
    message: 'The sun is being dramatic again.',
    skyTop: 0xc96462,
    skyHorizon: 0xffc27b,
    groundTint: 0xe4bf77,
    waterTint: 0xf0a2a0,
    night: 0,
    storm: 0,
    aurora: 0,
    moon: false,
    rain: false,
    asteroids: false,
  },
  {
    id: 'asteroid-drift',
    title: 'ORBIT CHANGE APPROVED',
    message: 'Gravity clocked out early. Mind the rocks.',
    skyTop: 0x03040c,
    skyHorizon: 0x121a30,
    groundTint: 0x87847c,
    waterTint: 0x4b4f5c,
    night: 1,
    storm: 0,
    aurora: 0,
    moon: true,
    rain: false,
    asteroids: true,
  },
]

function eventDeck(cycle: number, seed: number): WorldEvent[] {
  const deck = [...events]
  let state = (seed + Math.imul(cycle + 1, 0x9e3779b9)) >>> 0
  for (let index = deck.length - 1; index > 0; index -= 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    const other = state % (index + 1)
    ;[deck[index], deck[other]] = [deck[other], deck[index]]
  }

  if (cycle > 0 && deck[0].id === eventDeck(cycle - 1, seed)[events.length - 1].id) {
    ;[deck[0], deck[1]] = [deck[1], deck[0]]
  }
  return deck
}

export function worldEventForObjective(objectiveIndex: number, seed = 0x4c414e44): WorldEvent {
  const cycle = Math.floor(Math.max(0, objectiveIndex) / events.length)
  const position = Math.max(0, objectiveIndex) % events.length
  return eventDeck(cycle, seed)[position]
}

export function worldEventCount(): number {
  return events.length
}
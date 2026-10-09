export type WorldEventId =
  | 'cloud-party' | 'moonrise' | 'lunar-mail' | 'rain-check' | 'aurora' | 'golden-hour' | 'asteroid-drift'
  | 'snow-globe' | 'confetti-parade' | 'blood-moon' | 'moon-too-close' | 'ember-season' | 'ash-fall' | 'firefly-night'
  | 'petal-blizzard' | 'bubble-bath' | 'meteor-shower' | 'disco-floor' | 'sepia' | 'toxic-sunrise' | 'candy-rain'
  | 'peace-treaty' | 'storm-opera' | 'gold-rush' | 'ice-cream-sunset' | 'ghost-hour'

export type ParticleKind = 'snow' | 'confetti' | 'petals' | 'embers' | 'ash' | 'bubbles' | 'fireflies' | 'meteors' | 'sparks'

interface WorldEventExtras {
  particles: ParticleKind | null
  particleColor: number | null
  moonColor: number | null
  moonScale: number
  rainColor: number | null
  disco: boolean
  scoreMultiplier: number
  peace: boolean
}

export interface WorldEvent extends WorldEventExtras {
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

type WorldEventSpec = Omit<WorldEvent, keyof WorldEventExtras> & Partial<WorldEventExtras>

const extraDefaults: WorldEventExtras = {
  particles: null,
  particleColor: null,
  moonColor: null,
  moonScale: 1,
  rainColor: null,
  disco: false,
  scoreMultiplier: 1,
  peace: false,
}

const specs: readonly WorldEventSpec[] = [
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
  {
    id: 'snow-globe',
    title: 'SNOW GLOBE PROTOCOL',
    message: 'Someone shook the world. Please stay calm and fluffy.',
    skyTop: 0xaec4d6, skyHorizon: 0xf2f5f7, groundTint: 0xe8f1f6, waterTint: 0xbfe3f2,
    night: 0.05, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'snow',
  },
  {
    id: 'confetti-parade',
    title: 'PARTY PERMIT GRANTED',
    message: 'Nobody knows who is celebrating. Points are doubled anyway.',
    skyTop: 0x56b8e5, skyHorizon: 0xffe08a, groundTint: 0xffd0e8, waterTint: 0x9ae6ff,
    night: 0, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'confetti', scoreMultiplier: 2,
  },
  {
    id: 'blood-moon',
    title: 'THE MOON IS EMBARRASSED',
    message: 'It turned bright red and refuses to explain.',
    skyTop: 0x2a0a12, skyHorizon: 0x7a2a2a, groundTint: 0xb06a62, waterTint: 0x8a3a4a,
    night: 0.9, storm: 0, aurora: 0, moon: true, rain: false, asteroids: false,
    moonColor: 0xff4a3a, moonScale: 1.7,
  },
  {
    id: 'moon-too-close',
    title: 'MOON PARKING VIOLATION',
    message: 'It is parked far too close. Please do not honk.',
    skyTop: 0x0b1030, skyHorizon: 0x39507a, groundTint: 0xb4bdd6, waterTint: 0x7a96c8,
    night: 0.95, storm: 0, aurora: 0, moon: true, rain: false, asteroids: false,
    moonScale: 3.6,
  },
  {
    id: 'ember-season',
    title: 'THE FLOOR IS LAVA (EMOTIONALLY)',
    message: 'Everything is warm and orange. Fly with confidence.',
    skyTop: 0x4a0f0a, skyHorizon: 0xff7a2a, groundTint: 0xd9703a, waterTint: 0xff9a4a,
    night: 0.15, storm: 0.2, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'embers',
  },
  {
    id: 'ash-fall',
    title: 'VOLCANO OPENED A TAB',
    message: 'Gentle ash is drifting down. Nobody is panicking. Much.',
    skyTop: 0x2b2b2e, skyHorizon: 0x8a7a70, groundTint: 0x8c8580, waterTint: 0x5f6a70,
    night: 0.3, storm: 0.7, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'ash',
  },
  {
    id: 'firefly-night',
    title: 'FIREFLY UNION STRIKE',
    message: 'Thousands of tiny lamps demand better working hours.',
    skyTop: 0x06141a, skyHorizon: 0x23424a, groundTint: 0x86b28a, waterTint: 0x4a8f88,
    night: 0.92, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'fireflies',
  },
  {
    id: 'petal-blizzard',
    title: 'CHERRY BLOSSOM BLIZZARD',
    message: 'The trees overreacted, but beautifully.',
    skyTop: 0xf2b8cf, skyHorizon: 0xffe4ec, groundTint: 0xf4c2d4, waterTint: 0xf0a8c4,
    night: 0, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'petals',
  },
  {
    id: 'bubble-bath',
    title: 'THE SKY IS HAVING BATH TIME',
    message: 'Bubbles are rising from somewhere. Do not ask where.',
    skyTop: 0x6ad0e8, skyHorizon: 0xe8fbff, groundTint: 0xbdeee0, waterTint: 0x8fe6f0,
    night: 0, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'bubbles',
  },
  {
    id: 'meteor-shower',
    title: 'FREE FIREWORKS, ALL NATURAL',
    message: 'Shooting stars are on tap. Please make wishes quickly.',
    skyTop: 0x050818, skyHorizon: 0x1a2a55, groundTint: 0x8a96b8, waterTint: 0x4a62a0,
    night: 0.95, storm: 0, aurora: 0.35, moon: false, rain: false, asteroids: false,
    particles: 'meteors',
  },
  {
    id: 'disco-floor',
    title: 'THE GROUND JOINED A DISCO',
    message: 'The colors will not stop cycling. Points are doubled. Dance responsibly.',
    skyTop: 0x1a0f3a, skyHorizon: 0x6a2aa8, groundTint: 0xff66cc, waterTint: 0x66ffee,
    night: 0.55, storm: 0, aurora: 0.4, moon: false, rain: false, asteroids: false,
    disco: true, scoreMultiplier: 2, particles: 'sparks', particleColor: 0xffffff,
  },
  {
    id: 'sepia',
    title: 'OLD PHOTOGRAPH MODE',
    message: 'The world is brown and nostalgic. Please do not touch the screen.',
    skyTop: 0x8a7458, skyHorizon: 0xd9c49c, groundTint: 0xb89a6a, waterTint: 0x8d7a5a,
    night: 0, storm: 0.15, aurora: 0, moon: false, rain: false, asteroids: false,
  },
  {
    id: 'toxic-sunrise',
    title: 'QUESTIONABLE SUNRISE',
    message: 'The sky is a color that does not have a name yet.',
    skyTop: 0x2ec27e, skyHorizon: 0xe9ff6a, groundTint: 0xb6ff5a, waterTint: 0x3dffb0,
    night: 0, storm: 0, aurora: 0.2, moon: false, rain: false, asteroids: false,
    particles: 'bubbles', particleColor: 0xb6ff5a,
  },
  {
    id: 'candy-rain',
    title: 'SWEET WEATHER ADVISORY',
    message: 'It is raining something pink. Do not open your mouth.',
    skyTop: 0xc86aa8, skyHorizon: 0xffb6d9, groundTint: 0xf0a8cc, waterTint: 0xff90c8,
    night: 0, storm: 0.7, aurora: 0, moon: false, rain: true, asteroids: false,
    rainColor: 0xff7ac8,
  },
  {
    id: 'peace-treaty',
    title: 'ONE-DAY PEACE TREATY',
    message: 'The drones signed something. Enemies are napping and the sky is quiet.',
    skyTop: 0x7ad1c4, skyHorizon: 0xfff0c8, groundTint: 0xcfe8a0, waterTint: 0xa4f0e0,
    night: 0, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    peace: true, particles: 'petals', particleColor: 0xffffff,
  },
  {
    id: 'storm-opera',
    title: 'THUNDER IS REHEARSING',
    message: 'The storm is warming up its voice. Aurora backing vocals included.',
    skyTop: 0x24223c, skyHorizon: 0x5a4f7a, groundTint: 0x8a90b0, waterTint: 0x5a78b0,
    night: 0.35, storm: 1, aurora: 0.5, moon: false, rain: true, asteroids: false,
    rainColor: 0xa8c8ff,
  },
  {
    id: 'gold-rush',
    title: 'MIDNIGHT GOLD RUSH',
    message: 'Gold dust is falling upward for reasons of its own. Points are 1.5x.',
    skyTop: 0x0c0a24, skyHorizon: 0x3a2a58, groundTint: 0xd9b45a, waterTint: 0xc9964a,
    night: 0.8, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
    particles: 'sparks', particleColor: 0xffd24a, scoreMultiplier: 1.5,
  },
  {
    id: 'ice-cream-sunset',
    title: 'ICE CREAM SUNSET',
    message: 'Strawberry sky, mint ground, no calories.',
    skyTop: 0xff8ab8, skyHorizon: 0x8ad9ff, groundTint: 0xbdf5d4, waterTint: 0xffc2e0,
    night: 0, storm: 0, aurora: 0, moon: false, rain: false, asteroids: false,
  },
  {
    id: 'ghost-hour',
    title: 'GHOST HOUR (FRIENDLY)',
    message: 'The spooky glow is on and the ghosts only want to wave.',
    skyTop: 0x1a2430, skyHorizon: 0x6a8a8a, groundTint: 0x9ab0b0, waterTint: 0x7aa0a8,
    night: 0.7, storm: 0.1, aurora: 0, moon: true, rain: false, asteroids: false,
    moonColor: 0xbfffe8, moonScale: 1.3, particles: 'bubbles', particleColor: 0xbfffe8,
  },
]

const events: readonly WorldEvent[] = specs.map((spec) => ({ ...extraDefaults, ...spec }))

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
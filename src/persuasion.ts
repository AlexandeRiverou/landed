export type PersuasionEffect =
  | 'grow'
  | 'recolor'
  | 'relocate'
  | 'beacon'
  | 'guides'
  | 'sparkles'
  | 'strobe'
  | 'tunnel'
  | 'hud-pulse'
  | 'sky-glow'

export interface PersuasionMessage {
  title: string
  copy: string
}

export interface PersuasionState {
  ignored: number
  stage: number
  bestDistance: number
  lastDistance: number
  counts: Record<PersuasionEffect, number>
  color: number
  lastTitle: string
}

export interface PersuasionEvent {
  effect: PersuasionEffect
  stage: number
  message: PersuasionMessage
  relocateTo: number | null
  color: number | null
}

export interface PersuasionLook {
  scale: number
  color: number
  beacon: boolean
  guides: boolean
  sparkles: boolean
  strobe: boolean
  tunnel: boolean
  hudPulse: boolean
  skyGlow: boolean
}

export const DEFAULT_RING_COLOR = 0xffd28a

// Seconds of being ignored needed to reach each escalation step.
const thresholds = [7, 14, 21, 29, 37, 46, 55, 65, 75, 86, 98, 111, 125, 140]

// How many times each effect may fire during one objective.
const limits: Record<PersuasionEffect, number> = {
  grow: 3,
  recolor: 3,
  relocate: 2,
  beacon: 1,
  guides: 1,
  sparkles: 1,
  strobe: 1,
  tunnel: 1,
  'hud-pulse': 1,
  'sky-glow': 1,
}

const effects = Object.keys(limits) as PersuasionEffect[]
const ringColors = [0xff4fa3, 0x5dffb0, 0x58c7ff, 0xb07dff, 0xffffff, 0xff6a3d]
const relocateRanges = [1000, 450]
const growScales = [1, 1.6, 2.4, 3.4]

const messages: Record<PersuasionEffect, readonly PersuasionMessage[]> = {
  grow: [
    { title: 'THE RING PUT ON WEIGHT', copy: 'It says it is "just big-boned" and would love a visit.' },
    { title: 'SIZE UPGRADE', copy: 'The ring is now bigger. You are legally allowed to hit it.' },
    { title: 'SUPERSIZE ME', copy: 'Extra large, extra hopeful, extra impossible to miss.' },
    { title: 'IT IS INFLATING', copy: 'Someone is pumping up the ring. Please do not let it pop.' },
  ],
  recolor: [
    { title: 'NEW LOOK, WHO DIS', copy: 'It changed color to get your attention. It worked on nobody else.' },
    { title: 'THE RING DYED ITS HAIR', copy: 'Bold choice. Still not as bold as ignoring it.' },
    { title: 'FASHION EMERGENCY', copy: 'The ring is now a shade of "please look at me".' },
  ],
  relocate: [
    { title: 'DELIVERY SERVICE', copy: 'The ring has come to you. Please sign for it by flying through.' },
    { title: 'THE RING MOVED CLOSER', copy: 'It teleported toward you. Rude? Maybe. Effective? Fly forward.' },
    { title: 'IT FOLLOWED YOU HOME', copy: 'A restraining order is pending. Fly through it to settle this.' },
  ],
  beacon: [
    { title: 'LIGHT SHOW', copy: 'A beacon of pure desperation now points at the ring.' },
    { title: 'THE SKY HAS A NEW PILLAR', copy: 'It is very bright. It is very loud. It is very pointing.' },
    { title: 'SUBTLE AS A BRICK', copy: 'The ring fired a light beam into space. Please acknowledge.' },
  ],
  guides: [
    { title: 'FOLLOW THE ARROWS', copy: 'The arrows are doing their best. Please do not make them beg.' },
    { title: 'ARROW CONGA LINE', copy: 'Eight arrows are leading the way. Be a good audience.' },
    { title: 'THIS WAY, GENIUS', copy: 'The arrows have run out of polite things to say.' },
  ],
  sparkles: [
    { title: 'GLITTER BOMB', copy: 'The ring discovered glitter. There is no going back.' },
    { title: 'IT IS SPARKLING', copy: 'Shiny things are hard to ignore. We are counting on it.' },
    { title: 'BIRTHDAY MODE', copy: 'Sparkles activated. Nobody asked, but it is happening.' },
  ],
  strobe: [
    { title: 'DISCO RING', copy: 'The ring is flashing. This is not a drill, it is a party.' },
    { title: 'ATTENTION PLEASE', copy: 'Strobe mode on. The ring has run out of indoor voices.' },
    { title: 'LOOK AT ME', copy: 'Blink blink. That is ring for "please".' },
  ],
  tunnel: [
    { title: 'A TUNNEL, FOR YOU', copy: 'A line of little rings leads the way. It is basically a red carpet.' },
    { title: 'RING RING RING RING', copy: 'It brought friends. Smaller friends. All pointing at it.' },
    { title: 'FOLLOW THE HOOPS', copy: 'Thread the little rings and arrive at the big one. Easy.' },
  ],
  'hud-pulse': [
    { title: 'THE PANEL IS PLEADING', copy: 'Your field-notes panel is now shaking with anticipation.' },
    { title: 'EVEN THE HUD IS WORRIED', copy: 'The panel has started to tremble. That is not a good sign.' },
    { title: 'HEADS UP', copy: 'The instruments have formed a committee about this ring.' },
  ],
  'sky-glow': [
    { title: 'THE SKY IS BLUSHING', copy: 'The horizon glows toward the ring. The sky has taken sides.' },
    { title: 'HORIZON RECOMMENDATION', copy: 'The sky is lighting up in that direction. Very helpful sky.' },
    { title: 'THE SUNSET ENDORSES IT', copy: 'Even the clouds have chosen a favorite. Fly there.' },
  ],
}

export const persuasionStageCount = thresholds.length

export function createPersuasion(distance = Number.POSITIVE_INFINITY): PersuasionState {
  const counts = Object.fromEntries(effects.map((effect) => [effect, 0])) as Record<PersuasionEffect, number>
  return { ignored: 0, stage: 0, bestDistance: distance, lastDistance: distance, counts, color: DEFAULT_RING_COLOR, lastTitle: '' }
}

const CLOSE_RANGE = 500

// Calm when the player is near the ring; unchanged when far away.
function ignorePace(distance: number, radialSpeed: number): number {
  if (distance >= CLOSE_RANGE) return 1
  return radialSpeed > 8 ? 0.6 : 0.3
}

// Returns the escalation to apply when the player has ignored the ring long enough, otherwise null.
export function stepPersuasion(state: PersuasionState, distance: number, delta: number, random: () => number): PersuasionEvent | null {
  const radialSpeed = Number.isFinite(state.lastDistance) && delta > 0 ? (distance - state.lastDistance) / delta : 0
  state.lastDistance = distance
  if (distance < state.bestDistance - 25) {
    state.bestDistance = distance
    state.ignored = Math.max(0, state.ignored - 4)
  } else {
    state.ignored += Math.max(0, delta) * ignorePace(distance, radialSpeed)
  }

  const reached = thresholds.filter((threshold) => state.ignored >= threshold).length
  if (reached <= state.stage) return null

  const available = effects.filter((effect) => state.counts[effect] < limits[effect])
  if (available.length === 0) {
    state.stage = reached
    return null
  }

  const effect = available[Math.min(available.length - 1, Math.floor(random() * available.length))]
  const options = messages[effect]
  let variant = Math.min(options.length - 1, Math.floor(random() * options.length))
  if (options[variant].title === state.lastTitle) variant = (variant + 1) % options.length
  const message = options[variant]

  let relocateTo: number | null = null
  let color: number | null = null
  if (effect === 'relocate') relocateTo = relocateRanges[Math.min(state.counts.relocate, relocateRanges.length - 1)]
  if (effect === 'recolor') {
    const choices = ringColors.filter((candidate) => candidate !== state.color)
    color = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
    state.color = color
  }

  state.counts[effect] += 1
  state.stage = reached
  state.lastTitle = message.title
  return { effect, stage: reached, message, relocateTo, color }
}

export function persuasionLook(state: PersuasionState): PersuasionLook {
  return {
    scale: growScales[Math.min(state.counts.grow, growScales.length - 1)],
    color: state.color,
    beacon: state.counts.beacon > 0,
    guides: state.counts.guides > 0,
    sparkles: state.counts.sparkles > 0,
    strobe: state.counts.strobe > 0,
    tunnel: state.counts.tunnel > 0,
    hudPulse: state.counts['hud-pulse'] > 0,
    skyGlow: state.counts['sky-glow'] > 0,
  }
}

export function resetPersuasionDistance(state: PersuasionState, distance: number): void {
  state.bestDistance = distance
  state.lastDistance = distance
}

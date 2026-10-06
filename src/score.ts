export type ScoreKey =
  | 'bird' | 'kite' | 'balloon' | 'glider' | 'airplane' | 'asteroid'
  | 'tree' | 'rock' | 'house' | 'car' | 'cannon'
  | 'drone' | 'interceptor' | 'gunship'
  | 'ring'
  | 'hit-by-shot' | 'crash-traffic' | 'crash-asteroid' | 'ram-enemy' | 'tower' | 'cliff'

interface ScoreRule {
  points: number
  label: string
  combo: boolean
}

// Shooting chains into a combo; mistakes cost points and break it.
export const SCORE_RULES: Record<ScoreKey, ScoreRule> = {
  bird: { points: 25, label: 'FEATHER FLURRY', combo: true },
  kite: { points: 75, label: 'KITE CUT LOOSE', combo: true },
  balloon: { points: 60, label: 'POP GOES THE BALLOON', combo: true },
  glider: { points: 110, label: 'GLIDER GROUNDED', combo: true },
  airplane: { points: 130, label: 'PLANE POPPED', combo: true },
  asteroid: { points: 70, label: 'ROCK SHATTERED', combo: true },
  tree: { points: 5, label: 'TIMBER', combo: true },
  rock: { points: 10, label: 'BOULDER BUSTED', combo: true },
  house: { points: 40, label: 'HOUSE CALL', combo: true },
  car: { points: 30, label: 'ROAD CLOSED', combo: true },
  cannon: { points: 150, label: 'CANNON SILENCED', combo: true },
  drone: { points: 150, label: 'DRONE DOWN', combo: true },
  interceptor: { points: 275, label: 'INTERCEPTOR DOWN', combo: true },
  gunship: { points: 600, label: 'GUNSHIP DOWN', combo: true },
  ring: { points: 500, label: 'RING CLEARED', combo: false },
  'hit-by-shot': { points: -100, label: 'TAKEN A HIT', combo: false },
  'crash-traffic': { points: -75, label: 'MIDAIR BUMP', combo: false },
  'crash-asteroid': { points: -60, label: 'ROCK RASH', combo: false },
  'ram-enemy': { points: -200, label: 'REALLY, RAMMING?', combo: false },
  tower: { points: -150, label: 'TOWER TAP', combo: false },
  cliff: { points: -50, label: 'CLIFF KISS', combo: false },
}

export const COMBO_WINDOW_MS = 4000
export const MAX_COMBO = 4

export interface ScoreState {
  score: number
  combo: number
  lastComboAt: number
}

export interface ScoreResult {
  delta: number
  label: string
  multiplier: number
}

export function createScore(): ScoreState {
  return { score: 0, combo: 0, lastComboAt: Number.NEGATIVE_INFINITY }
}

// Ring bonus rewards quick, boosted passes; the score never drops below zero.
export function applyScore(state: ScoreState, key: ScoreKey, now: number, bonus = 0): ScoreResult {
  const rule = SCORE_RULES[key]
  let multiplier = 1
  let delta = rule.points + bonus
  if (rule.points > 0 && rule.combo) {
    state.combo = now - state.lastComboAt <= COMBO_WINDOW_MS ? Math.min(state.combo + 1, MAX_COMBO) : 0
    state.lastComboAt = now
    multiplier = 1 + state.combo * 0.25
    delta = Math.round(delta * multiplier)
  } else if (rule.points < 0) {
    state.combo = 0
  }
  const next = Math.max(0, state.score + delta)
  const result = { delta: next - state.score, label: rule.label, multiplier }
  state.score = next
  return result
}

export function ringBonus(stage: number, boosted: boolean): number {
  return Math.max(0, 300 - stage * 40) + (boosted ? 150 : 0)
}

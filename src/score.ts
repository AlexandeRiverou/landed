export type ScoreKey =
  | 'bird' | 'kite' | 'balloon' | 'glider' | 'airplane' | 'asteroid'
  | 'tree' | 'rock' | 'house' | 'cannon' | 'landmark'
  | 'drone' | 'interceptor' | 'gunship' | 'weaver' | 'sniper' | 'spinner' | 'minelayer' | 'kamikaze' | 'mine'
  | 'ring'
  | 'boss'
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
  cannon: { points: 150, label: 'CANNON SILENCED', combo: true },
  landmark: { points: 80, label: 'LANDMARK LEVELED', combo: true },
  drone: { points: 150, label: 'DRONE DOWN', combo: true },
  interceptor: { points: 275, label: 'INTERCEPTOR DOWN', combo: true },
  gunship: { points: 600, label: 'GUNSHIP DOWN', combo: true },
  weaver: { points: 200, label: 'WEAVER UNWOVEN', combo: true },
  sniper: { points: 350, label: 'SNIPER SPOTTED', combo: true },
  spinner: { points: 400, label: 'SPINNER STOPPED', combo: true },
  minelayer: { points: 300, label: 'MINELAYER SUNK', combo: true },
  kamikaze: { points: 250, label: 'KAMIKAZE DEFUSED', combo: true },
  mine: { points: 25, label: 'MINE POPPED', combo: true },
  ring: { points: 500, label: 'RING CLEARED', combo: false },
  boss: { points: 2500, label: 'BOSS DEFEATED', combo: false },
  'hit-by-shot': { points: -100, label: 'TAKEN A HIT', combo: false },
  'crash-traffic': { points: -75, label: 'MIDAIR BUMP', combo: false },
  'crash-asteroid': { points: -60, label: 'ROCK RASH', combo: false },
  'ram-enemy': { points: -200, label: 'REALLY, RAMMING?', combo: false },
  tower: { points: -150, label: 'TOWER TAP', combo: false },
  cliff: { points: -50, label: 'CLIFF KISS', combo: false },
}

export const COMBO_WINDOW_MS = 4000
export const MAX_COMBO = 4
export const STREAK_WINDOW_MS = 20000
export const MAX_STREAK = 6
export const STREAK_STEP = 0.6

export interface ScoreState {
  score: number
  combo: number
  lastComboAt: number
  streak: number
  lastLossAt: number
}

export interface ScoreResult {
  delta: number
  label: string
  multiplier: number
}

export function createScore(): ScoreState {
  return { score: 0, combo: 0, lastComboAt: Number.NEGATIVE_INFINITY, streak: 0, lastLossAt: Number.NEGATIVE_INFINITY }
}

// Ring bonus rewards quick, boosted passes; the score never drops below zero.
export function applyScore(state: ScoreState, key: ScoreKey, now: number, bonus = 0, boost = 1): ScoreResult {
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
    // Hits taken in quick succession cost more each time.
    if (now - state.lastLossAt > STREAK_WINDOW_MS) state.streak = 0
    multiplier = 1 + Math.min(state.streak, MAX_STREAK) * STREAK_STEP
    delta = Math.round(delta * multiplier)
    state.streak += 1
    state.lastLossAt = now
  }
  if (delta > 0 && boost !== 1) {
    delta = Math.round(delta * boost)
    multiplier *= boost
  }
  const next = Math.max(0, state.score + delta)
  const result = { delta: next - state.score, label: rule.label, multiplier }
  state.score = next
  return result
}

export function ringBonus(stage: number, boosted: boolean): number {
  return Math.max(0, 300 - stage * 40) + (boosted ? 150 : 0)
}

import { highestTerrainAlongPath } from './world'

const CRUISE_SPEED = 64
const BOOST_SPEED = 256
const BOOST_CHARGE_RATE = 0.3
const BOOST_DECAY_RATE = 0.4
const MAX_BANK = 0.78
const MAX_PITCH = 0.48
const MIN_PITCH_AUTHORITY = 0.08
const PITCH_CHARGE_RATE = 0.42

export interface FlightState {
  x: number
  y: number
  z: number
  heading: number
  pitch: number
  pitchCharge: number
  pitchDirection: number
  bank: number
  speed: number
  boost: number
}

export interface FlightControls {
  roll: number
  pitch: number
  boost: boolean
}

export function createFlightState(): FlightState {
  return { x: 0, y: 1320, z: 0, heading: 0, pitch: 0, pitchCharge: 0, pitchDirection: 0, bank: 0, speed: CRUISE_SPEED, boost: 0 }
}

// Returns true when a steep slope forced the glider upward (a cliff scrape).
export function stepFlight(state: FlightState, controls: FlightControls, elapsed: number): boolean {
  const delta = Math.min(Math.max(elapsed, 0), 0.05)
  const previousX = state.x
  const previousZ = state.z
  const roll = Math.max(-1, Math.min(controls.roll, 1))
  const pitch = Math.max(-1, Math.min(controls.pitch, 1))
  const pitchDirection = Math.sign(pitch)

  state.bank += (-roll * MAX_BANK - state.bank) * Math.min(1, delta * 2.6)
  if (pitchDirection !== state.pitchDirection) {
    state.pitchCharge = 0
    if (pitchDirection !== 0 && Math.sign(state.pitch) !== pitchDirection) state.pitch *= 0.25
    state.pitchDirection = pitchDirection
  }
  state.pitchCharge = Math.min(1, state.pitchCharge + (pitchDirection === 0 ? 0 : PITCH_CHARGE_RATE * delta))
  const pitchAuthority = MIN_PITCH_AUTHORITY + (MAX_PITCH - MIN_PITCH_AUTHORITY) * state.pitchCharge
  state.pitch += (pitch * pitchAuthority - state.pitch) * Math.min(1, delta * 3.2)
  state.boost = Math.max(0, Math.min(1, state.boost + (controls.boost ? BOOST_CHARGE_RATE : -BOOST_DECAY_RATE) * delta))
  state.speed = CRUISE_SPEED + state.boost * BOOST_SPEED
  state.heading += state.bank * 0.44 * Math.sqrt(state.speed / CRUISE_SPEED) * delta
  state.x -= Math.sin(state.heading) * state.speed * delta
  state.z -= Math.cos(state.heading) * state.speed * delta
  state.y += state.pitch * state.speed * 0.86 * delta

  const floor = highestTerrainAlongPath(previousX, previousZ, state.x, state.z) + 170
  const intended = state.y
  state.y = Math.max(floor, Math.min(state.y, 2400))
  const lift = state.y - Math.min(intended, 2400)
  return lift > 1 && lift > Math.hypot(state.x - previousX, state.z - previousZ) * 1.8
}

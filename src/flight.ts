import { terrainHeight } from './world'

export interface FlightState {
  x: number
  y: number
  z: number
  heading: number
  pitch: number
  bank: number
  speed: number
}

export interface FlightControls {
  roll: number
  pitch: number
}

export function createFlightState(): FlightState {
  return { x: 0, y: 1320, z: 0, heading: 0, pitch: 0, bank: 0, speed: 52 }
}

export function stepFlight(state: FlightState, controls: FlightControls, elapsed: number): void {
  const delta = Math.min(Math.max(elapsed, 0), 0.05)
  const roll = Math.max(-1, Math.min(controls.roll, 1))
  const pitch = Math.max(-1, Math.min(controls.pitch, 1))

  state.bank += (roll * 0.58 - state.bank) * Math.min(1, delta * 2.8)
  state.pitch += (pitch * 0.2 - state.pitch) * Math.min(1, delta * 2.1)
  state.heading -= state.bank * 0.42 * delta
  state.x -= Math.sin(state.heading) * state.speed * delta
  state.z -= Math.cos(state.heading) * state.speed * delta
  state.y += state.pitch * state.speed * 0.72 * delta

  const floor = terrainHeight(state.x, state.z) + 170
  state.y = Math.max(floor, Math.min(state.y, 2400))
}

import { terrainHeight } from './world'

const fieldNoteTitles = [
  'THE LONG VIEW',
  'A SOFT TURN',
  'THE CLOUD WINDOW',
  'THE OPEN COUNTRY',
  'THE WINDWARD PASS',
  'THE FAR RIDGE',
]

export interface FieldNote {
  number: number
  title: string
  x: number
  y: number
  z: number
  heading: number
  range: number
}

export function createFieldNote(sequence: number, x: number, y: number, z: number, heading: number): FieldNote {
  const offset = [0.12, -0.22, 0.27, -0.14, 0.2, -0.08][sequence % 6]
  const course = heading + offset
  const range = 1800 + (sequence % 4) * 260
  const targetX = x - Math.sin(course) * range
  const targetZ = z - Math.cos(course) * range
  const ground = terrainHeight(targetX, targetZ)
  const preferredAltitude = y + ((sequence % 3) - 1) * 120

  return {
    number: sequence + 1,
    title: fieldNoteTitles[sequence % fieldNoteTitles.length],
    x: targetX,
    y: Math.max(ground + 380, Math.min(ground + 760, preferredAltitude)),
    z: targetZ,
    heading: course,
    range,
  }
}

export function fieldNoteDistance(note: FieldNote, x: number, y: number, z: number): number {
  return Math.hypot(note.x - x, note.y - y, note.z - z)
}

export function fieldNoteProgress(note: FieldNote, x: number, z: number): number {
  const remaining = Math.hypot(note.x - x, note.z - z)
  return Math.max(0, Math.min(1, 1 - remaining / note.range))
}

export function fieldNoteBearing(note: FieldNote, x: number, z: number, heading: number): number {
  const targetHeading = Math.atan2(-(note.x - x), -(note.z - z))
  const relativeHeading = targetHeading - heading
  return Math.atan2(Math.sin(relativeHeading), Math.cos(relativeHeading))
}

export function reachedFieldNote(note: FieldNote, x: number, y: number, z: number, radius = 125): boolean {
  return fieldNoteDistance(note, x, y, z) <= radius
}
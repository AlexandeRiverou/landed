import * as THREE from 'three'
import type { LandmarkKind } from './landmarks'

export interface LandmarkSpinner {
  object: THREE.Object3D
  axis: 'x' | 'y' | 'z'
  speed: number
}

export interface LandmarkModel {
  group: THREE.Group
  spinners: LandmarkSpinner[]
  bobs: boolean
  pulses: Array<{ object: THREE.Object3D; baseY: number }>
}

const solid = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra })
const glow = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false })

const materials = {
  stone: solid(0xb7ad98),
  darkStone: solid(0x7d7466),
  sand: solid(0xd9b878),
  white: solid(0xece6d4),
  red: solid(0xc4503a),
  wood: solid(0x8a6a43),
  darkWood: solid(0x5d452c),
  green: solid(0x4d8a3e),
  cactus: solid(0x3f8a52),
  stem: solid(0x5b9a3a),
  cream: solid(0xe8dcc0),
  capRed: solid(0xd04040),
  gold: solid(0xe0b040, { metalness: 0.5, roughness: 0.4 }),
  metal: solid(0xc8d0d4, { metalness: 0.4, roughness: 0.5 }),
  ice: solid(0xcdeeff, { transparent: true, opacity: 0.88, roughness: 0.2 }),
  rockUnder: solid(0x6b6358),
  grass: solid(0x6aa84a),
  blue: solid(0x4f86a8),
  petal: solid(0xffcc2a),
  brown: solid(0x5a3a22),
  lamp: glow(0xffe08a),
  steam: new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }),
  lava: glow(0xff6a1e),
  leaves: solid(0x3d7a35),
  bark: solid(0x6b4a2c),
  tile: solid(0xb83a30),
  slate: solid(0x5a6a74),
}

const geometries = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 12),
  square4: new THREE.ConeGeometry(1, 1, 4),
  hemisphere: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  octa: new THREE.OctahedronGeometry(1),
  tapered: new THREE.CylinderGeometry(0.55, 1, 1, 4),
  torus: new THREE.TorusGeometry(1, 0.06, 6, 40),
  arc: new THREE.TorusGeometry(1, 0.2, 8, 20, Math.PI),
  taperedTrunk: new THREE.CylinderGeometry(0.75, 1, 1, 10),
}

type Place = { x?: number; y?: number; z?: number; sx?: number; sy?: number; sz?: number; rx?: number; ry?: number; rz?: number }

function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, place: Place = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(place.x ?? 0, place.y ?? 0, place.z ?? 0)
  mesh.scale.set(place.sx ?? 1, place.sy ?? 1, place.sz ?? 1)
  mesh.rotation.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0)
  parent.add(mesh)
  return mesh
}

function windmill(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.white, { y: 20, sx: 8, sy: 40, sz: 8 }).scale.set(8, 40, 8)
  part(group, geometries.cone, materials.red, { y: 46, sx: 10, sy: 14, sz: 10 })
  const rotor = new THREE.Group()
  rotor.position.set(0, 38, -9)
  for (let blade = 0; blade < 4; blade += 1) {
    const arm = new THREE.Group()
    arm.rotation.z = (blade * Math.PI) / 2
    part(arm, geometries.box, materials.wood, { y: 15, sx: 1.6, sy: 30, sz: 0.8 })
    part(arm, geometries.box, materials.cream, { x: 3, y: 18, sx: 5, sy: 20, sz: 0.4 })
    rotor.add(arm)
  }
  part(rotor, geometries.sphere, materials.darkWood, { sx: 2.4, sy: 2.4, sz: 2.4 })
  group.add(rotor)
  model.spinners.push({ object: rotor, axis: 'z', speed: 0.7 })
}

function turbine(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.white, { y: 60, sx: 2.6, sy: 120, sz: 2.6 })
  part(group, geometries.box, materials.white, { y: 122, z: 2, sx: 6, sy: 6, sz: 14 })
  const rotor = new THREE.Group()
  rotor.position.set(0, 122, -7)
  for (let blade = 0; blade < 3; blade += 1) {
    const arm = new THREE.Group()
    arm.rotation.z = (blade * Math.PI * 2) / 3
    part(arm, geometries.box, materials.white, { y: 26, sx: 2.2, sy: 52, sz: 0.8 })
    rotor.add(arm)
  }
  part(rotor, geometries.sphere, materials.metal, { sx: 3, sy: 3, sz: 3 })
  group.add(rotor)
  model.spinners.push({ object: rotor, axis: 'z', speed: 1.3 })
}

function lighthouse(model: LandmarkModel): void {
  const { group } = model
  for (let band = 0; band < 4; band += 1) {
    part(group, geometries.cylinder, band % 2 === 0 ? materials.red : materials.white, { y: 8 + band * 16, sx: 10 - band * 1.3, sy: 16, sz: 10 - band * 1.3 })
  }
  part(group, geometries.cylinder, materials.darkStone, { y: 66, sx: 9, sy: 3, sz: 9 })
  part(group, geometries.sphere, materials.lamp, { y: 72, sx: 5, sy: 5, sz: 5 })
  part(group, geometries.cone, materials.red, { y: 82, sx: 7, sy: 9, sz: 7 })
  part(group, geometries.box, materials.white, { y: 3, sx: 20, sy: 6, sz: 14 })
}

function pyramid(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.square4, materials.sand, { y: 45, sx: 62, sy: 90, sz: 62, ry: Math.PI / 4 })
  part(group, geometries.square4, materials.gold, { y: 86, sx: 10, sy: 16, sz: 10, ry: Math.PI / 4 })
}

function obelisk(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.box, materials.darkStone, { y: 4, sx: 22, sy: 8, sz: 22 })
  part(group, geometries.tapered, materials.stone, { y: 62, sx: 6, sy: 110, sz: 6 })
  part(group, geometries.square4, materials.gold, { y: 130, sx: 6, sy: 18, sz: 6, ry: Math.PI / 4 })
}

function crystal(model: LandmarkModel): void {
  const { group } = model
  const palette = [0xff7ae0, 0x7ae6ff, 0xb07dff, 0x7affc8]
  for (let shard = 0; shard < 6; shard += 1) {
    const angle = shard * 1.05
    const height = 26 + ((shard * 37) % 40)
    const material = new THREE.MeshStandardMaterial({ color: palette[shard % palette.length], emissive: palette[shard % palette.length], emissiveIntensity: 0.6, roughness: 0.2, flatShading: true })
    part(group, geometries.octa, material, { x: Math.cos(angle) * (shard ? 12 : 0), z: Math.sin(angle) * (shard ? 12 : 0), y: height * 0.8, sx: 6, sy: height * 0.9, sz: 6, rx: (shard % 2) * 0.12, rz: ((shard + 1) % 3) * 0.08 })
  }
}

function mushroom(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.cream, { y: 16, sx: 5.5, sy: 32, sz: 5.5 })
  part(group, geometries.hemisphere, materials.capRed, { y: 30, sx: 24, sy: 22, sz: 24 })
  for (let dot = 0; dot < 7; dot += 1) {
    const angle = dot * 2.4
    const radius = 6 + (dot % 3) * 5
    part(group, geometries.sphere, materials.white, { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, y: 30 + Math.sqrt(Math.max(0, 22 * 22 - radius * radius * 0.9)) * 0.88, sx: 2.4, sy: 1.2, sz: 2.4 })
  }
}

function arch(model: LandmarkModel): void {
  const { group } = model
  for (const side of [-1, 1]) part(group, geometries.box, materials.stone, { x: side * 26, y: 28, sx: 12, sy: 56, sz: 14 })
  part(group, geometries.arc, materials.stone, { y: 56, sx: 26, sy: 26, sz: 26 }).scale.set(26, 26, 40)
  part(group, geometries.box, materials.darkStone, { y: 3, sx: 74, sy: 6, sz: 20 })
}

function ferris(model: LandmarkModel): void {
  const { group } = model
  for (const side of [-1, 1]) part(group, geometries.box, materials.metal, { x: side * 8, y: 24, z: 0, sx: 2, sy: 56, sz: 2, rz: side * 0.32 })
  const wheel = new THREE.Group()
  wheel.position.y = 54
  part(wheel, geometries.torus, materials.red, { sx: 42, sy: 42, sz: 42 }).scale.set(42, 42, 42)
  for (let spoke = 0; spoke < 6; spoke += 1) part(wheel, geometries.box, materials.white, { sx: 0.8, sy: 84, sz: 0.8, rz: (spoke * Math.PI) / 6 })
  for (let seat = 0; seat < 10; seat += 1) {
    const angle = (seat / 10) * Math.PI * 2
    const holder = new THREE.Group()
    holder.position.set(Math.cos(angle) * 42, Math.sin(angle) * 42, 0)
    holder.userData.gondola = true
    part(holder, geometries.box, seat % 2 ? materials.petal : materials.blue, { y: -3, sx: 6, sy: 5, sz: 6 })
    wheel.add(holder)
  }
  group.add(wheel)
  model.spinners.push({ object: wheel, axis: 'z', speed: 0.25 })
}

function castle(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.box, materials.stone, { y: 11, sx: 60, sy: 22, sz: 36 })
  part(group, geometries.box, materials.darkStone, { y: 9, z: -18, sx: 12, sy: 18, sz: 3 })
  for (const [x, z, roof] of [[-30, -18, true], [30, -18, false], [-30, 18, false], [30, 18, true]] as const) {
    part(group, geometries.cylinder, materials.stone, { x, z, y: 24, sx: 8.5, sy: 48, sz: 8.5 })
    if (roof) part(group, geometries.cone, materials.red, { x, z, y: 54, sx: 10.5, sy: 14, sz: 10.5 })
    else for (let tooth = 0; tooth < 4; tooth += 1) part(group, geometries.box, materials.stone, { x: x + Math.cos(tooth * 1.57) * 6, z: z + Math.sin(tooth * 1.57) * 6, y: 50, sx: 3, sy: 5, sz: 3 })
  }
}

function iceSpire(model: LandmarkModel): void {
  const { group } = model
  for (const [x, z, height, radius] of [[0, 0, 95, 11], [14, 6, 62, 8], [-12, 9, 48, 7]] as const) part(group, geometries.cone, materials.ice, { x, z, y: height / 2, sx: radius, sy: height, sz: radius })
}

function sunflower(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.stem, { y: 30, sx: 1.8, sy: 60, sz: 1.8 })
  part(group, geometries.box, materials.green, { x: 7, y: 26, sx: 14, sy: 0.6, sz: 7, rz: 0.4 })
  part(group, geometries.box, materials.green, { x: -7, y: 36, sx: 14, sy: 0.6, sz: 7, rz: -0.4 })
  const head = new THREE.Group()
  head.position.set(0, 62, 1)
  head.rotation.x = -0.35
  part(head, geometries.cylinder, materials.brown, { rx: Math.PI / 2, sx: 11, sy: 3, sz: 11 })
  for (let petal = 0; petal < 16; petal += 1) {
    const angle = (petal / 16) * Math.PI * 2
    part(head, geometries.box, materials.petal, { x: Math.cos(angle) * 15, y: Math.sin(angle) * 15, z: -0.5, sx: 4.6, sy: 9, sz: 0.8, rz: angle - Math.PI / 2 })
  }
  group.add(head)
}

function tiki(model: LandmarkModel): void {
  const { group } = model
  const colors = [materials.darkWood, materials.red, materials.wood, materials.blue]
  for (let tier = 0; tier < 3; tier += 1) {
    part(group, geometries.box, colors[tier], { y: 10 + tier * 20, sx: 15, sy: 19, sz: 15 })
    part(group, geometries.box, materials.cream, { x: -3.5, y: 12 + tier * 20, z: -7.6, sx: 3, sy: 3, sz: 1 })
    part(group, geometries.box, materials.cream, { x: 3.5, y: 12 + tier * 20, z: -7.6, sx: 3, sy: 3, sz: 1 })
    part(group, geometries.box, materials.petal, { y: 6 + tier * 20, z: -7.6, sx: 8, sy: 2.4, sz: 1 })
  }
  part(group, geometries.box, materials.red, { y: 62, sx: 34, sy: 3, sz: 3 })
  part(group, geometries.cone, materials.petal, { y: 66, sx: 6, sy: 10, sz: 6 })
}

function observatory(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.white, { y: 14, sx: 18, sy: 28, sz: 18 })
  const dome = new THREE.Group()
  dome.position.y = 28
  part(dome, geometries.hemisphere, materials.blue, { sx: 18, sy: 18, sz: 18 })
  part(dome, geometries.box, materials.darkStone, { y: 9, z: -9, sx: 4, sy: 16, sz: 4, rx: -0.5 })
  group.add(dome)
  model.spinners.push({ object: dome, axis: 'y', speed: 0.2 })
}

function island(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cone, materials.rockUnder, { y: -22, sx: 36, sy: 46, sz: 36, rx: Math.PI })
  part(group, geometries.cylinder, materials.grass, { y: 2, sx: 36, sy: 5, sz: 36 })
  part(group, geometries.cylinder, materials.wood, { x: -8, y: 12, z: 4, sx: 1.4, sy: 14, sz: 1.4 })
  part(group, geometries.cone, materials.green, { x: -8, y: 24, z: 4, sx: 7, sy: 18, sz: 7 })
  part(group, geometries.box, materials.cream, { x: 12, y: 8, z: -5, sx: 9, sy: 7, sz: 8 })
  part(group, geometries.square4, materials.red, { x: 12, y: 14, z: -5, sx: 8, sy: 6, sz: 8, ry: Math.PI / 4 })
  model.bobs = true
}

function cactus(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.cactus, { y: 23, sx: 5.2, sy: 46, sz: 5.2 })
  part(group, geometries.sphere, materials.cactus, { y: 46, sx: 5.2, sy: 5.2, sz: 5.2 })
  for (const [side, height] of [[-1, 24], [1, 32]] as const) {
    part(group, geometries.cylinder, materials.cactus, { x: side * 9, y: height, sx: 3.4, sy: 5, sz: 3.4, rz: Math.PI / 2 })
    part(group, geometries.cylinder, materials.cactus, { x: side * 13, y: height + 8, sx: 3.4, sy: 17, sz: 3.4 })
    part(group, geometries.sphere, materials.cactus, { x: side * 13, y: height + 17, sx: 3.4, sy: 3.4, sz: 3.4 })
  }
}

function waterTower(model: LandmarkModel): void {
  const { group } = model
  for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]] as const) part(group, geometries.box, materials.darkWood, { x, z, y: 22, sx: 2, sy: 44, sz: 2, rx: z * 0.012, rz: -x * 0.012 })
  part(group, geometries.box, materials.metal, { y: 24, sx: 20, sy: 1.5, sz: 20 })
  part(group, geometries.cylinder, materials.slate, { y: 52, sx: 13, sy: 26, sz: 13 })
  part(group, geometries.cone, materials.red, { y: 70, sx: 14, sy: 12, sz: 14 })
}

function siloFarm(model: LandmarkModel): void {
  const { group } = model
  for (const [x, z] of [[-14, 0], [14, 4]] as const) {
    part(group, geometries.cylinder, materials.metal, { x, z, y: 20, sx: 9, sy: 40, sz: 9 })
    part(group, geometries.hemisphere, materials.metal, { x, z, y: 40, sx: 9, sy: 9, sz: 9 })
  }
  part(group, geometries.box, materials.red, { x: 0, z: -28, y: 11, sx: 42, sy: 22, sz: 24 })
  part(group, geometries.square4, materials.darkWood, { x: 0, z: -28, y: 26, sx: 32, sy: 14, sz: 18, ry: Math.PI / 4 }).scale.set(32, 14, 22)
  part(group, geometries.box, materials.white, { x: 0, z: -40.4, y: 8, sx: 14, sy: 14, sz: 1 })
}

function stoneCircle(model: LandmarkModel): void {
  const { group } = model
  for (let stone = 0; stone < 8; stone += 1) {
    const angle = (stone / 8) * Math.PI * 2
    part(group, geometries.box, materials.stone, { x: Math.cos(angle) * 34, z: Math.sin(angle) * 34, y: 13 + (stone % 3), sx: 7, sy: 26 + (stone % 3) * 3, sz: 5, ry: -angle })
  }
  for (const angle of [0, Math.PI]) part(group, geometries.box, materials.darkStone, { x: Math.cos(angle) * 34, z: Math.sin(angle) * 34, y: 29, sx: 8, sy: 4, sz: 22, ry: -angle + 0.6 })
  part(group, geometries.box, materials.darkStone, { y: 4, sx: 14, sy: 8, sz: 8 })
}

function geyser(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cone, materials.darkStone, { y: 7, sx: 26, sy: 14, sz: 26 })
  part(group, geometries.cylinder, materials.lava, { y: 14.5, sx: 7, sy: 1.5, sz: 7 })
  for (let puff = 0; puff < 6; puff += 1) {
    const mesh = part(group, geometries.sphere, materials.steam, { y: 20, sx: 7, sy: 7, sz: 7 })
    model.pulses.push({ object: mesh, baseY: 18 + puff * 3 })
  }
}

function statue(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.box, materials.darkStone, { y: 7, sx: 22, sy: 14, sz: 22 })
  part(group, geometries.box, materials.stone, { x: -4, y: 30, sx: 5, sy: 32, sz: 6 })
  part(group, geometries.box, materials.stone, { x: 4, y: 30, sx: 5, sy: 32, sz: 6 })
  part(group, geometries.cylinder, materials.stone, { y: 62, sx: 9, sy: 32, sz: 6 })
  part(group, geometries.sphere, materials.stone, { y: 86, sx: 6.5, sy: 7.5, sz: 6.5 })
  part(group, geometries.box, materials.stone, { x: 13, y: 74, sx: 4, sy: 24, sz: 4, rz: -0.35 })
  part(group, geometries.box, materials.stone, { x: -10, y: 56, z: -4, sx: 4, sy: 18, sz: 4, rx: 0.5 })
  part(group, geometries.sphere, materials.gold, { x: 18, y: 87, sx: 3, sy: 3, sz: 3 })
}

function pagoda(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.box, materials.darkStone, { y: 3, sx: 44, sy: 6, sz: 44 })
  for (let tier = 0; tier < 4; tier += 1) {
    const size = 30 - tier * 5
    part(group, geometries.box, materials.cream, { y: 11 + tier * 17, sx: size, sy: 10, sz: size })
    part(group, geometries.square4, materials.tile, { y: 20 + tier * 17, sx: size * 0.95, sy: 8, sz: size * 0.95, ry: Math.PI / 4 }).scale.set(size * 0.95, 8, size * 0.95)
  }
  part(group, geometries.cylinder, materials.gold, { y: 80, sx: 0.8, sy: 14, sz: 0.8 })
}

function clockTower(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.box, materials.stone, { y: 33, sx: 15, sy: 66, sz: 15 })
  part(group, geometries.box, materials.darkStone, { y: 4, sx: 20, sy: 8, sz: 20 })
  part(group, geometries.cone, materials.slate, { y: 79, sx: 12, sy: 26, sz: 12, ry: Math.PI / 4 })
  part(group, geometries.square4, materials.slate, { y: 79, sx: 15, sy: 26, sz: 15, ry: Math.PI / 4 })
  const face = new THREE.Group()
  face.position.set(0, 56, -8.2)
  part(face, geometries.cylinder, materials.white, { rx: Math.PI / 2, sx: 6, sy: 1, sz: 6 })
  const hands = new THREE.Group()
  part(hands, geometries.box, materials.brown, { y: 2, z: -0.8, sx: 0.8, sy: 5, sz: 0.4 })
  part(hands, geometries.box, materials.brown, { x: 1.2, z: -0.9, sx: 3, sy: 0.7, sz: 0.4 })
  face.add(hands)
  group.add(face)
  model.spinners.push({ object: hands, axis: 'z', speed: 0.4 })
}

function radarDish(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cylinder, materials.metal, { y: 20, sx: 3.4, sy: 40, sz: 3.4 })
  part(group, geometries.box, materials.white, { y: 4, sx: 18, sy: 8, sz: 14 })
  const turret = new THREE.Group()
  turret.position.y = 42
  const dish = part(turret, geometries.hemisphere, materials.white, { y: 10, z: -4, sx: 22, sy: 12, sz: 22, rx: -Math.PI / 3 })
  void dish
  part(turret, geometries.cylinder, materials.red, { y: 18, z: -14, sx: 0.8, sy: 16, sz: 0.8, rx: -Math.PI / 3 })
  group.add(turret)
  model.spinners.push({ object: turret, axis: 'y', speed: 0.5 })
}

function ancientTree(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.taperedTrunk, materials.bark, { y: 30, sx: 12, sy: 60, sz: 12 })
  for (let root = 0; root < 5; root += 1) {
    const angle = root * 1.26
    part(group, geometries.cone, materials.bark, { x: Math.cos(angle) * 11, z: Math.sin(angle) * 11, y: 6, sx: 5, sy: 16, sz: 5, rz: Math.cos(angle) * 0.9, rx: -Math.sin(angle) * 0.9 })
  }
  for (const [x, y, z, size] of [[0, 84, 0, 34], [-24, 74, 6, 26], [24, 72, -6, 28], [4, 100, 8, 22], [-8, 70, -22, 22]] as const) part(group, geometries.sphere, materials.leaves, { x, y, z, sx: size, sy: size * 0.72, sz: size })
}

function miniVolcano(model: LandmarkModel): void {
  const { group } = model
  part(group, geometries.cone, materials.darkStone, { y: 30, sx: 54, sy: 60, sz: 54 })
  part(group, geometries.cylinder, materials.lava, { y: 60, sx: 10, sy: 2.4, sz: 10 })
  part(group, geometries.cylinder, materials.slate, { y: 59, sx: 15, sy: 4, sz: 15 }).scale.set(15, 4, 15)
  for (let ember = 0; ember < 4; ember += 1) {
    const mesh = part(group, geometries.sphere, materials.lava, { y: 62, sx: 3.2, sy: 3.2, sz: 3.2 })
    model.pulses.push({ object: mesh, baseY: 62 + ember * 4 })
  }
}

const builders: Record<LandmarkKind, (model: LandmarkModel) => void> = {
  windmill,
  'wind-turbine': turbine,
  lighthouse,
  pyramid,
  obelisk,
  crystal,
  mushroom,
  'stone-arch': arch,
  'ferris-wheel': ferris,
  castle,
  'ice-spire': iceSpire,
  sunflower,
  tiki,
  observatory,
  'floating-island': island,
  cactus,
  'water-tower': waterTower,
  'silo-farm': siloFarm,
  'stone-circle': stoneCircle,
  geyser,
  statue,
  pagoda,
  'clock-tower': clockTower,
  'radar-dish': radarDish,
  'ancient-tree': ancientTree,
  'mini-volcano': miniVolcano,
}

export function createLandmarkModel(kind: LandmarkKind): LandmarkModel {
  const model: LandmarkModel = { group: new THREE.Group(), spinners: [], bobs: false, pulses: [] }
  builders[kind](model)
  return model
}

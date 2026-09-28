import './style.css'
import * as THREE from 'three'
import { createFlightState, stepFlight } from './flight'
import { generateForest, generateRockField, terrainHeight } from './world'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <main class="flight-deck">
    <div class="world" id="world" aria-label="Aerial view over a procedurally generated landscape"></div>
    <div class="haze" aria-hidden="true"></div>
    <header class="masthead">
      <a class="wordmark" href="#" aria-label="landed flight home">
        <span class="wing-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="wordmark-copy"><strong>landed</strong><small>FIELD NOTES / 01</small></span>
      </a>
      <div class="flight-status"><span class="status-light"></span><span>IN THE AIR</span></div>
      <div class="flight-actions">
        <button class="boost-button" id="boost-button" type="button" aria-label="Hold to boost" aria-pressed="false">BOOST</button>
        <button class="reset-button" id="reset-flight" type="button">RESET</button>
        <button class="pause-button" id="pause-button" type="button" aria-label="Pause flight">
          <span class="pause-icon" aria-hidden="true"><i></i><i></i></span>
          <span id="pause-label">PAUSE</span>
        </button>
      </div>
    </header>

    <section class="view-title" aria-label="Current flight">
      <p class="location-line"><span class="location-dot"></span> OPEN COUNTRY <span class="location-divider">/</span> NO. 01</p>
      <h1>Quiet<br>air.</h1>
    </section>

    <section class="flight-data" aria-label="Flight instruments">
      <div class="data-heading"><span>FLIGHT DATA</span><span class="data-live">LIVE</span></div>
      <div class="data-row"><span>ALTITUDE</span><strong><span id="altitude">1,320</span><small> M</small></strong></div>
      <div class="data-row"><span>GROUND SPEED</span><strong><span id="speed">187</span><small> KM/H</small></strong></div>
      <div class="data-row"><span>HEADING</span><strong><span id="heading">000</span><small> DEG</small></strong></div>
      <div class="terrain-readout"><span class="terrain-line" aria-hidden="true"></span><span id="terrain-label">ABOVE THE RIDGELINE</span></div>
    </section>

    <div class="sightline" aria-hidden="true"><span></span><i></i><span></span></div>

    <footer class="flight-footer">
      <div class="footer-coordinates"><span class="coordinate-mark" aria-hidden="true"></span><span id="coordinates">36 12 N&nbsp;&nbsp; 118 41 W</span></div>
      <div class="footer-note"><span class="footer-rule"></span><span>NO ROUTE. NO RUSH.</span></div>
      <div class="touch-controls" aria-label="Flight controls">
        <button class="touch-control" id="bank-left" type="button" aria-label="Bank left"><span class="chevron chevron-left" aria-hidden="true"></span></button>
        <button class="touch-control" id="pitch-up" type="button" aria-label="Climb"><span class="chevron chevron-up" aria-hidden="true"></span></button>
        <button class="touch-control" id="pitch-down" type="button" aria-label="Descend"><span class="chevron chevron-down" aria-hidden="true"></span></button>
        <button class="touch-control" id="bank-right" type="button" aria-label="Bank right"><span class="chevron chevron-right" aria-hidden="true"></span></button>
      </div>
    </footer>

    <div class="pause-shade" id="pause-shade" aria-live="polite"><span>FLIGHT HELD</span></div>
    <div class="render-error" id="render-error" role="status" hidden>This browser could not start the 3D view. Try a browser with WebGL enabled.</div>
  </main>
`

const worldRoot = document.querySelector<HTMLDivElement>('#world')!
const errorMessage = document.querySelector<HTMLDivElement>('#render-error')!
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-button')!
const boostButton = document.querySelector<HTMLButtonElement>('#boost-button')!
const pauseLabel = document.querySelector<HTMLSpanElement>('#pause-label')!
const pauseShade = document.querySelector<HTMLDivElement>('#pause-shade')!
const altitudeReadout = document.querySelector<HTMLSpanElement>('#altitude')!
const speedReadout = document.querySelector<HTMLSpanElement>('#speed')!
const headingReadout = document.querySelector<HTMLSpanElement>('#heading')!
const terrainReadout = document.querySelector<HTMLSpanElement>('#terrain-label')!
const coordinatesReadout = document.querySelector<HTMLSpanElement>('#coordinates')!

let renderer: THREE.WebGLRenderer
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
} catch {
  errorMessage.hidden = false
  pauseButton.disabled = true
  throw new Error('WebGL is required to render landed.')
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
renderer.domElement.setAttribute('aria-hidden', 'true')
worldRoot.append(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 1, 15000)
scene.add(new THREE.HemisphereLight(0xe5f4ed, 0x40594e, 2.05))

const sunDirection = new THREE.Vector3(0.37, 0.62, -0.69).normalize()
const sunlight = new THREE.DirectionalLight(0xffe4b7, 2.2)
sunlight.position.copy(sunDirection).multiplyScalar(5000)
scene.add(sunlight)

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: { uSunDirection: { value: sunDirection } },
  vertexShader: `
    varying vec3 vDirection;
    void main() {
      vDirection = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uSunDirection;
    varying vec3 vDirection;
    void main() {
      vec3 direction = normalize(vDirection);
      float horizon = smoothstep(-0.12, 0.82, direction.y);
      vec3 sky = mix(vec3(0.72, 0.79, 0.74), vec3(0.16, 0.43, 0.53), horizon);
      float sun = max(dot(direction, normalize(uSunDirection)), 0.0);
      sky += vec3(1.0, 0.63, 0.34) * pow(sun, 160.0) * 1.1;
      sky += vec3(1.0, 0.74, 0.48) * pow(sun, 13.0) * 0.14;
      gl_FragColor = vec4(sky, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
})
const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 40, 24), skyMaterial)
sky.frustumCulled = false
scene.add(sky)

const terrainMaterial = new THREE.ShaderMaterial({
  uniforms: { uOffset: { value: new THREE.Vector2() } },
  vertexShader: `
    uniform vec2 uOffset;
    varying float vHeight;
    varying float vWater;
    varying float vVariation;
    varying vec3 vNormal;
    varying vec2 vLocal;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 cell = floor(p);
      vec2 part = fract(p);
      part = part * part * (3.0 - 2.0 * part);
      return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), part.x),
                 mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), part.x), part.y);
    }

    float relief(vec2 p) {
      float broad = noise(p * 0.00008) * 170.0;
      float foothills = noise(p * 0.00022) * 110.0;
      float ridgeShape = 1.0 - abs(noise(p * 0.00058) * 2.0 - 1.0);
      float ridges = pow(ridgeShape, 1.7) * 720.0;
      float detail = noise(p * 0.0024) * 36.0;
      return 35.0 + broad + foothills + ridges + detail;
    }

    float waterAt(vec2 point, out float waterLevel) {
      float riverX = sin(point.y * 0.00072) * 550.0 + sin(point.y * 0.00024) * 750.0;
      float riverWidth = 86.0 + noise(vec2(point.y * 0.0006, 0.19)) * 20.0;
      float coverage = 1.0 - smoothstep(riverWidth, riverWidth + 78.0, abs(point.x - riverX));
      waterLevel = 216.0 + sin(point.y * 0.00013) * 28.0 + noise(point * 0.00017) * 14.0;

      vec2 cell = floor(point / 5200.0);
      for (int x = -1; x <= 1; x++) {
        for (int z = -1; z <= 1; z++) {
          vec2 lakeCell = cell + vec2(float(x), float(z));
          if (hash(lakeCell + vec2(17.3, 29.7)) < 0.71) continue;
          vec2 center = (lakeCell + vec2(
            0.14 + hash(lakeCell + vec2(43.1, 7.2)) * 0.72,
            0.14 + hash(lakeCell + vec2(11.8, 61.4)) * 0.72
          )) * 5200.0;
          float radius = 310.0 + hash(lakeCell + vec2(83.2, 13.9)) * 210.0;
          float lake = 1.0 - smoothstep(radius * 0.82, radius * 1.12, length(point - center));
          if (lake > coverage) {
            coverage = lake;
            waterLevel = 205.0 + hash(lakeCell + vec2(18.4, 73.6)) * 40.0;
          }
        }
      }
      return coverage;
    }

    void main() {
      vLocal = position.xz;
      vec2 point = position.xz + uOffset;
      float waterLevel;
      float water = waterAt(point, waterLevel);
      float height = mix(relief(point), waterLevel, water);
      float left = relief(point + vec2(-5.0, 0.0));
      float right = relief(point + vec2(5.0, 0.0));
      float down = relief(point + vec2(0.0, -5.0));
      float up = relief(point + vec2(0.0, 5.0));
      vHeight = height;
      vWater = water;
      vVariation = noise(point * 0.0014);
      vNormal = normalize(vec3(left - right, 10.0, down - up));
      vec3 displaced = position;
      displaced.y = height;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    varying float vHeight;
    varying float vWater;
    varying float vVariation;
    varying vec3 vNormal;
    varying vec2 vLocal;
    void main() {
      vec3 grass = mix(vec3(0.075, 0.19, 0.055), vec3(0.22, 0.36, 0.10), vVariation);
      vec3 soil = vec3(0.39, 0.21, 0.10);
      vec3 rock = vec3(0.36, 0.34, 0.29);
      vec3 snow = vec3(0.88, 0.91, 0.89);
      float exposedSoil = smoothstep(310.0, 540.0, vHeight) * (0.55 + vVariation * 0.45);
      vec3 ground = mix(grass, soil, exposedSoil);
      ground = mix(ground, rock, smoothstep(500.0, 710.0, vHeight));
      ground = mix(ground, snow, smoothstep(760.0, 940.0, vHeight));
      float ripple = 0.5 + 0.5 * sin(vLocal.x * 0.003 + sin(vLocal.y * 0.002) * 2.0);
      vec3 water = mix(vec3(0.055, 0.25, 0.29), vec3(0.28, 0.55, 0.54), smoothstep(0.56, 0.98, ripple));
      ground = mix(ground, water, smoothstep(0.12, 0.8, vWater));
      float light = 0.42 + 0.78 * max(dot(normalize(vNormal), normalize(vec3(-0.36, 0.86, 0.37))), 0.0);
      ground *= light;
      float haze = smoothstep(3400.0, 6100.0, length(vLocal));
      ground = mix(ground, vec3(0.70, 0.81, 0.78), haze * 0.82);
      gl_FragColor = vec4(ground, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
})
const terrainGeometry = new THREE.PlaneGeometry(12000, 12000, 190, 190)
terrainGeometry.rotateX(-Math.PI / 2)
const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial)
terrain.frustumCulled = false
scene.add(terrain)

const treeCapacity = 2400
const forestTrunks = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(1.1, 0.68, 10, 6),
  new THREE.MeshStandardMaterial({ color: 0x725a43, roughness: 0.96, flatShading: true }),
  treeCapacity,
)
const forestCrowns = new THREE.InstancedMesh(
  new THREE.ConeGeometry(5.5, 25, 6),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true }),
  treeCapacity,
)
const forestBroadleaf = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(7, 1),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true }),
  treeCapacity,
)
const rockCapacity = 420
const rockOutcrops = new THREE.InstancedMesh(
  new THREE.DodecahedronGeometry(8, 0),
  new THREE.MeshStandardMaterial({ color: 0x81796d, roughness: 1, flatShading: true }),
  rockCapacity,
)
scene.add(forestTrunks, forestCrowns, forestBroadleaf, rockOutcrops)

const glider = new THREE.Group()
const ivory = new THREE.MeshStandardMaterial({ color: 0xe9e3d2, roughness: 0.58, metalness: 0.08, flatShading: true })
const underside = new THREE.MeshStandardMaterial({ color: 0xc59d68, roughness: 0.7, flatShading: true })
const canopy = new THREE.MeshStandardMaterial({ color: 0x263f43, roughness: 0.28, metalness: 0.2, flatShading: true })

const wingShape = new THREE.Shape()
wingShape.moveTo(-0.55, 1.25)
wingShape.lineTo(-16, 0.2)
wingShape.lineTo(-16, -2.7)
wingShape.lineTo(-0.55, -1.7)
wingShape.lineTo(0.55, -1.7)
wingShape.lineTo(16, -2.7)
wingShape.lineTo(16, 0.2)
wingShape.lineTo(0.55, 1.25)
wingShape.closePath()
const mainWing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), ivory)
mainWing.rotation.x = -Math.PI / 2
mainWing.position.y = 0.1
glider.add(mainWing)

const tailShape = new THREE.Shape()
tailShape.moveTo(-0.35, 4.0)
tailShape.lineTo(-4.5, 3.55)
tailShape.lineTo(-4.5, 1.6)
tailShape.lineTo(4.5, 1.6)
tailShape.lineTo(4.5, 3.55)
tailShape.lineTo(0.35, 4.0)
tailShape.closePath()
const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), underside)
tail.rotation.x = -Math.PI / 2
tail.position.y = 0.14
glider.add(tail)

const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.76, 12, 9), ivory)
fuselage.rotation.x = -Math.PI / 2
glider.add(fuselage)
const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), canopy)
cockpit.scale.set(0.72, 0.48, 1.45)
cockpit.position.set(0, 0.72, -1.3)
glider.add(cockpit)
const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 2.3), underside)
tailFin.position.set(0, 0.9, 4.1)
glider.add(tailFin)
scene.add(glider)

const flight = createFlightState()
const treeTransform = new THREE.Object3D()
const foliageColor = new THREE.Color()
let forestRegionX = Number.NaN
let forestRegionZ = Number.NaN

function updateForest(): void {
  const regionX = Math.round(flight.x / 6000)
  const regionZ = Math.round(flight.z / 6000)
  if (regionX === forestRegionX && regionZ === forestRegionZ) return
  forestRegionX = regionX
  forestRegionZ = regionZ

  const trees = generateForest(regionX * 6000, regionZ * 6000, treeCapacity)
  let pineCount = 0
  let broadleafCount = 0
  trees.forEach((tree, index) => {
    treeTransform.position.set(tree.x, tree.height + tree.scale * 5, tree.z)
    treeTransform.rotation.set(0, tree.rotation, 0)
    treeTransform.scale.setScalar(tree.scale)
    treeTransform.updateMatrix()
    forestTrunks.setMatrixAt(index, treeTransform.matrix)

    if (tree.kind === 'pine') {
      treeTransform.position.y = tree.height + tree.scale * 19
      treeTransform.updateMatrix()
      forestCrowns.setMatrixAt(pineCount, treeTransform.matrix)
      foliageColor.setHSL(0.27 + (tree.scale - 0.65) * 0.018, 0.31, 0.23 + (tree.scale - 0.65) * 0.05)
      forestCrowns.setColorAt(pineCount, foliageColor)
      pineCount += 1
    } else {
      treeTransform.position.y = tree.height + tree.scale * 17
      treeTransform.scale.set(tree.scale * 1.5, tree.scale * 1.1, tree.scale * 1.35)
      treeTransform.updateMatrix()
      forestBroadleaf.setMatrixAt(broadleafCount, treeTransform.matrix)
      foliageColor.setHSL(0.29 + (tree.scale - 0.65) * 0.018, 0.39, 0.27 + (tree.scale - 0.65) * 0.05)
      forestBroadleaf.setColorAt(broadleafCount, foliageColor)
      broadleafCount += 1
    }
  })
  const rocks = generateRockField(regionX * 6000, regionZ * 6000, rockCapacity)
  rocks.forEach((rock, index) => {
    treeTransform.position.set(rock.x, rock.height + rock.scale * 5, rock.z)
    treeTransform.rotation.set(rock.rotation * 0.25, rock.rotation, rock.rotation * 0.18)
    treeTransform.scale.set(rock.scale * 1.25, rock.scale * 0.72, rock.scale)
    treeTransform.updateMatrix()
    rockOutcrops.setMatrixAt(index, treeTransform.matrix)
    foliageColor.setHSL(0.1, 0.08, 0.32 + rock.scale * 0.055)
    rockOutcrops.setColorAt(index, foliageColor)
  })
  forestTrunks.count = trees.length
  forestCrowns.count = pineCount
  forestBroadleaf.count = broadleafCount
  rockOutcrops.count = rocks.length
  forestTrunks.instanceMatrix.needsUpdate = true
  forestCrowns.instanceMatrix.needsUpdate = true
  forestBroadleaf.instanceMatrix.needsUpdate = true
  rockOutcrops.instanceMatrix.needsUpdate = true
  if (forestCrowns.instanceColor) forestCrowns.instanceColor.needsUpdate = true
  if (forestBroadleaf.instanceColor) forestBroadleaf.instanceColor.needsUpdate = true
  if (rockOutcrops.instanceColor) rockOutcrops.instanceColor.needsUpdate = true
  forestTrunks.computeBoundingSphere()
  forestCrowns.computeBoundingSphere()
  forestBroadleaf.computeBoundingSphere()
  rockOutcrops.computeBoundingSphere()
}

updateForest()
const cloudGeometry = new THREE.SphereGeometry(1, 10, 7)
const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xf3f0e4, transparent: true, opacity: 0.8, depthWrite: false })
let randomSeed = 2041
const random = () => {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0
  return randomSeed / 4294967296
}

function createCloud(): THREE.Group {
  const cloud = new THREE.Group()
  const count = 5 + Math.floor(random() * 5)
  for (let index = 0; index < count; index += 1) {
    const puff = new THREE.Mesh(cloudGeometry, cloudMaterial)
    puff.position.set((random() - 0.5) * 210, (random() - 0.5) * 45, (random() - 0.5) * 125)
    puff.scale.set(0.58 + random() * 0.8, 0.2 + random() * 0.18, 0.42 + random() * 0.58)
    cloud.add(puff)
  }
  cloud.position.set((random() - 0.5) * 7400, 1450 + random() * 780, (random() - 0.5) * 7400)
  scene.add(cloud)
  return cloud
}

const clouds = Array.from({ length: 30 }, createCloud)
const pressedKeys = new Set<string>()
let touchRoll = 0
let touchPitch = 0
let touchBoost = false
let paused = false

function controlValue(negative: string[], positive: string[], touch: number): number {
  const down = negative.some((key) => pressedKeys.has(key))
  const up = positive.some((key) => pressedKeys.has(key))
  return (Number(up) - Number(down)) || touch
}

function setPaused(value: boolean): void {
  paused = value
  pauseButton.setAttribute('aria-label', paused ? 'Resume flight' : 'Pause flight')
  pauseLabel.textContent = paused ? 'RESUME' : 'PAUSE'
  pauseShade.classList.toggle('is-visible', paused)
  document.querySelector('.flight-status span:last-child')!.textContent = paused ? 'PAUSED' : 'IN THE AIR'
}

function resetFlight(): void {
  Object.assign(flight, createFlightState())
  setPaused(false)
}

pauseButton.addEventListener('click', () => setPaused(!paused))
document.querySelector<HTMLButtonElement>('#reset-flight')!.addEventListener('click', resetFlight)
boostButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  boostButton.setPointerCapture(event.pointerId)
  touchBoost = true
})
const releaseBoost = () => { touchBoost = false }
boostButton.addEventListener('pointerup', releaseBoost)
boostButton.addEventListener('pointercancel', releaseBoost)
boostButton.addEventListener('lostpointercapture', releaseBoost)

const touchButtons: Array<[string, number, number]> = [
  ['bank-left', -1, 0],
  ['bank-right', 1, 0],
  ['pitch-up', 0, 1],
  ['pitch-down', 0, -1],
]

for (const [id, roll, pitch] of touchButtons) {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`)!
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    button.setPointerCapture(event.pointerId)
    touchRoll = roll
    touchPitch = pitch
  })
  const release = () => {
    touchRoll = 0
    touchPitch = 0
  }
  button.addEventListener('pointerup', release)
  button.addEventListener('pointercancel', release)
  button.addEventListener('lostpointercapture', release)
}

window.addEventListener('keydown', (event) => {
  const controls = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']
  const boostControls = ['Space', 'ShiftLeft', 'ShiftRight']
  if (controls.includes(event.code) || boostControls.includes(event.code)) {
    event.preventDefault()
    pressedKeys.add(event.code)
  }
  if (event.code === 'KeyP' && !event.repeat) setPaused(!paused)
  if (event.code === 'KeyR' && !event.repeat) resetFlight()
})
window.addEventListener('keyup', (event) => pressedKeys.delete(event.code))
window.addEventListener('blur', () => {
  pressedKeys.clear()
  touchRoll = 0
  touchPitch = 0
  touchBoost = false
})

function updateReadouts(): void {
  const groundHeight = terrainHeight(flight.x, flight.z)
  altitudeReadout.textContent = Math.round(flight.y).toLocaleString('en-US')
  speedReadout.textContent = Math.round(flight.speed * 3.6).toString()
  headingReadout.textContent = Math.round(((flight.heading * 180 / Math.PI + 360) % 360)).toString().padStart(3, '0')
  terrainReadout.textContent = flight.y - groundHeight < 380 ? 'OVER THE HIGHLANDS' : 'ABOVE THE RIDGELINE'
  const northing = Math.round(36 + flight.z / 11000)
  const easting = Math.round(118 + flight.x / 11000)
  coordinatesReadout.textContent = `${northing} 12 N\u00a0\u00a0 ${easting} 41 W`
  const boostHeld = touchBoost || pressedKeys.has('Space') || pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')
  boostButton.setAttribute('aria-pressed', boostHeld.toString())
  boostButton.classList.toggle('is-active', flight.boost > 0.15)
  document.querySelector('.flight-status span:last-child')!.textContent = paused ? 'PAUSED' : flight.boost > 0.5 ? 'BOOSTING' : 'IN THE AIR'
}

let previousFrame = performance.now()
function render(now: number): void {
  const delta = Math.min((now - previousFrame) / 1000, 0.05)
  previousFrame = now

  if (!paused) {
    stepFlight(flight, {
      roll: controlValue(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD'], touchRoll),
      pitch: controlValue(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW'], touchPitch),
      boost: touchBoost || pressedKeys.has('Space') || pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight'),
    }, delta)
  }

  glider.position.set(flight.x, flight.y, flight.z)
  glider.rotation.order = 'YXZ'
  glider.rotation.set(flight.pitch, flight.heading, flight.bank)
  terrain.position.set(flight.x, 0, flight.z)
  ;(terrainMaterial.uniforms.uOffset.value as THREE.Vector2).set(flight.x, flight.z)
  updateForest()

  const cameraOffset = new THREE.Vector3(0, 13, 58).applyQuaternion(glider.quaternion)
  const desiredCameraPosition = glider.position.clone().add(cameraOffset)
  const cameraTarget = glider.position.clone().add(new THREE.Vector3(0, 0, -45).applyQuaternion(glider.quaternion))
  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-delta * 3.4))
  camera.lookAt(cameraTarget)
  sky.position.copy(camera.position)

  for (const cloud of clouds) {
    const distance = Math.hypot(cloud.position.x - flight.x, cloud.position.z - flight.z)
    if (distance > 6700) {
      const angle = random() * Math.PI * 2
      const radius = 2800 + random() * 2100
      cloud.position.set(flight.x + Math.cos(angle) * radius, 1450 + random() * 780, flight.z + Math.sin(angle) * radius)
    }
  }

  updateReadouts()
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
})

updateReadouts()
requestAnimationFrame(render)

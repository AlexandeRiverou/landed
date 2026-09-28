import * as THREE from 'three'
import './style.css'
import { createFlightState, stepFlight } from './flight'
import { createFieldNote, fieldNoteBearing, fieldNoteDistance, fieldNoteProgress, reachedFieldNote, type FieldNote } from './objectives'
import { worldEventForObjective, type WorldEvent } from './world-events'
import { createWorldSeed, generateCannons, generateFlyingThings, generateForest, generateRockField, generateSettlement, setWorldSeed, terrainGridOrigin, terrainHeight, terrainNormalAt, waterCoverage } from './world'

const worldSeed = createWorldSeed()
setWorldSeed(worldSeed)

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

    <section class="wayfinder" aria-label="Wayfinder field note">
      <div class="wayfinder-heading"><span>FIELD NOTES</span><span id="note-count">00 KEPT</span></div>
      <strong id="note-title">THE LONG VIEW</strong>
      <p id="note-prompt">Fly through the amber ring</p>
      <div class="note-range-row"><span>TO THE GATE</span><span class="note-bearing"><i class="note-arrow" id="note-arrow" aria-hidden="true"></i><span id="note-range">2.0 KM</span></span></div>
      <div class="note-progress" aria-hidden="true"><span id="note-progress"></span></div>
    </section>

    <div class="sightline" aria-hidden="true"><span></span><i></i><span></span></div>
    <div class="moment-toast" id="moment-toast" aria-live="polite" aria-hidden="true">
      <span>FIELD NOTE SAVED</span>
      <strong id="moment-title">THE SKY IS SMILING</strong>
      <small id="moment-copy">The clouds think they are helping.</small>
    </div>

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
const noteCountReadout = document.querySelector<HTMLSpanElement>('#note-count')!
const noteTitleReadout = document.querySelector<HTMLElement>('#note-title')!
const notePromptReadout = document.querySelector<HTMLParagraphElement>('#note-prompt')!
const noteRangeReadout = document.querySelector<HTMLSpanElement>('#note-range')!
const noteProgressReadout = document.querySelector<HTMLSpanElement>('#note-progress')!
const noteArrowReadout = document.querySelector<HTMLElement>('#note-arrow')!
const momentToast = document.querySelector<HTMLDivElement>('#moment-toast')!
const momentTitle = document.querySelector<HTMLElement>('#moment-title')!
const momentCopy = document.querySelector<HTMLElement>('#moment-copy')!

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
const hemisphereLight = new THREE.HemisphereLight(0xe5f4ed, 0x40594e, 2.05)
scene.add(hemisphereLight)

const sunDirection = new THREE.Vector3(0.37, 0.62, -0.69).normalize()
const moonAzimuth = ((worldSeed & 0xffff) / 0x10000) * Math.PI * 2
const moonElevation = 0.34 + ((worldSeed >>> 16) / 0x10000) * 0.38
const moonDirection = new THREE.Vector3(
  Math.cos(moonAzimuth) * Math.cos(moonElevation),
  Math.sin(moonElevation),
  -Math.sin(moonAzimuth) * Math.cos(moonElevation),
).normalize()
const sunlight = new THREE.DirectionalLight(0xffe4b7, 2.2)
sunlight.position.copy(sunDirection).multiplyScalar(5000)
scene.add(sunlight)
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(260, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xf3e9ca, toneMapped: false }),
)
moon.visible = false
scene.add(moon)

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uSunDirection: { value: sunDirection },
    uSkyTop: { value: new THREE.Color().setRGB(0.16, 0.43, 0.53) },
    uSkyHorizon: { value: new THREE.Color().setRGB(0.72, 0.79, 0.74) },
    uNight: { value: 0 },
    uStorm: { value: 0 },
    uAurora: { value: 0 },
  },
  vertexShader: `
    varying vec3 vDirection;
    void main() {
      vDirection = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uSunDirection;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHorizon;
    uniform float uNight;
    uniform float uStorm;
    uniform float uAurora;
    varying vec3 vDirection;
    void main() {
      vec3 direction = normalize(vDirection);
      float horizon = smoothstep(-0.12, 0.82, direction.y);
      vec3 daySky = mix(uSkyHorizon, uSkyTop, horizon);
      vec3 nightSky = mix(vec3(0.012, 0.018, 0.055), vec3(0.065, 0.12, 0.25), horizon);
      vec3 sky = mix(daySky, nightSky, uNight);
      float sun = max(dot(direction, normalize(uSunDirection)), 0.0);
      sky += vec3(1.0, 0.63, 0.34) * pow(sun, 160.0) * 1.1 * (1.0 - uNight);
      sky += vec3(1.0, 0.74, 0.48) * pow(sun, 13.0) * 0.14 * (1.0 - uNight);
      vec3 starCell = floor(direction * vec3(310.0, 180.0, 310.0));
      float starHash = fract(sin(dot(starCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float stars = step(0.9972, starHash) * smoothstep(-0.12, 0.4, direction.y);
      sky += vec3(0.72, 0.84, 1.0) * stars * uNight * 2.4;
      float auroraWave = 0.5 + 0.5 * sin(direction.x * 22.0 + sin(direction.z * 13.0) * 3.0);
      float auroraBand = smoothstep(0.58, 0.98, auroraWave) * smoothstep(0.05, 0.82, direction.y);
      sky += vec3(0.08, 0.9, 0.46) * auroraBand * uAurora * 0.72;
      sky = mix(sky, vec3(0.18, 0.25, 0.32), uStorm * 0.78);
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
  uniforms: {
    uOffset: { value: new THREE.Vector2() },
    uFestival: { value: 0 },
    uEventGround: { value: new THREE.Color(0xffffff) },
    uEventWater: { value: new THREE.Color(0xffffff) },
    uLunar: { value: 0 },
  },
  vertexShader: `
    uniform vec2 uOffset;
    varying float vHeight;
    varying float vWater;
    varying float vVariation;
    varying float vFineVariation;
    varying vec3 vNormal;
    varying vec2 vLocal;
    varying vec2 vWorld;

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
      vWorld = point;
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
      vFineVariation = noise(point * 0.006);
      vNormal = normalize(vec3(left - right, 10.0, down - up));
      vec3 displaced = position;
      displaced.y = height;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uFestival;
    uniform vec3 uEventGround;
    uniform vec3 uEventWater;
    uniform float uLunar;
    varying float vHeight;
    varying float vWater;
    varying float vVariation;
    varying float vFineVariation;
    varying vec3 vNormal;
    varying vec2 vLocal;
    varying vec2 vWorld;
    void main() {
      vec3 grass = mix(vec3(0.045, 0.19, 0.045), vec3(0.17, 0.37, 0.075), vVariation);
      vec3 soil = mix(vec3(0.34, 0.16, 0.065), vec3(0.49, 0.28, 0.11), vFineVariation);
      vec3 rock = mix(vec3(0.31, 0.29, 0.25), vec3(0.49, 0.43, 0.33), vVariation);
      vec3 snow = vec3(0.76, 0.84, 0.80);
      float dryPatches = smoothstep(0.64, 0.84, vFineVariation) * (1.0 - smoothstep(540.0, 790.0, vHeight)) * 0.7;
      float exposedSoil = max(smoothstep(320.0, 650.0, vHeight) * (0.55 + vVariation * 0.45), dryPatches);
      vec3 ground = mix(grass, soil, exposedSoil);
      ground = mix(ground, rock, smoothstep(610.0, 940.0, vHeight));
      ground = mix(ground, snow, smoothstep(1080.0, 1330.0, vHeight));
      float ripple = 0.5 + 0.5 * sin(vWorld.x * 0.003 + sin(vWorld.y * 0.002) * 2.0);
      vec3 water = mix(vec3(0.055, 0.25, 0.29), vec3(0.28, 0.55, 0.54), smoothstep(0.56, 0.98, ripple));
      ground = mix(ground, water, smoothstep(0.12, 0.8, vWater));
      float light = 0.42 + 0.78 * max(dot(normalize(vNormal), normalize(vec3(-0.36, 0.86, 0.37))), 0.0);
      ground *= light;
      float haze = smoothstep(6200.0, 11200.0, length(vLocal));
      ground = mix(ground, vec3(0.49, 0.65, 0.59), haze * 0.42);
      vec3 eventGround = mix(uEventGround, uEventWater, smoothstep(0.12, 0.8, vWater));
      float lunarGray = dot(eventGround, vec3(0.299, 0.587, 0.114));
      eventGround = mix(eventGround, vec3(lunarGray * 0.84), uLunar);
      ground = mix(ground, eventGround, uFestival * 0.84);
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

const cannonField = new THREE.Group()
const cannonWood = new THREE.MeshStandardMaterial({ color: 0x674a31, roughness: 0.92, flatShading: true })
const cannonIron = new THREE.MeshStandardMaterial({ color: 0x343b39, roughness: 0.68, metalness: 0.42, flatShading: true })
const cannonWheelGeometry = new THREE.CylinderGeometry(13, 13, 6, 12)
const cannonBarrelGeometry = new THREE.CylinderGeometry(6.5, 8.5, 52, 10)
const cannonMuzzleGeometry = new THREE.CylinderGeometry(9.2, 8.5, 8, 10)
scene.add(cannonField)

function createCannon(site: ReturnType<typeof generateCannons>[number]): THREE.Group {
  const cannon = new THREE.Group()
  const normal = terrainNormalAt(site.x, site.z)
  const surfaceNormal = new THREE.Vector3(normal.x, normal.y, normal.z)
  const alignToSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal)
  const turnOnSlope = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.rotation)
  cannon.quaternion.copy(alignToSlope.multiply(turnOnSlope))
  cannon.scale.setScalar(site.scale)
  cannon.position.set(site.x + normal.x * 4, site.height + normal.y * 4, site.z + normal.z * 4)

  const carriage = new THREE.Mesh(new THREE.BoxGeometry(40, 11, 48), cannonWood)
  carriage.position.set(0, 17, 6)
  cannon.add(carriage)

  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(cannonWheelGeometry, cannonWood)
    wheel.position.set(side * 22, 13, 8)
    wheel.rotation.z = Math.PI / 2
    cannon.add(wheel)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 7, 8), cannonIron)
    hub.position.copy(wheel.position)
    hub.rotation.copy(wheel.rotation)
    cannon.add(hub)
  }

  const barrel = new THREE.Mesh(cannonBarrelGeometry, cannonIron)
  barrel.position.set(0, 34, -5)
  barrel.rotation.x = -Math.PI / 2 + 0.48
  cannon.add(barrel)
  const muzzle = new THREE.Mesh(cannonMuzzleGeometry, cannonIron)
  muzzle.position.set(0, 45.2, -26.2)
  muzzle.rotation.x = barrel.rotation.x
  cannon.add(muzzle)
  const sight = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 3), cannonWood)
  sight.position.set(0, 41, -4)
  cannon.add(sight)
  return cannon
}

const townGroup = new THREE.Group()
scene.add(townGroup)
const roadSurface = new THREE.MeshStandardMaterial({ color: 0x55574f, roughness: 0.96, flatShading: true })
const roadPaint = new THREE.MeshStandardMaterial({ color: 0xd8c98c, roughness: 0.88, flatShading: true })
const roadGeometry = new THREE.BoxGeometry(1, 1, 1)
const buildingGeometry = new THREE.BoxGeometry(1, 1, 1)
const roofGeometry = new THREE.ConeGeometry(1, 1, 4)
const foundationMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6355, roughness: 1, flatShading: true })
const wallMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xd7c08d, roughness: 0.94, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0xc98562, roughness: 0.94, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0xd8d4c2, roughness: 0.94, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0x879578, roughness: 0.94, flatShading: true }),
]
const roofMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x64493b, roughness: 0.91, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0x3f5554, roughness: 0.88, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0xb64f3c, roughness: 0.9, flatShading: true }),
]
const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x9dc8c5, roughness: 0.38, metalness: 0.15, flatShading: true })
const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x594435, roughness: 0.95, flatShading: true })
const carMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xc7543f, roughness: 0.48, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0x477b8f, roughness: 0.48, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0xd2a74f, roughness: 0.48, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0x455b49, roughness: 0.48, flatShading: true }),
]
const carBodyGeometry = new THREE.BoxGeometry(25, 8, 13)
const carCabinGeometry = new THREE.BoxGeometry(13, 7, 10)
const carWheelGeometry = new THREE.CylinderGeometry(3.3, 3.3, 2.4, 8)
const carActors: Array<{ group: THREE.Group; site: ReturnType<typeof generateSettlement>['cars'][number] }> = []

function createTownBuilding(site: ReturnType<typeof generateSettlement>['buildings'][number]): THREE.Group {
  const group = new THREE.Group()
  const normal = terrainNormalAt(site.x, site.z)
  const surfaceNormal = new THREE.Vector3(normal.x, normal.y, normal.z)
  const alignToSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal)
  const turnOnSlope = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.rotation)
  group.quaternion.copy(alignToSlope.multiply(turnOnSlope))
  group.scale.setScalar(site.scale)
  group.position.set(site.x + normal.x * 2, site.height + normal.y * 2, site.z + normal.z * 2)

  const width = site.kind === 'barn' ? 46 : site.kind === 'cottage' ? 31 : 38
  const depth = site.kind === 'shop' ? 38 : 31
  const bodyHeight = site.kind === 'cottage' ? 24 : site.kind === 'shop' ? 34 : site.kind === 'barn' ? 31 : 29
  const roofHeight = site.kind === 'cottage' ? 24 : site.kind === 'barn' ? 19 : 17
  const wallIndex = Math.floor(Math.abs(site.x * 0.017 + site.z * 0.013)) % wallMaterials.length
  const roofIndex = Math.floor(Math.abs(site.x * 0.009 + site.z * 0.011)) % roofMaterials.length

  const foundation = new THREE.Mesh(buildingGeometry, foundationMaterial)
  foundation.scale.set(width + 5, 4, depth + 5)
  foundation.position.y = 2
  group.add(foundation)
  const body = new THREE.Mesh(buildingGeometry, wallMaterials[wallIndex])
  body.scale.set(width, bodyHeight, depth)
  body.position.y = 4 + bodyHeight / 2
  group.add(body)

  if (site.kind === 'shop') {
    const awning = new THREE.Mesh(buildingGeometry, roofMaterials[2])
    awning.scale.set(width + 8, 3, 9)
    awning.position.set(0, bodyHeight * 0.48, -depth * 0.56)
    group.add(awning)
  } else {
    const roof = new THREE.Mesh(roofGeometry, roofMaterials[roofIndex])
    roof.scale.set(width * 0.78, roofHeight, depth * 0.78)
    roof.position.y = 4 + bodyHeight + roofHeight / 2
    roof.rotation.y = Math.PI / 4
    group.add(roof)
  }

  const door = new THREE.Mesh(buildingGeometry, doorMaterial)
  door.scale.set(width * 0.18, bodyHeight * 0.58, 1.5)
  door.position.set(0, 4 + bodyHeight * 0.29, -depth * 0.51)
  group.add(door)
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(buildingGeometry, windowMaterial)
    window.scale.set(width * 0.18, bodyHeight * 0.22, 1.2)
    window.position.set(side * width * 0.29, 4 + bodyHeight * 0.58, -depth * 0.52)
    group.add(window)
  }

  return group
}

function createTownCar(site: ReturnType<typeof generateSettlement>['cars'][number]): THREE.Group {
  const car = new THREE.Group()
  const colorIndex = [0xc7543f, 0x477b8f, 0xd2a74f, 0x455b49].indexOf(site.color)
  const body = new THREE.Mesh(carBodyGeometry, carMaterials[Math.max(0, colorIndex)])
  body.position.y = 7
  car.add(body)
  const cabin = new THREE.Mesh(carCabinGeometry, windowMaterial)
  cabin.position.set(1.5, 14.2, 0)
  car.add(cabin)
  for (const x of [-7.5, 7.5]) {
    for (const z of [-7, 7]) {
      const wheel = new THREE.Mesh(carWheelGeometry, cannonIron)
      wheel.position.set(x, 4, z)
      wheel.rotation.z = Math.PI / 2
      car.add(wheel)
    }
  }
  return car
}

function updateTownCars(now: number): void {
  const loopRadius = 300
  const halfPerimeter = loopRadius * 2
  const fullPerimeter = halfPerimeter * 4
  for (const actor of carActors) {
    const distance = (now * 0.006 * actor.site.speed + actor.site.phase * fullPerimeter) % fullPerimeter
    const leg = Math.floor(distance / halfPerimeter)
    const part = distance % halfPerimeter
    let localX: number
    let localZ: number
    let direction: number
    if (leg === 0) {
      localX = -loopRadius + part
      localZ = -loopRadius
      direction = 0
    } else if (leg === 1) {
      localX = loopRadius
      localZ = -loopRadius + part
      direction = Math.PI / 2
    } else if (leg === 2) {
      localX = loopRadius - part
      localZ = loopRadius
      direction = Math.PI
    } else {
      localX = -loopRadius
      localZ = loopRadius - part
      direction = -Math.PI / 2
    }

    const cosine = Math.cos(actor.site.rotation)
    const sine = Math.sin(actor.site.rotation)
    const x = actor.site.x + localX * cosine + localZ * sine
    const z = actor.site.z - localX * sine + localZ * cosine
    actor.group.position.set(x, terrainHeight(x, z) + 5, z)
    actor.group.rotation.y = actor.site.rotation + direction
  }
}

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
const waypointRing = new THREE.Mesh(
  new THREE.TorusGeometry(78, 2.5, 12, 64),
  new THREE.MeshBasicMaterial({ color: 0xffd28a, side: THREE.DoubleSide, toneMapped: false }),
)
waypointRing.visible = false
scene.add(waypointRing)
let activeFieldNote: FieldNote | null = null
let fieldNotesKept = 0
let nextFieldNoteSequence = 0
let nextFieldNoteAt = 0
let lastNoteRange = ''
let activeWorldEvent: WorldEvent | null = null
const baseSkyTop = new THREE.Color().setRGB(0.16, 0.43, 0.53)
const baseSkyHorizon = new THREE.Color().setRGB(0.72, 0.79, 0.74)
const eventSkyTop = new THREE.Color()
const eventSkyHorizon = new THREE.Color()
const eventGroundTint = new THREE.Color()
const eventWaterTint = new THREE.Color()
const neutralEventTint = new THREE.Color(0xffffff)

function beginFieldNote(): void {
  activeFieldNote = createFieldNote(nextFieldNoteSequence, flight.x, flight.y, flight.z, flight.heading)
  nextFieldNoteSequence += 1
  waypointRing.position.set(activeFieldNote.x, activeFieldNote.y, activeFieldNote.z)
  waypointRing.rotation.set(0, activeFieldNote.heading, 0)
  waypointRing.visible = true
  noteCountReadout.textContent = `${String(fieldNotesKept).padStart(2, '0')} KEPT`
  noteTitleReadout.textContent = activeFieldNote.title
  notePromptReadout.textContent = 'Fly through the amber ring'
  lastNoteRange = ''
}

function resetFieldNotes(): void {
  activeFieldNote = null
  fieldNotesKept = 0
  nextFieldNoteSequence = 0
  nextFieldNoteAt = performance.now() + 1800
  waypointRing.visible = false
  noteCountReadout.textContent = '00 KEPT'
  noteTitleReadout.textContent = 'THE NEXT VIEW'
  notePromptReadout.textContent = 'A new wayfinder will appear soon'
  noteRangeReadout.textContent = 'SOON'
  noteProgressReadout.style.transform = 'scaleX(0)'
  lastNoteRange = 'SOON'
}

function updateFieldNote(now: number): void {
  if (!activeFieldNote) {
    if (now >= nextFieldNoteAt) beginFieldNote()
    else return
  }
  if (!activeFieldNote) return

  const distance = fieldNoteDistance(activeFieldNote, flight.x, flight.y, flight.z)
  waypointRing.scale.setScalar(1 + Math.sin(now * 0.002) * 0.035)
  waypointRing.rotation.z = Math.sin(now * 0.0007) * 0.035
  const rangeText = `${(distance / 1000).toFixed(1)} KM`
  if (rangeText !== lastNoteRange) {
    noteRangeReadout.textContent = rangeText
    lastNoteRange = rangeText
  }
  const bearing = fieldNoteBearing(activeFieldNote, flight.x, flight.z, flight.heading)
  noteArrowReadout.style.transform = `rotate(${-45 - bearing * 180 / Math.PI}deg)`
  noteProgressReadout.style.transform = `scaleX(${fieldNoteProgress(activeFieldNote, flight.x, flight.z)})`

  if (!paused && reachedFieldNote(activeFieldNote, flight.x, flight.y, flight.z)) {
    fieldNotesKept += 1
    const worldEvent = worldEventForObjective(fieldNotesKept - 1, worldSeed)
    noteCountReadout.textContent = `${String(fieldNotesKept).padStart(2, '0')} KEPT`
    noteTitleReadout.textContent = worldEvent.title
    notePromptReadout.textContent = worldEvent.message
    noteRangeReadout.textContent = 'LOOK UP'
    noteProgressReadout.style.transform = 'scaleX(1)'
    lastNoteRange = 'LOOK UP'
    activeFieldNote = null
    waypointRing.visible = false
    startCloudCelebration(now, worldEvent)
    nextFieldNoteAt = now + 11000
  }
}

beginFieldNote()
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
    const normal = terrainNormalAt(rock.x, rock.z)
    const surfaceNormal = new THREE.Vector3(normal.x, normal.y, normal.z)
    const alignToSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfaceNormal)
    const turnOnSlope = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, rock.rotation)
    const supportHeight = rock.scale * 8 * 0.72
    treeTransform.position.set(
      rock.x + normal.x * supportHeight,
      rock.height + normal.y * supportHeight,
      rock.z + normal.z * supportHeight,
    )
    treeTransform.quaternion.copy(turnOnSlope.multiply(alignToSlope))
    treeTransform.scale.set(rock.scale * 1.25, rock.scale * 0.72, rock.scale)
    treeTransform.updateMatrix()
    rockOutcrops.setMatrixAt(index, treeTransform.matrix)
    foliageColor.setHSL(0.1, 0.08, 0.32 + rock.scale * 0.055)
    rockOutcrops.setColorAt(index, foliageColor)
  })
  cannonField.clear()
  for (const site of generateCannons(regionX * 6000, regionZ * 6000, 12)) cannonField.add(createCannon(site))
  townGroup.clear()
  carActors.length = 0
  const town = generateSettlement(regionX * 6000, regionZ * 6000)
  for (const street of town.roads) {
    const road = new THREE.Mesh(roadGeometry, roadSurface)
    road.position.set(street.x, street.height + 1, street.z)
    road.rotation.y = street.rotation
    road.scale.set(street.length, 1.4, street.width)
    townGroup.add(road)

    for (const dash of [-1, 0, 1]) {
      const marking = new THREE.Mesh(roadGeometry, roadPaint)
      marking.position.set(dash * 34, 0.8, 0)
      marking.scale.set(15, 0.4, 1.2)
      road.add(marking)
    }
  }
  for (const building of town.buildings) townGroup.add(createTownBuilding(building))
  for (const car of town.cars) {
    const group = createTownCar(car)
    townGroup.add(group)
    carActors.push({ group, site: car })
  }
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
let randomSeed = worldSeed
const random = () => {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0
  return randomSeed / 4294967296
}

interface FestivalFlower {
  x: number
  z: number
  height: number
  scale: number
  rotation: number
  hue: number
  normal: THREE.Vector3
  plantedAt: number
}

const flowersPerObjective = 48
const flowerCapacity = 48 * 24
const flowerStemInstances = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.8, 1.2, 22, 5),
  new THREE.MeshStandardMaterial({ color: 0x477d3d, roughness: 0.96, flatShading: true }),
  flowerCapacity,
)
const flowerHeadInstances = new THREE.InstancedMesh(
  new THREE.DodecahedronGeometry(8, 0),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, flatShading: true }),
  flowerCapacity,
)
const flowerCenterInstances = new THREE.InstancedMesh(
  new THREE.SphereGeometry(3.2, 7, 5),
  new THREE.MeshStandardMaterial({ color: 0xffd26a, roughness: 0.78, flatShading: true }),
  flowerCapacity,
)
scene.add(flowerStemInstances, flowerHeadInstances, flowerCenterInstances)
let festivalFlowers: FestivalFlower[] = []
let worldCelebrationActive = false
let worldCelebrationStartedAt = 0
const flowerTransform = new THREE.Object3D()
const flowerColor = new THREE.Color()

function plantCelebrationFlowers(now: number): number {
  const targetCount = Math.min(flowersPerObjective, flowerCapacity - festivalFlowers.length)
  let planted = 0
  for (let attempt = 0; attempt < targetCount * 16 && planted < targetCount; attempt += 1) {
    const angle = random() * Math.PI * 2
    const distance = 300 + Math.sqrt(random()) * 1350
    const x = flight.x + Math.cos(angle) * distance
    const z = flight.z + Math.sin(angle) * distance
    if (waterCoverage(x, z) > 0.08) continue
    const height = terrainHeight(x, z)
    if (height > 1600) continue
    const surface = terrainNormalAt(x, z)
    festivalFlowers.push({
      x,
      z,
      height,
      scale: 0.55 + random() * 0.9,
      rotation: random() * Math.PI * 2,
      hue: random() * 0.98,
      normal: new THREE.Vector3(surface.x, surface.y, surface.z),
      plantedAt: now,
    })
    planted += 1
  }
  return planted
}

function updateCelebrationFlowers(now: number): void {
  festivalFlowers.forEach((flower, index) => {
    const age = now - flower.plantedAt
    if (age >= 850) return
    const growth = THREE.MathUtils.smoothstep(age / 850, 0, 1)
    const scale = flower.scale * growth
    const alignToSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), flower.normal)
    const turnOnSlope = new THREE.Quaternion().setFromAxisAngle(flower.normal, flower.rotation)
    flowerTransform.quaternion.copy(turnOnSlope.multiply(alignToSlope))
    flowerTransform.position.set(
      flower.x + flower.normal.x * scale * 10,
      flower.height + flower.normal.y * scale * 10,
      flower.z + flower.normal.z * scale * 10,
    )
    flowerTransform.scale.set(scale, scale, scale)
    flowerTransform.updateMatrix()
    flowerStemInstances.setMatrixAt(index, flowerTransform.matrix)

    flowerTransform.position.set(
      flower.x + flower.normal.x * scale * 23,
      flower.height + flower.normal.y * scale * 23,
      flower.z + flower.normal.z * scale * 23,
    )
    flowerTransform.scale.set(scale, scale * 0.8, scale)
    flowerTransform.updateMatrix()
    flowerHeadInstances.setMatrixAt(index, flowerTransform.matrix)
    flowerTransform.scale.setScalar(scale * 0.43)
    flowerTransform.updateMatrix()
    flowerCenterInstances.setMatrixAt(index, flowerTransform.matrix)
    flowerColor.setHSL(flower.hue, 0.78, 0.57)
    flowerHeadInstances.setColorAt(index, flowerColor)
  })

  flowerStemInstances.count = festivalFlowers.length
  flowerHeadInstances.count = festivalFlowers.length
  flowerCenterInstances.count = festivalFlowers.length
  flowerStemInstances.instanceMatrix.needsUpdate = true
  flowerHeadInstances.instanceMatrix.needsUpdate = true
  flowerCenterInstances.instanceMatrix.needsUpdate = true
  if (flowerHeadInstances.instanceColor) flowerHeadInstances.instanceColor.needsUpdate = true
  flowerStemInstances.computeBoundingSphere()
  flowerHeadInstances.computeBoundingSphere()
  flowerCenterInstances.computeBoundingSphere()
}

function startWorldCelebration(now: number, worldEvent: WorldEvent): void {
  worldCelebrationStartedAt = now
  worldCelebrationActive = true
  activeWorldEvent = worldEvent
  eventSkyTop.setHex(worldEvent.skyTop)
  eventSkyHorizon.setHex(worldEvent.skyHorizon)
  eventGroundTint.setHex(worldEvent.groundTint)
  eventWaterTint.setHex(worldEvent.waterTint)
  momentTitle.textContent = worldEvent.title
  momentCopy.textContent = `${worldEvent.message} ${plantCelebrationFlowers(now)} emergency flowers have been planted.`
  momentToast.setAttribute('aria-hidden', 'false')
  momentToast.classList.add('is-visible')
}

function updateWorldCelebration(now: number): void {
  if (!activeWorldEvent) return

  const elapsed = now - worldCelebrationStartedAt
  const eventMix = THREE.MathUtils.smoothstep(elapsed / 1200, 0, 1)
  ;(terrainMaterial.uniforms.uFestival.value as number) = eventMix
  skyMaterial.uniforms.uSkyTop.value.copy(baseSkyTop).lerp(eventSkyTop, eventMix)
  skyMaterial.uniforms.uSkyHorizon.value.copy(baseSkyHorizon).lerp(eventSkyHorizon, eventMix)
  skyMaterial.uniforms.uNight.value = (activeWorldEvent?.night ?? 0) * eventMix
  skyMaterial.uniforms.uStorm.value = (activeWorldEvent?.storm ?? 0) * eventMix
  skyMaterial.uniforms.uAurora.value = (activeWorldEvent?.aurora ?? 0) * eventMix
  terrainMaterial.uniforms.uEventGround.value.copy(eventGroundTint).lerp(new THREE.Color(0xffffff), 1 - eventMix)
  terrainMaterial.uniforms.uEventWater.value.copy(eventWaterTint).lerp(new THREE.Color(0xffffff), 1 - eventMix)
  terrainMaterial.uniforms.uLunar.value = activeWorldEvent?.id === 'lunar-mail' ? eventMix : 0
  hemisphereLight.intensity = 2.05 * (1 - eventMix * ((activeWorldEvent?.night ?? 0) * 0.66 + (activeWorldEvent?.storm ?? 0) * 0.3))
  sunlight.intensity = 2.2 * (1 - eventMix * ((activeWorldEvent?.night ?? 0) * 0.9 + (activeWorldEvent?.storm ?? 0) * 0.58))
  moon.visible = Boolean(activeWorldEvent?.moon && eventMix > 0.08)
  updateCelebrationFlowers(now)
  skyMaterial.uniforms.uSkyTop.value.copy(baseSkyTop).lerp(eventSkyTop, eventMix)
  skyMaterial.uniforms.uSkyHorizon.value.copy(baseSkyHorizon).lerp(eventSkyHorizon, eventMix)
  skyMaterial.uniforms.uNight.value = (activeWorldEvent?.night ?? 0) * eventMix
  skyMaterial.uniforms.uStorm.value = (activeWorldEvent?.storm ?? 0) * eventMix
  skyMaterial.uniforms.uAurora.value = (activeWorldEvent?.aurora ?? 0) * eventMix
  terrainMaterial.uniforms.uEventGround.value.copy(eventGroundTint).lerp(neutralEventTint, 1 - eventMix)
  terrainMaterial.uniforms.uEventWater.value.copy(eventWaterTint).lerp(neutralEventTint, 1 - eventMix)
  terrainMaterial.uniforms.uLunar.value = activeWorldEvent?.id === 'lunar-mail' ? eventMix : 0
  hemisphereLight.intensity = 2.05 * (1 - eventMix * ((activeWorldEvent?.night ?? 0) * 0.66 + (activeWorldEvent?.storm ?? 0) * 0.3))
  sunlight.intensity = 2.2 * (1 - eventMix * ((activeWorldEvent?.night ?? 0) * 0.9 + (activeWorldEvent?.storm ?? 0) * 0.58))
  moon.visible = Boolean(activeWorldEvent?.moon && eventMix > 0.08)
  cloudMaterial.color.setHex(activeWorldEvent?.storm ? 0x8796a2 : 0xf3f0e4)
  cloudMaterial.opacity = 0.8 - eventMix * ((activeWorldEvent?.storm ?? 0) * 0.18)
  momentToast.classList.toggle('is-visible', worldCelebrationActive && elapsed < 4800)

  if (elapsed >= 10500 && worldCelebrationActive) {
    worldCelebrationActive = false
    momentToast.setAttribute('aria-hidden', 'true')
    momentToast.classList.remove('is-visible')
  }
}

function createCloud(): THREE.Group {
  const cloud = new THREE.Group()
  const count = 5 + Math.floor(random() * 5)
  for (let index = 0; index < count; index += 1) {
    const puff = new THREE.Mesh(cloudGeometry, cloudMaterial)
    puff.position.set((random() - 0.5) * 190, (random() - 0.5) * 36, (random() - 0.5) * 130)
    puff.scale.set(95 + random() * 105, 32 + random() * 28, 70 + random() * 75)
    cloud.add(puff)
  }
  cloud.position.set((random() - 0.5) * 7400, 1450 + random() * 780, (random() - 0.5) * 7400)
  scene.add(cloud)
  return cloud
}

const clouds = Array.from({ length: 30 }, createCloud)
let cloudCelebrationActive = false
let cloudCelebrationStartedAt = 0
let cloudCelebrationHomes: THREE.Vector3[] = []
let cloudCelebrationFaces: THREE.Vector3[] = []

function startCloudCelebration(now: number, worldEvent: WorldEvent): void {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(glider.quaternion).normalize()
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(glider.quaternion).normalize()
  const center = new THREE.Vector3(flight.x, flight.y, flight.z)
    .addScaledVector(forward, 1650)
    .add(new THREE.Vector3(0, 470, 0))

  cloudCelebrationHomes = clouds.map((cloud) => cloud.position.clone())
  cloudCelebrationFaces = clouds.map((_, index) => {
    let horizontal: number
    let vertical: number

    if (index < 8) {
      const eye = index < 4 ? -460 : 460
      const part = index % 4
      const angle = part * Math.PI / 2
      horizontal = eye + Math.cos(angle) * 105
      vertical = 145 + Math.sin(angle) * 115
    } else if (index < 23) {
      const part = index - 8
      horizontal = (part / 14 - 0.5) * 1350
      vertical = -175 + (horizontal * horizontal) / 3600
    } else if (index < 27) {
      horizontal = index % 2 === 0 ? -760 : 760
      vertical = -80 - (index % 3) * 48
    } else {
      const sparkles = [-650, 0, 650]
      horizontal = sparkles[(index - 27) % sparkles.length]
      vertical = index === 28 ? 430 : 330
    }

    return center.clone().addScaledVector(right, horizontal).add(new THREE.Vector3(0, vertical, 0))
  })
  cloudCelebrationStartedAt = now
  cloudCelebrationActive = true
  startWorldCelebration(now, worldEvent)
}

function updateCloudCelebration(now: number): void {
  if (!cloudCelebrationActive) return

  const elapsed = now - cloudCelebrationStartedAt
  const gatherDuration = 1800
  const portraitDuration = 6800
  const dissolveDuration = 1900
  const gather = THREE.MathUtils.smoothstep(elapsed / gatherDuration, 0, 1)
  const dissolve = THREE.MathUtils.smoothstep((elapsed - gatherDuration - portraitDuration) / dissolveDuration, 0, 1)

  clouds.forEach((cloud, index) => {
    if (elapsed < gatherDuration) {
      cloud.position.lerpVectors(cloudCelebrationHomes[index], cloudCelebrationFaces[index], gather)
    } else if (elapsed < gatherDuration + portraitDuration) {
      cloud.position.copy(cloudCelebrationFaces[index])
      cloud.position.y += Math.sin(now * 0.0018 + index) * 14
    } else if (elapsed < gatherDuration + portraitDuration + dissolveDuration) {
      cloud.position.lerpVectors(cloudCelebrationFaces[index], cloudCelebrationHomes[index], dissolve)
    } else {
      cloudCelebrationActive = false
    }
  })
}

interface TrafficActor {
  group: THREE.Group
  spawn: ReturnType<typeof generateFlyingThings>[number]
  distance: number
  wings: Array<{ left: THREE.Group; right: THREE.Group; phase: number }>
}

const birdMaterial = new THREE.MeshStandardMaterial({ color: 0x34453c, roughness: 0.85, flatShading: true, side: THREE.DoubleSide })
const birdBodyGeometry = new THREE.ConeGeometry(0.28, 1.6, 5)
const leftWingShape = new THREE.Shape()
leftWingShape.moveTo(0, 0)
leftWingShape.lineTo(-4.8, -0.25)
leftWingShape.lineTo(-0.5, 0.7)
leftWingShape.closePath()
const rightWingShape = new THREE.Shape()
rightWingShape.moveTo(0, 0)
rightWingShape.lineTo(4.8, -0.25)
rightWingShape.lineTo(0.5, 0.7)
rightWingShape.closePath()
const leftWingGeometry = new THREE.ShapeGeometry(leftWingShape)
const rightWingGeometry = new THREE.ShapeGeometry(rightWingShape)
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xd76c42, roughness: 0.45, metalness: 0.08, flatShading: true })
const gliderMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e3d2, roughness: 0.58, metalness: 0.08, flatShading: true })
const kiteMaterial = new THREE.MeshStandardMaterial({ color: 0xd2a6dc, roughness: 0.8, flatShading: true, side: THREE.DoubleSide })
const kiteShape = new THREE.Shape()
kiteShape.moveTo(0, 19)
kiteShape.lineTo(14, 0)
kiteShape.lineTo(0, -21)
kiteShape.lineTo(-14, 0)
kiteShape.closePath()
const kiteGeometry = new THREE.ShapeGeometry(kiteShape)
const balloonMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xc7543f, roughness: 0.72, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0xd99f52, roughness: 0.72, flatShading: true }),
]
let trafficActors: TrafficActor[] = []
let trafficRegionX = Number.NaN
let trafficRegionZ = Number.NaN
const rainDropCount = 280
const rainPositions = new Float32Array(rainDropCount * 6)
for (let index = 0; index < rainDropCount; index += 1) {
  const offset = index * 6
  const x = (random() - 0.5) * 2500
  const y = 150 + random() * 1200
  const z = (random() - 0.5) * 3400
  rainPositions.set([x, y, z, x + 14, y - 75, z + 4], offset)
}
const rainGeometry = new THREE.BufferGeometry()
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage))
const rainMaterial = new THREE.LineBasicMaterial({ color: 0xbdd6eb, transparent: true, opacity: 0, depthWrite: false })
const rain = new THREE.LineSegments(rainGeometry, rainMaterial)
rain.frustumCulled = false
rain.visible = false
scene.add(rain)

function updateEventWeather(delta: number): void {
  const eventMix = terrainMaterial.uniforms.uFestival.value as number
  rain.visible = Boolean(activeWorldEvent?.rain && eventMix > 0.05)
  rainMaterial.opacity = (activeWorldEvent?.rain ?? false) ? eventMix * 0.64 : 0
  if (!rain.visible) return

  rain.position.set(flight.x, flight.y, flight.z)
  for (let index = 0; index < rainDropCount; index += 1) {
    const offset = index * 6
    rainPositions[offset + 1] -= delta * 720
    rainPositions[offset + 4] -= delta * 720
    if (rainPositions[offset + 1] < -160) {
      const x = (random() - 0.5) * 2500
      const y = 700 + random() * 700
      const z = (random() - 0.5) * 3400
      rainPositions.set([x, y, z, x + 14, y - 75, z + 4], offset)
    }
  }
  rainGeometry.attributes.position.needsUpdate = true
}

function createBirdFlock(): { group: THREE.Group; wings: TrafficActor['wings'] } {
  const group = new THREE.Group()
  const wings: TrafficActor['wings'] = []
  for (let index = 0; index < 5; index += 1) {
    const bird = new THREE.Group()
    bird.position.set((index - 2) * 7, (index % 2) * 2, Math.abs(index - 2) * 5)
    const body = new THREE.Mesh(birdBodyGeometry, birdMaterial)
    body.rotation.x = -Math.PI / 2
    bird.add(body)
    const left = new THREE.Group()
    left.position.x = -0.2
    const leftWing = new THREE.Mesh(leftWingGeometry, birdMaterial)
    leftWing.rotation.x = -Math.PI / 2
    left.add(leftWing)
    const right = new THREE.Group()
    right.position.x = 0.2
    const rightWing = new THREE.Mesh(rightWingGeometry, birdMaterial)
    rightWing.rotation.x = -Math.PI / 2
    right.add(rightWing)
    bird.add(left, right)
    group.add(bird)
    wings.push({ left, right, phase: index * 0.7 })
  }
  return { group, wings }
}

function createTrafficModel(kind: TrafficActor['spawn']['kind']): { group: THREE.Group; wings: TrafficActor['wings'] } {
  const group = new THREE.Group()
  const wings: TrafficActor['wings'] = []

  if (kind === 'birds') return createBirdFlock()

  if (kind === 'kite') {
    const sail = new THREE.Mesh(kiteGeometry, kiteMaterial)
    group.add(sail)
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 42, 0.8), underside)
    group.add(spine)
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 0.8), ivory)
    group.add(crossbar)
    for (let index = 0; index < 4; index += 1) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 18, 0.6), balloonMaterials[index % 2])
      tail.position.set(index % 2 === 0 ? -4 : 4, -29 - Math.floor(index / 2) * 16, 0)
      group.add(tail)
    }
    return { group, wings }
  }

  if (kind === 'airplane' || kind === 'glider') {
    const paint = kind === 'airplane' ? planeMaterial : gliderMaterial
    const airplane = new THREE.Group()
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.8, 14, 7), paint)
    fuselage.rotation.x = -Math.PI / 2
    airplane.add(fuselage)
    const wing = new THREE.Mesh(new THREE.BoxGeometry(kind === 'glider' ? 34 : 22, 0.6, 4.3), ivory)
    wing.position.y = 0.1
    airplane.add(wing)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.45, 2), underside)
    tail.position.set(0, 0.1, 4.2)
    airplane.add(tail)
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.1, 2), paint)
    tailFin.position.set(0, 0.8, 4)
    airplane.add(tailFin)
    if (kind === 'airplane') {
      const propeller = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 0.26), canopy)
      propeller.position.z = -6.2
      airplane.add(propeller)
    }
    group.add(airplane)
    return { group, wings }
  }

  const envelope = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 10), balloonMaterials[0])
  envelope.scale.set(0.8, 1, 0.8)
  envelope.position.y = 6
  group.add(envelope)
  const lowerBand = new THREE.Mesh(new THREE.TorusGeometry(9, 1.2, 5, 12), balloonMaterials[1])
  lowerBand.position.y = 1
  lowerBand.rotation.x = Math.PI / 2
  group.add(lowerBand)
  const basket = new THREE.Mesh(new THREE.BoxGeometry(4, 3.5, 4), underside)
  basket.position.y = -10
  group.add(basket)
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0xe0c9a0, roughness: 0.9 })
  const ropeGeometry = new THREE.CylinderGeometry(0.12, 0.12, 8, 4)
  for (const x of [-1.2, 1.2]) {
    for (const z of [-1.2, 1.2]) {
      const rope = new THREE.Mesh(ropeGeometry, ropeMaterial)
      rope.position.set(x, -5.5, z)
      group.add(rope)
    }
  }
  return { group, wings }
}

function updateTraffic(delta: number, now: number): void {
  const regionX = Math.round(flight.x / 6000)
  const regionZ = Math.round(flight.z / 6000)
  if (regionX !== trafficRegionX || regionZ !== trafficRegionZ) {
    for (const actor of trafficActors) scene.remove(actor.group)
    trafficRegionX = regionX
    trafficRegionZ = regionZ
    trafficActors = generateFlyingThings(regionX * 6000, regionZ * 6000, 24).map((spawn) => {
      const model = createTrafficModel(spawn.kind)
      model.group.scale.setScalar(spawn.kind === 'birds' ? 1.6 : spawn.kind === 'airplane' ? 0.8 : spawn.kind === 'kite' ? 1.25 : 1)
      model.group.rotation.y = spawn.heading
      scene.add(model.group)
      return { group: model.group, wings: model.wings, spawn, distance: 0 }
    })
  }

  for (const actor of trafficActors) {
    actor.distance = Math.min(actor.distance + actor.spawn.speed * delta, 11200)
    const directionX = -Math.sin(actor.spawn.heading)
    const directionZ = -Math.cos(actor.spawn.heading)
    const x = actor.spawn.x + directionX * actor.distance
    const z = actor.spawn.z + directionZ * actor.distance
    const clearance = actor.spawn.kind === 'balloon' ? 850 : actor.spawn.kind === 'airplane' ? 550 : actor.spawn.kind === 'kite' ? 620 : actor.spawn.kind === 'glider' ? 480 : 300
    const altitude = Math.max(actor.spawn.y, terrainHeight(x, z) + clearance)
    actor.group.position.set(
      x,
      altitude + Math.sin(now * 0.0012 + actor.spawn.phase) * (actor.spawn.kind === 'birds' ? 16 : 6),
      z,
    )
    actor.group.visible = actor.distance < 10800
    if (actor.spawn.kind === 'birds') {
      for (const wings of actor.wings) {
        const flap = Math.sin(now * 0.009 + actor.spawn.phase + wings.phase) * 0.55
        wings.left.rotation.z = flap
        wings.right.rotation.z = -flap
      }
    }
  }
}

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
  resetFieldNotes()
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
  const terrainOriginX = terrainGridOrigin(flight.x)
  const terrainOriginZ = terrainGridOrigin(flight.z)
  terrain.position.set(terrainOriginX, 0, terrainOriginZ)
  ;(terrainMaterial.uniforms.uOffset.value as THREE.Vector2).set(terrainOriginX, terrainOriginZ)
  updateForest()
  if (!paused) updateTownCars(now)

  const cameraOffset = new THREE.Vector3(0, 13, 58).applyQuaternion(glider.quaternion)
  const desiredCameraPosition = glider.position.clone().add(cameraOffset)
  const cameraTarget = glider.position.clone().add(new THREE.Vector3(0, 0, -45).applyQuaternion(glider.quaternion))
  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-delta * 3.4))
  camera.lookAt(cameraTarget)
  sky.position.copy(camera.position)
  moon.position.copy(camera.position).addScaledVector(moonDirection, 7200)

  if (cloudCelebrationActive) {
    updateCloudCelebration(now)
  } else {
    for (const cloud of clouds) {
      const distance = Math.hypot(cloud.position.x - flight.x, cloud.position.z - flight.z)
      if (distance > 6700 || cloud.position.y < flight.y + 360) {
        const angle = random() * Math.PI * 2
        const radius = 2800 + random() * 2100
        const altitude = flight.y + 500 + random() * 450
        cloud.position.set(flight.x + Math.cos(angle) * radius, altitude, flight.z + Math.sin(angle) * radius)
      }
    }
  }

  updateTraffic(delta, now)
  updateFieldNote(now)
  updateWorldCelebration(now)
  updateEventWeather(delta)
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

import * as THREE from 'three'
import './style.css'
import { createFlightState, stepFlight } from './flight'
import { createFieldNote, fieldNoteBearing, fieldNoteDistance, fieldNoteProgress, reachedFieldNote, relocateFieldNote, type FieldNote } from './objectives'
import { createPersuasion, persuasionLook, resetPersuasionDistance, stepPersuasion, type PersuasionEvent } from './persuasion'
import { segmentHitsSphere } from './collision'
import { resolveTowerCollision } from './obstacles'
import { createEnemy, ENEMY_STATS, stepEnemy, type Enemy, type EnemyKind } from './enemies'
import { createAudio } from './audio'
import { BOSS_STATS, bossDue, bossEnraged, createBoss, damageBoss, stepBoss, type Boss, type BossKind } from './bosses'
import { applyScore, createScore, ringBonus, SCORE_RULES, type ScoreKey } from './score'
import { worldEventForObjective, type ParticleKind, type WorldEvent } from './world-events'
import { createWorldSeed, generateCannons, generateFlyingThings, generateForest, generateRockField, generateSettlement, generateTowers, generateWaterfalls, setWorldSeed, type TowerSite, type WaterfallSite, terrainGridOrigin, terrainHeight, terrainNormalAt, waterCoverage, worldSeedOffset } from './world'

const worldSeed = createWorldSeed()
setWorldSeed(worldSeed)
const audio = createAudio(worldSeed)

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
        <button class="fire-button" id="fire-button" type="button" aria-label="Hold to fire" aria-pressed="false">FIRE</button>
        <button class="reset-button" id="mute-button" type="button" aria-label="Toggle sound" aria-pressed="false">SOUND</button>
        <button class="boost-button" id="boost-button" type="button" aria-label="Hold to boost" aria-pressed="false">BOOST</button>
        <button class="reset-button" id="reset-flight" type="button">RESET</button>
        <button class="pause-button" id="pause-button" type="button" aria-label="Pause flight">
          <span class="pause-icon" aria-hidden="true"><i></i><i></i></span>
          <span id="pause-label">PAUSE</span>
        </button>
      </div>
    </header>

    <section class="flight-data" aria-label="Flight instruments">
      <div class="data-heading"><span>FLIGHT DATA</span><span class="data-live">LIVE</span></div>
      <div class="data-row score-row"><span>SCORE</span><strong><span id="score">0</span><small> PTS</small></strong></div>
      <div class="score-pop" id="score-pop" aria-live="polite"></div>
      <div class="data-row"><span>ALTITUDE</span><strong><span id="altitude">1,320</span><small> M</small></strong></div>
      <div class="data-row"><span>GROUND SPEED</span><strong><span id="speed">187</span><small> KM/H</small></strong></div>
      <div class="data-row"><span>HEADING</span><strong><span id="heading">000</span><small> DEG</small></strong></div>
      <div class="data-row"><span>TARGETS</span><strong><span id="targets-popped">0</span><small> POPPED</small></strong></div>
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
    <div class="far-arrow" id="far-arrow" aria-hidden="true"><i id="far-arrow-head"></i><span id="far-arrow-range"></span></div>
    <div class="boss-bar" id="boss-bar" aria-live="polite"><span id="boss-name"></span><div class="boss-track"><i id="boss-fill"></i></div></div>
    <div class="moment-toast" id="moment-toast" aria-live="polite" aria-hidden="true">
      <span id="moment-label">FIELD NOTE SAVED</span>
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
const fireButton = document.querySelector<HTMLButtonElement>('#fire-button')!
const pauseLabel = document.querySelector<HTMLSpanElement>('#pause-label')!
const pauseShade = document.querySelector<HTMLDivElement>('#pause-shade')!
const altitudeReadout = document.querySelector<HTMLSpanElement>('#altitude')!
const speedReadout = document.querySelector<HTMLSpanElement>('#speed')!
const headingReadout = document.querySelector<HTMLSpanElement>('#heading')!
const terrainReadout = document.querySelector<HTMLSpanElement>('#terrain-label')!
const coordinatesReadout = document.querySelector<HTMLSpanElement>('#coordinates')!
const targetsPoppedReadout = document.querySelector<HTMLSpanElement>('#targets-popped')!
const scoreReadout = document.querySelector<HTMLSpanElement>('#score')!
const scorePop = document.querySelector<HTMLDivElement>('#score-pop')!
const scoreState = createScore()

function awardScore(key: ScoreKey, now: number, bonus = 0): void {
  const result = applyScore(scoreState, key, now, bonus, activeWorldEvent?.scoreMultiplier ?? 1)
  scoreReadout.textContent = scoreState.score.toLocaleString('en-US')
  const gain = SCORE_RULES[key].points > 0
  const sign = gain ? '+' : '\u2212'
  const combo = result.multiplier > 1 ? ` x${result.multiplier.toFixed(2)}` : ''
  scorePop.textContent = `${sign}${Math.abs(result.delta)} ${result.label}${combo}`
  scorePop.classList.toggle('is-loss', !gain)
  scorePop.classList.remove('is-visible')
  void scorePop.offsetWidth
  scorePop.classList.add('is-visible')
}
const noteCountReadout = document.querySelector<HTMLSpanElement>('#note-count')!
const noteTitleReadout = document.querySelector<HTMLElement>('#note-title')!
const notePromptReadout = document.querySelector<HTMLParagraphElement>('#note-prompt')!
const noteRangeReadout = document.querySelector<HTMLSpanElement>('#note-range')!
const noteProgressReadout = document.querySelector<HTMLSpanElement>('#note-progress')!
const noteArrowReadout = document.querySelector<HTMLElement>('#note-arrow')!
const farArrow = document.querySelector<HTMLElement>('#far-arrow')!
const farArrowHead = document.querySelector<HTMLElement>('#far-arrow-head')!
const farArrowRange = document.querySelector<HTMLElement>('#far-arrow-range')!
const momentToast = document.querySelector<HTMLDivElement>('#moment-toast')!
const momentLabel = document.querySelector<HTMLSpanElement>('#moment-label')!
const flightStatus = document.querySelector<HTMLElement>('.flight-status')!
const dataLive = document.querySelector<HTMLElement>('.data-live')!
const wayfinderPanel = document.querySelector<HTMLElement>('.wayfinder')!
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
    uGlowDirection: { value: new THREE.Vector3(0, 0, -1) },
    uGlowColor: { value: new THREE.Color(0xff4fa3) },
    uGlow: { value: 0 },
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
    uniform vec3 uGlowDirection;
    uniform vec3 uGlowColor;
    uniform float uGlow;
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
      sky += uGlowColor * pow(max(dot(direction, normalize(uGlowDirection)), 0.0), 5.0) * uGlow * 0.6;
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
    uSeedOffset: { value: new THREE.Vector2(...worldSeedOffset()) },
  },
  vertexShader: `
    uniform vec2 uOffset;
    uniform vec2 uSeedOffset;
    varying float vHeight;
    varying float vWater;
    varying float vVariation;
    varying float vFineVariation;
    varying vec3 vNormal;
    varying vec2 vLocal;
    varying vec2 vWorld;
    varying vec3 vBiome;

    float hash(vec2 p) {
      p = mod(p + uSeedOffset, 256.0);
      vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
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
      float ridges = pow(ridgeShape, 1.7) * 1150.0;
      float detail = noise(p * 0.0024) * 36.0;
      float height = 35.0 + broad + foothills + ridges + detail;

      vec2 massifCell = floor(p / 8000.0);
      if (hash(massifCell + vec2(301.1, 57.3)) >= 0.55) {
        vec2 center = (massifCell + vec2(0.3 + hash(massifCell + vec2(12.7, 401.9)) * 0.4, 0.3 + hash(massifCell + vec2(88.2, 19.4)) * 0.4)) * 8000.0;
        float radius = 1000.0 + hash(massifCell + vec2(142.6, 7.7)) * 600.0;
        float peak = 1400.0 + hash(massifCell + vec2(63.9, 233.1)) * 1200.0;
        float lift = 1.0 - smoothstep(0.0, radius, length(p - center));
        if (lift > 0.0) height += pow(lift, 1.6) * peak * (0.8 + noise(p * 0.003) * 0.4);
      }

      float lane = floor(p.x / 6400.0);
      if (hash(vec2(lane + 411.3, 9.7)) >= 0.45) {
        float center = (lane + 0.3 + hash(vec2(lane + 5.1, 77.7)) * 0.4) * 6400.0;
        float phase = hash(vec2(lane + 29.4, 3.3)) * 6.283185307179586;
        float distanceToCanyon = abs(p.x - (center + sin(p.y * 0.0011 + phase) * 380.0));
        float presence = smoothstep(0.38, 0.5, noise(vec2(p.y * 0.00035 + lane * 7.3, 0.5)));
        float mesa = (1.0 - smoothstep(230.0, 680.0, distanceToCanyon)) * presence;
        height += (max(height, 430.0) - height) * mesa;
        float carve = (1.0 - smoothstep(90.0, 230.0, distanceToCanyon)) * presence;
        height += (70.0 + noise(p * 0.004) * 30.0 - height) * carve;
      }
      return height;
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
      float warmth = noise(point * 0.00009 + vec2(31.7, 9.1));
      float moisture = noise(point * 0.00009 + vec2(77.3, 51.9));
      float desertMix = smoothstep(0.56, 0.7, warmth);
      float frostMix = 1.0 - smoothstep(0.3, 0.44, warmth);
      vBiome = vec3(desertMix, frostMix, smoothstep(0.52, 0.66, moisture) * (1.0 - desertMix) * (1.0 - frostMix));
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
    varying vec3 vBiome;
    float h21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vn(vec2 p) {
      vec2 cell = floor(p);
      vec2 part = fract(p);
      part = part * part * (3.0 - 2.0 * part);
      return mix(mix(h21(cell), h21(cell + vec2(1.0, 0.0)), part.x), mix(h21(cell + vec2(0.0, 1.0)), h21(cell + vec2(1.0, 1.0)), part.x), part.y);
    }
    float fbm(vec2 p) {
      return vn(p) * 0.5 + vn(p * 2.03) * 0.25 + vn(p * 4.01) * 0.125 + vn(p * 8.03) * 0.0625;
    }
    void main() {
      float near = 1.0 - smoothstep(1800.0, 5200.0, length(vLocal));
      float broadTone = vn(vWorld / 420.0);
      float grain = fbm(vWorld / 11.0);
      float tuft = vn(vWorld / 3.2);
      float fields = smoothstep(0.35, 0.75, vn(vWorld / 900.0 + 7.0));
      vec3 grass = mix(vec3(0.045, 0.19, 0.045), vec3(0.17, 0.37, 0.075), vVariation);
      grass = mix(grass, vec3(0.34, 0.42, 0.12), fields * 0.38 * (0.5 + broadTone * 0.5));
      grass *= 0.72 + grain * 0.56 + (tuft - 0.5) * 0.28 * near;
      vec3 soil = mix(vec3(0.34, 0.16, 0.065), vec3(0.49, 0.28, 0.11), vFineVariation);
      grass = mix(grass, vec3(0.78, 0.62, 0.36) * (0.82 + grain * 0.36), vBiome.x);
      grass = mix(grass, vec3(0.62, 0.34, 0.08) * (0.8 + grain * 0.4), vBiome.z * 0.8);
      grass = mix(grass, vec3(0.74, 0.8, 0.8) * (0.86 + grain * 0.28), vBiome.y * 0.85);
      soil = mix(soil, vec3(0.66, 0.4, 0.2), vBiome.x);
      soil *= 0.78 + fbm(vWorld / 7.0) * 0.46;
      float strata = 0.5 + 0.5 * sin(vHeight * 0.05 + fbm(vWorld / 160.0) * 5.0);
      vec3 rock = mix(vec3(0.31, 0.29, 0.25), vec3(0.49, 0.43, 0.33), vVariation);
      rock *= 0.82 + mix(0.5, strata, near) * 0.18 + (grain - 0.5) * 0.35;
      vec3 snow = vec3(0.76, 0.84, 0.80) * (0.9 + (grain - 0.5) * 0.18);
      float dryPatches = smoothstep(0.64, 0.84, vFineVariation) * (1.0 - smoothstep(540.0, 790.0, vHeight)) * 0.7;
      float exposedSoil = max(smoothstep(320.0, 650.0, vHeight) * (0.55 + vVariation * 0.45), dryPatches);
      vec3 ground = mix(grass, soil, exposedSoil);
      ground = mix(ground, rock, smoothstep(610.0, 940.0, vHeight));
      ground = mix(ground, snow, smoothstep(1080.0 - vBiome.y * 700.0, 1330.0 - vBiome.y * 700.0, vHeight));
      float steepness = 1.0 - smoothstep(0.3, 0.8, normalize(vNormal).y);
      ground = mix(ground, rock * 0.85, steepness * 0.9);
      float ripple = 0.5 + 0.5 * sin(vWorld.x * 0.003 + sin(vWorld.y * 0.002) * 2.0);
      vec3 water = mix(vec3(0.055, 0.25, 0.29), vec3(0.28, 0.55, 0.54), smoothstep(0.56, 0.98, ripple));
      water *= 0.9 + fbm(vWorld / 26.0) * 0.28;
      ground = mix(ground, water, smoothstep(0.12, 0.8, vWater));
      float light = 0.36 + 0.86 * max(dot(normalize(vNormal), normalize(vec3(-0.36, 0.86, 0.37))), 0.0);
      ground *= light;
      float haze = smoothstep(6200.0, 11200.0, length(vLocal));
      ground = mix(ground, vec3(0.49, 0.65, 0.59), haze * 0.34);
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
    if (!actor.group.parent) continue
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
const waypointMaterial = new THREE.MeshBasicMaterial({ color: 0xffd28a, side: THREE.DoubleSide, toneMapped: false })
const waypointRing = new THREE.Mesh(new THREE.TorusGeometry(78, 2.5, 12, 64), waypointMaterial)
waypointRing.visible = false
scene.add(waypointRing)
const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
const waypointBeacon = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 5000, 20, 1, true), beaconMaterial)
waypointBeacon.visible = false
scene.add(waypointBeacon)
const guideCount = 8
const guideMaterial = new THREE.MeshBasicMaterial({ color: 0xff4fa3, toneMapped: false })
const guideArrows = Array.from({ length: guideCount }, () => {
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(16, 44, 4), guideMaterial)
  arrow.visible = false
  scene.add(arrow)
  return arrow
})
const guideDirection = new THREE.Vector3()
const upAxis = new THREE.Vector3(0, 1, 0)
let persuasion = createPersuasion()
let ringScale = 1
let persuasionToastUntil = 0
let lastPersuasionTick = 0

const glowTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
})()
const sparkleCount = 120
const sparklePositions = new Float32Array(sparkleCount * 3)
for (let index = 0; index < sparkleCount; index += 1) {
  const vertical = Math.random() * 2 - 1
  const angle = Math.random() * Math.PI * 2
  const flat = Math.sqrt(1 - vertical * vertical)
  const radius = 70 + Math.random() * 70
  sparklePositions.set([Math.cos(angle) * flat * radius, vertical * radius, Math.sin(angle) * flat * radius], index * 3)
}
const sparkleGeometry = new THREE.BufferGeometry()
sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3))
const sparkleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 18, map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial)
sparkles.visible = false
sparkles.frustumCulled = false
scene.add(sparkles)
const tunnelCount = 6
const tunnelMaterial = new THREE.MeshBasicMaterial({ color: 0xff4fa3, side: THREE.DoubleSide, toneMapped: false })
const tunnelGeometry = new THREE.TorusGeometry(78, 2.5, 10, 48)
const tunnelRings = Array.from({ length: tunnelCount }, () => {
  const ring = new THREE.Mesh(tunnelGeometry, tunnelMaterial)
  ring.visible = false
  scene.add(ring)
  return ring
})
const tunnelDirection = new THREE.Vector3()
const zAxis = new THREE.Vector3(0, 0, 1)
let activeFieldNote: FieldNote | null = null
let fieldNotesKept = 0
let targetsPopped = 0
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

function applyPersuasionLook(): void {
  const look = persuasionLook(persuasion)
  const shown = waypointRing.visible
  waypointBeacon.visible = look.beacon && shown
  for (const arrow of guideArrows) arrow.visible = look.guides && shown
  for (const ring of tunnelRings) ring.visible = look.tunnel && shown
  sparkles.visible = look.sparkles && shown
  wayfinderPanel.classList.toggle('is-pleading', look.hudPulse && shown)
  if (!shown || !look.skyGlow) skyMaterial.uniforms.uGlow.value = 0
  waypointMaterial.color.setHex(look.color)
}

function resetPersuasionVisuals(): void {
  persuasion = createPersuasion()
  ringScale = 1
  persuasionToastUntil = 0
  applyPersuasionLook()
}

function escalatePersuasion(event: PersuasionEvent, now: number): void {
  const note = activeFieldNote
  if (!note) return
  applyPersuasionLook()

  if (event.relocateTo !== null && fieldNoteDistance(note, flight.x, flight.y, flight.z) > event.relocateTo) {
    const moved = relocateFieldNote(note, flight.x, flight.y, flight.z, flight.heading, event.relocateTo)
    activeFieldNote = moved
    waypointRing.position.set(moved.x, moved.y, moved.z)
    waypointRing.rotation.y = moved.heading
    resetPersuasionDistance(persuasion, fieldNoteDistance(moved, flight.x, flight.y, flight.z))
    lastNoteRange = ''
  }

  const message = event.message
  if (message) {
    momentLabel.textContent = 'THE RING HAS NOTICED'
    momentTitle.textContent = message.title
    momentCopy.textContent = message.copy
    notePromptReadout.textContent = message.title
    momentToast.setAttribute('aria-hidden', 'false')
    momentToast.classList.add('is-visible')
    persuasionToastUntil = now + 5200
  }
}

function beginFieldNote(): void {
  activeFieldNote = createFieldNote(nextFieldNoteSequence, flight.x, flight.y, flight.z, flight.heading)
  nextFieldNoteSequence += 1
  waypointRing.position.set(activeFieldNote.x, activeFieldNote.y, activeFieldNote.z)
  waypointRing.rotation.set(0, activeFieldNote.heading, 0)
  waypointRing.visible = true
  resetPersuasionVisuals()
  lastPersuasionTick = performance.now()
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
  resetPersuasionVisuals()
  momentToast.classList.remove('is-visible')
  momentToast.setAttribute('aria-hidden', 'true')
  noteCountReadout.textContent = '00 KEPT'
  noteTitleReadout.textContent = 'THE NEXT VIEW'
  notePromptReadout.textContent = 'A new wayfinder will appear soon'
  noteRangeReadout.textContent = 'SOON'
  noteProgressReadout.style.transform = 'scaleX(0)'
  lastNoteRange = 'SOON'
}

function updateFieldNote(now: number): void {
  if (persuasionToastUntil > 0 && now > persuasionToastUntil) {
    persuasionToastUntil = 0
    momentToast.classList.remove('is-visible')
    momentToast.setAttribute('aria-hidden', 'true')
  }
  if (!activeFieldNote) {
    farArrow.classList.remove('is-visible')
    if (now >= nextFieldNoteAt) beginFieldNote()
    else return
  }
  if (!activeFieldNote) return

  const tickDelta = Math.min((now - lastPersuasionTick) / 1000, 0.1)
  lastPersuasionTick = now
  let distance = fieldNoteDistance(activeFieldNote, flight.x, flight.y, flight.z)
  const persuasionEvent = paused ? null : stepPersuasion(persuasion, distance, tickDelta, random)
  if (persuasionEvent) {
    escalatePersuasion(persuasionEvent, now)
    if (!activeFieldNote) return
    distance = fieldNoteDistance(activeFieldNote, flight.x, flight.y, flight.z)
  }

  const look = persuasionLook(persuasion)
  ringScale += (look.scale - ringScale) * (1 - Math.exp(-tickDelta * 2.5))
  const pulse = look.strobe ? 1 + Math.sin(now * 0.012) * 0.08 : 1 + Math.sin(now * 0.002) * 0.035
  waypointRing.scale.setScalar(ringScale * pulse)
  waypointRing.rotation.z = Math.sin(now * 0.0007) * 0.035
  waypointMaterial.color.setHex(look.strobe && Math.floor(now / 110) % 2 === 0 ? 0xffffff : look.color)
  beaconMaterial.color.setHex(look.color)
  guideMaterial.color.setHex(look.color)
  tunnelMaterial.color.setHex(look.color)
  if (look.beacon) {
    waypointBeacon.position.set(activeFieldNote.x, activeFieldNote.y, activeFieldNote.z)
    beaconMaterial.opacity = 0.2 + 0.12 * Math.sin(now * 0.004)
  }
  if (look.guides) {
    guideDirection.set(activeFieldNote.x - flight.x, activeFieldNote.y - flight.y, activeFieldNote.z - flight.z)
    const length = guideDirection.length()
    guideDirection.normalize()
    guideArrows.forEach((arrow, index) => {
      const along = 140 + ((now * 0.0004 + index / guideCount) % 1) * Math.max(0, Math.min(length - 220, 1800))
      arrow.position.set(flight.x, flight.y, flight.z).addScaledVector(guideDirection, along)
      arrow.quaternion.setFromUnitVectors(upAxis, guideDirection)
      arrow.visible = length > 420
    })
  }
  if (look.sparkles) {
    sparkles.position.set(activeFieldNote.x, activeFieldNote.y, activeFieldNote.z)
    sparkles.scale.setScalar(ringScale)
    sparkles.rotation.y = now * 0.0006
    sparkleMaterial.color.setHex(look.color)
    sparkleMaterial.opacity = 0.75 + 0.25 * Math.sin(now * 0.01)
  }
  if (look.tunnel) {
    tunnelDirection.set(flight.x - activeFieldNote.x, flight.y - activeFieldNote.y, flight.z - activeFieldNote.z)
    const span = tunnelDirection.length()
    tunnelDirection.normalize()
    tunnelRings.forEach((ring, index) => {
      const along = (index + 1) * 190
      ring.position.set(activeFieldNote!.x, activeFieldNote!.y, activeFieldNote!.z).addScaledVector(tunnelDirection, along)
      ring.quaternion.setFromUnitVectors(zAxis, tunnelDirection)
      ring.scale.setScalar(Math.max(0.5, ringScale * (0.9 - index * 0.08)))
      ring.visible = along < span - 120
    })
  }
  if (look.skyGlow) {
    skyMaterial.uniforms.uGlow.value = 0.75 + 0.25 * Math.sin(now * 0.003)
    skyMaterial.uniforms.uGlowColor.value.setHex(look.color)
    skyMaterial.uniforms.uGlowDirection.value.set(activeFieldNote.x - camera.position.x, activeFieldNote.y - camera.position.y, activeFieldNote.z - camera.position.z).normalize()
  }
  const rangeText = `${(distance / 1000).toFixed(1)} KM`
  if (rangeText !== lastNoteRange) {
    noteRangeReadout.textContent = rangeText
    lastNoteRange = rangeText
  }
  const bearing = fieldNoteBearing(activeFieldNote, flight.x, flight.z, flight.heading)
  noteArrowReadout.style.transform = `rotate(${-45 - bearing * 180 / Math.PI}deg)`
  farArrow.classList.toggle('is-visible', distance > 3500 && !paused)
  farArrowHead.style.transform = `rotate(${-45 - bearing * 180 / Math.PI}deg)`
  farArrowRange.textContent = rangeText
  noteProgressReadout.style.transform = `scaleX(${fieldNoteProgress(activeFieldNote, flight.x, flight.z)})`

  if (!paused && reachedFieldNote(activeFieldNote, flight.x, flight.y, flight.z, 125 * look.scale)) {
    fieldNotesKept += 1
    awardScore('ring', now, ringBonus(persuasion.stage, flight.boost > 0.5))
    audio.chime()
    const worldEvent = worldEventForObjective(fieldNotesKept - 1, worldSeed)
    noteCountReadout.textContent = `${String(fieldNotesKept).padStart(2, '0')} KEPT`
    noteTitleReadout.textContent = worldEvent.title
    notePromptReadout.textContent = worldEvent.message
    noteRangeReadout.textContent = 'LOOK UP'
    noteProgressReadout.style.transform = 'scaleX(1)'
    lastNoteRange = 'LOOK UP'
    activeFieldNote = null
    waypointRing.visible = false
    resetPersuasionVisuals()
    startCloudCelebration(now, worldEvent)
    nextFieldNoteAt = bossDue(fieldNotesKept) ? Number.POSITIVE_INFINITY : now + 11000
    if (bossDue(fieldNotesKept)) scheduleBoss(now)
  }
}

beginFieldNote()

const towerGroup = new THREE.Group()
const waterfallGroup = new THREE.Group()
scene.add(towerGroup, waterfallGroup)
let activeTowers: TowerSite[] = []
const towerShaftMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.85, flatShading: true })
const towerBandMaterial = new THREE.MeshStandardMaterial({ color: 0xc9462f, roughness: 0.8, flatShading: true })
const towerLightMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b2f })
const towerLightGeometry = new THREE.SphereGeometry(5, 8, 6)
const waterfallMistGeometry = new THREE.SphereGeometry(1, 9, 6)
const waterfallMistMaterial = new THREE.MeshBasicMaterial({ color: 0xeaf6f2, transparent: true, opacity: 0.32, depthWrite: false })
const waterfallMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float streak = 0.5 + 0.5 * sin(vUv.x * 46.0 + sin(vUv.y * 9.0 - uTime * 2.0) * 1.4);
      float flow = 0.5 + 0.5 * sin(vUv.y * 38.0 + uTime * 7.0 + vUv.x * 11.0);
      float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
      vec3 color = mix(vec3(0.58, 0.82, 0.86), vec3(0.97, 1.0, 1.0), streak * 0.6 + flow * 0.4);
      gl_FragColor = vec4(color, edge * (0.62 + streak * 0.3));
      #include <colorspace_fragment>
    }
  `,
})
const waterfallMists: THREE.Mesh[] = []

function createTower(site: TowerSite): THREE.Group {
  const group = new THREE.Group()
  const height = site.top - site.base
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(site.radius * 0.62, site.radius, height, 10), towerShaftMaterial)
  shaft.position.y = height / 2
  group.add(shaft)
  for (let index = 0; index < 4; index += 1) {
    const fraction = 0.16 + index * 0.2
    const band = new THREE.Mesh(new THREE.CylinderGeometry(site.radius * (1 - 0.38 * (fraction + 0.045)) * 1.04, site.radius * (1 - 0.38 * (fraction - 0.045)) * 1.04, height * 0.09, 10), towerBandMaterial)
    band.position.y = height * fraction
    group.add(band)
  }
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(site.radius * 1.5, site.radius * 1.8, 30, 10), towerShaftMaterial)
  footing.position.y = 6
  group.add(footing)
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(site.radius * 1.55, site.radius * 0.9, 20, 10), towerBandMaterial)
  pod.position.y = height + 8
  group.add(pod)
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 80, 6), towerShaftMaterial)
  antenna.position.y = height + 58
  group.add(antenna)
  const light = new THREE.Mesh(towerLightGeometry, towerLightMaterial)
  light.position.y = height + 100
  group.add(light)
  group.position.set(site.x, site.base - 6, site.z)
  return group
}

function createWaterfall(site: WaterfallSite): THREE.Group {
  const group = new THREE.Group()
  const segments = 20
  const halfWidth = 24
  const inward = Math.sign(site.bottomX - site.topX) * 9
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const amount = index / segments
    const x = site.topX + (site.bottomX - site.topX) * amount
    const y = terrainHeight(x, site.topZ) + 7
    positions.push(x + inward, y, site.topZ - halfWidth, x + inward, y, site.topZ + halfWidth)
    uvs.push(0, 1 - amount, 1, 1 - amount)
    if (index < segments) indices.push(index * 2, index * 2 + 1, index * 2 + 2, index * 2 + 1, index * 2 + 3, index * 2 + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  group.add(new THREE.Mesh(geometry, waterfallMaterial))
  for (let puff = 0; puff < 3; puff += 1) {
    const mist = new THREE.Mesh(waterfallMistGeometry, waterfallMistMaterial)
    mist.position.set(site.bottomX + inward * 2 + (puff - 1) * 6, site.bottomY + 14 + puff * 8, site.topZ + (puff - 1) * 14)
    mist.userData.phase = puff * 2.1
    mist.userData.base = 34 + puff * 8
    group.add(mist)
    waterfallMists.push(mist)
  }
  return group
}

function rebuildObstacles(centerX: number, centerZ: number): void {
  for (const child of [...towerGroup.children]) {
    towerGroup.remove(child)
    child.traverse((part) => {
      if (part instanceof THREE.Mesh && part.geometry !== towerLightGeometry) part.geometry.dispose()
    })
  }
  for (const child of [...waterfallGroup.children]) {
    waterfallGroup.remove(child)
    child.traverse((part) => {
      if (part instanceof THREE.Mesh && part.geometry !== waterfallMistGeometry) part.geometry.dispose()
    })
  }
  waterfallMists.length = 0
  activeTowers = generateTowers(centerX, centerZ)
  for (const site of activeTowers) towerGroup.add(createTower(site))
  for (const site of generateWaterfalls(centerX, centerZ)) waterfallGroup.add(createWaterfall(site))
}

function updateObstacles(now: number): void {
  waterfallMaterial.uniforms.uTime.value = now * 0.001
  towerLightMaterial.color.setRGB(1, 0.23, 0.18).multiplyScalar(Math.sin(now * 0.004) > -0.2 ? 1 : 0.15)
  for (const mist of waterfallMists) {
    const pulse = 1 + Math.sin(now * 0.0016 + mist.userData.phase) * 0.14
    mist.scale.set(mist.userData.base * pulse, mist.userData.base * 0.7, mist.userData.base * pulse)
  }
}

const treeTransform = new THREE.Object3D()
const foliageColor = new THREE.Color()
let forestRegionX = Number.NaN
let forestRegionZ = Number.NaN

interface Destructible {
  x: number
  y: number
  z: number
  radius: number
  size: number
  palette: readonly number[]
  destroyed: boolean
  object?: THREE.Object3D
  destroy: () => void
}

const destructibles: Destructible[] = []
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const fireDebris = [0xffd27a, 0xff8a3d, 0xff5a2a, 0xffffff] as const
const woodDebris = [0x8a6a43, 0x674a31, 0xd7c08d, 0xffa04a] as const
const metalDebris = [0x343b39, 0xb0b7b5, 0xffa04a, 0xffd27a] as const
const leafDebris = [0x3f7d3a, 0x2d5f2a, 0x725a43, 0x8fbf55] as const
const rockDebris = [0x81796d, 0x5a554d, 0xa39b8a, 0xffa04a] as const

function hideInstance(mesh: THREE.InstancedMesh, index: number): void {
  mesh.setMatrixAt(index, hiddenMatrix)
  mesh.instanceMatrix.needsUpdate = true
}

function registerTree(tree: ReturnType<typeof generateForest>[number], trunkIndex: number, crownIndex: number, pine: boolean): void {
  destructibles.push({
    x: tree.x,
    y: tree.height + tree.scale * (pine ? 18 : 16),
    z: tree.z,
    radius: tree.scale * (pine ? 8 : 11),
    size: tree.scale * 14,
    palette: leafDebris,
    destroyed: false,
    destroy: () => {
      hideInstance(forestTrunks, trunkIndex)
      hideInstance(pine ? forestCrowns : forestBroadleaf, crownIndex)
    },
  })
}

function registerRock(rock: ReturnType<typeof generateRockField>[number], index: number): void {
  destructibles.push({
    x: rock.x,
    y: rock.height + rock.scale * 6,
    z: rock.z,
    radius: rock.scale * 10,
    size: rock.scale * 14,
    palette: rockDebris,
    destroyed: false,
    destroy: () => hideInstance(rockOutcrops, index),
  })
}

function updateForest(): void {
  const regionX = Math.round(flight.x / 6000)
  const regionZ = Math.round(flight.z / 6000)
  if (regionX === forestRegionX && regionZ === forestRegionZ) return
  forestRegionX = regionX
  forestRegionZ = regionZ

  rebuildObstacles(regionX * 6000, regionZ * 6000)
  const trees = generateForest(regionX * 6000, regionZ * 6000, treeCapacity)
  destructibles.length = 0
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
      foliageColor.setHSL(0.27 - tree.autumn * 0.1 + (tree.scale - 0.65) * 0.018, 0.31 + tree.autumn * 0.2, 0.23 + (tree.scale - 0.65) * 0.05)
      forestCrowns.setColorAt(pineCount, foliageColor)
      registerTree(tree, index, pineCount, true)
      pineCount += 1
    } else {
      treeTransform.position.y = tree.height + tree.scale * 17
      treeTransform.scale.set(tree.scale * 1.5, tree.scale * 1.1, tree.scale * 1.35)
      treeTransform.updateMatrix()
      forestBroadleaf.setMatrixAt(broadleafCount, treeTransform.matrix)
      foliageColor.setHSL(0.29 - tree.autumn * 0.23 + (tree.scale - 0.65) * 0.018, 0.39 + tree.autumn * 0.3, 0.27 + tree.autumn * 0.06 + (tree.scale - 0.65) * 0.05)
      forestBroadleaf.setColorAt(broadleafCount, foliageColor)
      registerTree(tree, index, broadleafCount, false)
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
    registerRock(rock, index)
  })
  cannonField.clear()
  for (const site of generateCannons(regionX * 6000, regionZ * 6000, 12)) {
    const cannon = createCannon(site)
    cannonField.add(cannon)
    destructibles.push({
      x: site.x,
      y: site.height + 30 * site.scale,
      z: site.z,
      radius: 40 * site.scale,
      size: 38 * site.scale,
      palette: metalDebris,
      destroyed: false,
      destroy: () => cannonField.remove(cannon),
    })
  }
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
  for (const building of town.buildings) {
    const house = createTownBuilding(building)
    townGroup.add(house)
    destructibles.push({
      x: building.x,
      y: building.height + 22 * building.scale,
      z: building.z,
      radius: 40 * building.scale,
      size: 40 * building.scale,
      palette: woodDebris,
      destroyed: false,
      destroy: () => townGroup.remove(house),
    })
  }
  for (const car of town.cars) {
    const group = createTownCar(car)
    townGroup.add(group)
    carActors.push({ group, site: car })
    destructibles.push({
      x: car.x,
      y: car.height + 8,
      z: car.z,
      radius: 18,
      size: 20,
      palette: metalDebris,
      destroyed: false,
      object: group,
      destroy: () => townGroup.remove(group),
    })
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
  ;(moon.material as THREE.MeshBasicMaterial).color.setHex(worldEvent.moonColor ?? 0xf3e9ca)
  moon.scale.setScalar(worldEvent.moonScale)
  rainMaterial.color.setHex(worldEvent.rainColor ?? 0xbdd6eb)
  configureParticles(worldEvent.particles, worldEvent.particleColor)
  if (worldEvent.peace) {
    for (const actor of enemyActors) {
      actor.alive = false
      actor.group.visible = false
    }
  }
  momentLabel.textContent = 'FIELD NOTE SAVED'
  momentTitle.textContent = worldEvent.title
  if (worldEvent.asteroids) {
    spawnAsteroidField()
    momentCopy.textContent = `${worldEvent.message} ${asteroidCapacity} asteroids are now drifting nearby. Shoot them for fun.`
  } else {
    clearAsteroidField()
    momentCopy.textContent = `${worldEvent.message} ${plantCelebrationFlowers(now)} emergency flowers have been planted.`
  }
  momentToast.setAttribute('aria-hidden', 'false')
  momentToast.classList.add('is-visible')
}

function updateWorldCelebration(now: number): void {
  if (!activeWorldEvent) return

  const elapsed = now - worldCelebrationStartedAt
  if (activeWorldEvent.disco) {
    const hue = (now * 0.00007) % 1
    eventGroundTint.setHSL(hue, 0.95, 0.55)
    eventWaterTint.setHSL((hue + 0.5) % 1, 0.95, 0.55)
    eventSkyHorizon.setHSL((hue + 0.18) % 1, 0.7, 0.45)
  }
  const eventMix = THREE.MathUtils.smoothstep(elapsed / 1200, 0, 1)
  ;(terrainMaterial.uniforms.uFestival.value as number) = eventMix
  updateCelebrationFlowers(now)
  skyMaterial.uniforms.uSkyTop.value.copy(baseSkyTop).lerp(eventSkyTop, eventMix)
  skyMaterial.uniforms.uSkyHorizon.value.copy(baseSkyHorizon).lerp(eventSkyHorizon, eventMix)
  skyMaterial.uniforms.uNight.value = activeWorldEvent.night * eventMix
  skyMaterial.uniforms.uStorm.value = activeWorldEvent.storm * eventMix
  skyMaterial.uniforms.uAurora.value = activeWorldEvent.aurora * eventMix
  terrainMaterial.uniforms.uEventGround.value.copy(eventGroundTint).lerp(neutralEventTint, 1 - eventMix)
  terrainMaterial.uniforms.uEventWater.value.copy(eventWaterTint).lerp(neutralEventTint, 1 - eventMix)
  terrainMaterial.uniforms.uLunar.value = activeWorldEvent.id === 'lunar-mail' ? eventMix : 0
  hemisphereLight.intensity = 2.05 * (1 - eventMix * (activeWorldEvent.night * 0.66 + activeWorldEvent.storm * 0.3))
  sunlight.intensity = 2.2 * (1 - eventMix * (activeWorldEvent.night * 0.9 + activeWorldEvent.storm * 0.58))
  moon.visible = Boolean(activeWorldEvent.moon && eventMix > 0.08)
  cloudMaterial.color.setHex(activeWorldEvent.storm ? 0x8796a2 : 0xf3f0e4)
  cloudMaterial.opacity = 0.8 - eventMix * (activeWorldEvent.storm * 0.18)
  momentToast.classList.toggle('is-visible', (worldCelebrationActive && elapsed < 4800) || now < persuasionToastUntil)

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
  popped: boolean
  poppedAt: number
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

interface ParticleStyle {
  velocity: [number, number, number]
  sway: number
  size: number
  color: number
  additive: boolean
  count: number
  opacity: number
}

const particleStyles: Record<ParticleKind, ParticleStyle> = {
  snow: { velocity: [0, -24, 0], sway: 14, size: 10, color: 0xffffff, additive: false, count: 520, opacity: 0.9 },
  confetti: { velocity: [0, -38, 0], sway: 26, size: 16, color: 0xffffff, additive: false, count: 460, opacity: 1 },
  petals: { velocity: [18, -20, 0], sway: 30, size: 14, color: 0xffb7d1, additive: false, count: 420, opacity: 0.95 },
  embers: { velocity: [0, 34, 0], sway: 12, size: 8, color: 0xff7a2a, additive: true, count: 420, opacity: 1 },
  ash: { velocity: [0, -15, 6], sway: 8, size: 7, color: 0xb8b0a8, additive: false, count: 520, opacity: 0.8 },
  bubbles: { velocity: [0, 28, 0], sway: 14, size: 13, color: 0xdff8ff, additive: true, count: 300, opacity: 0.55 },
  fireflies: { velocity: [0, 0, 0], sway: 44, size: 11, color: 0xe6ff7a, additive: true, count: 360, opacity: 1 },
  meteors: { velocity: [330, -290, 0], sway: 0, size: 12, color: 0xfff0c0, additive: true, count: 120, opacity: 1 },
  sparks: { velocity: [0, 42, 0], sway: 18, size: 9, color: 0xffd24a, additive: true, count: 440, opacity: 1 },
}
const particleCapacity = 520
const PARTICLE_SPAN = 1300
const PARTICLE_RISE = 650
const particlePositions = new Float32Array(particleCapacity * 3)
const particleColors = new Float32Array(particleCapacity * 3)
const particleSeeds = new Float32Array(particleCapacity)
const particleGeometry = new THREE.BufferGeometry()
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage))
particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))
const particleMaterial = new THREE.PointsMaterial({ size: 8, map: glowTexture, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, depthWrite: false })
const particles = new THREE.Points(particleGeometry, particleMaterial)
particles.frustumCulled = false
particles.visible = false
scene.add(particles)
let particleStyle: ParticleStyle | null = null
const particleTint = new THREE.Color()

function configureParticles(kind: ParticleKind | null, colorOverride: number | null): void {
  particleStyle = kind ? particleStyles[kind] : null
  if (!kind || !particleStyle) return
  particleMaterial.size = particleStyle.size * 1.7
  particleMaterial.blending = particleStyle.additive ? THREE.AdditiveBlending : THREE.NormalBlending
  particleMaterial.needsUpdate = true
  particleGeometry.setDrawRange(0, particleStyle.count)
  for (let index = 0; index < particleCapacity; index += 1) {
    particlePositions[index * 3] = camera.position.x + (random() * 2 - 1) * PARTICLE_SPAN
    particlePositions[index * 3 + 1] = camera.position.y + (random() * 2 - 1) * PARTICLE_RISE
    particlePositions[index * 3 + 2] = camera.position.z + (random() * 2 - 1) * PARTICLE_SPAN
    particleSeeds[index] = random()
    if (kind === 'confetti') particleTint.setHSL(random(), 0.9, 0.6)
    else particleTint.setHex(colorOverride ?? particleStyle.color).multiplyScalar(0.75 + random() * 0.25)
    particleColors.set([particleTint.r, particleTint.g, particleTint.b], index * 3)
  }
  particleGeometry.attributes.color.needsUpdate = true
}

function wrapAround(value: number, center: number, half: number): number {
  if (value > center + half) return value - half * 2
  if (value < center - half) return value + half * 2
  return value
}

function updateParticles(delta: number, eventMix: number, now: number): void {
  particles.visible = Boolean(particleStyle) && eventMix > 0.05
  if (!particleStyle || !particles.visible) return
  particleMaterial.opacity = eventMix * particleStyle.opacity
  const time = now * 0.001
  const [vx, vy, vz] = particleStyle.velocity
  for (let index = 0; index < particleStyle.count; index += 1) {
    const seed = particleSeeds[index]
    const offset = index * 3
    const sway = particleStyle.sway
    particlePositions[offset] = wrapAround(particlePositions[offset] + (vx + Math.sin(time * 0.9 + seed * 6.28) * sway) * delta, camera.position.x, PARTICLE_SPAN)
    particlePositions[offset + 1] = wrapAround(particlePositions[offset + 1] + (vy * (0.6 + seed * 0.8) + Math.sin(time * 0.6 + seed * 9) * sway * 0.3) * delta, camera.position.y, PARTICLE_RISE)
    particlePositions[offset + 2] = wrapAround(particlePositions[offset + 2] + (vz + Math.cos(time * 0.8 + seed * 6.28) * sway) * delta, camera.position.z, PARTICLE_SPAN)
  }
  particleGeometry.attributes.position.needsUpdate = true
}

function updateEventWeather(delta: number): void {
  const eventMix = terrainMaterial.uniforms.uFestival.value as number
  updateParticles(delta, eventMix, performance.now())
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
    trafficActors = generateFlyingThings(regionX * 6000, regionZ * 6000, 40).map((spawn) => {
      const model = createTrafficModel(spawn.kind)
      model.group.scale.setScalar(spawn.kind === 'birds' ? 1.6 : spawn.kind === 'airplane' ? 0.8 : spawn.kind === 'kite' ? 1.25 : 1)
      model.group.rotation.y = spawn.heading
      scene.add(model.group)
      return { group: model.group, wings: model.wings, spawn, distance: 0, popped: false, poppedAt: 0 }
    })
  }

  for (const actor of trafficActors) {
    if (actor.popped) {
      if (now - actor.poppedAt > TARGET_RESPAWN_DELAY) respawnTrafficActor(actor)
      else continue
    }
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

function respawnTrafficActor(actor: TrafficActor): void {
  const angle = random() * Math.PI * 2
  const radius = 2400 + random() * 3200
  actor.spawn.x = flight.x + Math.cos(angle) * radius
  actor.spawn.z = flight.z - 1200 - random() * 4000
  actor.distance = 0
  actor.popped = false
  actor.group.visible = true
}

const SHOT_COOLDOWN = 260
const PROJECTILE_SPEED = 640
const PROJECTILE_LIFETIME = 2400
const TARGET_RESPAWN_DELAY = 4200

interface Projectile {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  spawnedAt: number
}

const projectileGeometry = new THREE.SphereGeometry(2.2, 8, 6)
const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b0, toneMapped: false })
const activeProjectiles: Projectile[] = []
let lastShotAt = -Infinity

const popFlashCount = 24
const popFlashSpawnedAt = new Float64Array(popFlashCount).fill(-Infinity)
const popFlashSize = new Float32Array(popFlashCount)
const popFlashes: THREE.Sprite[] = Array.from({ length: popFlashCount }, () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  scene.add(sprite)
  return sprite
})
let nextPopFlash = 0
const POP_FLASH_DURATION = 520

function spawnPopFlash(position: THREE.Vector3, size: number, color = 0xffd27a): void {
  const flashIndex = nextPopFlash
  nextPopFlash = (nextPopFlash + 1) % popFlashCount
  popFlashSpawnedAt[flashIndex] = performance.now()
  popFlashSize[flashIndex] = size
  popFlashes[flashIndex].position.copy(position)
  popFlashes[flashIndex].material.color.setHex(color)
}

function updatePopFlashes(now: number): void {
  for (let index = 0; index < popFlashCount; index += 1) {
    const age = now - popFlashSpawnedAt[index]
    const sprite = popFlashes[index]
    if (age < 0 || age > POP_FLASH_DURATION) {
      sprite.material.opacity = 0
      continue
    }
    const progress = age / POP_FLASH_DURATION
    sprite.material.opacity = (1 - progress) ** 1.5
    sprite.scale.setScalar(popFlashSize[index] * (0.5 + progress * 1.3))
  }
}

interface DebrisParticle {
  alive: boolean
  smoke: boolean
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  size: number
  gravity: number
  spin: number
  rotation: number
  color: THREE.Color
}

const debrisCapacity = 480
const debrisMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), debrisCapacity)
debrisMesh.frustumCulled = false
const debrisParticles: DebrisParticle[] = Array.from({ length: debrisCapacity }, () => ({
  alive: false,
  smoke: false,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  life: 0,
  maxLife: 1,
  size: 1,
  gravity: 0,
  spin: 0,
  rotation: 0,
  color: new THREE.Color(),
}))
for (let index = 0; index < debrisCapacity; index += 1) {
  debrisMesh.setMatrixAt(index, hiddenMatrix)
  debrisMesh.setColorAt(index, debrisParticles[index].color)
}
scene.add(debrisMesh)
let nextDebris = 0
const debrisDummy = new THREE.Object3D()
const debrisColor = new THREE.Color()
const charcoal = new THREE.Color(0x1a1612)
const debrisVelocity = new THREE.Vector3()

function spawnDebris(position: THREE.Vector3, velocity: THREE.Vector3, size: number, life: number, color: number, gravity: number, smoke: boolean): void {
  const particle = debrisParticles[nextDebris]
  nextDebris = (nextDebris + 1) % debrisCapacity
  particle.alive = true
  particle.smoke = smoke
  particle.position.copy(position)
  particle.velocity.copy(velocity)
  particle.size = size
  particle.life = life
  particle.maxLife = life
  particle.gravity = gravity
  particle.spin = (Math.random() - 0.5) * 14
  particle.rotation = Math.random() * Math.PI * 2
  particle.color.setHex(color)
}

function updateDebris(delta: number): void {
  let touched = false
  for (let index = 0; index < debrisCapacity; index += 1) {
    const particle = debrisParticles[index]
    if (!particle.alive) continue
    particle.life -= delta
    touched = true
    if (particle.life <= 0) {
      particle.alive = false
      debrisMesh.setMatrixAt(index, hiddenMatrix)
      continue
    }
    particle.velocity.y -= particle.gravity * delta
    particle.velocity.multiplyScalar(Math.max(0, 1 - (particle.smoke ? 1.2 : 0.5) * delta))
    particle.position.addScaledVector(particle.velocity, delta)
    particle.rotation += particle.spin * delta
    const remaining = particle.life / particle.maxLife
    const scale = particle.smoke
      ? particle.size * 0.55 * (2.4 - 1.6 * remaining) * Math.min(1, remaining * 4)
      : particle.size * (0.35 + 0.65 * remaining)
    debrisDummy.position.copy(particle.position)
    debrisDummy.rotation.set(particle.rotation, particle.rotation * 0.7, 0)
    debrisDummy.scale.setScalar(scale)
    debrisDummy.updateMatrix()
    debrisMesh.setMatrixAt(index, debrisDummy.matrix)
    debrisColor.copy(particle.color)
    if (!particle.smoke) debrisColor.lerp(charcoal, 1 - remaining)
    debrisMesh.setColorAt(index, debrisColor)
  }
  if (touched) {
    debrisMesh.instanceMatrix.needsUpdate = true
    if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true
  }
}

function explode(position: THREE.Vector3, size: number, palette: readonly number[] = fireDebris): void {
  audio.explosion(size)
  spawnPopFlash(position, size * 3.4, 0xffd27a)
  spawnPopFlash(position, size * 2.2, 0xff6a2a)
  const chunks = Math.min(36, Math.round(14 + size * 0.5))
  for (let index = 0; index < chunks; index += 1) {
    debrisVelocity.set(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize().multiplyScalar(40 + Math.random() * size * 3.5)
    spawnDebris(position, debrisVelocity, size * (0.08 + Math.random() * 0.12), 0.9 + Math.random() * 0.9, palette[index % palette.length], 70, false)
  }
  for (let index = 0; index < 9; index += 1) {
    debrisVelocity.set((Math.random() - 0.5) * 30, 12 + Math.random() * 30, (Math.random() - 0.5) * 30)
    spawnDebris(position, debrisVelocity, size * 0.4, 1.6 + Math.random() * 1.2, 0x4a4742, -8, true)
  }
}

const trafficHitRadius: Record<string, number> = { balloon: 62, kite: 46, airplane: 34, glider: 38, birds: 44 }
const trafficExplosionSize: Record<string, number> = { balloon: 60, kite: 38, airplane: 46, glider: 46, birds: 30 }
const trafficPalette: Record<string, readonly number[]> = {
  balloon: [0xc7543f, 0xd99f52, 0xff8a3d, 0xffd27a],
  kite: [0xd2a6dc, 0xff4fa3, 0xffd27a, 0xffffff],
  airplane: [0xd76c42, 0xe9e3d2, 0xffa04a, 0x343b39],
  glider: [0xe9e3d2, 0xc59d68, 0xffa04a, 0xffd27a],
  birds: [0x34453c, 0x8fbf55, 0xffd27a, 0xffffff],
}

const DAMAGE_DURATION = 1400
let damageUntil = 0
const damageForward = new THREE.Vector3()
const damageSmokeVelocity = new THREE.Vector3()
const damageSmokePosition = new THREE.Vector3()
let damageCooldownUntil = 0
const projectileStart = new THREE.Vector3()
const hitCenter = new THREE.Vector3()

function damagePlayer(now: number, penalty: ScoreKey): void {
  if (now < damageCooldownUntil) return
  awardScore(penalty, now)
  damageUntil = now + DAMAGE_DURATION
  damageCooldownUntil = now + 1200
  audio.hit()
  damageSmokePosition.set(flight.x, flight.y, flight.z)
  for (let spark = 0; spark < 8; spark += 1) {
    damageSmokeVelocity.set((Math.random() - 0.5) * 70, (Math.random() - 0.2) * 50, (Math.random() - 0.5) * 70)
    spawnDebris(damageSmokePosition, damageSmokeVelocity, 1.6 + Math.random() * 1.2, 0.35 + Math.random() * 0.35, 0xffb347, -30, false)
  }
}

// The glider keeps a thin side trail so the cue never covers the view ahead.
function updateDamage(now: number): void {
  if (now < damageUntil && !paused && Math.random() < 0.5) {
    damageForward.set(0, 0, -1).applyQuaternion(glider.quaternion)
    damageSmokePosition.set(Math.random() < 0.5 ? -9 : 9, -1, 4).applyQuaternion(glider.quaternion).add(glider.position)
    damageSmokeVelocity.set(0, 4 + Math.random() * 5, 0).addScaledVector(damageForward, -14)
    spawnDebris(damageSmokePosition, damageSmokeVelocity, 1.6 + Math.random() * 0.8, 0.4, 0x4a4742, -3, true)
  }
}

function checkPlayerCollisions(now: number): void {
  for (const actor of trafficActors) {
    if (actor.popped || !actor.group.visible) continue
    const radius = trafficHitRadius[actor.spawn.kind] + 18
    const center = actor.group.position
    if ((center.x - flight.x) ** 2 + (center.y - flight.y) ** 2 + (center.z - flight.z) ** 2 < radius * radius) {
      popTrafficActor(actor, now)
      damagePlayer(now, 'crash-traffic')
      return
    }
  }
  for (const actor of enemyActors) {
    if (!actor.alive) continue
    const center = actor.group.position
    if ((center.x - flight.x) ** 2 + (center.y - flight.y) ** 2 + (center.z - flight.z) ** 2 < (ENEMY_STATS[actor.enemy.kind].hitRadius + 18) ** 2) {
      popEnemy(actor, now)
      damagePlayer(now, 'ram-enemy')
      return
    }
  }
  if (!asteroidsActive) return
  for (const asteroid of asteroidStates) {
    if (asteroid.popped) continue
    const radius = asteroid.scale * 1.15 + 18
    const center = asteroid.position
    if ((center.x - flight.x) ** 2 + (center.y - flight.y) ** 2 + (center.z - flight.z) ** 2 < radius * radius) {
      popAsteroid(asteroid, now)
      damagePlayer(now, 'crash-asteroid')
      return
    }
  }
}

const asteroidCapacity = 30
const asteroidGeometry = new THREE.IcosahedronGeometry(1, 0)
const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0x716b62, roughness: 1, flatShading: true })
const asteroidField = new THREE.InstancedMesh(asteroidGeometry, asteroidMaterial, asteroidCapacity)
asteroidField.count = 0
scene.add(asteroidField)

interface AsteroidState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  scale: number
  spin: number
  rotation: number
  popped: boolean
  poppedAt: number
}

let asteroidStates: AsteroidState[] = []
let asteroidsActive = false
const asteroidTransform = new THREE.Object3D()

function createAsteroidState(center: THREE.Vector3): AsteroidState {
  const angle = random() * Math.PI * 2
  const radius = 400 + random() * 2400
  return {
    position: new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + (random() - 0.5) * 1400,
      center.z + Math.sin(angle) * radius,
    ),
    velocity: new THREE.Vector3((random() - 0.5) * 22, (random() - 0.5) * 6, (random() - 0.5) * 22),
    scale: 10 + random() * 34,
    spin: (random() - 0.5) * 1.4,
    rotation: random() * Math.PI * 2,
    popped: false,
    poppedAt: 0,
  }
}

function spawnAsteroidField(): void {
  const center = new THREE.Vector3(flight.x, flight.y, flight.z)
  asteroidStates = Array.from({ length: asteroidCapacity }, () => createAsteroidState(center))
  asteroidsActive = true
}

function clearAsteroidField(): void {
  asteroidsActive = false
  asteroidStates = []
  asteroidField.count = 0
}

function updateAsteroids(now: number, delta: number): void {
  if (!asteroidsActive) return

  asteroidStates.forEach((asteroid, index) => {
    if (asteroid.popped) {
      if (now - asteroid.poppedAt > TARGET_RESPAWN_DELAY) {
        Object.assign(asteroid, createAsteroidState(new THREE.Vector3(flight.x, flight.y, flight.z)))
      } else {
        asteroidTransform.position.set(0, -100000, 0)
        asteroidTransform.scale.setScalar(0)
        asteroidTransform.updateMatrix()
        asteroidField.setMatrixAt(index, asteroidTransform.matrix)
        return
      }
    }

    asteroid.position.addScaledVector(asteroid.velocity, delta)
    asteroid.rotation += asteroid.spin * delta
    const distanceFromPlayer = Math.hypot(asteroid.position.x - flight.x, asteroid.position.y - flight.y, asteroid.position.z - flight.z)
    if (distanceFromPlayer > 4200) {
      Object.assign(asteroid, createAsteroidState(new THREE.Vector3(flight.x, flight.y, flight.z)))
    }

    asteroidTransform.position.copy(asteroid.position)
    asteroidTransform.rotation.set(asteroid.rotation, asteroid.rotation * 0.6, asteroid.rotation * 0.3)
    asteroidTransform.scale.setScalar(asteroid.scale)
    asteroidTransform.updateMatrix()
    asteroidField.setMatrixAt(index, asteroidTransform.matrix)
  })
  asteroidField.count = asteroidCapacity
  asteroidField.instanceMatrix.needsUpdate = true
}

function fireProjectile(now: number): void {
  if (now - lastShotAt < SHOT_COOLDOWN) return
  lastShotAt = now
  audio.shot()
  const mesh = new THREE.Mesh(projectileGeometry, projectileMaterial)
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(glider.quaternion)
  mesh.position.set(flight.x, flight.y, flight.z).addScaledVector(forward, 16)
  scene.add(mesh)
  activeProjectiles.push({ mesh, velocity: forward.clone().multiplyScalar(PROJECTILE_SPEED + flight.speed), spawnedAt: now })
}

function popTrafficActor(actor: TrafficActor, now: number): void {
  actor.popped = true
  actor.poppedAt = now
  actor.group.visible = false
  explode(actor.group.position, trafficExplosionSize[actor.spawn.kind], trafficPalette[actor.spawn.kind])
  targetsPopped += 1
  targetsPoppedReadout.textContent = String(targetsPopped)
}

function popAsteroid(asteroid: AsteroidState, now: number): void {
  asteroid.popped = true
  asteroid.poppedAt = now
  explode(asteroid.position, asteroid.scale * 2.2, rockDebris)
  targetsPopped += 1
  targetsPoppedReadout.textContent = String(targetsPopped)
}

function destructibleCenter(target: Destructible): THREE.Vector3 {
  return target.object ? hitCenter.copy(target.object.position) : hitCenter.set(target.x, target.y, target.z)
}

function destroyDestructible(target: Destructible): void {
  target.destroyed = true
  explode(destructibleCenter(target), target.size, target.palette)
  target.destroy()
  awardScore(target.palette === leafDebris ? 'tree' : target.palette === rockDebris ? 'rock' : target.palette === woodDebris ? 'house' : target.object ? 'car' : 'cannon', performance.now())
  targetsPopped += 1
  targetsPoppedReadout.textContent = String(targetsPopped)
}

function updateProjectiles(now: number, delta: number): void {
  for (let index = activeProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = activeProjectiles[index]
    if (now - projectile.spawnedAt > PROJECTILE_LIFETIME) {
      scene.remove(projectile.mesh)
      activeProjectiles.splice(index, 1)
      continue
    }
    projectileStart.copy(projectile.mesh.position)
    projectile.mesh.position.addScaledVector(projectile.velocity, delta)
    const end = projectile.mesh.position

    let hit = false
    for (const actor of trafficActors) {
      if (actor.popped || !actor.group.visible) continue
      const center = actor.group.position
      if (segmentHitsSphere(projectileStart.x, projectileStart.y, projectileStart.z, end.x, end.y, end.z, center.x, center.y, center.z, trafficHitRadius[actor.spawn.kind])) {
        popTrafficActor(actor, now)
        awardScore(actor.spawn.kind === 'birds' ? 'bird' : actor.spawn.kind, now)
        hit = true
        break
      }
    }
    if (!hit) hit = hitEnemy(projectileStart, end, now)
    if (!hit) hit = hitBoss(projectileStart, end, now)
    if (!hit && asteroidsActive) {
      for (const asteroid of asteroidStates) {
        if (asteroid.popped) continue
        const center = asteroid.position
        if (segmentHitsSphere(projectileStart.x, projectileStart.y, projectileStart.z, end.x, end.y, end.z, center.x, center.y, center.z, asteroid.scale * 1.3)) {
          popAsteroid(asteroid, now)
          awardScore('asteroid', now)
          hit = true
          break
        }
      }
    }
    if (!hit) {
      for (const target of destructibles) {
        if (target.destroyed) continue
        const center = destructibleCenter(target)
        if (segmentHitsSphere(projectileStart.x, projectileStart.y, projectileStart.z, end.x, end.y, end.z, center.x, center.y, center.z, target.radius + 3)) {
          destroyDestructible(target)
          hit = true
          break
        }
      }
    }
    if (hit) {
      scene.remove(projectile.mesh)
      activeProjectiles.splice(index, 1)
    }
  }
}

const enemyBodyGeometry = new THREE.IcosahedronGeometry(1, 1)
const enemyWingGeometry = new THREE.BoxGeometry(46, 0.9, 9)
const enemyFinGeometry = new THREE.BoxGeometry(1, 9, 7)
const enemyGlowGeometry = new THREE.SphereGeometry(3, 8, 6)
const enemyBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2a2e, roughness: 0.5, metalness: 0.3, flatShading: true })
const enemyWingMaterial = new THREE.MeshStandardMaterial({ color: 0x8f2f2b, roughness: 0.6, flatShading: true })
const enemyGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xff4a2a, toneMapped: false })
const enemyBulletGeometry = new THREE.SphereGeometry(2.5, 8, 6)
const enemyBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a3c, toneMapped: false })
const ENEMY_BULLET_SPEED = 240
const ENEMY_BULLET_LIFETIME = 3600

interface EnemyActor {
  enemy: Enemy
  group: THREE.Group
  alive: boolean
  respawnAt: number
  previousHeading: number
}

interface EnemyBullet {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  spawnedAt: number
  life?: number
}

const enemyActors: EnemyActor[] = []
const enemyBullets: EnemyBullet[] = []
const enemyAim = new THREE.Vector3()

const enemyPalettes: Record<EnemyKind, { body: THREE.MeshStandardMaterial; wing: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial }> = {
  drone: { body: enemyBodyMaterial, wing: enemyWingMaterial, glow: enemyGlowMaterial },
  interceptor: {
    body: new THREE.MeshStandardMaterial({ color: 0x25384f, roughness: 0.4, metalness: 0.4, flatShading: true }),
    wing: new THREE.MeshStandardMaterial({ color: 0x4f86a8, roughness: 0.5, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ color: 0x66e6ff, toneMapped: false }),
  },
  gunship: {
    body: new THREE.MeshStandardMaterial({ color: 0x3a4636, roughness: 0.6, metalness: 0.25, flatShading: true }),
    wing: new THREE.MeshStandardMaterial({ color: 0x7a6a38, roughness: 0.7, flatShading: true }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffb13a, toneMapped: false }),
  },
}
const enemyShapes: Record<EnemyKind, { body: [number, number, number]; wing: [number, number, number]; fins: number; glows: number[]; glowSize: number }> = {
  drone: { body: [5, 3.4, 16], wing: [1, 1, 1], fins: 22, glows: [0], glowSize: 1 },
  interceptor: { body: [2.6, 2, 18], wing: [0.5, 1, 0.8], fins: 11, glows: [0], glowSize: 0.8 },
  gunship: { body: [9, 6, 24], wing: [1.5, 1.4, 1.6], fins: 33, glows: [-14, 14], glowSize: 1.8 },
}
const enemyExplosionSize: Record<EnemyKind, number> = { drone: 50, interceptor: 34, gunship: 95 }

function createEnemyModel(kind: EnemyKind): THREE.Group {
  const palette = enemyPalettes[kind]
  const shape = enemyShapes[kind]
  const group = new THREE.Group()
  const body = new THREE.Mesh(enemyBodyGeometry, palette.body)
  body.scale.set(...shape.body)
  group.add(body)
  const wings = new THREE.Mesh(enemyWingGeometry, palette.wing)
  wings.scale.set(...shape.wing)
  group.add(wings)
  for (const side of [-shape.fins, shape.fins]) {
    const fin = new THREE.Mesh(enemyFinGeometry, palette.wing)
    fin.position.set(side, 3, 1)
    fin.scale.setScalar(shape.glowSize)
    group.add(fin)
  }
  const eye = new THREE.Mesh(enemyGlowGeometry, palette.glow)
  eye.position.set(0, 1.5, -shape.body[2] * 0.8)
  eye.scale.setScalar(shape.glowSize)
  group.add(eye)
  for (const offset of shape.glows) {
    const engine = new THREE.Mesh(enemyGlowGeometry, palette.glow)
    engine.position.set(offset, 0, shape.body[2])
    engine.scale.setScalar(shape.glowSize)
    group.add(engine)
  }
  return group
}

function pickEnemyKind(): EnemyKind {
  const roll = random()
  if (targetsPopped >= 12 && roll < 0.25) return 'gunship'
  if (targetsPopped >= 4 && roll < 0.55) return 'interceptor'
  return 'drone'
}

function spawnEnemy(actor: EnemyActor): void {
  const bearing = flight.heading + (random() - 0.5) * 0.9
  const radius = 1500 + random() * 600
  const x = flight.x - Math.sin(bearing) * radius
  const z = flight.z - Math.cos(bearing) * radius
  const y = Math.max(flight.y + (random() - 0.5) * 200, terrainHeight(x, z) + 200)
  const kind = pickEnemyKind()
  scene.remove(actor.group)
  actor.group = createEnemyModel(kind)
  scene.add(actor.group)
  actor.enemy = createEnemy(x, y, z, random() * Math.PI * 2, kind)
  actor.enemy.heading = Math.atan2(flight.x - x, flight.z - z) + Math.PI
  actor.previousHeading = actor.enemy.heading
  actor.alive = true
  actor.group.visible = true
}

function popEnemy(actor: EnemyActor, now: number): void {
  actor.alive = false
  actor.respawnAt = now + 6000
  actor.group.visible = false
  explode(actor.group.position, enemyExplosionSize[actor.enemy.kind], fireDebris)
  targetsPopped += 1
  targetsPoppedReadout.textContent = String(targetsPopped)
}

function hitEnemy(start: THREE.Vector3, end: THREE.Vector3, now: number): boolean {
  for (const actor of enemyActors) {
    if (!actor.alive) continue
    const center = actor.group.position
    if (!segmentHitsSphere(start.x, start.y, start.z, end.x, end.y, end.z, center.x, center.y, center.z, ENEMY_STATS[actor.enemy.kind].hitRadius)) continue
    actor.enemy.health -= 1
    if (actor.enemy.health <= 0) {
      popEnemy(actor, now)
      awardScore(actor.enemy.kind, now)
    }
    else explode(center, 14, fireDebris)
    return true
  }
  return false
}

function fireEnemyBullet(actor: EnemyActor, now: number, spread = 0): void {
  const mesh = new THREE.Mesh(enemyBulletGeometry, enemyBulletMaterial)
  audio.enemyShot()
  enemyAim.set(flight.x - actor.enemy.x, flight.y - actor.enemy.y, flight.z - actor.enemy.z).normalize()
  enemyAim.x += (Math.random() - 0.5) * 0.06
  enemyAim.y += (Math.random() - 0.5) * 0.06
  enemyAim.z += (Math.random() - 0.5) * 0.06
  enemyAim.x -= enemyAim.z * spread
  enemyAim.z += enemyAim.x * spread
  enemyAim.normalize()
  mesh.position.set(actor.enemy.x, actor.enemy.y, actor.enemy.z).addScaledVector(enemyAim, 30)
  scene.add(mesh)
  enemyBullets.push({ mesh, velocity: enemyAim.clone().multiplyScalar(ENEMY_BULLET_SPEED), spawnedAt: now })
}

function updateEnemies(now: number, delta: number): void {
  const wanted = Math.min(5, 2 + Math.floor(targetsPopped / 10))
  while (enemyActors.length < wanted) {
    const group = createEnemyModel('drone')
    group.visible = false
    scene.add(group)
    enemyActors.push({ enemy: createEnemy(0, 0, 0), group, alive: false, respawnAt: now + 3000, previousHeading: 0 })
  }
  for (const actor of enemyActors) {
    if (!actor.alive) {
      if (now >= actor.respawnAt && !bossBusy() && !activeWorldEvent?.peace) spawnEnemy(actor)
      continue
    }
    if (Math.hypot(actor.enemy.x - flight.x, actor.enemy.z - flight.z) > 6500) {
      spawnEnemy(actor)
      continue
    }
    if (stepEnemy(actor.enemy, flight, delta)) {
      const burst = ENEMY_STATS[actor.enemy.kind].burst
      for (let shot = 0; shot < burst; shot += 1) fireEnemyBullet(actor, now, (shot - (burst - 1) / 2) * 0.1)
    }
    const turn = delta > 0 ? (actor.enemy.heading - actor.previousHeading) / delta : 0
    actor.previousHeading = actor.enemy.heading
    actor.group.position.set(actor.enemy.x, actor.enemy.y, actor.enemy.z)
    actor.group.rotation.set(0, actor.enemy.heading, THREE.MathUtils.clamp(turn * 0.6, -0.6, 0.6))
  }
}

function updateEnemyBullets(now: number, delta: number): void {
  for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
    const bullet = enemyBullets[index]
    projectileStart.copy(bullet.mesh.position)
    bullet.mesh.position.addScaledVector(bullet.velocity, delta)
    const end = bullet.mesh.position
    const struck = segmentHitsSphere(projectileStart.x, projectileStart.y, projectileStart.z, end.x, end.y, end.z, flight.x, flight.y, flight.z, 16)
    if (struck) damagePlayer(now, 'hit-by-shot')
    if (struck || now - bullet.spawnedAt > (bullet.life ?? ENEMY_BULLET_LIFETIME)) {
      scene.remove(bullet.mesh)
      enemyBullets.splice(index, 1)
    }
  }
}

const bossBar = document.querySelector<HTMLDivElement>('#boss-bar')!
const bossNameReadout = document.querySelector<HTMLSpanElement>('#boss-name')!
const bossFill = document.querySelector<HTMLElement>('#boss-fill')!
const bossBulletGeometry = new THREE.SphereGeometry(1, 10, 8)
const bossBulletMaterials: Record<BossKind, THREE.MeshBasicMaterial> = {
  dragon: new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }),
  mothership: new THREE.MeshBasicMaterial({ color: 0xff4fd8, toneMapped: false }),
  manta: new THREE.MeshBasicMaterial({ color: 0x6de8ff, toneMapped: false }),
}
const bossBulletSize: Record<BossKind, number> = { dragon: 7, mothership: 5, manta: 6 }
const bossWarnings: Record<BossKind, string> = {
  dragon: 'WARNING: A DRAGON HAS HEARD ABOUT YOUR RINGS',
  mothership: 'WARNING: A MOTHERSHIP IS PARKING OVERHEAD',
  manta: 'WARNING: A THUNDER MANTA IS COMING IN HOT',
}
const BOSS_BULLET_LIFE = 7000

let boss: Boss | null = null
let bossGroup: THREE.Group | null = null
let bossSpawnAt = Number.POSITIVE_INFINITY
let bossesDefeated = 0
let bossWarningUntil = 0
const bossWings: THREE.Object3D[] = []
const bossSegments: THREE.Object3D[] = []
const bossSpinners: THREE.Object3D[] = []
const bossBlasts: Array<{ at: number; x: number; y: number; z: number; size: number }> = []
const bossAim = new THREE.Vector3()
const bossSide = new THREE.Vector3()
const bossStart = new THREE.Vector3()

function bossBusy(): boolean {
  return boss !== null || Number.isFinite(bossSpawnAt) || bossBlasts.length > 0
}

function bossMesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  return mesh
}

function createBossModel(kind: BossKind): THREE.Group {
  bossWings.length = 0
  bossSegments.length = 0
  bossSpinners.length = 0
  const group = new THREE.Group()
  const glow = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
  const solid = (color: number, metalness = 0.15) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness, flatShading: true })
  const sphere = new THREE.SphereGeometry(1, 14, 10)
  const box = new THREE.BoxGeometry(1, 1, 1)
  const put = (parent: THREE.Object3D, mesh: THREE.Mesh): THREE.Mesh => {
    parent.add(mesh)
    return mesh
  }

  if (kind === 'dragon') {
    const scales = solid(0x7a2d2a)
    const belly = solid(0xc9a15b)
    const fire = glow(0xffb13a)
    const head = bossMesh(sphere, scales)
    head.scale.set(24, 18, 38)
    group.add(head)
    const jaw = bossMesh(box, belly, 0, -13, -10)
    jaw.scale.set(22, 6, 40)
    group.add(jaw)
    for (const side of [-1, 1]) {
      const horn = bossMesh(new THREE.ConeGeometry(5, 34, 6), belly, side * 12, 20, 14)
      horn.rotation.x = 0.9
      group.add(horn)
      put(group, bossMesh(sphere, fire, side * 12, 6, -26)).scale.setScalar(4.5)
    }
    const mouth = bossMesh(sphere, fire, 0, -4, -38)
    mouth.scale.setScalar(8)
    group.add(mouth)
    bossSpinners.push(mouth)
    for (let index = 0; index < 10; index += 1) {
      const size = 26 - index * 1.7
      const segment = new THREE.Group()
      segment.position.set(0, 0, 40 + index * 36)
      const body = bossMesh(sphere, scales)
      body.scale.set(size, size * 0.85, 26)
      segment.add(body)
      const spike = bossMesh(new THREE.ConeGeometry(size * 0.28, size * 0.9, 5), belly, 0, size * 0.85, 0)
      segment.add(spike)
      group.add(segment)
      bossSegments.push(segment)
    }
    for (const side of [-1, 1]) {
      const wing = new THREE.Group()
      wing.position.set(side * 16, 10, 58)
      const membrane = bossMesh(box, solid(0x9c3a2e), side * 80, 0, 6)
      membrane.scale.set(160, 2.5, 92)
      wing.add(membrane)
      for (const finger of [-34, 0, 34]) {
        const bone = bossMesh(box, belly, side * 80, 2, finger + 6)
        bone.scale.set(164, 3.5, 4)
        wing.add(bone)
      }
      group.add(wing)
      bossWings.push(wing)
    }
  } else if (kind === 'mothership') {
    const hull = solid(0x8d98a3, 0.5)
    const disc = bossMesh(new THREE.CylinderGeometry(150, 200, 28, 36), hull)
    group.add(disc)
    group.add(bossMesh(new THREE.CylinderGeometry(70, 90, 20, 24), solid(0x4a525a, 0.5), 0, -22, 0))
    const dome = bossMesh(new THREE.SphereGeometry(78, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.55, toneMapped: false }), 0, 14, 0)
    group.add(dome)
    const rim = bossMesh(new THREE.TorusGeometry(184, 6, 8, 48), glow(0xff4fd8))
    rim.rotation.x = Math.PI / 2
    group.add(rim)
    const lights = new THREE.Group()
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2
      put(lights, bossMesh(sphere, glow(index % 2 ? 0xffd27a : 0x66e6ff), Math.cos(angle) * 190, -6, Math.sin(angle) * 190)).scale.setScalar(7)
    }
    group.add(lights)
    bossSpinners.push(lights)
    for (const angle of [0, 2.1, 4.2]) {
      const cannon = bossMesh(new THREE.ConeGeometry(14, 44, 8), solid(0x343b39, 0.4), Math.cos(angle) * 70, -48, Math.sin(angle) * 70)
      cannon.rotation.x = Math.PI
      group.add(cannon)
    }
  } else {
    const hide = solid(0x24425a, 0.25)
    const body = bossMesh(sphere, hide)
    body.scale.set(60, 13, 96)
    group.add(body)
    put(group, bossMesh(sphere, solid(0xb8d4e0), 0, -8, -10)).scale.set(46, 8, 74)
    for (const side of [-1, 1]) {
      const wing = new THREE.Group()
      wing.position.set(side * 40, 0, 0)
      const membrane = bossMesh(box, hide, side * 80, 0, 0)
      membrane.scale.set(170, 4, 120)
      wing.add(membrane)
      const tip = bossMesh(box, solid(0x4f86a8), side * 170, 0, 30)
      tip.scale.set(60, 3, 50)
      wing.add(tip)
      group.add(wing)
      bossWings.push(wing)
      put(group, bossMesh(sphere, glow(0x6de8ff), side * 18, 6, -66)).scale.setScalar(5.5)
    }
    const tail = bossMesh(new THREE.CylinderGeometry(2, 7, 230, 6), hide, 0, 0, 200)
    tail.rotation.x = Math.PI / 2
    group.add(tail)
    for (const radius of [34, 54]) {
      const ring = bossMesh(new THREE.TorusGeometry(radius, 2.2, 6, 28), glow(0x6de8ff), 0, 14, 0)
      ring.rotation.x = Math.PI / 2
      group.add(ring)
      bossSpinners.push(ring)
    }
  }
  return group
}

function scheduleBoss(now: number): void {
  bossSpawnAt = now + 6500
  bossWarningUntil = now + 5500
  const kind = createBoss(bossesDefeated, 0, 0, 0).kind
  bossNameReadout.textContent = bossWarnings[kind]
  bossFill.style.transform = 'scaleX(1)'
  bossBar.classList.add('is-visible', 'is-warning')
}

function spawnBoss(): void {
  const bearing = flight.heading
  const x = flight.x - Math.sin(bearing) * 1700
  const z = flight.z - Math.cos(bearing) * 1700
  boss = createBoss(bossesDefeated, x, Math.max(flight.y + 150, terrainHeight(x, z) + 320), z)
  boss.angle = Math.atan2(z - flight.z, x - flight.x)
  bossGroup = createBossModel(boss.kind)
  scene.add(bossGroup)
  bossSpawnAt = Number.POSITIVE_INFINITY
  bossNameReadout.textContent = BOSS_STATS[boss.kind].name
  bossBar.classList.remove('is-warning')
}

function clearBoss(): void {
  if (bossGroup) scene.remove(bossGroup)
  bossGroup = null
  boss = null
  bossSpawnAt = Number.POSITIVE_INFINITY
  bossBlasts.length = 0
  bossBar.classList.remove('is-visible', 'is-warning')
}

function fireBossAttack(attack: { count: number; spread: number; speed: number }, now: number): void {
  if (!boss) return
  bossAim.set(flight.x - boss.x, flight.y - boss.y, flight.z - boss.z).normalize()
  bossSide.set(-bossAim.z, 0, bossAim.x).normalize()
  audio.enemyShot()
  for (let shot = 0; shot < attack.count; shot += 1) {
    const offset = (shot - (attack.count - 1) / 2) * attack.spread
    const velocity = bossAim.clone().addScaledVector(bossSide, offset).normalize()
    const mesh = new THREE.Mesh(bossBulletGeometry, bossBulletMaterials[boss.kind])
    mesh.scale.setScalar(bossBulletSize[boss.kind])
    mesh.position.set(boss.x, boss.y, boss.z).addScaledVector(velocity, BOSS_STATS[boss.kind].hitRadius * 0.7)
    scene.add(mesh)
    enemyBullets.push({ mesh, velocity: velocity.multiplyScalar(attack.speed), spawnedAt: now, life: BOSS_BULLET_LIFE })
  }
}

function hitBoss(start: THREE.Vector3, end: THREE.Vector3, now: number): boolean {
  if (!boss || !bossGroup) return false
  const stats = BOSS_STATS[boss.kind]
  if (!segmentHitsSphere(start.x, start.y, start.z, end.x, end.y, end.z, boss.x, boss.y, boss.z, stats.hitRadius)) return false
  bossStart.copy(end)
  spawnPopFlash(bossStart, 34, 0xffd27a)
  if (!damageBoss(boss)) return true
  const { x, y, z } = boss
  const size = stats.hitRadius * 0.9
  for (let blast = 0; blast < 9; blast += 1) {
    bossBlasts.push({ at: now + blast * 260, x: x + (Math.random() - 0.5) * stats.hitRadius * 1.6, y: y + (Math.random() - 0.5) * stats.hitRadius * 0.8, z: z + (Math.random() - 0.5) * stats.hitRadius * 1.6, size: size * (blast === 8 ? 2 : 0.7) })
  }
  scene.remove(bossGroup)
  bossGroup = null
  boss = null
  bossBar.classList.remove('is-visible')
  awardScore('boss', now, bossesDefeated * 500)
  bossesDefeated += 1
  targetsPopped += 1
  targetsPoppedReadout.textContent = String(targetsPopped)
  nextFieldNoteAt = now + 9000
  return true
}

function updateBoss(now: number, delta: number): void {
  if (!boss && now >= bossSpawnAt) spawnBoss()
  if (bossBar.classList.contains('is-warning') && now > bossWarningUntil && boss) bossBar.classList.remove('is-warning')
  for (let index = bossBlasts.length - 1; index >= 0; index -= 1) {
    const blast = bossBlasts[index]
    if (now < blast.at) continue
    explode(bossStart.set(blast.x, blast.y, blast.z), blast.size, fireDebris)
    bossBlasts.splice(index, 1)
  }
  if (!boss || !bossGroup) return

  const attack = stepBoss(boss, flight, delta)
  if (attack) fireBossAttack(attack, now)
  bossGroup.position.set(boss.x, boss.y, boss.z)
  bossGroup.rotation.set(0, boss.heading, 0)
  bossFill.style.transform = `scaleX(${boss.health / boss.maxHealth})`
  bossBar.classList.toggle('is-enraged', bossEnraged(boss))

  const time = now * 0.001
  bossWings.forEach((wing, index) => {
    wing.rotation.z = Math.sin(time * (boss!.kind === 'dragon' ? 3.2 : 1.6)) * 0.42 * (index === 0 ? -1 : 1)
  })
  bossSegments.forEach((segment, index) => {
    segment.position.x = Math.sin(time * 2.4 - index * 0.6) * 14
  })
  for (const spinner of bossSpinners) {
    if (boss.kind === 'mothership') spinner.rotation.y = time * 0.8
    else if (boss.kind === 'manta') spinner.rotation.z = time * 2
    else spinner.scale.setScalar(8 + Math.sin(time * 6) * 2)
  }
}

function checkBossCollision(now: number): void {
  if (!boss) return
  const reach = BOSS_STATS[boss.kind].hitRadius * 0.85 + 18
  if ((boss.x - flight.x) ** 2 + (boss.y - flight.y) ** 2 + (boss.z - flight.z) ** 2 < reach * reach) damagePlayer(now, 'ram-enemy')
}

const pressedKeys = new Set<string>()
let touchRoll = 0
let touchPitch = 0
let touchBoost = false
let touchFire = false
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
  targetsPopped = 0
  targetsPoppedReadout.textContent = '0'
  Object.assign(scoreState, createScore())
  scoreReadout.textContent = '0'
  scorePop.classList.remove('is-visible')
  damageUntil = 0
  damageCooldownUntil = 0
  for (const projectile of activeProjectiles.splice(0)) scene.remove(projectile.mesh)
  for (const bullet of enemyBullets.splice(0)) scene.remove(bullet.mesh)
  clearBoss()
  for (const actor of enemyActors) {
    actor.alive = false
    actor.group.visible = false
    actor.respawnAt = performance.now() + 2500
  }
  setPaused(false)
}

const muteButton = document.querySelector<HTMLButtonElement>('#mute-button')!
function toggleSound(): void {
  const muted = audio.toggleMute()
  muteButton.setAttribute('aria-pressed', String(muted))
  muteButton.textContent = muted ? 'MUTED' : 'SOUND'
}
muteButton.addEventListener('click', toggleSound)
window.addEventListener('pointerdown', () => audio.start())

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
fireButton.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  fireButton.setPointerCapture(event.pointerId)
  touchFire = true
})
const releaseFire = () => { touchFire = false }
fireButton.addEventListener('pointerup', releaseFire)
fireButton.addEventListener('pointercancel', releaseFire)
fireButton.addEventListener('lostpointercapture', releaseFire)

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
  audio.start()
  if (event.code === 'KeyM' && !event.repeat) toggleSound()
  const controls = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']
  const boostControls = ['Space', 'ShiftLeft', 'ShiftRight']
  const fireControls = ['KeyF']
  if (controls.includes(event.code) || boostControls.includes(event.code) || fireControls.includes(event.code)) {
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
  touchFire = false
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
  const damaged = !paused && performance.now() < damageUntil
  flightStatus.classList.toggle('is-damaged', damaged)
  dataLive.classList.toggle('is-damaged', damaged)
  dataLive.textContent = damaged ? 'HULL HIT' : 'LIVE'
  flightStatus.lastElementChild!.textContent = paused ? 'PAUSED' : damaged ? 'DAMAGED' : flight.boost > 0.5 ? 'BOOSTING' : 'IN THE AIR'
}

let previousFrame = performance.now()
function render(now: number): void {
  const delta = Math.min((now - previousFrame) / 1000, 0.05)
  previousFrame = now

  if (!paused) {
    const scraped = stepFlight(flight, {
      roll: controlValue(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD'], touchRoll),
      pitch: controlValue(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW'], touchPitch),
      boost: touchBoost || pressedKeys.has('Space') || pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight'),
    }, delta)
    const tower = resolveTowerCollision(flight, activeTowers)
    if (tower) damagePlayer(now, 'tower')
    else if (scraped) damagePlayer(now, 'cliff')
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
  if (!paused) {
    if (touchFire || pressedKeys.has('KeyF')) fireProjectile(now)
    updateProjectiles(now, delta)
    updateAsteroids(now, delta)
    updateEnemies(now, delta)
    updateEnemyBullets(now, delta)
    updateBoss(now, delta)
  }
  updatePopFlashes(now)
  updateDebris(delta)
  updateDamage(now)

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
  if (!paused) {
    checkPlayerCollisions(now)
    checkBossCollision(now)
  }
  updateFieldNote(now)
  updateWorldCelebration(now)
  updateEventWeather(delta)
  updateReadouts()
  updateObstacles(now)
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

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { SoundEngine } from './audio';
import { createAuroraBackdrop, DioramaPostShader } from './shaders';
import { SnowTrailSurface } from './snowTrail';
import {
  createBestFlag,
  createCandyCaneGate,
  createCocoaPickup,
  createDecoySnowman,
  createDioramaBoarder,
  createDioramaChalet,
  createDioramaDog,
  createDioramaPine,
  createDioramaSkier,
  createDioramaSkiLift,
  createDioramaYeti,
  createForegroundBokehFrame,
  createLodgeArch,
  createMogulRamp,
  createSnowRock,
  DioramaPine,
  DioramaSkier,
  DioramaYeti,
  loadSharedPools,
  SharedPools,
} from './sprites';
import {
  applyUpgrade,
  createInitialUpgrades,
  draftThreeUpgrades,
  UPGRADE_CATALOG,
  UpgradeDef,
  UpgradeId,
  UpgradeState,
} from './upgrades';

export type GameMode = 'loading' | 'title' | 'playing' | 'upgrading' | 'paused' | 'gameover';

interface SlopeEntity {
  id: number;
  kind:
    | 'tree'
    | 'rock'
    | 'mogul'
    | 'gate'
    | 'dog'
    | 'boarder'
    | 'cocoa'
    | 'lodge'
    | 'chalet'
    | 'decoy'
    | 'best_flag';
  mesh: THREE.Object3D;
  x: number;
  z: number;
  radius: number;
  vx?: number;
  vz?: number;
  gateWidth?: number;
  triggered?: boolean;
  nearMissed?: boolean;
  closestDist?: number;
  collided?: boolean;
  pineObj?: DioramaPine;
  card?: THREE.Mesh;
  sideDecor?: boolean;
  bobPhase?: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  spin: number;
}

interface Snowball {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  marker: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
}

export interface HudCallbacks {
  onHudUpdate: (data: {
    distance: number;
    speedMps: number;
    isMaxSpeed: boolean;
    score: number;
    bestDistance: number;
    flow: number;
    boosting: boolean;
    comboMult: number;
    sectorName: string;
    sectorColor: string;
    yetiActive: boolean;
    yetiLeadMeters: number;
    yetiAlertText: string;
    upgrades: UpgradeState;
  }) => void;
  onToast: (text: string, variant?: 'default' | 'good' | 'fire' | 'danger') => void;
  onMilestone: (eyebrow: string, title: string, sub: string) => void;
  onShowUpgradeDraft: (distance: number, choices: UpgradeDef[]) => void;
  onGameOver: (summary: {
    distance: number;
    score: number;
    bestDistance: number;
    tricksAndOutplays: number;
    upgrades: UpgradeState;
  }) => void;
  onModeChange: (mode: GameMode) => void;
}

const BEST_STORAGE_KEY = 'chomp_line_best_dist_v2';

export class ChompLineGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: HudCallbacks;
  public readonly sound = new SoundEngine();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private dioramaPass!: ShaderPass;

  private pools!: SharedPools;
  private auroraUniforms!: { uTime: { value: number }; uIntensity: { value: number } };
  private snowTrail!: SnowTrailSurface;
  private groundMesh!: THREE.Mesh;
  private bokehRig!: { group: THREE.Group; leftSide: THREE.Group; rightSide: THREE.Group };

  private liftChairs: { mesh: THREE.Group; t: number }[] = [];
  private snowfallPoints!: THREE.Points;
  private snowfallPositions!: Float32Array;

  // Shared particle/snowball geometries & cached HDR/SDR color materials (zero GPU leaks!)
  private burstParticles: BurstParticle[] = [];
  private burstMatCache = new Map<number, THREE.MeshBasicMaterial>();
  private sharedSphereGeo = new THREE.SphereGeometry(0.16, 6, 6);
  private sharedSparkGeo = new THREE.OctahedronGeometry(0.2, 0);
  private sharedSnowballGeo = new THREE.DodecahedronGeometry(0.75, 1);
  private sharedSnowballMat = new THREE.MeshStandardMaterial({ color: 0xeaf5ff, roughness: 0.85 });

  private skier!: DioramaSkier;
  private yeti!: DioramaYeti;

  private entities: SlopeEntity[] = [];
  private snowballs: Snowball[] = [];
  private nextEntityId = 1;

  private mode: GameMode = 'loading';
  private animFrameId = 0;
  private lastTime = 0;
  private elapsedTime = 0;

  // Responsive Camera Baseline (adapts seamlessly to iPhone Portrait, Landscape & Desktop!)
  private baseFov = 46;
  private baseCamY = 15.2;
  private baseCamZ = 34.5;

  // Player Physics & Flow-State Tuning
  private playerX = 0;
  private playerZ = -3.8;
  private playerVx = 0;
  private playerY = 0;
  private playerVy = 0;
  private speed = 14.5;
  private distance = 0;
  private score = 0;
  private bestDistance = 0;
  private runStartBest = 0;
  private bestFlagSpawned = false;
  private flow = 100;
  private flowSurgeTimer = 0;

  private comboMult = 1.0;
  private comboTimer = 0;
  private tricksAndOutplays = 0;
  private launchedFromMogul = false;
  private airSpinDegrees = 0;
  private spunInAir = false;
  private crashStunTimer = 0;
  private invulnTimer = 0;
  private screenShake = 0;

  // Expressive Spring-Physics Puppet State
  private squashPos = 0;
  private squashVel = 0;
  private smoothLean = 0;
  private smoothCrouch = 0;
  private facingDir = 1;

  // Yeti Lead & 2,000m Chomp Line Chase State
  // Clean skiing keeps Yeti off until 2,000m; repeated wipeouts burn your lead!
  private yetiLeadPenalty = 0;
  private yetiTriggered = false;
  private yetiActive = false;
  private yetiX = 0;
  private yetiZ = -24;
  private yetiStunTimer = 0;
  private yetiStompPhase = 0;
  private yetiLastStompStep = -1;
  private yetiSnowballTimer = 4.0;
  private yetiTargetDecoy: SlopeEntity | null = null;
  private yetiVictoryDance = false;

  private nextLodgeDist = 650;
  private spawnAccum = 0;
  private decorAccum = 0;
  private trailStampAccum = 0;
  private upgrades: UpgradeState = createInitialUpgrades();
  private activeDraftChoices: UpgradeDef[] = [];

  // Controls (Desktop Keyboard/Mouse + iPhone Multi-Touch Thumb Steering & Buttons)
  private keys = new Set<string>();
  private pointerSteerActive = false;
  private pointerNormX = 0;
  private mouseDown = false;
  private activeSteerTouchId: number | null = null;
  private touchJumpHeld = false;
  private touchBoostHeld = false;

  private readonly PLAY_HALF_WIDTH = 17.5;
  private readonly WORLD_WIDTH = 120;
  private readonly WORLD_LENGTH = 132;

  constructor(canvas: HTMLCanvasElement, callbacks: HudCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    try {
      const saved = window.localStorage.getItem(BEST_STORAGE_KEY);
      if (saved) this.bestDistance = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // ignore storage errors
    }

    this.initAsync();
  }

  private async initAsync(): Promise<void> {
    this.pools = await loadSharedPools();
    this.initScene();
    this.bindInputs();
    this.updateCameraForAspect();
    this.populateInitialScenicSlope();
    this.setMode('title');
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public getBestDistance(): number {
    return this.bestDistance;
  }

  public getMode(): GameMode {
    return this.mode;
  }

  private persistBestDistance(): void {
    const cur = Math.floor(this.distance);
    if (cur > this.bestDistance) {
      this.bestDistance = cur;
      try {
        window.localStorage.setItem(BEST_STORAGE_KEY, String(this.bestDistance));
      } catch {
        // ignore
      }
    }
  }

  private setMode(next: GameMode): void {
    this.mode = next;
    this.callbacks.onModeChange(next);
  }

  public setTouchJump(held: boolean): void {
    this.sound.unlock();
    const wasHeld = this.touchJumpHeld;
    this.touchJumpHeld = held;
    if (held && !wasHeld && this.mode === 'playing') {
      this.tryJump();
    }
  }

  public setTouchBoost(held: boolean): void {
    this.sound.unlock();
    this.touchBoostHeld = held;
  }

  public triggerTouchDecoy(): void {
    this.sound.unlock();
    if (this.mode === 'playing') {
      this.tryDeployDecoy(false);
    }
  }

  private initScene(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x52648f, 0.0028);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 240);
    this.camera.position.set(0, this.baseCamY, this.baseCamZ);
    this.camera.lookAt(0, 3.0, -3.5);
    this.scene.add(this.camera);

    // Out-of-focus foreground bokeh fairy-light pine corners
    this.bokehRig = createForegroundBokehFrame(this.pools);
    this.camera.add(this.bokehRig.group);

    // Proper Three.js 0.174 Post-Processing Pipeline:
    // MSAA RenderTarget -> RenderPass -> HDR UnrealBloom -> Diorama Tilt-Shift -> OutputPass (ACES + sRGB!)
    const msaaTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, msaaTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.32,
      0.6,
      1.04 // HDR threshold: only genuine fairy-light bulbs, yellow ribbons & fire sparks bloom!
    );
    this.composer.addPass(this.bloomPass);

    this.dioramaPass = new ShaderPass(DioramaPostShader);
    this.dioramaPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.dioramaPass);

    // OutputPass applies ACESFilmicToneMapping + linear-to-sRGB encoding so painted art renders vibrant & true!
    this.composer.addPass(new OutputPass());

    // Retuned balanced winter lighting calibrated for OutputPass
    const hemi = new THREE.HemisphereLight(0xdbeeff, 0x5c75a6, 0.92);
    this.scene.add(hemi);

    const moonLight = new THREE.DirectionalLight(0xfff8ec, 0.92);
    moonLight.position.set(16, 30, 18);
    this.scene.add(moonLight);

    const auroraRim = new THREE.DirectionalLight(0x64f0d8, 0.35);
    auroraRim.position.set(-18, 16, -26);
    this.scene.add(auroraRim);

    // Shimmering Aurora Borealis + Snowy Mountain Horizon Backdrop
    const aurora = createAuroraBackdrop();
    this.auroraUniforms = aurora.uniforms;
    aurora.mesh.position.set(0, 17.5, -66);
    this.scene.add(aurora.mesh);

    // Sculpted Valley Terrain:
    // Playable corridor (|x| <= PLAY_HALF_WIDTH + 1.0) is strictly flat y = 0 so EVERY contact shadow
    // & yellow ribbon stays 100% flush with zero z-fighting or clipping; outer flanks rise like snowbanks!
    this.snowTrail = new SnowTrailSurface(this.WORLD_WIDTH, this.WORLD_LENGTH);
    const groundGeo = new THREE.PlaneGeometry(this.WORLD_WIDTH, this.WORLD_LENGTH, 64, 48);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const bank = Math.max(0, Math.abs(x) - (this.PLAY_HALF_WIDTH + 1.2));
      if (bank > 0) {
        const bankRise = Math.pow(bank * 0.16, 1.45) * 1.45;
        const drift = Math.sin(x * 0.22) * Math.cos(z * 0.15) * 0.18;
        posAttr.setY(i, bankRise + drift);
      } else {
        posAttr.setY(i, 0);
      }
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.snowTrail.texture,
      roughness: 0.78,
      metalness: 0.03,
      color: 0xffffff,
      emissive: 0x263554,
      emissiveIntensity: 0.15,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(this.groundMesh);

    this.initSkiLift();
    this.initSnowfall();

    this.skier = createDioramaSkier(this.pools);
    this.skier.root.position.set(0, 0, this.playerZ);
    this.scene.add(this.skier.root);

    this.yeti = createDioramaYeti(this.pools);
    this.yeti.root.position.set(5.5, 0, -14.5);
    this.yeti.root.visible = true;
    this.scene.add(this.yeti.root);
  }

  private updateCameraForAspect(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(1, h);

    if (aspect < 0.85) {
      // iPhone Portrait Mode: widen vertical FOV & pull slightly higher/back so the whole piste fits comfortably!
      this.baseFov = 58;
      this.baseCamY = 18.8;
      this.baseCamZ = 40.5;
      // Tuck bokeh pines closer to narrow portrait corners
      this.bokehRig.leftSide.position.set(-4.3, -3.5, 0);
      this.bokehRig.rightSide.position.set(4.3, -3.5, 0);
    } else if (aspect < 1.2) {
      // Tablet / Square
      this.baseFov = 50;
      this.baseCamY = 16.2;
      this.baseCamZ = 36.5;
      this.bokehRig.leftSide.position.set(-5.8, -2.5, 0);
      this.bokehRig.rightSide.position.set(5.8, -2.5, 0);
    } else {
      // Desktop / iPhone Landscape Widescreen
      this.baseFov = 46;
      this.baseCamY = 15.2;
      this.baseCamZ = 34.5;
      this.bokehRig.leftSide.position.set(-7.1, -2.1, 0);
      this.bokehRig.rightSide.position.set(7.1, -2.1, 0);
    }

    this.camera.aspect = aspect;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  private initSkiLift(): void {
    const cableCurve = new THREE.LineCurve3(
      new THREE.Vector3(-42, 13.4, -26),
      new THREE.Vector3(42, 18.8, -28)
    );
    const cableMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 2, 0.055, 5, false),
      new THREE.MeshBasicMaterial({ color: 0x1b263b })
    );
    this.scene.add(cableMesh);

    for (let i = 0; i < 4; i++) {
      const chair = createDioramaSkiLift(this.pools);
      this.scene.add(chair);
      this.liftChairs.push({ mesh: chair, t: i / 4 });
    }
  }

  private initSnowfall(): void {
    const count = 820;
    this.snowfallPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.snowfallPositions[i * 3] = (Math.random() - 0.5) * 76;
      this.snowfallPositions[i * 3 + 1] = Math.random() * 26;
      this.snowfallPositions[i * 3 + 2] = (Math.random() - 0.5) * 66;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.snowfallPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: this.pools.tex.snowFlake,
      size: 0.4,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.snowfallPoints = new THREE.Points(geo, mat);
    this.scene.add(this.snowfallPoints);
  }

  private clearAllHeldInputs(): void {
    this.keys.clear();
    this.mouseDown = false;
    this.touchJumpHeld = false;
    this.touchBoostHeld = false;
    this.activeSteerTouchId = null;
  }

  private bindInputs(): void {
    window.addEventListener('resize', this.onResize);

    // Auto-pause on tab blur / phone lock / app switch & clear held keys!
    window.addEventListener('blur', () => {
      this.clearAllHeldInputs();
      this.persistBestDistance();
      if (this.mode === 'playing') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearAllHeldInputs();
        this.persistBestDistance();
        if (this.mode === 'playing') this.pauseGame();
      }
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);

      if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') {
        this.pointerSteerActive = false;
      }

      // Ignore key-repeat so holding Space never eats landings or re-triggers toggles!
      if (e.repeat) return;

      if (code === 'KeyM') {
        const muted = this.sound.toggleMusic();
        const btn = document.getElementById('btn-music');
        if (btn) btn.classList.toggle('muted', muted);
        return;
      }
      if (code === 'KeyN') {
        const muted = this.sound.toggleSfx();
        const btn = document.getElementById('btn-sfx');
        if (btn) {
          btn.textContent = muted ? '🔇' : '🔊';
          btn.classList.toggle('muted', muted);
        }
        return;
      }

      if (this.mode === 'upgrading') {
        if (code === 'Digit1' && this.activeDraftChoices[0]) this.selectUpgrade(this.activeDraftChoices[0].id);
        if (code === 'Digit2' && this.activeDraftChoices[1]) this.selectUpgrade(this.activeDraftChoices[1].id);
        if (code === 'Digit3' && this.activeDraftChoices[2]) this.selectUpgrade(this.activeDraftChoices[2].id);
        return;
      }

      if (code === 'KeyP' || code === 'Escape') {
        if (this.mode === 'playing') this.pauseGame();
        else if (this.mode === 'paused') this.resumeGame();
        return;
      }

      // Restrict R restart strictly to paused or gameover (never accidental mid-run!)
      if (code === 'KeyR' && (this.mode === 'paused' || this.mode === 'gameover')) {
        this.startNewRun();
        return;
      }

      if (code === 'Space') {
        e.preventDefault();
        if (this.mode === 'gameover') {
          this.startNewRun();
        } else if (this.mode === 'playing') {
          this.tryJump();
        }
      }

      if (code === 'KeyE' && this.mode === 'playing') {
        this.tryDeployDecoy(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Seamless Mouse (Desktop) + Multi-Touch Thumb Steering (iPhone/iPad)!
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'playing') return;
      this.sound.unlock();
      if (e.pointerType === 'touch') {
        e.preventDefault();
        if (this.activeSteerTouchId === null) {
          this.activeSteerTouchId = e.pointerId;
          this.pointerSteerActive = true;
          this.pointerNormX = (e.clientX / window.innerWidth) * 2 - 1;
        }
      } else if (e.button === 0) {
        this.mouseDown = true;
        this.pointerSteerActive = true;
        this.pointerNormX = (e.clientX / window.innerWidth) * 2 - 1;
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'playing') return;
      if (e.pointerType === 'touch') {
        if (e.pointerId === this.activeSteerTouchId) {
          e.preventDefault();
          this.pointerSteerActive = true;
          this.pointerNormX = (e.clientX / window.innerWidth) * 2 - 1;
        }
      } else {
        this.pointerSteerActive = true;
        this.pointerNormX = (e.clientX / window.innerWidth) * 2 - 1;
      }
    });

    const endPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (e.pointerId === this.activeSteerTouchId) {
          this.activeSteerTouchId = null;
        }
      } else {
        this.mouseDown = false;
      }
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h); // Automatically resizes BloomPass & OutputPass cleanly
    this.dioramaPass.uniforms.uResolution.value.set(w, h);
    this.updateCameraForAspect();
  };

  public startNewRun(): void {
    this.persistBestDistance();
    this.clearAllHeldInputs();
    this.sound.unlock();
    this.sound.setMusicDucked(false);
    this.clearDynamicEntities();
    this.snowTrail.reset();

    this.playerX = 0;
    this.playerZ = -3.8;
    this.playerVx = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.speed = 14.5;
    this.distance = 0;
    this.score = 0;
    this.runStartBest = this.bestDistance;
    this.bestFlagSpawned = false;
    this.flow = 100;
    this.flowSurgeTimer = 0;
    this.comboMult = 1.0;
    this.comboTimer = 0;
    this.tricksAndOutplays = 0;
    this.launchedFromMogul = false;
    this.airSpinDegrees = 0;
    this.spunInAir = false;
    this.crashStunTimer = 0;
    this.invulnTimer = 0;
    this.screenShake = 0;
    this.squashPos = 0;
    this.squashVel = 0;
    this.smoothLean = 0;
    this.smoothCrouch = 0;
    this.facingDir = 1;
    this.skier.setPose('straight');

    this.yetiLeadPenalty = 0;
    this.yetiTriggered = false;
    this.yetiActive = false;
    this.yetiX = 0;
    this.yetiZ = -26;
    this.yetiStunTimer = 0;
    this.yetiTargetDecoy = null;
    this.yetiVictoryDance = false;
    this.yeti.root.visible = false;

    this.nextLodgeDist = 650;
    this.spawnAccum = 0;
    this.decorAccum = 0;
    this.upgrades = createInitialUpgrades();

    this.skier.root.visible = true;
    this.skier.shieldRing.visible = false;
    this.skier.gliderWings.visible = false;
    this.skier.pyroGlow.visible = false;
    this.dioramaPass.uniforms.uDanger.value = 0;
    this.dioramaPass.uniforms.uBoost.value = 0;

    this.populateInitialScenicSlope();
    this.setMode('playing');
    this.sound.startMusic(false);
    this.emitHud(false);
  }

  public pauseGame(): void {
    if (this.mode !== 'playing') return;
    this.persistBestDistance();
    this.clearAllHeldInputs();
    this.sound.stopCarve();
    this.sound.pauseMusic();
    this.setMode('paused');
  }

  public resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.lastTime = performance.now();
    this.sound.resumeMusic();
    this.setMode('playing');
  }

  public selectUpgrade(id: UpgradeId): void {
    if (this.mode !== 'upgrading') return;
    applyUpgrade(this.upgrades, id);
    const def = UPGRADE_CATALOG.find((u) => u.id === id);
    this.sound.playUpgradePick();
    this.sound.setMusicDucked(false);

    this.skier.shieldRing.visible = this.upgrades.shields > 0;
    this.skier.pyroGlow.visible = this.upgrades.levels.pyro_carver > 0;
    this.flow = Math.min(100, this.flow + 40);
    this.invulnTimer = Math.max(this.invulnTimer, 1.5);

    if (def) {
      this.callbacks.onToast(`${def.icon} ${def.name} equipped!`, 'good');
    }

    this.activeDraftChoices = [];
    this.lastTime = performance.now();
    this.setMode('playing');
    this.emitHud(false);
  }

  private clearDynamicEntities(): void {
    for (const e of this.entities) this.scene.remove(e.mesh);
    this.entities = [];
    for (const sb of this.snowballs) {
      this.scene.remove(sb.mesh);
      this.scene.remove(sb.shadow);
      this.scene.remove(sb.marker);
    }
    this.snowballs = [];
    for (const p of this.burstParticles) this.scene.remove(p.mesh);
    this.burstParticles = [];
  }

  private populateInitialScenicSlope(): void {
    for (let z = -54; z <= 30; z += 7.0) {
      this.spawnSideDecorAt(z);
    }
    this.spawnGate(0, 12);
    this.spawnPine(10.5, 11);
    this.spawnPine(-10.5, 15);
    this.spawnDog(-9.5, 19);
    this.spawnGate(-3.5, 24);
    this.spawnMogul(4.5, 28);
  }

  private spawnSideDecorAt(z: number): void {
    for (const side of [-1, 1]) {
      const xBase = side * (this.PLAY_HALF_WIDTH + 2.8 + Math.random() * 5.2);
      if (Math.random() < 0.34) {
        const chalet = createDioramaChalet(this.pools, 0.92 + Math.random() * 0.25, side === 1);
        chalet.position.set(xBase + side * 2.2, 0.3, z);
        this.scene.add(chalet);
        this.entities.push({
          id: this.nextEntityId++,
          kind: 'chalet',
          mesh: chalet,
          x: chalet.position.x,
          z,
          radius: 3.4,
          sideDecor: true,
        });
      } else {
        const pine = createDioramaPine(this.pools, 0.9 + Math.random() * 0.45);
        pine.root.position.set(xBase, 0.2, z);
        this.scene.add(pine.root);
        this.entities.push({
          id: this.nextEntityId++,
          kind: 'tree',
          mesh: pine.root,
          x: xBase,
          z,
          radius: 1.0,
          pineObj: pine,
          sideDecor: true,
        });
      }

      const farX = side * (this.PLAY_HALF_WIDTH + 9.5 + Math.random() * 7.5);
      const farPine = createDioramaPine(this.pools, 1.05 + Math.random() * 0.55);
      farPine.root.position.set(farX, 0.8, z + (Math.random() - 0.5) * 3.5);
      this.scene.add(farPine.root);
      this.entities.push({
        id: this.nextEntityId++,
        kind: 'tree',
        mesh: farPine.root,
        x: farX,
        z: farPine.root.position.z,
        radius: 1.1,
        pineObj: farPine,
        sideDecor: true,
      });
    }
  }

  private spawnPine(x: number, z: number): void {
    const scale = 0.85 + Math.random() * 0.38;
    const pine = createDioramaPine(this.pools, scale);
    pine.root.position.set(x, 0, z);
    this.scene.add(pine.root);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'tree',
      mesh: pine.root,
      x,
      z,
      radius: 0.92 * scale,
      closestDist: 99,
      pineObj: pine,
    });
  }

  private spawnRock(x: number, z: number): void {
    const mesh = createSnowRock(this.pools);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'rock',
      mesh,
      x,
      z,
      radius: 0.85,
      closestDist: 99,
    });
  }

  private spawnMogul(x: number, z: number): void {
    const mesh = createMogulRamp(this.pools);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({ id: this.nextEntityId++, kind: 'mogul', mesh, x, z, radius: 2.2 });
  }

  private spawnGate(x: number, z: number): void {
    const gateWidth = 6.6;
    const mesh = createCandyCaneGate(this.pools, gateWidth);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'gate',
      mesh,
      x,
      z,
      radius: 0.5,
      gateWidth,
    });
  }

  private spawnDog(x: number, z: number): void {
    const { root, card } = createDioramaDog(this.pools);
    const dir = x < 0 ? 1 : -1;
    if (dir < 0) card.scale.x *= -1;
    root.position.set(x, 0, z);
    this.scene.add(root);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'dog',
      mesh: root,
      card,
      x,
      z,
      radius: 0.72,
      vx: dir * (2.6 + Math.random() * 1.4),
    });
  }

  private spawnBoarder(x: number, z: number): void {
    const { root, card } = createDioramaBoarder(this.pools);
    const vx = (Math.random() < 0.5 ? -1 : 1) * (4.2 + Math.random() * 2.2);
    if (vx < 0) card.scale.x *= -1;
    root.position.set(x, 0, z);
    this.scene.add(root);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'boarder',
      mesh: root,
      card,
      x,
      z,
      radius: 0.8,
      closestDist: 99,
      vx,
      vz: 4.2,
    });
  }

  private spawnCocoa(x: number, z: number): void {
    const mesh = createCocoaPickup(this.pools);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'cocoa',
      mesh,
      x,
      z,
      radius: 1.35,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  private spawnLodgeArch(z: number): void {
    const mesh = createLodgeArch(this.pools, 18);
    mesh.position.set(0, 0, z);
    this.scene.add(mesh);
    this.entities.push({ id: this.nextEntityId++, kind: 'lodge', mesh, x: 0, z, radius: 1.0 });
  }

  private spawnBestFlag(z: number): void {
    const mesh = createBestFlag(this.pools);
    mesh.position.set(0, 0, z);
    this.scene.add(mesh);
    this.entities.push({ id: this.nextEntityId++, kind: 'best_flag', mesh, x: 0, z, radius: 1.0 });
  }

  private bumpCombo(amount = 0.5): void {
    this.comboMult = Math.min(5.0, Math.round((this.comboMult + amount) * 10) / 10);
    this.comboTimer = 5.5;
  }

  private tryJump(): void {
    // Strictly grounded check (no double-jump or repeat-jump eating landings!)
    if (this.crashStunTimer > 0 || this.playerY > 0.02 || this.playerVy > 0) return;
    this.playerVy = 11.2 + this.upgrades.levels.aurora_glider * 1.0;
    this.launchedFromMogul = false;
    this.airSpinDegrees = 0;
    this.spunInAir = false;
    this.squashPos = 0.22;
    this.squashVel = 4.0;
    this.sound.playJump();
    this.spawnBurst(this.playerX, 0.25, this.playerZ, 8, 0xe8f7ff, 4.5);
  }

  private tryDeployDecoy(autoTriggered: boolean): boolean {
    if (this.upgrades.decoyCharges <= 0 || this.upgrades.decoyCooldown > 0) return false;
    this.upgrades.decoyCharges -= 1;
    this.upgrades.decoyCooldown = 2.0;

    const mesh = createDecoySnowman(this.pools);
    const dx = this.playerX;
    const dz = this.playerZ - 1.9;
    mesh.position.set(dx, 0, dz);
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'decoy',
      mesh,
      x: dx,
      z: dz,
      radius: 1.2,
    });
    this.spawnBurst(dx, 1.2, dz, 14, 0xffffff, 5.8);
    this.sound.playJump();
    this.callbacks.onToast(
      autoTriggered ? '⛄ Auto-Decoy Saved You!' : '⛄ Decoy Snowman Deployed!',
      'good'
    );
    return true;
  }

  private igniteTree(e: SlopeEntity): void {
    if (!e.pineObj || e.pineObj.ignited) return;
    e.pineObj.ignited = true;
    e.pineObj.emberHalo.visible = true;
    e.pineObj.warmGlow.scale.setScalar(2.1);

    this.sound.playFireIgnite();
    this.flow = Math.min(100, this.flow + 18);
    this.bumpCombo(0.3);
    const pts = Math.round(240 * this.comboMult);
    this.score += pts;
    this.spawnBurst(e.x, 2.0, e.z, 16, 0xff8c24, 6.8, true);
    this.spawnBurst(e.x, 2.6, e.z, 8, 0xffe478, 5.2, true);
    this.callbacks.onToast(`🔥 Pyro Skis Ignited Pine! +${pts}`, 'fire');
  }

  private triggerGateLightning(): void {
    const strikes = 1 + this.upgrades.levels.gate_striker;
    let count = 0;
    for (let i = this.entities.length - 1; i >= 0 && count < strikes; i--) {
      const e = this.entities[i];
      if (e.sideDecor) continue;
      if ((e.kind === 'rock' || e.kind === 'tree') && e.z > this.playerZ && e.z < this.playerZ + 18) {
        this.spawnBurst(e.x, 1.8, e.z, 14, 0xffd76e, 8.0, true);
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        this.score += Math.round(180 * this.comboMult);
        count++;
      }
    }
    if (count > 0) {
      this.sound.playOrnamentShatter();
      this.callbacks.onToast(`⚡ Fairy-Light Strike ×${count}!`, 'fire');
    }
  }

  private getBurstMaterial(colorHex: number, isSpark: boolean): THREE.MeshBasicMaterial {
    const key = isSpark ? colorHex + 0x1000000 : colorHex;
    let mat = this.burstMatCache.get(key);
    if (!mat) {
      const c = new THREE.Color(colorHex);
      if (isSpark) c.multiplyScalar(1.55); // HDR glow for fire/magic sparks!
      mat = new THREE.MeshBasicMaterial({ color: c, toneMapped: !isSpark });
      this.burstMatCache.set(key, mat);
    }
    return mat;
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 6.0,
    isSpark = false
  ): void {
    const mat = this.getBurstMaterial(colorHex, isSpark);
    for (let i = 0; i < count; i++) {
      if (this.burstParticles.length > 220) break;
      const mesh = new THREE.Mesh(isSpark ? this.sharedSparkGeo : this.sharedSphereGeo, mat);
      mesh.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 0.85) * speed;
      this.scene.add(mesh);
      this.burstParticles.push({
        mesh,
        vx: Math.cos(a) * sp,
        vy: 1.8 + Math.random() * speed * 0.72,
        vz: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.42 + Math.random() * 0.44,
        gravity: isSpark ? 4.8 : 12.2,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  private loop = (now: number): void => {
    this.animFrameId = window.requestAnimationFrame(this.loop);
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (this.mode === 'title') {
      this.elapsedTime += dt;
      this.updateScenicTitleLoop(dt);
    } else if (this.mode === 'playing') {
      this.elapsedTime += dt;
      this.updatePlaying(dt);
    } else if (this.mode === 'gameover' && this.yetiVictoryDance) {
      this.elapsedTime += dt;
      this.updateYetiVictoryDance(dt);
    } else {
      this.elapsedTime += dt * 0.35;
      this.updateAmbientAtmosphere(dt * 0.35, 0);
    }

    this.composer.render();
  };

  private updateScenicTitleLoop(dt: number): void {
    const demoSpeed = 10.2;
    const dz = demoSpeed * dt;
    this.auroraUniforms.uIntensity.value = 0.86 + Math.sin(this.elapsedTime * 0.35) * 0.12;

    const targetX = Math.sin(this.elapsedTime * 0.72) * 5.2;
    this.playerVx = (targetX - this.playerX) * 3.0;
    this.playerX += this.playerVx * dt;
    this.skier.root.position.set(this.playerX, 0, this.playerZ);

    if (Math.abs(this.playerVx) > 2.2) {
      this.skier.setPose('carve');
      this.facingDir = this.playerVx > 0 ? -1 : 1;
    } else {
      this.skier.setPose('straight');
      this.facingDir = 1;
    }
    this.skier.visual.rotation.z = -this.playerVx * 0.022;
    this.skier.visual.rotation.y = this.playerVx * 0.028;
    this.skier.uniforms.uTime.value = this.elapsedTime;
    this.skier.uniforms.uSpeed.value = 1.1;
    this.skier.uniforms.uSquash.value = 0.0;
    this.skier.uniforms.uCrouch.value = 0.0;
    this.skier.uniforms.uFlipX.value = this.facingDir;

    this.yeti.root.visible = true;
    const yStep = this.elapsedTime * 6.5;
    this.yeti.root.position.set(
      this.playerX * 0.6 + 5.2,
      Math.abs(Math.sin(yStep)) * 0.45,
      -13.5
    );
    this.yeti.uniforms.uTime.value = this.elapsedTime;
    this.yeti.uniforms.uStride.value = yStep;
    this.yeti.uniforms.uLunge.value = 0.2;
    this.yeti.uniforms.uFlipX.value = 1;

    this.snowTrail.advance(dz);
    this.snowTrail.stampSkiTracks(this.playerX, this.playerZ, this.playerVx * 0.05, false, false, false);

    this.decorAccum += dz;
    if (this.decorAccum >= 7.0) {
      this.decorAccum -= 7.0;
      this.spawnSideDecorAt(30);
    }
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.z -= dz;
      e.mesh.position.z = e.z;
      if (e.z < -56) {
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
      }
    }

    this.updateAmbientAtmosphere(dt, dz);
    this.camera.position.set(this.playerX * 0.34, this.baseCamY, this.baseCamZ);
    this.camera.lookAt(this.playerX * 0.24, 3.0, -3.5);
  }

  private updatePlaying(dt: number): void {
    // 1. Controls (Desktop + iPhone Multi-Touch!)
    let steerInput = 0;
    const leftKey = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const rightKey = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const brakeKey = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const tuckKey = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    const jumpHeld = this.keys.has('Space') || this.touchJumpHeld;

    if (leftKey) steerInput -= 1;
    if (rightKey) steerInput += 1;

    if (steerInput === 0 && this.pointerSteerActive) {
      const desiredX = this.pointerNormX * (this.PLAY_HALF_WIDTH * 1.05);
      const diff = desiredX - this.playerX;
      steerInput = Math.max(-1, Math.min(1, diff / 3.6));
    }

    const boostHeld =
      this.keys.has('KeyF') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.mouseDown ||
      this.touchBoostHeld;

    if (this.flowSurgeTimer > 0) this.flowSurgeTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.upgrades.decoyCooldown > 0) this.upgrades.decoyCooldown -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboMult = 1.0;
    }

    // Only reward active carving when NOT pinned against the outer wall!
    const notAgainstWall = Math.abs(this.playerX) < this.PLAY_HALF_WIDTH - 0.5;
    const carvingHard =
      this.playerY <= 0.08 && notAgainstWall && Math.abs(this.playerVx) > 4.8 && Math.abs(steerInput) > 0.52;
    const magnetLvl = this.upgrades.levels.cocoa_magnet;

    // 2. Speed Curve (14.5 -> 23 m/s cruise; Tuck disabled during Yeti chase so you can't cheese him for free!)
    const isBoosting =
      this.crashStunTimer <= 0 && ((boostHeld && this.flow > 1.5) || this.flowSurgeTimer > 0);
    const distAccel = Math.min(8.5, this.distance / 250);
    const baseCruise = 14.5 + distAccel;
    let targetSpeed = baseCruise;
    if (brakeKey) targetSpeed *= 0.68;
    if (tuckKey && !this.yetiActive) targetSpeed *= 1.15;

    if (isBoosting) {
      targetSpeed = baseCruise + 11.2 + magnetLvl * 1.4;
      if (this.flowSurgeTimer <= 0) {
        this.flow = Math.max(0, this.flow - 20.0 * dt);
      }
    } else {
      const carveRefill = carvingHard ? 7.5 + magnetLvl * 2.5 : 0;
      this.flow = Math.min(100, this.flow + (4.5 + carveRefill) * dt);
    }

    if (this.crashStunTimer > 0) {
      this.crashStunTimer -= dt;
      targetSpeed = 5.5;
    }

    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 6.5);
    this.sound.setTempoFromSpeed(this.speed);

    const dz = this.speed * dt;
    this.distance += dz;
    this.score += dz * this.comboMult * (isBoosting ? 1.65 : 1.0);

    // 3. Crisp Carving & Skillful Upright Mogul Trick Physics (No free flat-hop spin farming!)
    const maxLatSpeed = (isBoosting ? 18.5 : 15.5) * (this.crashStunTimer > 0 ? 0.38 : 1.0);
    const targetVx = steerInput * maxLatSpeed;
    this.playerVx += (targetVx - this.playerVx) * Math.min(1, dt * 13.5);
    this.playerX += this.playerVx * dt;
    this.playerX = Math.max(-this.PLAY_HALF_WIDTH, Math.min(this.PLAY_HALF_WIDTH, this.playerX));

    const gliderLvl = this.upgrades.levels.aurora_glider;
    const isGliding = gliderLvl > 0 && this.playerY > 0.8 && this.playerVy < 0 && jumpHeld;
    this.skier.gliderWings.visible = isGliding;

    if (this.playerY > 0 || this.playerVy > 0) {
      this.playerY += this.playerVy * dt;
      const grav = isGliding ? 6.5 - gliderLvl * 1.1 : 22.5;
      this.playerVy -= grav * dt;

      // Tricks ONLY spin while actively holding Space / Jump after launching off a Mogul!
      if (this.launchedFromMogul && jumpHeld) {
        this.spunInAir = true;
        this.airSpinDegrees += dt * (430 + gliderLvl * 75);
        if (Math.random() < 0.38) {
          this.spawnBurst(this.playerX, this.playerY + 0.2, this.playerZ, 1, 0x8ef5ff, 2.2, true);
        }
      } else if (this.spunInAir) {
        // Gentle alignment toward nearest 360° only if within ±65° when you release!
        const rem = this.airSpinDegrees % 360;
        const nearest = rem > 180 ? this.airSpinDegrees + (360 - rem) : this.airSpinDegrees - rem;
        if (Math.abs(nearest - this.airSpinDegrees) < 65) {
          this.airSpinDegrees += (nearest - this.airSpinDegrees) * Math.min(1, dt * 14);
        }
      }

      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVy = 0;
        this.skier.gliderWings.visible = false;
        this.handleTrickLanding(jumpHeld);
      }
    }

    const desiredZ = this.yetiActive ? -2.2 : -3.8;
    this.playerZ += (desiredZ - this.playerZ) * Math.min(1, dt * 2.5);

    // 4. Update Expressive Skier Puppet
    this.skier.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.skier.shadow.position.y = 0.04 - this.playerY;
    this.skier.shadow.scale.setScalar(Math.max(0.4, 1 - this.playerY * 0.09));

    const springForce = -195 * this.squashPos - 14 * this.squashVel;
    this.squashVel += springForce * dt;
    this.squashPos = Math.max(-0.32, Math.min(0.32, this.squashPos + this.squashVel * dt));

    const targetLean = Math.max(-1, Math.min(1, this.playerVx / 13.5));
    this.smoothLean += (targetLean - this.smoothLean) * Math.min(1, dt * 13);
    const targetCrouch = isBoosting ? 1.0 : tuckKey && !this.yetiActive ? 0.55 : 0.0;
    this.smoothCrouch += (targetCrouch - this.smoothCrouch) * Math.min(1, dt * 10);

    const absVx = Math.abs(this.playerVx);
    if (isBoosting && absVx < 9.5 && this.playerY < 0.2) {
      this.skier.setPose('boost');
      this.facingDir = 1;
    } else if (absVx > 8.2) {
      this.skier.setPose('hard_carve');
      this.facingDir = this.playerVx > 0 ? -1 : 1;
    } else if (absVx > 2.4 || this.playerY > 0.25) {
      this.skier.setPose('carve');
      if (absVx > 1.6) this.facingDir = this.playerVx > 0 ? -1 : 1;
    } else {
      this.skier.setPose('straight');
      this.facingDir = 1;
    }

    const speedNorm = Math.min(2.0, this.speed / 16.5);
    const groundBob =
      this.playerY <= 0.05 ? Math.abs(Math.sin(this.elapsedTime * (10 + speedNorm * 3.5))) * 0.09 : 0;
    this.skier.visual.position.y = groundBob;
    this.skier.visual.rotation.y = this.smoothLean * 0.32 + (this.airSpinDegrees * Math.PI) / 180;
    this.skier.visual.rotation.x = this.playerY > 0.15 ? -0.14 : 0;
    this.skier.visual.rotation.z = -this.smoothLean * 0.22;
    if (this.crashStunTimer > 0) {
      this.skier.visual.rotation.z += Math.sin(this.elapsedTime * 34) * 0.42;
    }

    const u = this.skier.uniforms;
    u.uTime.value = this.elapsedTime;
    u.uSpeed.value = speedNorm;
    u.uSquash.value = this.squashPos;
    u.uCrouch.value = this.smoothCrouch;
    u.uFlipX.value = this.facingDir;

    if (this.skier.shieldRing.visible) {
      this.skier.shieldRing.rotation.y += dt * 3.4;
    }

    this.sound.updateCarve(
      Math.min(1, (this.speed - 10) / 22),
      Math.abs(this.playerVx) / 16,
      this.playerY > 0.1
    );

    // 5. Subtle Snow-Pressed Ski Tracks & Carving Powder Spray
    this.snowTrail.advance(dz);
    if (this.playerY <= 0.08) {
      const pyroOn = this.upgrades.levels.pyro_carver > 0 && (carvingHard || isBoosting);
      this.snowTrail.stampSkiTracks(
        this.playerX,
        this.playerZ,
        Math.atan2(this.playerVx, Math.max(8, this.speed)),
        pyroOn,
        isBoosting,
        carvingHard
      );
      this.trailStampAccum += dt;
      const sprayInterval = carvingHard || isBoosting ? 0.028 : 0.065;
      if (this.trailStampAccum > sprayInterval && (absVx > 2.8 || isBoosting)) {
        this.trailStampAccum = 0;
        const sprayDir = -Math.sign(this.playerVx || 1);
        this.spawnBurst(
          this.playerX + sprayDir * 0.65,
          0.25,
          this.playerZ - 0.55,
          carvingHard ? 4 : 2,
          pyroOn ? 0xffa63d : isBoosting ? 0x9ef5ff : 0xf2f9ff,
          carvingHard ? 5.2 : 3.6
        );
      }
    }

    // 6. Aurora Intensity & Yeti Lead Stakes Trigger!
    this.auroraUniforms.uIntensity.value = Math.min(1.0, 0.72 + (this.distance / 2200) * 0.28);
    this.checkYetiTrigger();

    // 7. Spawners, Entities, Yeti & Particles
    this.updateSpawners(dz);
    this.updateEntities(dt, dz);
    if (this.yetiActive) {
      this.updateYeti(dt, dz);
      this.updateSnowballs(dt);
    }
    this.updateAmbientAtmosphere(dt, dz);
    this.updateBurstParticles(dt, dz);

    // 8. Responsive Camera Follow & FOV Acceleration Punch
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    const sx = (Math.random() - 0.5) * this.screenShake * 1.1;
    const sy = (Math.random() - 0.5) * this.screenShake * 0.8;
    const boostZoom = isBoosting ? 1.5 : 0;

    const targetFov =
      this.baseFov + Math.min(5.0, Math.max(0, (this.speed - 14.5) * 0.25)) + (isBoosting ? 2.0 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4.5);
    this.camera.updateProjectionMatrix();

    this.camera.position.x += (this.playerX * 0.4 + sx - this.camera.position.x) * Math.min(1, dt * 5.5);
    this.camera.position.y += (this.baseCamY - boostZoom * 0.3 + sy - this.camera.position.y) * Math.min(1, dt * 4.5);
    this.camera.position.z += (this.baseCamZ + boostZoom - this.camera.position.z) * Math.min(1, dt * 4.5);
    this.camera.lookAt(this.playerX * 0.3, 3.0, -3.5);

    this.bokehRig.group.position.x = -this.playerVx * 0.032;
    this.bokehRig.group.position.y = Math.sin(this.elapsedTime * 1.4) * 0.1;

    const yetiGap = this.yetiActive ? Math.abs(this.playerZ - this.yetiZ) : 99;
    const danger = this.yetiActive ? Math.max(0, Math.min(1, 1 - (yetiGap - 3) / 13)) : 0;
    this.dioramaPass.uniforms.uTime.value = this.elapsedTime;
    this.dioramaPass.uniforms.uBoost.value += ((isBoosting ? 1 : 0) - this.dioramaPass.uniforms.uBoost.value) * dt * 6;
    this.dioramaPass.uniforms.uDanger.value += (danger - this.dioramaPass.uniforms.uDanger.value) * dt * 5;

    this.emitHud(isBoosting);
  }

  private getYetiLeadMeters(): number {
    if (this.yetiActive) return 0;
    return Math.max(0, 2000 - this.distance - this.yetiLeadPenalty);
  }

  private handleTrickLanding(jumpStillHeld: boolean): void {
    this.squashPos = -0.22;
    this.squashVel = -1.7;

    const wasMogul = this.launchedFromMogul;
    const deg = this.airSpinDegrees;
    const didSpin = this.spunInAir;
    this.launchedFromMogul = false;
    this.airSpinDegrees = 0;
    this.spunInAir = false;

    // Flat hops don't farm trick combos; only genuine Mogul spins pay out!
    if (!wasMogul || !didSpin) return;

    const rem = deg % 360;
    const offAxis = Math.min(rem, 360 - rem);
    const fullSpins = Math.round(deg / 360);

    // Must complete at least ~1 full spin AND land reasonably lined up (real skill!)
    if (fullSpins <= 0 || offAxis > 72) {
      if (deg > 90) {
        this.callbacks.onToast('❄️ Sketchy Landing!', 'default');
      }
      return;
    }

    const perfect = !jumpStillHeld && offAxis < 38;
    const pts = Math.round(fullSpins * 240 * this.comboMult * (perfect ? 1.5 : 1.0));
    this.score += pts;
    this.flow = Math.min(100, this.flow + 20 + fullSpins * 10);
    this.tricksAndOutplays += 1;
    this.bumpCombo(perfect ? 0.6 : 0.3);

    // Earn back a little Yeti Lead penalty on clean mogul tricks!
    if (!this.yetiActive && this.yetiLeadPenalty > 0) {
      this.yetiLeadPenalty = Math.max(0, this.yetiLeadPenalty - 45);
    }

    if (perfect) {
      this.flowSurgeTimer = Math.max(this.flowSurgeTimer, 0.75);
      this.sound.playPerfectStomp();
      this.screenShake = Math.max(this.screenShake, 0.3);
      this.spawnBurst(this.playerX, 0.4, this.playerZ, 18, 0x62f5ff, 8.0, true);
      this.callbacks.onToast(`✨ Perfect ${fullSpins * 360}° Stomp! +${pts}`, 'good');

      if (this.upgrades.levels.avalanche_stomp > 0) {
        this.triggerAvalancheShockwave();
      }
    } else {
      this.sound.playJump();
      this.callbacks.onToast(`❄️ ${fullSpins * 360}° Landed! +${pts}`, 'default');
    }
  }

  private triggerAvalancheShockwave(): void {
    const rad = 6.8 + this.upgrades.levels.avalanche_stomp * 2.0;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.sideDecor) continue;
      if (e.kind === 'rock' || e.kind === 'tree') {
        if (Math.hypot(e.x - this.playerX, e.z - this.playerZ) < rad) {
          this.spawnBurst(e.x, 1.8, e.z, 12, 0x99f3ff, 8.0, true);
          this.scene.remove(e.mesh);
          this.entities.splice(i, 1);
          this.score += Math.round(140 * this.comboMult);
        }
      }
    }
    if (this.yetiActive && Math.hypot(this.yetiX - this.playerX, this.yetiZ - this.playerZ) < rad + 4) {
      this.yetiStunTimer = 2.6;
      this.yetiTargetDecoy = null; // Clear decoy lock on stun!
      this.yetiZ -= 6.5;
      this.tricksAndOutplays += 1;
      this.callbacks.onToast('❄️ Avalanche Stomp Knocked Back the Yeti!', 'good');
    }
  }

  private checkYetiTrigger(): void {
    if (!this.yetiTriggered && this.getYetiLeadMeters() <= 0) {
      this.yetiTriggered = true;
      this.yetiActive = true;
      this.yetiX = this.playerX + (this.playerX > 0 ? -4.2 : 4.2);
      this.yetiZ = this.playerZ - 16.0;
      this.yetiStunTimer = 0;
      this.yetiTargetDecoy = null;
      this.yeti.root.position.set(this.yetiX, 0, this.yetiZ);
      this.yeti.root.visible = true;
      this.screenShake = 0.85;
      this.flow = Math.min(100, this.flow + 45);
      this.sound.playYetiRoar();
      this.sound.setChaseMode(true);
      const earlyCatch = this.distance < 1950;
      this.callbacks.onMilestone(
        earlyCatch ? `LEAD LOST AT ${Math.floor(this.distance)}m` : '2,000 METERS',
        'THE CHOMP LINE',
        'Boost with F / Click / 🔥 to Outrun the Yeti!'
      );
    }
  }

  private updateSpawners(dz: number): void {
    this.decorAccum += dz;
    if (this.decorAccum >= 6.8) {
      this.decorAccum -= 6.8;
      this.spawnSideDecorAt(30);
    }

    if (!this.bestFlagSpawned && this.runStartBest >= 150 && this.distance >= this.runStartBest - 30) {
      this.bestFlagSpawned = true;
      this.spawnBestFlag(30);
    }

    if (this.distance >= this.nextLodgeDist - 30) {
      this.spawnLodgeArch(30);
      this.nextLodgeDist += this.nextLodgeDist < 1950 ? 650 : 850;
    }

    const densityMeters = Math.max(5.4, 8.8 - this.distance / 900);
    this.spawnAccum += dz;
    if (this.spawnAccum >= densityMeters) {
      this.spawnAccum -= densityMeters;
      const z = 28 + Math.random() * 5;
      const roll = Math.random();

      if (roll < 0.44) {
        const x1 = (Math.random() - 0.5) * (this.PLAY_HALF_WIDTH * 1.8);
        this.spawnPine(x1, z);
        if (Math.random() < 0.4) {
          const x2 = x1 + (Math.random() < 0.5 ? -6.2 : 6.2);
          if (Math.abs(x2) < this.PLAY_HALF_WIDTH) this.spawnPine(x2, z + 2.4);
        }
      } else if (roll < 0.67) {
        this.spawnGate((Math.random() - 0.5) * (this.PLAY_HALF_WIDTH * 1.2), z);
      } else if (roll < 0.79) {
        this.spawnMogul((Math.random() - 0.5) * (this.PLAY_HALF_WIDTH * 1.4), z);
      } else if (roll < 0.86) {
        this.spawnRock((Math.random() - 0.5) * (this.PLAY_HALF_WIDTH * 1.65), z);
      } else if (roll < 0.92) {
        const dx = Math.random() < 0.5 ? -this.PLAY_HALF_WIDTH + 1 : this.PLAY_HALF_WIDTH - 1;
        this.spawnDog(dx, z);
      } else if (roll < 0.96) {
        this.spawnBoarder((Math.random() - 0.5) * (this.PLAY_HALF_WIDTH * 1.4), z);
      } else {
        this.spawnCocoa((Math.random() - 0.5) * (this.PLAY_HALF_WIDTH * 1.4), z);
      }
    }
  }

  private updateEntities(dt: number, dz: number): void {
    const magnetLvl = this.upgrades.levels.cocoa_magnet;
    const pyroLvl = this.upgrades.levels.pyro_carver;
    const steppedTime = Math.floor(this.elapsedTime * 14) / 14;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.z -= dz;

      if (e.kind === 'dog' && e.vx) {
        e.x += e.vx * dt;
        e.mesh.position.y = Math.abs(Math.sin(steppedTime * 14)) * 0.25;
      } else if (e.kind === 'boarder' && e.vx) {
        e.x += e.vx * dt;
        if (e.vz) e.z += e.vz * dt;
        if (Math.abs(e.x) > this.PLAY_HALF_WIDTH - 1.2) {
          e.vx *= -1;
          if (e.card) e.card.scale.x *= -1;
        }
        e.mesh.position.y = Math.abs(Math.sin(steppedTime * 7)) * 0.35;
        this.snowTrail.stampBoardTrack(e.x, e.z);
      } else if (e.kind === 'cocoa') {
        e.mesh.rotation.y += dt * 2.2;
        e.mesh.position.y = Math.sin(this.elapsedTime * 4 + (e.bobPhase || 0)) * 0.24;
        const pullRad = 4.8 + magnetLvl * 4.2;
        const dx = this.playerX - e.x;
        const ddz = this.playerZ - e.z;
        const d = Math.hypot(dx, ddz);
        if (d < pullRad && d > 0.1) {
          e.x += (dx / d) * (13 + magnetLvl * 5) * dt;
          e.z += (ddz / d) * (13 + magnetLvl * 5) * dt;
        }
      } else if (e.kind === 'tree' && e.pineObj?.ignited) {
        const flick = 0.88 + Math.sin(this.elapsedTime * 22 + e.id) * 0.16;
        e.pineObj.emberHalo.scale.set(
          4.6 * flick,
          5.2 * (0.92 + Math.cos(this.elapsedTime * 19 + e.id) * 0.15),
          1
        );
        if (Math.random() < 0.45) {
          const col = Math.random() > 0.35 ? 0xff8c24 : 0xffe478;
          this.spawnBurst(e.x + (Math.random() - 0.5) * 1.2, 1.8 + Math.random() * 1.8, e.z, 1, col, 3.2, true);
        }
      }

      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;

      if (e.z < -58) {
        // Clear decoy lock if Yeti's decoy target scrolls off-screen!
        if (this.yetiTargetDecoy === e) this.yetiTargetDecoy = null;
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        continue;
      }

      if (e.sideDecor) continue;

      const dx = this.playerX - e.x;
      const ddz = this.playerZ - e.z;
      const dist = Math.hypot(dx, ddz);

      if (e.kind === 'best_flag' && !e.triggered && e.z <= this.playerZ) {
        e.triggered = true;
        this.sound.playUpgradePick();
        this.spawnBurst(this.playerX, 1.6, this.playerZ, 22, 0xffd766, 8.2, true);
        this.callbacks.onToast('🏆 NEW PERSONAL BEST!', 'fire');
        continue;
      }

      if (e.kind === 'lodge' && !e.triggered && e.z <= this.playerZ) {
        e.triggered = true;
        this.openUpgradeDraft();
        continue;
      }

      if (e.kind === 'gate' && !e.triggered && e.z <= this.playerZ + 0.6 && e.z >= this.playerZ - 1.5) {
        const halfW = (e.gateWidth || 6.6) * 0.5 + magnetLvl * 0.7;
        if (Math.abs(dx) <= halfW) {
          e.triggered = true;
          this.bumpCombo(0.4);
          this.tricksAndOutplays += 1;
          const pts = Math.round(160 * this.comboMult);
          this.score += pts;
          this.flow = Math.min(100, this.flow + 22);
          if (!this.yetiActive && this.yetiLeadPenalty > 0) {
            this.yetiLeadPenalty = Math.max(0, this.yetiLeadPenalty - 25);
          }
          this.sound.playGateChime(Math.floor(this.comboMult * 2));
          this.spawnBurst(this.playerX, 1.3, this.playerZ, 12, 0xffd770, 6.2, true);
          this.callbacks.onToast(`🍬 Candy Slalom! +${pts}`, 'good');
          if (this.upgrades.levels.gate_striker > 0) this.triggerGateLightning();
        }
        continue;
      }

      if (e.kind === 'cocoa' && !e.triggered && dist < 1.95) {
        e.triggered = true;
        this.flow = Math.min(100, this.flow + 38);
        this.score += Math.round(180 * this.comboMult);
        this.sound.playGateChime(4);
        this.spawnBurst(e.x, 1.0, e.z, 12, 0xffd770, 5.8, true);
        this.callbacks.onToast('☕ Hot Cocoa Refill!', 'fire');
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        continue;
      }

      if (e.kind === 'mogul' && !e.triggered && dist < 2.35 && this.playerY < 0.8) {
        e.triggered = true;
        this.playerVy = 14.4 + this.upgrades.levels.aurora_glider * 1.4;
        this.launchedFromMogul = true;
        this.airSpinDegrees = 0;
        this.spunInAir = false;
        this.squashPos = 0.28;
        this.squashVel = 5.0;
        this.sound.playJump();
        this.spawnBurst(e.x, 0.7, e.z, 14, 0x8ef5ff, 6.6, true);
        continue;
      }

      if (e.kind === 'dog' && !e.triggered && dist < 2.3) {
        if (this.playerY > 0.75) {
          e.triggered = true;
          const pts = Math.round(250 * this.comboMult);
          this.score += pts;
          this.flow = Math.min(100, this.flow + 22);
          this.bumpCombo(0.5);
          this.tricksAndOutplays += 1;
          this.sound.playBark();
          this.callbacks.onToast(`🐶 Good Boy Leap! +${pts}`, 'good');
          continue;
        } else if (dist > 1.3 && !e.nearMissed) {
          e.nearMissed = true;
          this.sound.playBark();
        }
      }

      // Track closest distance on approach; ONLY award Close Call AFTER passing cleanly!
      if (e.kind === 'tree' || e.kind === 'boarder' || e.kind === 'rock') {
        if (this.playerY < 1.2 && dist < (e.closestDist ?? 99)) {
          e.closestDist = dist;
        }
        // Solid collision check FIRST
        if (dist < e.radius + 0.48 && this.playerY < 1.35 && this.invulnTimer <= 0) {
          e.collided = true;
          this.handlePlayerCrash(e);
          continue;
        }
        // Award Close Call / Pyro Ignition strictly AFTER passing cleanly behind player!
        if (
          !e.nearMissed &&
          !e.collided &&
          e.z < this.playerZ - 1.25 &&
          (e.closestDist ?? 99) < e.radius + 2.35
        ) {
          e.nearMissed = true;
          if (e.kind === 'tree' && pyroLvl > 0 && !e.pineObj?.ignited) {
            this.igniteTree(e);
          } else {
            this.flow = Math.min(100, this.flow + 12);
            this.bumpCombo(0.2);
            this.score += Math.round(110 * this.comboMult);
            this.sound.playOrnamentShatter();
            this.callbacks.onToast('✨ Close Call! +Flow', 'default');
          }
        }
      } else if (
        e.kind === 'dog' &&
        dist < e.radius + 0.45 &&
        this.playerY < 1.2 &&
        this.invulnTimer <= 0
      ) {
        this.handlePlayerCrash(e);
      }
    }
  }

  private handlePlayerCrash(obstacle: SlopeEntity): void {
    if (this.upgrades.shields > 0) {
      this.upgrades.shields -= 1;
      this.skier.shieldRing.visible = this.upgrades.shields > 0;
      this.invulnTimer = 1.3;
      this.screenShake = 0.55;
      this.sound.playOrnamentShatter();
      this.spawnBurst(this.playerX, 1.2, this.playerZ, 22, 0xffd770, 8.0, true);
      this.callbacks.onToast('🎄 Bauble Ward Saved Combo!', 'good');
      if (obstacle.kind === 'tree' && this.upgrades.levels.pyro_carver > 0) this.igniteTree(obstacle);
      return;
    }

    this.crashStunTimer = 0.62;
    this.invulnTimer = 1.2;
    this.comboMult = 1.0;
    this.speed = Math.max(5.5, this.speed * 0.42);
    this.screenShake = 0.8;
    this.sound.playCrash();
    this.spawnBurst(this.playerX, 0.9, this.playerZ, 16, 0xffffff, 7.5);
    if (obstacle.kind === 'tree') this.sound.playOrnamentShatter();
    if (obstacle.kind === 'dog') this.sound.playBark();

    // Real stakes before 2,000m: every wipeout lets the Yeti gain 260m!
    if (!this.yetiActive) {
      this.yetiLeadPenalty += 260;
      this.sound.playYetiRoar();
      this.callbacks.onToast('💥 Wipeout! Yeti Gained 260m!', 'danger');
    } else {
      this.callbacks.onToast('💥 Wipeout!', 'danger');
    }
  }

  private openUpgradeDraft(): void {
    this.sound.stopCarve();
    this.sound.setMusicDucked(true);
    this.clearAllHeldInputs();
    this.activeDraftChoices = draftThreeUpgrades(this.upgrades);
    this.setMode('upgrading');
    this.callbacks.onShowUpgradeDraft(Math.floor(this.distance), this.activeDraftChoices);
  }

  private updateYeti(dt: number, dz: number): void {
    if (this.yetiStunTimer > 0) {
      this.yetiStunTimer -= dt;
      this.yetiTargetDecoy = null;
      this.yetiZ = Math.max(-23.5, this.yetiZ - dz * 0.72);
      this.yeti.root.position.set(this.yetiX, 0, this.yetiZ);
      return;
    }

    // Validate decoy target is still active in entities
    if (this.yetiTargetDecoy && !this.entities.includes(this.yetiTargetDecoy)) {
      this.yetiTargetDecoy = null;
    }
    if (!this.yetiTargetDecoy) {
      for (const e of this.entities) {
        if (e.kind === 'decoy' && !e.triggered && Math.abs(e.z - this.yetiZ) < 17) {
          this.yetiTargetDecoy = e;
          break;
        }
      }
    }

    const targetX = this.yetiTargetDecoy ? this.yetiTargetDecoy.x : this.playerX;
    // Yeti is faster than both cruise & tuck (28.6 -> 34 m/s); ONLY Boost (34–38 m/s) pulls away!
    const baseYetiSpeed = 28.6 + Math.min(5.4, Math.max(0, this.distance - 2000) / 650);
    const relativeDz = (baseYetiSpeed - this.speed) * dt;

    // HARD CLAMP: Yeti can NEVER overshoot past the player off the bottom of the screen!
    this.yetiZ = Math.max(-22.5, Math.min(this.playerZ + 0.35, this.yetiZ + relativeDz));

    // Raise lateral pursuit speed above player's max when close so one sidestep NEVER breaks him!
    const zGap = Math.max(0, this.playerZ - this.yetiZ);
    const maxYetiLat = zGap < 6.5 ? 20.8 : 14.5;
    const dx = targetX - this.yetiX;
    this.yetiX += Math.max(-maxYetiLat, Math.min(maxYetiLat, dx * 4.2)) * dt;
    this.yetiX = Math.max(-this.PLAY_HALF_WIDTH, Math.min(this.PLAY_HALF_WIDTH, this.yetiX));

    this.yetiStompPhase += dt * 9.8;
    const bounce = Math.abs(Math.sin(this.yetiStompPhase));
    this.yeti.root.position.set(this.yetiX, bounce * 0.52, this.yetiZ);
    this.yeti.uniforms.uTime.value = this.elapsedTime;
    this.yeti.uniforms.uStride.value = this.yetiStompPhase;
    this.yeti.uniforms.uLunge.value = Math.max(0, Math.min(1, 1 - (zGap - 2) / 10));
    this.yeti.uniforms.uFlipX.value = dx < -1.5 ? -1 : 1;

    const stepIndex = Math.floor(this.yetiStompPhase / Math.PI);
    if (stepIndex !== this.yetiLastStompStep) {
      this.yetiLastStompStep = stepIndex;
      this.snowTrail.stampYetiFootprint(this.yetiX, this.yetiZ, stepIndex % 2 === 0);
      const proximity = Math.max(0, 1 - zGap / 22);
      if (proximity > 0.15) {
        this.sound.playYetiStomp(proximity);
        this.screenShake = Math.max(this.screenShake, proximity * 0.22);
      }
    }

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.sideDecor) continue;
      const d = Math.hypot(e.x - this.yetiX, e.z - this.yetiZ);

      if (e.kind === 'decoy' && d < 2.4) {
        e.triggered = true;
        this.yetiTargetDecoy = null;
        this.yetiStunTimer = 3.5;
        this.spawnBurst(e.x, 1.5, e.z, 20, 0xffffff, 7.8);
        this.sound.playChomp();
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        this.callbacks.onToast('⛄ Yeti Chomped the Decoy! Run!', 'good');
        return;
      }

      if (e.kind === 'tree' && d < 2.3) {
        if (e.pineObj?.ignited) {
          this.spawnBurst(e.x, 2.4, e.z, 22, 0xff8c2b, 8.8, true);
          this.sound.playFireIgnite();
          this.scene.remove(e.mesh);
          this.entities.splice(i, 1);
          this.yetiTargetDecoy = null;
          this.yetiStunTimer = 2.4;
          this.yetiZ -= 5.0;
          this.score += Math.round(450 * this.comboMult);
          this.tricksAndOutplays += 1;
          this.callbacks.onToast('🔥 Bonfire Outplay! +450', 'fire');
        } else {
          this.spawnBurst(e.x, 2.0, e.z, 10, 0xffffff, 6.2);
          this.scene.remove(e.mesh);
          this.entities.splice(i, 1);
        }
      }
    }

    // Telegraphed Snowball Throw when player opens a big lead
    this.yetiSnowballTimer -= dt;
    if (zGap > 10.5 && this.yetiSnowballTimer <= 0) {
      this.yetiSnowballTimer = 4.2 + Math.random() * 2.0;
      this.spawnYetiSnowball();
    }

    // Auto-deploy Decoy Snowman right before a bite!
    const distToPlayer = Math.hypot(this.playerX - this.yetiX, this.playerZ - this.yetiZ);
    if (distToPlayer < 4.5 && this.upgrades.decoyCharges > 0 && this.upgrades.decoyCooldown <= 0) {
      this.tryDeployDecoy(true);
      return;
    }

    // Unbreakable Z-crossing catch check!
    const absDx = Math.abs(this.playerX - this.yetiX);
    if (this.yetiZ >= this.playerZ - 1.55) {
      if (absDx < 2.35 && this.playerY < 1.85) {
        this.triggerGameOver();
        return;
      }
      // If the player heroically jumped over him OR narrowly dodged at the exact line,
      // Yeti skids & resets slightly upslope so he never flies off-screen!
      if (this.yetiZ >= this.playerZ + 0.15) {
        this.yetiZ = this.playerZ - 6.8;
        this.spawnBurst(this.yetiX, 0.8, this.yetiZ, 12, 0xffffff, 5.5);
        this.callbacks.onToast('💨 Narrow Yeti Dodge!', 'good');
      }
    }
  }

  private spawnYetiSnowball(): void {
    this.sound.playSnowballThrow();

    const mesh = new THREE.Mesh(this.sharedSnowballGeo, this.sharedSnowballMat);
    mesh.position.set(this.yetiX, 2.4, this.yetiZ + 1.0);
    this.scene.add(mesh);

    const shadow = new THREE.Mesh(this.pools.geoDecalPlane, this.pools.matShadowDecal);
    shadow.scale.set(1.1, 1, 1.1);
    shadow.position.set(this.yetiX, 0.04, this.yetiZ + 1.0);
    this.scene.add(shadow);

    // Glowing cyan ground target marker telegraphing where the snowball is aimed!
    const leadX = Math.max(-this.PLAY_HALF_WIDTH, Math.min(this.PLAY_HALF_WIDTH, this.playerX + this.playerVx * 0.36));
    const marker = new THREE.Mesh(this.pools.geoDecalPlane, this.pools.matCyanGlowDecal);
    marker.scale.set(1.65, 1, 1.65);
    marker.position.set(leadX, 0.055, this.playerZ);
    this.scene.add(marker);

    const dx = leadX - this.yetiX;
    const ddz = Math.max(4, this.playerZ - this.yetiZ);
    const travelT = 0.78;
    this.snowballs.push({
      mesh,
      shadow,
      marker,
      x: this.yetiX,
      y: 2.4,
      z: this.yetiZ + 1.0,
      vx: dx / travelT,
      vz: ddz / travelT + 5.0,
    });
  }

  private updateSnowballs(dt: number): void {
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const sb = this.snowballs[i];
      sb.x += sb.vx * dt;
      sb.z += sb.vz * dt;
      sb.y = Math.max(0.7, sb.y - dt * 2.4);
      sb.mesh.position.set(sb.x, sb.y, sb.z);
      sb.mesh.rotation.x += dt * 7;
      sb.shadow.position.set(sb.x, 0.04, sb.z);
      sb.marker.position.z = this.playerZ;
      const pulse = 1.45 + Math.sin(this.elapsedTime * 18) * 0.25;
      sb.marker.scale.set(pulse, 1, pulse);

      const d = Math.hypot(sb.x - this.playerX, sb.z - this.playerZ);
      if (d < 1.3 && this.playerY < 1.35 && this.invulnTimer <= 0) {
        this.handlePlayerCrash({ id: -1, kind: 'rock', mesh: sb.mesh, x: sb.x, z: sb.z, radius: 0.7 });
        this.scene.remove(sb.mesh);
        this.scene.remove(sb.shadow);
        this.scene.remove(sb.marker);
        this.snowballs.splice(i, 1);
        continue;
      }
      if (sb.z > 24 || Math.abs(sb.x) > 30) {
        this.scene.remove(sb.mesh);
        this.scene.remove(sb.shadow);
        this.scene.remove(sb.marker);
        this.snowballs.splice(i, 1);
      }
    }
  }

  private triggerGameOver(): void {
    this.persistBestDistance();
    this.clearAllHeldInputs();
    this.sound.stopCarve();
    this.sound.stopMusic();
    this.sound.playChomp();

    this.skier.root.visible = false;
    this.yetiVictoryDance = true;
    this.yetiX = this.playerX;
    this.yetiZ = this.playerZ;
    this.yeti.root.position.set(this.yetiX, 0, this.yetiZ);
    this.spawnBurst(this.playerX, 1.5, this.playerZ, 26, 0xffffff, 8.5);
    this.dioramaPass.uniforms.uDanger.value = 0;

    this.setMode('gameover');
    this.callbacks.onGameOver({
      distance: Math.floor(this.distance),
      score: Math.floor(this.score),
      bestDistance: this.bestDistance,
      tricksAndOutplays: this.tricksAndOutplays,
      upgrades: this.upgrades,
    });
  }

  private updateYetiVictoryDance(dt: number): void {
    this.yetiStompPhase += dt * 11;
    this.yeti.root.position.y = Math.abs(Math.sin(this.yetiStompPhase)) * 0.75;
    this.yeti.uniforms.uTime.value = this.elapsedTime;
    this.yeti.uniforms.uStride.value = this.yetiStompPhase;
    this.yeti.uniforms.uLunge.value = 0.6;
    this.updateAmbientAtmosphere(dt, 0);
    this.updateBurstParticles(dt, 0);
  }

  private updateAmbientAtmosphere(dt: number, dz: number): void {
    this.auroraUniforms.uTime.value = this.elapsedTime;

    for (const c of this.liftChairs) {
      c.t = (c.t + dt * 0.03) % 1;
      const x = -42 + c.t * 84;
      const y = 13.4 + c.t * 5.4;
      const z = -26 - c.t * 2.0;
      c.mesh.position.set(x, y, z);
      c.mesh.rotation.z = Math.sin(this.elapsedTime * 1.6 + c.t * 10) * 0.06;
    }

    const arr = this.snowfallPositions;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += Math.sin(this.elapsedTime * 0.9 + i) * dt * 0.85;
      arr[i + 1] -= dt * (2.5 + (i % 5) * 0.35);
      arr[i + 2] -= dz * 0.35;
      if (arr[i + 1] < 0) {
        arr[i + 1] = 24 + Math.random() * 4;
        arr[i] = this.playerX + (Math.random() - 0.5) * 74;
      }
      if (arr[i + 2] < -36) arr[i + 2] += 66;
      if (arr[i + 2] > 30) arr[i + 2] -= 66;
    }
    this.snowfallPoints.geometry.attributes.position.needsUpdate = true;
  }

  private updateBurstParticles(dt: number, dz: number): void {
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.burstParticles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.06, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += (p.vz - dz * 0.6) * dt;
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * dt;
      p.mesh.scale.setScalar(Math.max(0.01, 1 - p.life / p.maxLife));
    }
  }

  private emitHud(boosting: boolean): void {
    const sector =
      this.distance < 700
        ? { name: 'Starlight Village', color: '#ffd470' }
        : this.distance < 1400
          ? { name: 'Timberline Ridge', color: '#62d9ff' }
          : this.distance < 2000
            ? { name: 'Aurora Approach', color: '#55f5cb' }
            : { name: 'The Chomp Line', color: '#ff6e84' };

    this.callbacks.onHudUpdate({
      distance: Math.floor(this.distance),
      speedMps: this.speed,
      isMaxSpeed: boosting || this.speed > 26,
      score: Math.floor(this.score),
      bestDistance: Math.max(this.bestDistance, Math.floor(this.distance)),
      flow: Math.round(this.flow),
      boosting,
      comboMult: this.comboMult,
      sectorName: sector.name,
      sectorColor: sector.color,
      yetiActive: this.yetiActive,
      yetiLeadMeters: this.getYetiLeadMeters(),
      yetiAlertText: 'THE CHOMP LINE — Boost to Outrun the Yeti!',
      upgrades: this.upgrades,
    });
  }
}

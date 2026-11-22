import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { SoundEngine } from './audio';
import { createAuroraBackdrop, DioramaPostShader } from './shaders';
import { SnowTrailSurface } from './snowTrail';
import {
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
  createGrindRail,
  createIcePond,
  createLodgeArch,
  createMogulRamp,
  createSnowRock,
  DioramaPine,
  DioramaSkier,
  DioramaTextures,
  DioramaYeti,
  loadDioramaTextures,
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
    | 'rail'
    | 'ice'
    | 'dog'
    | 'boarder'
    | 'cocoa'
    | 'lodge'
    | 'chalet'
    | 'decoy';
  mesh: THREE.Object3D;
  x: number;
  z: number;
  radius: number;
  vx?: number;
  vz?: number;
  gateWidth?: number;
  railLength?: number;
  iceRx?: number;
  iceRz?: number;
  triggered?: boolean;
  nearMissed?: boolean;
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
    carveCharge: number;
    comboMult: number;
    sectorName: string;
    sectorColor: string;
    yetiActive: boolean;
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

  private tex!: DioramaTextures;
  private auroraUniforms!: { uTime: { value: number }; uIntensity: { value: number } };
  private snowTrail!: SnowTrailSurface;
  private groundMesh!: THREE.Mesh;
  private bokehFrame!: THREE.Group;

  private liftChairs: { mesh: THREE.Group; t: number }[] = [];
  private snowfallPoints!: THREE.Points;
  private snowfallPositions!: Float32Array;
  private burstParticles: BurstParticle[] = [];
  private sharedSphereGeo = new THREE.SphereGeometry(0.16, 6, 6);
  private sharedSparkGeo = new THREE.OctahedronGeometry(0.2, 0);

  private skier!: DioramaSkier;
  private yeti!: DioramaYeti;

  private entities: SlopeEntity[] = [];
  private snowballs: Snowball[] = [];
  private nextEntityId = 1;

  private mode: GameMode = 'loading';
  private animFrameId = 0;
  private lastTime = 0;
  private elapsedTime = 0;

  // Player Physics & Modern Kinetic State
  private playerX = 0;
  private playerZ = -2.2;
  private playerVx = 0;
  private playerY = 0;
  private playerVy = 0;
  private speed = 16.5;
  private distance = 0;
  private score = 0;
  private bestDistance = 0;
  private flow = 100;
  private flowSurgeTimer = 0;

  // Modern Carve-Slingshot, Tricks, Rail Grind & Combo Multiplier
  private carveCharge = 0; // 0..1
  private lastCarveDir = 0;
  private comboMult = 1.0;
  private comboTimer = 0;
  private tricksAndOutplays = 0;
  private airSpinDegrees = 0;
  private airTrickActive = false;
  private grindingRail: SlopeEntity | null = null;
  private grindSparkAccum = 0;
  private onIcePond = false;
  private crashStunTimer = 0;
  private invulnTimer = 0;
  private screenShake = 0;

  // Expressive Spring-Physics Puppet Animation State
  private squashPos = 0;
  private squashVel = 0;
  private smoothLean = 0;
  private smoothCrouch = 0;
  private smoothAir = 0;
  private facingDir = 1; // 1 = left-facing sprite default, -1 = mirrored right-facing

  // 2,000m Chomp Line Yeti State (Pure anticipation & payoff — no early ambush interruptions!)
  private yetiTriggered = false;
  private yetiActive = false;
  private yetiX = 0;
  private yetiZ = -24;
  private yetiStunTimer = 0;
  private yetiStompPhase = 0;
  private yetiLastStompStep = -1;
  private yetiSnowballTimer = 4.2;
  private yetiTargetDecoy: SlopeEntity | null = null;
  private yetiVictoryDance = false;

  private nextLodgeDist = 650;
  private spawnAccum = 0;
  private decorAccum = 0;
  private trailStampAccum = 0;
  private upgrades: UpgradeState = createInitialUpgrades();
  private activeDraftChoices: UpgradeDef[] = [];

  // Controls
  private keys = new Set<string>();
  private mouseActive = false;
  private mouseNormX = 0;
  private mouseDown = false;

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
      // ignore
    }

    this.initAsync();
  }

  private async initAsync(): Promise<void> {
    this.tex = await loadDioramaTextures();
    this.initScene();
    this.bindInputs();
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

  private setMode(next: GameMode): void {
    this.mode = next;
    this.callbacks.onModeChange(next);
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
    this.renderer.toneMappingExposure = 1.02;

    this.scene = new THREE.Scene();
    // Soft luminous winter-lavender mist (keeps snow bright & powdery like the concept art!)
    this.scene.fog = new THREE.FogExp2(0x6c80ad, 0.0032);

    // Intimate diorama snow-globe framing matching the concept art!
    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 240);
    this.camera.position.set(0, 12.8, 31.0);
    this.camera.lookAt(0, 3.2, -5.0);
    this.scene.add(this.camera);

    // Lush out-of-focus foreground bokeh fairy-light pine framing attached to camera corners
    this.bokehFrame = createForegroundBokehFrame(this.tex);
    this.camera.add(this.bokehFrame);

    // Post-processing: Cozy Golden Bloom + Macro Tilt-Shift Diorama Bokeh
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.34, // crisp warm holiday glow without over-blowing aurora or snow
      0.62,
      0.86
    );
    this.composer.addPass(this.bloomPass);

    this.dioramaPass = new ShaderPass(DioramaPostShader);
    this.dioramaPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.dioramaPass);

    // Luminous moonlit snow lighting so powder looks crisp icy-white and sapphire trenches POP!
    const hemi = new THREE.HemisphereLight(0xf0f7ff, 0x7c97c4, 1.55);
    this.scene.add(hemi);

    const moonLight = new THREE.DirectionalLight(0xfffaf0, 1.45);
    moonLight.position.set(16, 30, 18);
    this.scene.add(moonLight);

    const auroraRim = new THREE.DirectionalLight(0x7af5df, 0.45);
    auroraRim.position.set(-18, 16, -26);
    this.scene.add(auroraRim);

    // Shimmering Aurora Borealis + Snowy Mountain Horizon Backdrop
    const aurora = createAuroraBackdrop();
    this.auroraUniforms = aurora.uniforms;
    aurora.mesh.position.set(0, 17.5, -66);
    this.scene.add(aurora.mesh);

    // Sculpted 3D Undulating Snowy Alpine Valley + Glossy Blue Ski Trenches Texture
    this.snowTrail = new SnowTrailSurface(this.WORLD_WIDTH, this.WORLD_LENGTH);
    const groundGeo = new THREE.PlaneGeometry(this.WORLD_WIDTH, this.WORLD_LENGTH, 64, 48);
    groundGeo.rotateX(-Math.PI / 2);

    // Gently sculpt valley snowbanks along outer sides so terrain feels pillowy & 3D!
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const bank = Math.max(0, Math.abs(x) - (this.PLAY_HALF_WIDTH + 1.5));
      const bankRise = Math.pow(bank * 0.16, 1.45) * 1.4;
      const gentleDrift = Math.sin(x * 0.22) * Math.cos(z * 0.15) * 0.22;
      posAttr.setY(i, bankRise + gentleDrift);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.snowTrail.texture,
      roughness: 0.72,
      metalness: 0.04,
      color: 0xffffff,
      emissive: 0x3b4e74,
      emissiveIntensity: 0.36,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(this.groundMesh);

    // Overhead Vintage Garlanded Ski-Lift Cable & Handcrafted Cutout Chairs
    this.initSkiLift();
    this.initSnowfall();

    // Hero Skier & Christmas-Light Yeti Diorama Cutouts
    this.skier = createDioramaSkier(this.tex);
    this.skier.root.position.set(0, 0, this.playerZ);
    this.scene.add(this.skier.root);

    this.yeti = createDioramaYeti(this.tex);
    this.yeti.root.position.set(5.5, 0, -14.5);
    this.yeti.root.visible = true; // Featured prominently on the live title diorama!
    this.scene.add(this.yeti.root);
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
      const chair = createDioramaSkiLift(this.tex);
      this.scene.add(chair);
      this.liftChairs.push({ mesh: chair, t: i / 4 });
    }
  }

  private initSnowfall(): void {
    const count = 900;
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
      map: this.tex.snowFlake,
      size: 0.42,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.snowfallPoints = new THREE.Points(geo, mat);
    this.scene.add(this.snowfallPoints);
  }

  private bindInputs(): void {
    window.addEventListener('resize', this.onResize);

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);

      if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') {
        this.mouseActive = false;
      }

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

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'playing') return;
      this.mouseActive = true;
      this.mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'playing') return;
      if (e.button === 0) {
        this.sound.unlock();
        this.mouseDown = true;
        this.mouseActive = true;
        this.mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
      }
    });

    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
    this.dioramaPass.uniforms.uResolution.value.set(w, h);
  };

  public startNewRun(): void {
    this.sound.unlock();
    this.clearDynamicEntities();
    this.snowTrail.reset();

    this.playerX = 0;
    this.playerZ = -2.2;
    this.playerVx = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.speed = 21.5;
    this.distance = 0;
    this.score = 0;
    this.flow = 100;
    this.flowSurgeTimer = 0;
    this.carveCharge = 0;
    this.lastCarveDir = 0;
    this.comboMult = 1.0;
    this.comboTimer = 0;
    this.tricksAndOutplays = 0;
    this.airSpinDegrees = 0;
    this.airTrickActive = false;
    this.grindingRail = null;
    this.onIcePond = false;
    this.crashStunTimer = 0;
    this.invulnTimer = 0;
    this.screenShake = 0;
    this.squashPos = 0;
    this.squashVel = 0;
    this.smoothLean = 0;
    this.smoothCrouch = 0;
    this.smoothAir = 0;
    this.facingDir = 1;
    this.skier.setPose('straight');

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

    this.populateInitialScenicSlope();
    this.setMode('playing');
    this.sound.startMusic(false);
    this.emitHud(false);
  }

  public pauseGame(): void {
    if (this.mode !== 'playing') return;
    this.sound.stopCarve();
    this.setMode('paused');
  }

  public resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.lastTime = performance.now();
    this.setMode('playing');
  }

  public selectUpgrade(id: UpgradeId): void {
    if (this.mode !== 'upgrading') return;
    applyUpgrade(this.upgrades, id);
    const def = UPGRADE_CATALOG.find((u) => u.id === id);
    this.sound.playUpgradePick();

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
    for (const sb of this.snowballs) this.scene.remove(sb.mesh);
    this.snowballs = [];
    for (const p of this.burstParticles) this.scene.remove(p.mesh);
    this.burstParticles = [];
  }

  private populateInitialScenicSlope(): void {
    for (let z = -54; z <= 30; z += 7.0) {
      this.spawnSideDecorAt(z);
    }
    // Crisp, rhythmic, uncluttered starting slope!
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
        const chalet = createDioramaChalet(this.tex, 0.92 + Math.random() * 0.25, side === 1);
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
        const pine = createDioramaPine(this.tex, 0.9 + Math.random() * 0.45);
        pine.root.position.set(xBase, 0.2, z);
        this.scene.add(pine.root);
        this.entities.push({
          id: this.nextEntityId++,
          kind: 'tree',
          mesh: pine.root,
          x: xBase,
          z,
          radius: 1.1,
          pineObj: pine,
          sideDecor: true,
        });
      }

      // Second lush layer of village pines behind the first
      const farX = side * (this.PLAY_HALF_WIDTH + 9.5 + Math.random() * 7.5);
      const farPine = createDioramaPine(this.tex, 1.05 + Math.random() * 0.55);
      farPine.root.position.set(farX, 0.8, z + (Math.random() - 0.5) * 3.5);
      this.scene.add(farPine.root);
      this.entities.push({
        id: this.nextEntityId++,
        kind: 'tree',
        mesh: farPine.root,
        x: farX,
        z: farPine.root.position.z,
        radius: 1.2,
        pineObj: farPine,
        sideDecor: true,
      });
    }
  }

  private spawnPine(x: number, z: number): void {
    const scale = 0.85 + Math.random() * 0.38;
    const pine = createDioramaPine(this.tex, scale);
    pine.root.position.set(x, 0, z);
    this.scene.add(pine.root);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'tree',
      mesh: pine.root,
      x,
      z,
      radius: 1.15 * scale,
      pineObj: pine,
    });
  }

  private spawnRock(x: number, z: number): void {
    const mesh = createSnowRock(this.tex);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    this.entities.push({ id: this.nextEntityId++, kind: 'rock', mesh, x, z, radius: 1.0 });
  }

  private spawnMogul(x: number, z: number): void {
    const mesh = createMogulRamp(this.tex);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({ id: this.nextEntityId++, kind: 'mogul', mesh, x, z, radius: 2.1 });
  }

  private spawnGate(x: number, z: number): void {
    const gateWidth = 6.6;
    const mesh = createCandyCaneGate(this.tex, gateWidth);
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

  private spawnRail(x: number, z: number): void {
    const railLength = 11.5;
    const mesh = createGrindRail(this.tex, railLength);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'rail',
      mesh,
      x,
      z,
      radius: 1.25,
      railLength,
    });
  }

  private spawnIcePond(x: number, z: number): void {
    const rx = 4.8 + Math.random() * 1.8;
    const rz = 6.5 + Math.random() * 2.5;
    const mesh = createIcePond(this.tex, rx, rz);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'ice',
      mesh,
      x,
      z,
      radius: rx,
      iceRx: rx,
      iceRz: rz,
    });
  }

  private spawnDog(x: number, z: number): void {
    const { root, card } = createDioramaDog(this.tex);
    const dir = x < 0 ? 1 : -1;
    if (dir < 0) card.scale.x = -1;
    root.position.set(x, 0, z);
    this.scene.add(root);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'dog',
      mesh: root,
      card,
      x,
      z,
      radius: 0.9,
      vx: dir * (2.6 + Math.random() * 1.4),
    });
  }

  private spawnBoarder(x: number, z: number): void {
    const { root, card } = createDioramaBoarder(this.tex);
    const vx = (Math.random() < 0.5 ? -1 : 1) * (4.2 + Math.random() * 2.2);
    if (vx < 0) card.scale.x = -1;
    root.position.set(x, 0, z);
    this.scene.add(root);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'boarder',
      mesh: root,
      card,
      x,
      z,
      radius: 1.0,
      vx,
      vz: 4.2,
    });
  }

  private spawnCocoa(x: number, z: number): void {
    const mesh = createCocoaPickup(this.tex);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.entities.push({
      id: this.nextEntityId++,
      kind: 'cocoa',
      mesh,
      x,
      z,
      radius: 1.3,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  private spawnLodgeArch(z: number): void {
    const mesh = createLodgeArch(this.tex, 18);
    mesh.position.set(0, 0, z);
    this.scene.add(mesh);
    this.entities.push({ id: this.nextEntityId++, kind: 'lodge', mesh, x: 0, z, radius: 1.0 });
  }

  private bumpCombo(amount = 0.5): void {
    this.comboMult = Math.min(5.0, Math.round((this.comboMult + amount) * 10) / 10);
    this.comboTimer = 5.5;
  }

  private tryJump(): void {
    if (this.crashStunTimer > 0) return;
    if (this.grindingRail) {
      // Pop high off a grind rail!
      this.grindingRail = null;
      this.playerVy = 11.2;
      this.airTrickActive = true;
      this.airSpinDegrees = 0;
      this.squashPos = 0.22;
      this.squashVel = 3.8;
      this.sound.playJump();
      this.spawnBurst(this.playerX, 1.2, this.playerZ, 12, 0xffd770, 6.2, true);
      return;
    }
    if (this.playerY > 0.12) return;
    this.playerVy = 10.2 + this.upgrades.levels.aurora_glider * 1.1;
    this.airTrickActive = true;
    this.airSpinDegrees = 0;
    this.squashPos = 0.24;
    this.squashVel = 4.2;
    this.sound.playJump();
    this.spawnBurst(this.playerX, 0.25, this.playerZ, 10, 0xe8f7ff, 4.8);
  }

  private tryDeployDecoy(autoTriggered: boolean): boolean {
    if (this.upgrades.decoyCharges <= 0 || this.upgrades.decoyCooldown > 0) return false;
    this.upgrades.decoyCharges -= 1;
    this.upgrades.decoyCooldown = 2.0;

    const mesh = createDecoySnowman(this.tex);
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
    this.spawnBurst(dx, 1.2, dz, 16, 0xffffff, 5.8);
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
    // Organic glowing particle bonfire directly on the real Christmas tree (no fake clipart sticker!)
    e.pineObj.emberHalo.visible = true;
    e.pineObj.warmGlow.scale.setScalar(2.1);

    this.sound.playFireIgnite();
    this.flow = Math.min(100, this.flow + 18);
    this.bumpCombo(0.3);
    const pts = Math.round(240 * this.comboMult);
    this.score += pts;
    this.spawnBurst(e.x, 2.0, e.z, 18, 0xff8c24, 6.8, true);
    this.spawnBurst(e.x, 2.6, e.z, 10, 0xffe478, 5.2, true);
    this.callbacks.onToast(`🔥 Pyro Skis Ignited Pine! +${pts}`, 'fire');
  }

  private triggerRailLightning(): void {
    const strikes = 1 + this.upgrades.levels.rail_striker;
    let count = 0;
    for (let i = this.entities.length - 1; i >= 0 && count < strikes; i--) {
      const e = this.entities[i];
      if (e.sideDecor) continue;
      if ((e.kind === 'rock' || e.kind === 'tree') && e.z > this.playerZ && e.z < this.playerZ + 18) {
        this.spawnBurst(e.x, 1.8, e.z, 16, 0xffd76e, 8.0, true);
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

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 6.0,
    isSpark = false
  ): void {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      if (this.burstParticles.length > 240) break;
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

    // Live expressive skier puppet on the title diorama (zero face warp!)
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

    // Showcase the articulated Christmas-light Yeti stomping behind on the scenic title diorama!
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
    this.camera.position.set(this.playerX * 0.34, 12.8, 31.0);
    this.camera.lookAt(this.playerX * 0.24, 3.2, -5.0);
  }

  private updatePlaying(dt: number): void {
    // 1. Controls
    let steerInput = 0;
    const leftKey = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const rightKey = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const brakeKey = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const tuckKey = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    const spaceHeld = this.keys.has('Space');

    if (leftKey) steerInput -= 1;
    if (rightKey) steerInput += 1;

    if (steerInput === 0 && this.mouseActive) {
      const desiredX = this.mouseNormX * (this.PLAY_HALF_WIDTH * 1.04);
      const diff = desiredX - this.playerX;
      steerInput = Math.max(-1, Math.min(1, diff / 3.8));
    }

    const boostHeld =
      this.keys.has('KeyF') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.mouseDown;

    if (this.flowSurgeTimer > 0) this.flowSurgeTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.upgrades.decoyCooldown > 0) this.upgrades.decoyCooldown -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboMult = 1.0;
    }

    // 2. Modern Carve-Slingshot System!
    const carvingHard = this.playerY <= 0.08 && !this.grindingRail && Math.abs(steerInput) > 0.58;
    const carveDir = Math.sign(steerInput);
    const magnetLvl = this.upgrades.levels.cocoa_magnet;

    if (carvingHard) {
      const chargeRate = (0.72 + magnetLvl * 0.32) * (this.onIcePond ? 1.85 : 1.0);
      if (this.lastCarveDir !== 0 && carveDir !== this.lastCarveDir && this.carveCharge >= 0.55) {
        this.releaseCarveSlingshot();
      } else {
        this.carveCharge = Math.min(1.0, this.carveCharge + chargeRate * dt);
      }
      this.lastCarveDir = carveDir;
    } else {
      if (this.carveCharge >= 0.55 && this.playerY <= 0.08 && !this.grindingRail) {
        this.releaseCarveSlingshot();
      } else {
        this.carveCharge = Math.max(0, this.carveCharge - dt * 1.6);
      }
      if (Math.abs(steerInput) < 0.25) this.lastCarveDir = 0;
    }

    // 3. Exhilarating Accelerating Speed Curve (coupled directly to the Christmas music tempo!)
    const isBoosting =
      this.crashStunTimer <= 0 && ((boostHeld && this.flow > 1.5) || this.flowSurgeTimer > 0);
    // Starts brisk at 22 m/s and steadily accelerates up to 36+ m/s with distance & combo momentum!
    const distAccel = Math.min(13.5, this.distance / 155);
    const comboAccel = (this.comboMult - 1.0) * 1.9;
    const baseCruise = (22.0 + distAccel + comboAccel) * (this.onIcePond ? 1.24 : 1.0);
    let targetSpeed = baseCruise;
    if (brakeKey) targetSpeed *= 0.72;
    if (tuckKey) targetSpeed *= 1.18;
    if (this.grindingRail) targetSpeed = baseCruise + 9.0;

    if (isBoosting) {
      targetSpeed = Math.max(targetSpeed, baseCruise + 13.5 + magnetLvl * 1.8);
      if (this.flowSurgeTimer <= 0) {
        this.flow = Math.max(0, this.flow - 22.0 * dt);
      }
    } else {
      this.flow = Math.min(100, this.flow + (5.5 + (carvingHard ? 6.2 : 0)) * dt);
    }

    if (this.crashStunTimer > 0) {
      this.crashStunTimer -= dt;
      targetSpeed = 8.0;
    }

    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 7.2);
    // Sync music BPM smoothly to your live downhill speed!
    this.sound.setTempoFromSpeed(this.speed);

    const dz = this.speed * dt;
    this.distance += dz;
    this.score += dz * this.comboMult * (isBoosting ? 1.65 : 1.0);

    // Crisp, responsive lateral carving (fast & snappy even on ice!)
    const latResponsiveness = this.onIcePond ? 10.5 : 15.5;
    const maxLatSpeed = (isBoosting ? 23.0 : 19.5) * (this.crashStunTimer > 0 ? 0.4 : 1.0);

    if (this.grindingRail) {
      // Lock cleanly along the festive wooden rail!
      this.playerX += (this.grindingRail.x - this.playerX) * Math.min(1, dt * 14);
      this.playerY = 1.18;
      this.playerVy = 0;
      this.flow = Math.min(100, this.flow + 24 * dt);
      this.score += 180 * this.comboMult * dt;
      this.grindSparkAccum += dt;
      if (this.grindSparkAccum > 0.055) {
        this.grindSparkAccum = 0;
        this.spawnBurst(this.playerX, 1.15, this.playerZ - 0.3, 3, 0xffd770, 5.2, true);
      }
      const halfL = (this.grindingRail.railLength || 11.5) * 0.5;
      if (this.playerZ < this.grindingRail.z - halfL || this.playerZ > this.grindingRail.z + halfL + 1.0) {
        this.grindingRail = null;
        this.playerVy = 6.8;
      }
    } else {
      const targetVx = steerInput * maxLatSpeed;
      this.playerVx += (targetVx - this.playerVx) * Math.min(1, dt * latResponsiveness);
      this.playerX += this.playerVx * dt;
      this.playerX = Math.max(-this.PLAY_HALF_WIDTH, Math.min(this.PLAY_HALF_WIDTH, this.playerX));

      // Vertical Jump, Hold-to-Spin Tricks, Aurora Glider & Perfect Stomp!
      const gliderLvl = this.upgrades.levels.aurora_glider;
      const isGliding = gliderLvl > 0 && this.playerY > 0.8 && this.playerVy < 0 && spaceHeld;
      this.skier.gliderWings.visible = isGliding;

      if (this.playerY > 0 || this.playerVy > 0) {
        this.playerY += this.playerVy * dt;
        const grav = isGliding ? 6.5 - gliderLvl * 1.1 : 23.5;
        this.playerVy -= grav * dt;

        if (spaceHeld && this.airTrickActive) {
          this.airSpinDegrees += dt * (440 + gliderLvl * 85);
        }

        if (this.playerY <= 0) {
          this.playerY = 0;
          this.playerVy = 0;
          this.skier.gliderWings.visible = false;
          this.handleTrickLanding(spaceHeld);
        }
      }
    }

    // Shift player slightly forward when Yeti is active for awesome framing
    const desiredZ = this.yetiActive ? -0.6 : -2.2;
    this.playerZ += (desiredZ - this.playerZ) * Math.min(1, dt * 2.5);

    // Update Articulated HD-2D Stop-Motion Skier Puppet (4 Poses + Spring Squash/Stretch + Scarf Wind + 3D Banking!)
    this.skier.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.skier.shadow.position.y = 0.04 - this.playerY;
    const shadowScale = Math.max(0.4, 1 - this.playerY * 0.09);
    this.skier.shadow.scale.setScalar(shadowScale);

    // Damped spring oscillator for juicy squash & stretch!
    const springForce = -195 * this.squashPos - 14 * this.squashVel;
    this.squashVel += springForce * dt;
    this.squashPos = Math.max(-0.32, Math.min(0.32, this.squashPos + this.squashVel * dt));

    // Smoothly interpolate puppet deformation channels
    const targetLean = Math.max(-1, Math.min(1, this.playerVx / 13.5));
    this.smoothLean += (targetLean - this.smoothLean) * Math.min(1, dt * 13);
    const targetCrouch = isBoosting ? 1.0 : tuckKey ? 0.55 : this.grindingRail ? 0.45 : 0.0;
    this.smoothCrouch += (targetCrouch - this.smoothCrouch) * Math.min(1, dt * 10);
    const targetAir = this.playerY > 0.25 ? 1.0 : 0.0;
    this.smoothAir += (targetAir - this.smoothAir) * Math.min(1, dt * 12);

    // Select stop-motion pose dynamically based on action!
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

    // 3D banking yaw & roll + mid-air trick spin!
    const speedNorm = Math.min(2.0, this.speed / 16.5);
    const groundBob =
      this.playerY <= 0.05 && !this.grindingRail
        ? Math.abs(Math.sin(this.elapsedTime * (10 + speedNorm * 3.5))) * 0.09
        : 0;
    this.skier.visual.position.y = groundBob;
    this.skier.visual.rotation.y = this.smoothLean * 0.34;
    this.skier.visual.rotation.z =
      -this.smoothLean * 0.26 + (this.airSpinDegrees * Math.PI) / 180;
    if (this.crashStunTimer > 0) {
      this.skier.visual.rotation.z += Math.sin(this.elapsedTime * 34) * 0.42;
    }

    // Feed clean puppet uniforms (ZERO face warping — only scarf tip flutter + whole-body squash/stretch!)
    const u = this.skier.uniforms;
    u.uTime.value = this.elapsedTime;
    u.uSpeed.value = speedNorm;
    u.uSquash.value = this.squashPos;
    u.uCrouch.value = this.smoothCrouch;
    u.uFlipX.value = this.facingDir;

    if (this.skier.shieldRing.visible) {
      this.skier.shieldRing.rotation.y += dt * 3.4;
    }

    // Audio snow carving + wind
    this.sound.updateCarve(
      Math.min(1, (this.speed - 10) / 22),
      Math.abs(this.playerVx) / 16,
      this.playerY > 0.1 || this.grindingRail !== null
    );

    // 4. Glossy Carved Snow Tracks & Continuous Rooster-Tail Carving Powder Spray!
    this.snowTrail.advance(dz);
    if (this.playerY <= 0.08 && !this.grindingRail) {
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

    // 5. Escalating Yeti Encounters & Aurora Intensity!
    this.auroraUniforms.uIntensity.value = Math.min(1.0, 0.72 + (this.distance / 2200) * 0.28);
    this.checkYetiPhaseTriggers();

    // 6. Spawners, Entities, Yeti & Particles
    this.updateSpawners(dz);
    this.updateEntities(dt, dz);
    if (this.yetiActive) {
      this.updateYeti(dt, dz);
      this.updateSnowballs(dt);
    }
    this.updateAmbientAtmosphere(dt, dz);
    this.updateBurstParticles(dt, dz);

    // 7. Intimate Snow-Globe Camera Follow + Subtle Bokeh Frame Sway
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    const sx = (Math.random() - 0.5) * this.screenShake * 1.1;
    const sy = (Math.random() - 0.5) * this.screenShake * 0.8;
    const boostZoom = isBoosting ? 1.6 : 0;

    // Dynamic FOV punch as speed accelerates so you VISCERALLY feel flying down the mountain!
    const targetFov = 46 + Math.min(10.5, Math.max(0, (this.speed - 20) * 0.42)) + (isBoosting ? 2.5 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5.0);
    this.camera.updateProjectionMatrix();

    this.camera.position.x += (this.playerX * 0.4 + sx - this.camera.position.x) * Math.min(1, dt * 5.5);
    this.camera.position.y += (12.8 - boostZoom * 0.3 + sy - this.camera.position.y) * Math.min(1, dt * 4.5);
    this.camera.position.z += (31.0 + boostZoom - this.camera.position.z) * Math.min(1, dt * 4.5);
    this.camera.lookAt(this.playerX * 0.3, 3.2, -5.0);

    // Gently sway the foreground bokeh corner pine framing for tactile snow-globe depth
    this.bokehFrame.position.x = -this.playerVx * 0.035;
    this.bokehFrame.position.y = Math.sin(this.elapsedTime * 1.4) * 0.12;

    const yetiGap = this.yetiActive ? this.playerZ - this.yetiZ : 99;
    const danger = this.yetiActive ? Math.max(0, Math.min(1, 1 - (yetiGap - 3) / 13)) : 0;
    this.dioramaPass.uniforms.uTime.value = this.elapsedTime;
    this.dioramaPass.uniforms.uBoost.value += ((isBoosting ? 1 : 0) - this.dioramaPass.uniforms.uBoost.value) * dt * 6;
    this.dioramaPass.uniforms.uDanger.value += (danger - this.dioramaPass.uniforms.uDanger.value) * dt * 5;

    this.emitHud(isBoosting);
  }

  private releaseCarveSlingshot(): void {
    const power = this.carveCharge;
    this.carveCharge = 0;
    const magnetLvl = this.upgrades.levels.cocoa_magnet;
    this.flowSurgeTimer = Math.max(this.flowSurgeTimer, 0.75 + power * 0.65 + magnetLvl * 0.25);
    this.flow = Math.min(100, this.flow + 14 + power * 10);
    this.squashPos = 0.2;
    this.squashVel = 3.2;
    this.bumpCombo(0.4);
    const pts = Math.round((120 + power * 120) * this.comboMult);
    this.score += pts;
    this.sound.playSlingshot();
    this.spawnBurst(this.playerX, 0.5, this.playerZ, 14, 0x7df9ff, 6.8, true);
    this.callbacks.onToast(`⚡ Carve Slingshot! +${pts}`, 'good');

    // Pyro Carver synergy: snapping a slingshot ignites nearby pine trees into bonfires!
    if (this.upgrades.levels.pyro_carver > 0) {
      const fireRad = 6.5 + this.upgrades.levels.pyro_carver * 2.2;
      for (const e of this.entities) {
        if (e.kind === 'tree' && !e.sideDecor && !e.pineObj?.ignited) {
          if (Math.hypot(e.x - this.playerX, e.z - this.playerZ) < fireRad) {
            this.igniteTree(e);
          }
        }
      }
    }
  }

  private handleTrickLanding(spaceStillHeld: boolean): void {
    // Juicy landing compression squash even on normal hops!
    this.squashPos = -0.24;
    this.squashVel = -1.8;

    const spins = Math.floor((this.airSpinDegrees + 80) / 360);
    this.airSpinDegrees = 0;
    this.airTrickActive = false;
    if (spins <= 0) return;

    // Releasing Space before touchdown (or modest spin) nails a PERFECT STOMP!
    const perfect = !spaceStillHeld || spins === 1;
    const basePts = spins * 220;
    const pts = Math.round(basePts * this.comboMult * (perfect ? 1.5 : 1.0));
    this.score += pts;
    this.flow = Math.min(100, this.flow + 20 + spins * 10);
    this.tricksAndOutplays += 1;
    this.bumpCombo(perfect ? 0.6 : 0.3);

    if (perfect) {
      this.flowSurgeTimer = Math.max(this.flowSurgeTimer, 0.9);
      this.sound.playPerfectStomp();
      this.screenShake = Math.max(this.screenShake, 0.35);
      this.spawnBurst(this.playerX, 0.4, this.playerZ, 20, 0x62f5ff, 8.2, true);
      this.callbacks.onToast(`✨ Perfect ${spins * 360}° Stomp! +${pts}`, 'good');

      if (this.upgrades.levels.avalanche_stomp > 0) {
        this.triggerAvalancheShockwave();
      }
    } else {
      this.sound.playJump();
      this.callbacks.onToast(`❄️ ${spins * 360}° Landed! +${pts}`, 'default');
    }
  }

  private triggerAvalancheShockwave(): void {
    const rad = 6.8 + this.upgrades.levels.avalanche_stomp * 2.0;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.sideDecor) continue;
      if (e.kind === 'rock' || e.kind === 'tree') {
        if (Math.hypot(e.x - this.playerX, e.z - this.playerZ) < rad) {
          this.spawnBurst(e.x, 1.8, e.z, 14, 0x99f3ff, 8.0, true);
          this.scene.remove(e.mesh);
          this.entities.splice(i, 1);
          this.score += Math.round(140 * this.comboMult);
        }
      }
    }
    if (this.yetiActive && Math.hypot(this.yetiX - this.playerX, this.yetiZ - this.playerZ) < rad + 4) {
      this.yetiStunTimer = 2.6;
      this.yetiZ -= 6.5;
      this.tricksAndOutplays += 1;
      this.callbacks.onToast('❄️ Avalanche Stomp Knocked Back the Yeti!', 'good');
    }
  }

  private checkYetiPhaseTriggers(): void {
    // Save the Yeti's iconic grand entrance for 2,000 meters — pure anticipation & payoff!
    if (!this.yetiTriggered && this.distance >= 2000) {
      this.yetiTriggered = true;
      this.yetiActive = true;
      this.yetiX = this.playerX + (this.playerX > 0 ? -4.5 : 4.5);
      this.yetiZ = this.playerZ - 16.5;
      this.yetiStunTimer = 0;
      this.yeti.root.position.set(this.yetiX, 0, this.yetiZ);
      this.yeti.root.visible = true;
      this.screenShake = 0.85;
      this.flow = Math.min(100, this.flow + 50);
      this.sound.playYetiRoar();
      this.sound.setChaseMode(true); // Kicks into fast manic Jingle Bells!
      this.callbacks.onMilestone(
        '2,000 METERS',
        'THE CHOMP LINE',
        'Hold F or Click to Boost — Outrun the Yeti!'
      );
    }
  }

  private updateSpawners(dz: number): void {
    this.decorAccum += dz;
    if (this.decorAccum >= 6.8) {
      this.decorAccum -= 6.8;
      this.spawnSideDecorAt(30);
    }

    if (this.distance >= this.nextLodgeDist - 30) {
      this.spawnLodgeArch(30);
      this.nextLodgeDist += this.nextLodgeDist < 1950 ? 650 : 850;
    }

    // Crisp, rhythmic, uncluttered arcade slope!
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
        // Frequent Candy-Cane Slalom Gates with bright yellow ribbon!
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
    this.onIcePond = false;

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
          if (e.card) e.card.scale.x = e.vx < 0 ? -1 : 1;
        }
        e.mesh.position.y = Math.abs(Math.sin(steppedTime * 7)) * 0.35;
        this.snowTrail.stampBoardTrack(e.x, e.z);
      } else if (e.kind === 'cocoa') {
        e.mesh.rotation.y += dt * 2.2;
        e.mesh.position.y = Math.sin(this.elapsedTime * 4 + (e.bobPhase || 0)) * 0.24;
        const pullRad = 4.6 + magnetLvl * 4.2;
        const dx = this.playerX - e.x;
        const ddz = this.playerZ - e.z;
        const d = Math.hypot(dx, ddz);
        if (d < pullRad && d > 0.1) {
          e.x += (dx / d) * (13 + magnetLvl * 5) * dt;
          e.z += (ddz / d) * (13 + magnetLvl * 5) * dt;
        }
      } else if (e.kind === 'tree' && e.pineObj?.ignited) {
        // Organic flickering bonfire glow + rising real flame/spark particles!
        const flick = 0.88 + Math.sin(this.elapsedTime * 22 + e.id) * 0.16;
        e.pineObj.emberHalo.scale.set(flick, 0.92 + Math.cos(this.elapsedTime * 19 + e.id) * 0.15, 1);
        if (Math.random() < 0.48) {
          const col = Math.random() > 0.35 ? 0xff8c24 : 0xffe478;
          this.spawnBurst(e.x + (Math.random() - 0.5) * 1.2, 1.8 + Math.random() * 1.8, e.z, 1, col, 3.2, true);
        }
      }

      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;

      if (e.z < -58) {
        if (this.grindingRail === e) this.grindingRail = null;
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        continue;
      }

      if (e.sideDecor) continue;

      const dx = this.playerX - e.x;
      const ddz = this.playerZ - e.z;
      const dist = Math.hypot(dx, ddz);

      // Frozen Ice Pond detection!
      if (e.kind === 'ice' && this.playerY < 0.2) {
        const rx = e.iceRx || 5;
        const rz = e.iceRz || 7;
        if ((dx * dx) / (rx * rx) + (ddz * ddz) / (rz * rz) <= 1.0) {
          this.onIcePond = true;
          if (!e.triggered) {
            e.triggered = true;
            this.flow = Math.min(100, this.flow + 12);
            this.callbacks.onToast('🧊 Ice Drift — 2× Carve Charge!', 'good');
          }
        }
        continue;
      }

      if (e.kind === 'rail' && !this.grindingRail) {
        const halfL = (e.railLength || 11.5) * 0.5;
        const nearEntry = Math.abs(ddz - halfL) < 2.2 && this.playerY < 1.2;
        const landingOn = Math.abs(ddz) < halfL && this.playerY > 0.2 && this.playerY < 2.8 && this.playerVy <= 2.5;
        if (Math.abs(dx) < 1.6 && (nearEntry || landingOn)) {
          this.grindingRail = e;
          this.airTrickActive = false;
          this.airSpinDegrees = 0;
          this.squashPos = -0.16;
          this.squashVel = -1.2;
          this.callbacks.onToast('⚡ Festive Rail Grind!', 'fire');
        }
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
          this.sound.playGateChime(Math.floor(this.comboMult * 2));
          this.spawnBurst(this.playerX, 1.3, this.playerZ, 12, 0xffd770, 6.2, true);
          this.callbacks.onToast(`🍬 Candy Slalom! +${pts}`, 'good');
          if (this.upgrades.levels.rail_striker > 0) this.triggerRailLightning();
        }
        continue;
      }

      if (e.kind === 'cocoa' && !e.triggered && dist < 1.95) {
        e.triggered = true;
        this.flow = Math.min(100, this.flow + 38);
        this.score += Math.round(180 * this.comboMult);
        this.sound.playGateChime(4);
        this.spawnBurst(e.x, 1.0, e.z, 14, 0xffd770, 5.8, true);
        this.callbacks.onToast('☕ Hot Cocoa Refill!', 'fire');
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        continue;
      }

      if (e.kind === 'mogul' && !e.triggered && dist < 2.25 && this.playerY < 0.7) {
        e.triggered = true;
        this.playerVy = 12.8 + this.upgrades.levels.aurora_glider * 1.4;
        this.airTrickActive = true;
        this.airSpinDegrees = 0;
        this.squashPos = 0.28;
        this.squashVel = 5.0;
        this.sound.playJump();
        this.spawnBurst(e.x, 0.7, e.z, 14, 0x8ef5ff, 6.4, true);
        continue;
      }

      if (e.kind === 'dog' && !e.triggered && dist < 2.3) {
        if (this.playerY > 0.75) {
          e.triggered = true;
          const pts = Math.round(250 * this.comboMult);
          this.score += pts;
          this.flow = Math.min(100, this.flow + 22);
          this.bumpCombo(0.5);
          this.sound.playBark();
          this.callbacks.onToast(`🐶 Good Boy Leap! +${pts}`, 'good');
          continue;
        } else if (dist > 1.25 && !e.nearMissed) {
          e.nearMissed = true;
          this.sound.playBark();
        }
      }

      // Near-miss & Pyro Carver ignition
      if (
        (e.kind === 'tree' || e.kind === 'boarder' || e.kind === 'rock') &&
        !e.nearMissed &&
        dist < e.radius + 2.4 &&
        dist > e.radius + 0.65 &&
        this.playerY < 1.2
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

      // Solid Collision
      if (
        (e.kind === 'tree' || e.kind === 'rock' || e.kind === 'dog' || e.kind === 'boarder') &&
        dist < e.radius + 0.55 &&
        this.playerY < 1.45 &&
        !this.grindingRail &&
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
      this.spawnBurst(this.playerX, 1.2, this.playerZ, 24, 0xffd770, 8.0, true);
      this.callbacks.onToast('🎄 Bauble Ward Saved Combo!', 'good');
      if (obstacle.kind === 'tree' && this.upgrades.levels.pyro_carver > 0) this.igniteTree(obstacle);
      return;
    }

    this.crashStunTimer = 0.62;
    this.invulnTimer = 1.2;
    this.comboMult = 1.0;
    this.carveCharge = 0;
    this.speed = Math.max(6.2, this.speed * 0.42);
    this.screenShake = 0.8;
    this.sound.playCrash();
    this.spawnBurst(this.playerX, 0.9, this.playerZ, 18, 0xffffff, 7.5);
    if (obstacle.kind === 'tree') this.sound.playOrnamentShatter();
    if (obstacle.kind === 'dog') this.sound.playBark();
    this.callbacks.onToast('💥 Wipeout!', 'danger');
  }

  private openUpgradeDraft(): void {
    this.sound.stopCarve();
    this.activeDraftChoices = draftThreeUpgrades(this.upgrades);
    this.setMode('upgrading');
    this.callbacks.onShowUpgradeDraft(Math.floor(this.distance), this.activeDraftChoices);
  }

  private updateYeti(dt: number, dz: number): void {
    if (this.yetiStunTimer > 0) {
      this.yetiStunTimer -= dt;
      this.yetiZ -= dz * 0.72;
      this.yeti.root.position.set(this.yetiX, 0, this.yetiZ);
      return;
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
    // Fast, thrilling 2,000m Yeti pursuit — hold F / Click or chain Slalom Gates to outrun!
    const baseYetiSpeed = 33.5 + Math.min(9.5, (this.distance - 2000) / 520);
    const relativeDz = (baseYetiSpeed - this.speed) * dt;

    this.yetiZ = Math.max(-22.5, this.yetiZ + relativeDz);
    const dx = targetX - this.yetiX;
    this.yetiX += Math.max(-12.5, Math.min(12.5, dx * 3.1)) * dt;

    // Articulated stop-motion Yeti puppet stride, independent waving arms & eager lunge!
    this.yetiStompPhase += dt * 9.8;
    const bounce = Math.abs(Math.sin(this.yetiStompPhase));
    this.yeti.root.position.set(this.yetiX, bounce * 0.52, this.yetiZ);
    const gapToPlayer = Math.max(0, this.playerZ - this.yetiZ);
    this.yeti.uniforms.uTime.value = this.elapsedTime;
    this.yeti.uniforms.uStride.value = this.yetiStompPhase;
    this.yeti.uniforms.uLunge.value = Math.max(0, Math.min(1, 1 - (gapToPlayer - 2) / 10));
    this.yeti.uniforms.uFlipX.value = dx < -1.5 ? -1 : 1;

    const stepIndex = Math.floor(this.yetiStompPhase / Math.PI);
    if (stepIndex !== this.yetiLastStompStep) {
      this.yetiLastStompStep = stepIndex;
      this.snowTrail.stampYetiFootprint(this.yetiX, this.yetiZ, stepIndex % 2 === 0);
      const proximity = Math.max(0, 1 - Math.abs(this.playerZ - this.yetiZ) / 22);
      if (proximity > 0.15) {
        this.sound.playYetiStomp(proximity);
        this.screenShake = Math.max(this.screenShake, proximity * 0.22);
      }
    }

    // Yeti smashes pines (getting scorched/outplayed by roaring Yule bonfires!) or eats decoys!
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.sideDecor) continue;
      const d = Math.hypot(e.x - this.yetiX, e.z - this.yetiZ);

      if (e.kind === 'decoy' && d < 2.4) {
        e.triggered = true;
        this.yetiTargetDecoy = null;
        this.yetiStunTimer = 3.5;
        this.spawnBurst(e.x, 1.5, e.z, 22, 0xffffff, 7.8);
        this.sound.playChomp();
        this.scene.remove(e.mesh);
        this.entities.splice(i, 1);
        this.callbacks.onToast('⛄ Yeti Chomped the Decoy! Run!', 'good');
        return;
      }

      if (e.kind === 'tree' && d < 2.3) {
        if (e.pineObj?.ignited) {
          this.spawnBurst(e.x, 2.4, e.z, 24, 0xff8c2b, 8.8, true);
          this.sound.playFireIgnite();
          this.scene.remove(e.mesh);
          this.entities.splice(i, 1);
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

    // Occasional Snowball Throw when player pulls far ahead
    const gap = this.playerZ - this.yetiZ;
    this.yetiSnowballTimer -= dt;
    if (gap > 11.0 && this.yetiSnowballTimer <= 0) {
      this.yetiSnowballTimer = 4.2 + Math.random() * 2.0;
      this.spawnYetiSnowball();
    }

    // Auto-deploy Decoy Snowman right before a bite!
    const distToPlayer = Math.hypot(this.playerX - this.yetiX, this.playerZ - this.yetiZ);
    if (distToPlayer < 4.5 && this.upgrades.decoyCharges > 0 && this.upgrades.decoyCooldown <= 0) {
      this.tryDeployDecoy(true);
      return;
    }

    // CHOMPED CHECK (Vaulting high in the air over the Yeti avoids the bite!)
    if (distToPlayer < 2.15 && this.playerY < 1.95) {
      this.triggerGameOver();
    }
  }

  private spawnYetiSnowball(): void {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.75, 1),
      new THREE.MeshStandardMaterial({ color: 0xeaf5ff, roughness: 0.85 })
    );
    mesh.position.set(this.yetiX, 2.4, this.yetiZ + 1.0);
    this.scene.add(mesh);

    const leadX = this.playerX + this.playerVx * 0.4;
    const dx = leadX - this.yetiX;
    const ddz = Math.max(4, this.playerZ - this.yetiZ);
    const travelT = 0.65;
    this.snowballs.push({
      mesh,
      x: this.yetiX,
      y: 2.4,
      z: this.yetiZ + 1.0,
      vx: dx / travelT,
      vz: ddz / travelT + 5.8,
    });
  }

  private updateSnowballs(dt: number): void {
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const sb = this.snowballs[i];
      sb.x += sb.vx * dt;
      sb.z += sb.vz * dt;
      sb.y = Math.max(0.7, sb.y - dt * 2.6);
      sb.mesh.position.set(sb.x, sb.y, sb.z);
      sb.mesh.rotation.x += dt * 7;

      const d = Math.hypot(sb.x - this.playerX, sb.z - this.playerZ);
      if (d < 1.4 && this.playerY < 1.35 && this.invulnTimer <= 0) {
        this.handlePlayerCrash({ id: -1, kind: 'rock', mesh: sb.mesh, x: sb.x, z: sb.z, radius: 0.7 });
        this.scene.remove(sb.mesh);
        this.snowballs.splice(i, 1);
        continue;
      }
      if (sb.z > 24 || Math.abs(sb.x) > 30) {
        this.scene.remove(sb.mesh);
        this.snowballs.splice(i, 1);
      }
    }
  }

  private triggerGameOver(): void {
    this.sound.stopCarve();
    this.sound.stopMusic();
    this.sound.playChomp();

    if (this.distance > this.bestDistance) {
      this.bestDistance = Math.floor(this.distance);
      try {
        window.localStorage.setItem(BEST_STORAGE_KEY, String(this.bestDistance));
      } catch {
        // ignore
      }
    }

    this.skier.root.visible = false;
    this.yetiVictoryDance = true;
    this.yetiX = this.playerX;
    this.yetiZ = this.playerZ;
    this.yeti.root.position.set(this.yetiX, 0, this.yetiZ);
    this.spawnBurst(this.playerX, 1.5, this.playerZ, 28, 0xffffff, 8.5);

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

    const alertText = 'THE CHOMP LINE — Hold F or Click to Outrun the Yeti!';

    this.callbacks.onHudUpdate({
      distance: Math.floor(this.distance),
      speedMps: this.speed,
      isMaxSpeed: boosting || this.speed > 27,
      score: Math.floor(this.score),
      bestDistance: Math.max(this.bestDistance, Math.floor(this.distance)),
      flow: Math.round(this.flow),
      boosting,
      carveCharge: this.carveCharge,
      comboMult: this.comboMult,
      sectorName: sector.name,
      sectorColor: sector.color,
      yetiActive: this.yetiActive,
      yetiAlertText: alertText,
      upgrades: this.upgrades,
    });
  }
}

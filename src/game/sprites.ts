import * as THREE from 'three';
import {
  createSkierPuppetMaterial,
  createYetiPuppetMaterial,
  SkierPuppetUniforms,
  YetiPuppetUniforms,
} from './puppetShader';

/**
 * Zero-Leak HD-2D Stop-Motion Diorama Asset Library!
 * Every shared Geometry and Material is allocated ONCE in SharedAssetPool
 * so spawning/despawning thousands of entities leaks ZERO GPU memory.
 */

export interface DioramaTextures {
  skier: THREE.Texture;
  skierStraight: THREE.Texture;
  skierHardCarve: THREE.Texture;
  skierBoost: THREE.Texture;
  yeti: THREE.Texture;
  pineTree: THREE.Texture;
  chalet: THREE.Texture;
  dog: THREE.Texture;
  snowboarder: THREE.Texture;
  skiLift: THREE.Texture;
  shadowDisc: THREE.CanvasTexture;
  warmGlowDisc: THREE.CanvasTexture;
  cyanGlowDisc: THREE.CanvasTexture;
  bokehDot: THREE.CanvasTexture;
  snowFlake: THREE.CanvasTexture;
  candyStripe: THREE.CanvasTexture;
}

export interface SharedPools {
  tex: DioramaTextures;
  // Shared cutout planes & materials (reused across every spawned instance!)
  geoUnitPlane: THREE.PlaneGeometry;
  geoDecalPlane: THREE.PlaneGeometry;
  matShadowDecal: THREE.MeshBasicMaterial;
  matWarmGlowDecal: THREE.MeshBasicMaterial;
  matCyanGlowDecal: THREE.MeshBasicMaterial;
  matPine: THREE.MeshBasicMaterial;
  matChalet: THREE.MeshBasicMaterial;
  matDog: THREE.MeshBasicMaterial;
  matBoarder: THREE.MeshBasicMaterial;
  matSkiLift: THREE.MeshBasicMaterial;
  matBokeh: THREE.MeshBasicMaterial;
  // Shared 3D prop geometries & materials (HDR emissives where appropriate for Bloom!)
  matSnow: THREE.MeshStandardMaterial;
  matSnowShadow: THREE.MeshStandardMaterial;
  matWood: THREE.MeshStandardMaterial;
  matCandy: THREE.MeshStandardMaterial;
  matStone: THREE.MeshStandardMaterial;
  matStoneDark: THREE.MeshStandardMaterial;
  matPine3D: THREE.MeshStandardMaterial;
  matYellowRibbon: THREE.MeshBasicMaterial;
  matGoldRibbon: THREE.MeshBasicMaterial;
  matHdrCyanBulb: THREE.MeshBasicMaterial;
  matHdrGoldBulb: THREE.MeshBasicMaterial;
  matCocoaMug: THREE.MeshStandardMaterial;
  matCarrot: THREE.MeshStandardMaterial;
  matScarfRed: THREE.MeshStandardMaterial;
  // Shared 3D geometries
  geoCaneShaft: THREE.CylinderGeometry;
  geoCaneHook: THREE.TorusGeometry;
  geoMogulMain: THREE.SphereGeometry;
  geoMogulPuff: THREE.SphereGeometry;
  geoMogulSlat: THREE.BoxGeometry;
  geoStake: THREE.CylinderGeometry;
  geoBulbSmall: THREE.SphereGeometry;
  geoRockMain: THREE.DodecahedronGeometry;
  geoRockCap: THREE.SphereGeometry;
  geoSprig: THREE.ConeGeometry;
  geoSnowmanB1: THREE.SphereGeometry;
  geoSnowmanB2: THREE.SphereGeometry;
  geoSnowmanB3: THREE.SphereGeometry;
  geoCarrot: THREE.ConeGeometry;
  geoScarf: THREE.TorusGeometry;
  geoMug: THREE.CylinderGeometry;
  geoMugRing: THREE.TorusGeometry;
  geoLodgePost: THREE.CylinderGeometry;
  geoLodgeBeam: THREE.BoxGeometry;
  geoLodgeLantern: THREE.SphereGeometry;
  geoFlagPole: THREE.CylinderGeometry;
  geoFlagPennant: THREE.ConeGeometry;
}

function makeRadialDiscTexture(
  innerColor: string,
  midColor: string,
  outerColor: string,
  size = 128
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.45, midColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCandyStripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff9f5';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#d91e36';
  for (let y = -64; y < 192; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(64, y + 32);
    ctx.lineTo(64, y + 46);
    ctx.lineTo(0, y + 14);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function texAspect(t: THREE.Texture): number {
  const img = t.image as HTMLImageElement | undefined;
  return img && img.height ? img.width / img.height : 1;
}

export async function loadSharedPools(): Promise<SharedPools> {
  const loader = new THREE.TextureLoader();
  const loadTex = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 4;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.magFilter = THREE.LinearFilter;
          resolve(t);
        },
        undefined,
        reject
      );
    });

  const [
    skier,
    skierStraight,
    skierHardCarve,
    skierBoost,
    yeti,
    pineTree,
    chalet,
    dog,
    snowboarder,
    skiLift,
  ] = await Promise.all([
    loadTex('/assets/skier.png'),
    loadTex('/assets/skier_straight.png'),
    loadTex('/assets/skier_hard_carve.png'),
    loadTex('/assets/skier_boost.png'),
    loadTex('/assets/yeti.png'),
    loadTex('/assets/pine_tree.png'),
    loadTex('/assets/chalet.png'),
    loadTex('/assets/dog.png'),
    loadTex('/assets/snowboarder.png'),
    loadTex('/assets/ski_lift.png'),
  ]);

  const tex: DioramaTextures = {
    skier,
    skierStraight,
    skierHardCarve,
    skierBoost,
    yeti,
    pineTree,
    chalet,
    dog,
    snowboarder,
    skiLift,
    shadowDisc: makeRadialDiscTexture(
      'rgba(18, 42, 86, 0.50)',
      'rgba(24, 52, 102, 0.24)',
      'rgba(24, 52, 102, 0.0)'
    ),
    warmGlowDisc: makeRadialDiscTexture(
      'rgba(255, 198, 92, 0.56)',
      'rgba(255, 148, 46, 0.22)',
      'rgba(255, 130, 30, 0.0)'
    ),
    cyanGlowDisc: makeRadialDiscTexture(
      'rgba(110, 245, 255, 0.52)',
      'rgba(48, 210, 240, 0.18)',
      'rgba(48, 210, 240, 0.0)'
    ),
    bokehDot: makeRadialDiscTexture(
      'rgba(255, 242, 194, 0.92)',
      'rgba(255, 192, 82, 0.48)',
      'rgba(255, 150, 40, 0.0)'
    ),
    snowFlake: makeRadialDiscTexture(
      'rgba(255, 255, 255, 1.0)',
      'rgba(235, 246, 255, 0.65)',
      'rgba(235, 246, 255, 0.0)',
      64
    ),
    candyStripe: makeCandyStripeTexture(),
  };

  const makeCutoutMat = (map: THREE.Texture) =>
    new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });

  const geoDecalPlane = new THREE.PlaneGeometry(2, 2);
  geoDecalPlane.rotateX(-Math.PI / 2);

  // HDR emissive bulb colors (> 1.0 in linear space) so UnrealBloomPass makes Christmas lights genuinely glow!
  const hdrGold = new THREE.Color(2.1, 1.65, 0.72);
  const hdrCyan = new THREE.Color(0.75, 2.0, 2.3);

  return {
    tex,
    geoUnitPlane: new THREE.PlaneGeometry(1, 1),
    geoDecalPlane,
    matShadowDecal: new THREE.MeshBasicMaterial({
      map: tex.shadowDisc,
      transparent: true,
      depthWrite: false,
    }),
    matWarmGlowDecal: new THREE.MeshBasicMaterial({
      map: tex.warmGlowDisc,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    matCyanGlowDecal: new THREE.MeshBasicMaterial({
      map: tex.cyanGlowDisc,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    matPine: makeCutoutMat(tex.pineTree),
    matChalet: makeCutoutMat(tex.chalet),
    matDog: makeCutoutMat(tex.dog),
    matBoarder: makeCutoutMat(tex.snowboarder),
    matSkiLift: makeCutoutMat(tex.skiLift),
    matBokeh: new THREE.MeshBasicMaterial({
      map: tex.bokehDot,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    matSnow: new THREE.MeshStandardMaterial({ color: 0xf0f6ff, roughness: 0.88 }),
    matSnowShadow: new THREE.MeshStandardMaterial({ color: 0xcbe0f7, roughness: 0.9 }),
    matWood: new THREE.MeshStandardMaterial({ color: 0x764422, roughness: 0.86 }),
    matCandy: new THREE.MeshStandardMaterial({ map: tex.candyStripe, roughness: 0.32 }),
    matStone: new THREE.MeshStandardMaterial({ color: 0x526178, roughness: 0.92 }),
    matStoneDark: new THREE.MeshStandardMaterial({ color: 0x3b485c, roughness: 0.95 }),
    matPine3D: new THREE.MeshStandardMaterial({ color: 0x1b523d, roughness: 0.88 }),
    matYellowRibbon: new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.55, 1.32, 0.38), // HDR golden-yellow slalom line!
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    matGoldRibbon: new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.65, 1.25, 0.4),
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    matHdrCyanBulb: new THREE.MeshBasicMaterial({ color: hdrCyan, toneMapped: false }),
    matHdrGoldBulb: new THREE.MeshBasicMaterial({ color: hdrGold, toneMapped: false }),
    matCocoaMug: new THREE.MeshStandardMaterial({
      color: 0xd92544,
      emissive: 0x450914,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    }),
    matCarrot: new THREE.MeshStandardMaterial({ color: 0xff701a, roughness: 0.65 }),
    matScarfRed: new THREE.MeshStandardMaterial({ color: 0xd91e36, roughness: 0.88 }),
    geoCaneShaft: new THREE.CylinderGeometry(0.16, 0.16, 2.8, 10),
    geoCaneHook: new THREE.TorusGeometry(0.4, 0.16, 8, 12, Math.PI),
    geoMogulMain: new THREE.SphereGeometry(2.05, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    geoMogulPuff: new THREE.SphereGeometry(1.0, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    geoMogulSlat: new THREE.BoxGeometry(0.28, 0.08, 2.3),
    geoStake: new THREE.CylinderGeometry(0.08, 0.09, 1.35, 8),
    geoBulbSmall: new THREE.SphereGeometry(0.14, 8, 8),
    geoRockMain: new THREE.DodecahedronGeometry(0.95, 1),
    geoRockCap: new THREE.SphereGeometry(0.88, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.48),
    geoSprig: new THREE.ConeGeometry(0.28, 0.72, 7),
    geoSnowmanB1: new THREE.SphereGeometry(0.75, 10, 10),
    geoSnowmanB2: new THREE.SphereGeometry(0.54, 10, 10),
    geoSnowmanB3: new THREE.SphereGeometry(0.38, 10, 10),
    geoCarrot: new THREE.ConeGeometry(0.09, 0.46, 6),
    geoScarf: new THREE.TorusGeometry(0.36, 0.09, 7, 12),
    geoMug: new THREE.CylinderGeometry(0.46, 0.38, 0.8, 12),
    geoMugRing: new THREE.TorusGeometry(0.72, 0.06, 6, 16),
    geoLodgePost: new THREE.CylinderGeometry(0.36, 0.42, 6.6, 8),
    geoLodgeBeam: new THREE.BoxGeometry(19.6, 0.72, 0.68),
    geoLodgeLantern: new THREE.SphereGeometry(0.38, 8, 8),
    geoFlagPole: new THREE.CylinderGeometry(0.12, 0.14, 4.4, 8),
    geoFlagPennant: new THREE.ConeGeometry(0.62, 1.8, 3),
  };
}

function addPooledDecal(
  parent: THREE.Object3D,
  geo: THREE.PlaneGeometry,
  mat: THREE.MeshBasicMaterial,
  rx: number,
  rz: number,
  yOffset = 0.04
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(rx, 1, rz);
  m.position.y = yOffset;
  parent.add(m);
  return m;
}

function createPooledCard(
  pools: SharedPools,
  mat: THREE.MeshBasicMaterial,
  aspect: number,
  height: number,
  tiltX = -0.15
): THREE.Mesh {
  const card = new THREE.Mesh(pools.geoUnitPlane, mat);
  card.scale.set(height * aspect, height, 1);
  card.position.y = height * 0.5 - 0.06;
  card.rotation.x = tiltX;
  return card;
}

export type SkierPose = 'straight' | 'carve' | 'hard_carve' | 'boost';

export interface DioramaSkier {
  root: THREE.Group;
  visual: THREE.Group;
  card: THREE.Mesh;
  uniforms: SkierPuppetUniforms;
  setPose: (pose: SkierPose) => void;
  shadow: THREE.Mesh;
  shieldRing: THREE.Group;
  gliderWings: THREE.Group;
  pyroGlow: THREE.Mesh;
}

export function createDioramaSkier(pools: SharedPools): DioramaSkier {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  const height = 4.35;
  const poseMap: Record<SkierPose, THREE.Texture> = {
    straight: pools.tex.skierStraight,
    carve: pools.tex.skier,
    hard_carve: pools.tex.skierHardCarve,
    boost: pools.tex.skierBoost,
  };

  const { material, uniforms } = createSkierPuppetMaterial(pools.tex.skierStraight);
  const geo = new THREE.PlaneGeometry(height, height, 16, 16);
  const card = new THREE.Mesh(geo, material);
  card.position.y = height * 0.5 - 0.08;
  card.rotation.x = -0.16;
  visual.add(card);

  let currentPose: SkierPose | null = null;
  const setPose = (pose: SkierPose) => {
    if (pose === currentPose) return;
    currentPose = pose;
    const t = poseMap[pose];
    uniforms.uMap.value = t;
    card.scale.x = texAspect(t);
  };
  setPose('straight');

  const shadow = addPooledDecal(root, pools.geoDecalPlane, pools.matShadowDecal, 1.55, 1.0, 0.04);

  const shieldRing = new THREE.Group();
  shieldRing.position.set(0, 1.5, 0);
  shieldRing.visible = false;
  const shieldMats = [
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.35, 0.5), toneMapped: false }),
    pools.matHdrGoldBulb,
    pools.matHdrCyanBulb,
  ];
  const orbGeo = new THREE.SphereGeometry(0.19, 10, 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const orb = new THREE.Mesh(orbGeo, shieldMats[i % 3]);
    orb.position.set(Math.cos(a) * 1.55, Math.sin(a * 2) * 0.2, Math.sin(a) * 1.55);
    shieldRing.add(orb);
  }
  root.add(shieldRing);

  const gliderWings = new THREE.Group();
  gliderWings.position.set(0, 2.2, -0.2);
  gliderWings.visible = false;
  const wingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 1.8, 1.45),
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const wingGeo = new THREE.PlaneGeometry(2.6, 0.95);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(side * 1.5, 0.15, 0);
    wing.rotation.z = side * 0.28;
    gliderWings.add(wing);
  }
  visual.add(gliderWings);

  const pyroGlow = addPooledDecal(root, pools.geoDecalPlane, pools.matWarmGlowDecal, 2.2, 2.2, 0.05);
  pyroGlow.visible = false;

  return { root, visual, card, uniforms, setPose, shadow, shieldRing, gliderWings, pyroGlow };
}

export interface DioramaYeti {
  root: THREE.Group;
  card: THREE.Mesh;
  uniforms: YetiPuppetUniforms;
}

export function createDioramaYeti(pools: SharedPools): DioramaYeti {
  const root = new THREE.Group();
  const height = 7.6;
  const aspect = texAspect(pools.tex.yeti);

  const { material, uniforms } = createYetiPuppetMaterial(pools.tex.yeti);
  const geo = new THREE.PlaneGeometry(height * aspect, height, 16, 16);
  const card = new THREE.Mesh(geo, material);
  card.position.y = height * 0.5 - 0.08;
  card.rotation.x = -0.14;
  root.add(card);

  addPooledDecal(root, pools.geoDecalPlane, pools.matShadowDecal, 3.2, 1.8, 0.04);
  addPooledDecal(root, pools.geoDecalPlane, pools.matWarmGlowDecal, 4.2, 3.6, 0.05);
  addPooledDecal(root, pools.geoDecalPlane, pools.matCyanGlowDecal, 3.4, 3.0, 0.06);
  return { root, card, uniforms };
}

export interface DioramaPine {
  root: THREE.Group;
  warmGlow: THREE.Mesh;
  emberHalo: THREE.Mesh;
  ignited: boolean;
}

export function createDioramaPine(pools: SharedPools, scale = 1.0): DioramaPine {
  const root = new THREE.Group();
  const h = 5.6 * scale;
  const card = createPooledCard(pools, pools.matPine, texAspect(pools.tex.pineTree), h, -0.15);
  if (Math.random() < 0.5) card.scale.x *= -1;
  root.add(card);

  addPooledDecal(root, pools.geoDecalPlane, pools.matShadowDecal, 2.2 * scale, 1.3 * scale, 0.04);
  const warmGlow = addPooledDecal(
    root,
    pools.geoDecalPlane,
    pools.matWarmGlowDecal,
    3.1 * scale,
    2.5 * scale,
    0.05
  );

  const emberHalo = new THREE.Mesh(pools.geoUnitPlane, pools.matWarmGlowDecal);
  emberHalo.scale.set(4.6 * scale, 5.2 * scale, 1);
  emberHalo.position.set(0, h * 0.45, 0.25);
  emberHalo.visible = false;
  root.add(emberHalo);

  return { root, warmGlow, emberHalo, ignited: false };
}

export function createDioramaChalet(pools: SharedPools, scale = 1.0, flip = false): THREE.Group {
  const root = new THREE.Group();
  const card = createPooledCard(pools, pools.matChalet, texAspect(pools.tex.chalet), 7.2 * scale, -0.14);
  if (flip) card.scale.x *= -1;
  root.add(card);
  addPooledDecal(root, pools.geoDecalPlane, pools.matShadowDecal, 4.2 * scale, 2.4 * scale, 0.04);
  addPooledDecal(root, pools.geoDecalPlane, pools.matWarmGlowDecal, 6.4 * scale, 4.8 * scale, 0.055);
  return root;
}

export function createDioramaDog(pools: SharedPools): { root: THREE.Group; card: THREE.Mesh } {
  const root = new THREE.Group();
  const card = createPooledCard(pools, pools.matDog, texAspect(pools.tex.dog), 2.15, -0.16);
  root.add(card);
  addPooledDecal(root, pools.geoDecalPlane, pools.matShadowDecal, 1.0, 0.6, 0.04);
  return { root, card };
}

export function createDioramaBoarder(pools: SharedPools): { root: THREE.Group; card: THREE.Mesh } {
  const root = new THREE.Group();
  const card = createPooledCard(pools, pools.matBoarder, texAspect(pools.tex.snowboarder), 3.1, -0.16);
  root.add(card);
  addPooledDecal(root, pools.geoDecalPlane, pools.matShadowDecal, 1.15, 0.72, 0.04);
  return { root, card };
}

export function createDioramaSkiLift(pools: SharedPools): THREE.Group {
  const root = new THREE.Group();
  const card = createPooledCard(pools, pools.matSkiLift, texAspect(pools.tex.skiLift), 4.5, 0);
  card.position.y = -2.25;
  root.add(card);
  return root;
}

export function createForegroundBokehFrame(pools: SharedPools): {
  group: THREE.Group;
  leftSide: THREE.Group;
  rightSide: THREE.Group;
} {
  const group = new THREE.Group();
  const buildSide = (side: -1 | 1) => {
    const s = new THREE.Group();
    const card = createPooledCard(pools, pools.matPine, texAspect(pools.tex.pineTree), 7.6, 0);
    if (side === 1) card.scale.x *= -1;
    card.position.set(0, 0, -10.5);
    s.add(card);

    const spots = [
      [-0.6, -1.6],
      [0.3, -0.8],
      [-0.8, 0.2],
      [0.2, 1.1],
      [-0.4, 2.0],
    ];
    for (const [ox, oy] of spots) {
      const size = 0.8 + Math.random() * 0.6;
      const orb = new THREE.Mesh(pools.geoUnitPlane, pools.matBokeh);
      orb.scale.set(size, size, 1);
      orb.position.set(ox * side, oy, -10.0);
      s.add(orb);
    }
    return s;
  };

  const leftSide = buildSide(-1);
  const rightSide = buildSide(1);
  leftSide.position.set(-6.8, -2.1, 0);
  rightSide.position.set(6.8, -2.1, 0);
  group.add(leftSide, rightSide);
  return { group, leftSide, rightSide };
}

export function createCandyCaneGate(pools: SharedPools, width = 6.6): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const cane = new THREE.Group();
    const shaft = new THREE.Mesh(pools.geoCaneShaft, pools.matCandy);
    shaft.position.y = 1.4;
    cane.add(shaft);
    const hook = new THREE.Mesh(pools.geoCaneHook, pools.matCandy);
    hook.position.set(side * -0.4, 2.8, 0);
    cane.add(hook);
    cane.position.x = side * (width * 0.5);
    g.add(cane);
  }

  const yellowLine = new THREE.Mesh(pools.geoUnitPlane, pools.matYellowRibbon);
  yellowLine.rotation.x = -Math.PI / 2;
  yellowLine.scale.set(width - 0.3, 0.48, 1);
  yellowLine.position.y = 0.07;
  g.add(yellowLine);

  addPooledDecal(g, pools.geoDecalPlane, pools.matWarmGlowDecal, width * 0.5, 1.15, 0.045);
  return g;
}

export function createMogulRamp(pools: SharedPools): THREE.Group {
  const g = new THREE.Group();
  const mainDrift = new THREE.Mesh(pools.geoMogulMain, pools.matSnow);
  mainDrift.scale.set(1.3, 0.44, 1.45);
  g.add(mainDrift);

  for (const [ox, oz, s] of [
    [-1.4, 0.45, 0.85],
    [1.4, 0.35, 0.8],
    [0.0, -0.9, 0.9],
  ]) {
    const puff = new THREE.Mesh(pools.geoMogulPuff, pools.matSnowShadow);
    puff.scale.set(1.2 * s, 0.42 * s, 1.1 * s);
    puff.position.set(ox, 0, oz);
    g.add(puff);
  }

  for (const ox of [-0.9, 0, 0.9]) {
    const slat = new THREE.Mesh(pools.geoMogulSlat, pools.matWood);
    slat.position.set(ox, 0.52, 0.2);
    slat.rotation.x = 0.24;
    g.add(slat);
  }

  for (const sx of [-1.85, 1.85]) {
    const stake = new THREE.Mesh(pools.geoStake, pools.matCandy);
    stake.position.set(sx, 0.65, 0.65);
    g.add(stake);
    const bulb = new THREE.Mesh(pools.geoBulbSmall, pools.matHdrCyanBulb);
    bulb.position.set(sx, 1.38, 0.65);
    g.add(bulb);
  }

  addPooledDecal(g, pools.geoDecalPlane, pools.matCyanGlowDecal, 2.7, 2.7, 0.05);
  return g;
}

export function createSnowRock(pools: SharedPools): THREE.Group {
  const g = new THREE.Group();
  const stones = [
    { x: 0, y: 0.52, z: 0, sx: 1.22, sy: 0.8, sz: 1.0, m: pools.matStone },
    { x: -0.76, y: 0.34, z: 0.3, sx: 0.62, sy: 0.48, sz: 0.58, m: pools.matStoneDark },
    { x: 0.74, y: 0.32, z: -0.22, sx: 0.58, sy: 0.45, sz: 0.55, m: pools.matStoneDark },
  ];
  for (const s of stones) {
    const rock = new THREE.Mesh(pools.geoRockMain, s.m);
    rock.scale.set(s.sx, s.sy, s.sz);
    rock.position.set(s.x, s.y, s.z);
    rock.rotation.set(s.x * 0.5, s.z * 1.4, 0.2);
    g.add(rock);

    const cap = new THREE.Mesh(pools.geoRockCap, pools.matSnow);
    cap.scale.set(s.sx * 1.04, s.sy * 0.62, s.sz * 1.04);
    cap.position.set(s.x, s.y + s.sy * 0.56, s.z);
    g.add(cap);
  }

  const sprig = new THREE.Mesh(pools.geoSprig, pools.matPine3D);
  sprig.position.set(-0.92, 0.42, 0.52);
  sprig.rotation.z = 0.22;
  g.add(sprig);

  addPooledDecal(g, pools.geoDecalPlane, pools.matShadowDecal, 1.7, 1.2, 0.04);
  return g;
}

export function createDecoySnowman(pools: SharedPools): THREE.Group {
  const g = new THREE.Group();
  const b1 = new THREE.Mesh(pools.geoSnowmanB1, pools.matSnow);
  b1.position.y = 0.68;
  const b2 = new THREE.Mesh(pools.geoSnowmanB2, pools.matSnow);
  b2.position.y = 1.65;
  const b3 = new THREE.Mesh(pools.geoSnowmanB3, pools.matSnow);
  b3.position.y = 2.38;
  const nose = new THREE.Mesh(pools.geoCarrot, pools.matCarrot);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.38, 0.45);
  const scarf = new THREE.Mesh(pools.geoScarf, pools.matScarfRed);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 2.04;
  g.add(b1, b2, b3, nose, scarf);
  addPooledDecal(g, pools.geoDecalPlane, pools.matShadowDecal, 1.2, 0.8, 0.04);
  addPooledDecal(g, pools.geoDecalPlane, pools.matWarmGlowDecal, 1.9, 1.9, 0.05);
  return g;
}

export function createCocoaPickup(pools: SharedPools): THREE.Group {
  const g = new THREE.Group();
  const mug = new THREE.Mesh(pools.geoMug, pools.matCocoaMug);
  mug.position.y = 1.0;
  const ring = new THREE.Mesh(pools.geoMugRing, pools.matHdrGoldBulb);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.0;
  g.add(mug, ring);
  addPooledDecal(g, pools.geoDecalPlane, pools.matWarmGlowDecal, 1.8, 1.8, 0.05);
  return g;
}

export function createLodgeArch(pools: SharedPools, width = 18): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(pools.geoLodgePost, pools.matWood);
    post.position.set(side * (width * 0.5), 3.3, 0);
    g.add(post);

    const lantern = new THREE.Mesh(pools.geoLodgeLantern, pools.matHdrGoldBulb);
    lantern.position.set(side * (width * 0.5), 6.8, 0);
    g.add(lantern);
  }
  const beam = new THREE.Mesh(pools.geoLodgeBeam, pools.matWood);
  beam.position.set(0, 6.1, 0);
  g.add(beam);

  for (let i = -8; i <= 8; i++) {
    const x = (i / 8) * (width * 0.48);
    const bulb = new THREE.Mesh(pools.geoBulbSmall, pools.matHdrGoldBulb);
    bulb.position.set(x, 5.6 + Math.cos(i * 0.4) * 0.16, 0.4);
    g.add(bulb);
  }

  addPooledDecal(g, pools.geoDecalPlane, pools.matWarmGlowDecal, width * 0.52, 2.5, 0.05);
  return g;
}

export function createBestFlag(pools: SharedPools): THREE.Group {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(pools.geoFlagPole, pools.matWood);
    pole.position.set(side * 8.5, 2.2, 0);
    g.add(pole);

    const pennant = new THREE.Mesh(pools.geoFlagPennant, pools.matHdrGoldBulb);
    pennant.rotation.z = side * -Math.PI * 0.5;
    pennant.position.set(side * 7.6, 3.85, 0);
    g.add(pennant);
  }

  const line = new THREE.Mesh(pools.geoUnitPlane, pools.matGoldRibbon);
  line.rotation.x = -Math.PI / 2;
  line.scale.set(17, 0.42, 1);
  line.position.y = 0.07;
  g.add(line);

  addPooledDecal(g, pools.geoDecalPlane, pools.matWarmGlowDecal, 8.8, 1.5, 0.05);
  return g;
}

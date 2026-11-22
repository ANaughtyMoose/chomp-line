import * as THREE from 'three';
import {
  createSkierPuppetMaterial,
  createYetiPuppetMaterial,
  SkierPuppetUniforms,
  YetiPuppetUniforms,
} from './puppetShader';

/**
 * HD-2D Stop-Motion Diorama Asset Library!
 * Loads our handcrafted Rankin/Bass-style miniature transparent PNG cutouts
 * and mounts them as lit 3D diorama standees with grounded sapphire contact shadows,
 * warm golden light-pools on the snow, real-time articulated puppet vertex shaders,
 * and sculptural interactive 3D props.
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

export async function loadDioramaTextures(): Promise<DioramaTextures> {
  const loader = new THREE.TextureLoader();
  const loadTex = (url: string) =>
    new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          resolve(tex);
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

  return {
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
      'rgba(18, 42, 86, 0.56)',
      'rgba(24, 52, 102, 0.28)',
      'rgba(24, 52, 102, 0.0)'
    ),
    warmGlowDisc: makeRadialDiscTexture(
      'rgba(255, 198, 92, 0.72)',
      'rgba(255, 148, 46, 0.30)',
      'rgba(255, 130, 30, 0.0)'
    ),
    cyanGlowDisc: makeRadialDiscTexture(
      'rgba(110, 245, 255, 0.65)',
      'rgba(48, 210, 240, 0.22)',
      'rgba(48, 210, 240, 0.0)'
    ),
    bokehDot: makeRadialDiscTexture(
      'rgba(255, 242, 194, 0.95)',
      'rgba(255, 192, 82, 0.55)',
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
}

/**
 * Helper to build an upright HD-2D cutout card that preserves the PNG's exact aspect ratio,
 * sits crisply on y=0, and includes a grounded sapphire contact shadow.
 */
function createCutoutCard(
  tex: THREE.Texture,
  height: number,
  options?: {
    shadowWidth?: number;
    warmGlowRadius?: number;
    cyanGlowRadius?: number;
    emissiveBoost?: number;
    tiltX?: number;
  }
): { group: THREE.Group; card: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  const img = tex.image as HTMLImageElement | undefined;
  const aspect = img && img.height ? img.width / img.height : 1;
  const width = height * aspect;

  // MeshBasicMaterial keeps the handcrafted stop-motion lighting & painterly colors 100% rich and true!
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    color: new THREE.Color(1, 1, 1).multiplyScalar(options?.emissiveBoost ?? 1.02),
  });

  const geo = new THREE.PlaneGeometry(width, height);
  const card = new THREE.Mesh(geo, mat);
  card.position.y = height * 0.5 - 0.08;
  card.rotation.x = options?.tiltX ?? -0.18; // Subtle tilt toward camera for lush diorama angle
  group.add(card);

  return { group, card, mat };
}

export function addGroundDecal(
  parent: THREE.Object3D,
  tex: THREE.Texture,
  radiusX: number,
  radiusZ: number,
  yOffset = 0.04,
  additive = false
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = yOffset;
  parent.add(mesh);
  return mesh;
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

export function createDioramaSkier(tex: DioramaTextures): DioramaSkier {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  const height = 4.35;
  const poseMap: Record<SkierPose, THREE.Texture> = {
    straight: tex.skierStraight,
    carve: tex.skier,
    hard_carve: tex.skierHardCarve,
    boost: tex.skierBoost,
  };

  const { material, uniforms } = createSkierPuppetMaterial(tex.skierStraight);
  // 18x18 subdivided plane enables silky real-time scarf flutter, knee-pump, carve lean & squash/stretch!
  const geo = new THREE.PlaneGeometry(height, height, 18, 18);
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
    const img = t.image as HTMLImageElement | undefined;
    const aspect = img && img.height ? img.width / img.height : 0.8;
    card.scale.x = aspect;
  };
  setPose('straight');

  const shadow = addGroundDecal(root, tex.shadowDisc, 1.55, 1.0, 0.04, false);

  // Orbiting Heirloom Glass Bauble Ward
  const shieldRing = new THREE.Group();
  shieldRing.position.set(0, 1.5, 0);
  shieldRing.visible = false;
  const cols = [0xff3b58, 0xffd466, 0x4df2e6];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 10, 10),
      new THREE.MeshBasicMaterial({ color: cols[i % 3] })
    );
    orb.position.set(Math.cos(a) * 1.55, Math.sin(a * 2) * 0.2, Math.sin(a) * 1.55);
    shieldRing.add(orb);
  }
  root.add(shieldRing);

  // Shimmering Emerald Aurora Glider Wings (visible when gliding!)
  const gliderWings = new THREE.Group();
  gliderWings.position.set(0, 2.2, -0.2);
  gliderWings.visible = false;
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0x55f5cb,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.95), wingMat);
    wing.position.set(side * 1.5, 0.15, 0);
    wing.rotation.z = side * 0.28;
    gliderWings.add(wing);
  }
  visual.add(gliderWings);

  // Warm Pyro Carver snow glow beneath skis
  const pyroGlow = addGroundDecal(root, tex.warmGlowDisc, 2.2, 2.2, 0.05, true);
  pyroGlow.visible = false;

  return { root, visual, card, uniforms, setPose, shadow, shieldRing, gliderWings, pyroGlow };
}

export interface DioramaYeti {
  root: THREE.Group;
  card: THREE.Mesh;
  uniforms: YetiPuppetUniforms;
  warmGlow: THREE.Mesh;
  cyanGlow: THREE.Mesh;
}

export function createDioramaYeti(tex: DioramaTextures): DioramaYeti {
  const root = new THREE.Group();
  const height = 7.6;
  const img = tex.yeti.image as HTMLImageElement | undefined;
  const aspect = img && img.height ? img.width / img.height : 0.84;

  const { material, uniforms } = createYetiPuppetMaterial(tex.yeti);
  const geo = new THREE.PlaneGeometry(height * aspect, height, 18, 18);
  const card = new THREE.Mesh(geo, material);
  card.position.y = height * 0.5 - 0.08;
  card.rotation.x = -0.14;
  root.add(card);

  addGroundDecal(root, tex.shadowDisc, 3.2, 1.8, 0.04, false);
  const warmGlow = addGroundDecal(root, tex.warmGlowDisc, 4.4, 3.8, 0.05, true);
  const cyanGlow = addGroundDecal(root, tex.cyanGlowDisc, 3.6, 3.2, 0.06, true);
  return { root, card, uniforms, warmGlow, cyanGlow };
}

export interface DioramaPine {
  root: THREE.Group;
  normalCard: THREE.Mesh;
  warmGlow: THREE.Mesh;
  emberHalo: THREE.Mesh;
  ignited: boolean;
}

export function createDioramaPine(
  tex: DioramaTextures,
  scale = 1.0
): DioramaPine {
  const root = new THREE.Group();
  const h = 5.6 * scale;

  const normal = createCutoutCard(tex.pineTree, h, { emissiveBoost: 1.05, tiltX: -0.15 });
  if (Math.random() < 0.5) {
    normal.card.scale.x = -1;
  }
  root.add(normal.group);

  addGroundDecal(root, tex.shadowDisc, 2.2 * scale, 1.3 * scale, 0.04, false);

  // Subtle cozy warm fairy-light snow pool around every Christmas pine
  const warmGlow = addGroundDecal(root, tex.warmGlowDisc, 3.2 * scale, 2.6 * scale, 0.05, true);

  // Soft upright flickering volumetric-style warm firelight glow (only visible if ignited by Pyro Carver!)
  const emberMat = new THREE.MeshBasicMaterial({
    map: tex.warmGlowDisc,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const emberHalo = new THREE.Mesh(new THREE.PlaneGeometry(4.6 * scale, 5.2 * scale), emberMat);
  emberHalo.position.set(0, h * 0.45, 0.25);
  emberHalo.visible = false;
  root.add(emberHalo);

  return {
    root,
    normalCard: normal.card,
    warmGlow,
    emberHalo,
    ignited: false,
  };
}

export function createDioramaChalet(tex: DioramaTextures, scale = 1.0, flip = false): THREE.Group {
  const root = new THREE.Group();
  const { group, card } = createCutoutCard(tex.chalet, 7.2 * scale, {
    emissiveBoost: 1.12,
    tiltX: -0.14,
  });
  if (flip) card.scale.x = -1;
  root.add(group);
  addGroundDecal(root, tex.shadowDisc, 4.2 * scale, 2.4 * scale, 0.04, false);
  // Warm golden chalet hearth light pool glowing on the snow!
  addGroundDecal(root, tex.warmGlowDisc, 6.8 * scale, 5.2 * scale, 0.055, true);
  return root;
}

export function createDioramaDog(tex: DioramaTextures): { root: THREE.Group; card: THREE.Mesh } {
  const root = new THREE.Group();
  const { group, card } = createCutoutCard(tex.dog, 2.15, { emissiveBoost: 1.04, tiltX: -0.16 });
  root.add(group);
  addGroundDecal(root, tex.shadowDisc, 1.0, 0.6, 0.04, false);
  return { root, card };
}

export function createDioramaBoarder(tex: DioramaTextures): { root: THREE.Group; card: THREE.Mesh } {
  const root = new THREE.Group();
  const { group, card } = createCutoutCard(tex.snowboarder, 3.1, {
    emissiveBoost: 1.08,
    tiltX: -0.16,
  });
  root.add(group);
  addGroundDecal(root, tex.shadowDisc, 1.15, 0.72, 0.04, false);
  return { root, card };
}

export function createDioramaSkiLift(tex: DioramaTextures): THREE.Group {
  const root = new THREE.Group();
  const { group, card } = createCutoutCard(tex.skiLift, 4.5, { emissiveBoost: 1.1, tiltX: 0 });
  // Hang downward from top of hanger arm!
  card.position.y = -2.25;
  root.add(group);
  return root;
}

/**
 * Lush Blurred Foreground Christmas Pine + Glowing Bokeh Fairy-Light Framing
 * (Directly replicates the magical snow-globe foreground framing of our concept art!)
 */
export function createForegroundBokehFrame(tex: DioramaTextures): THREE.Group {
  const frame = new THREE.Group();

  for (const side of [-1, 1]) {
    // Out-of-focus foreground snow-pine corner framing (visible cleanly in bottom corners!)
    const { group, card } = createCutoutCard(tex.pineTree, 7.6, {
      emissiveBoost: 0.94,
      tiltX: 0,
    });
    if (side === 1) card.scale.x = -1;
    group.position.set(side * 6.8, -5.8, -10.5);
    frame.add(group);

    // Creamy warm golden bokeh fairy-light orbs floating across the corner boughs!
    const bokehSpots = [
      [-0.6, 1.5],
      [0.3, 2.4],
      [-0.9, 3.2],
      [0.2, 4.1],
      [-0.4, 5.0],
    ];
    for (const [ox, oy] of bokehSpots) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex.bokehDot,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const size = 0.85 + Math.random() * 0.65;
      const orb = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      orb.position.set(side * (6.2 + ox * side), -5.3 + oy, -10.0);
      frame.add(orb);
    }
  }
  return frame;
}

/**
 * Interactive 3D Props: Candy-Cane Gates, Grindable Festive Rails, Frozen Ice Ponds,
 * Moguls, Snow Rocks, Decoy Snowmen, Hot Cocoa Mugs & Alpine Lodge Arches
 */
export function createCandyCaneGate(tex: DioramaTextures, width = 6.6): THREE.Group {
  const g = new THREE.Group();
  const matCandy = new THREE.MeshStandardMaterial({
    map: tex.candyStripe,
    roughness: 0.25,
    metalness: 0.08,
  });

  for (const side of [-1, 1]) {
    const cane = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.8, 10), matCandy);
    shaft.position.y = 1.4;
    cane.add(shaft);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.16, 8, 12, Math.PI), matCandy);
    hook.position.set(side * -0.4, 2.8, 0);
    cane.add(hook);
    cane.position.x = side * (width * 0.5);
    g.add(cane);
  }

  // Crisp glowing golden-yellow slalom ribbon stretched cleanly between the two candy canes!
  const yellowLine = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.3, 0.5),
    new THREE.MeshBasicMaterial({
      color: 0xffe45e,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    })
  );
  yellowLine.rotation.x = -Math.PI / 2;
  yellowLine.position.y = 0.08;
  g.add(yellowLine);

  addGroundDecal(g, tex.warmGlowDisc, width * 0.52, 1.2, 0.045, true);
  return g;
}

/**
 * Handcrafted Snow-Jump Mogul Ramp:
 * Layered pillowy snowdrifts with vintage Alpine wooden ramp slats,
 * striped launch poles, and an icy-cyan jump glint so it feels cozy & unmistakably jumpable!
 */
export function createMogulRamp(tex: DioramaTextures): THREE.Group {
  const g = new THREE.Group();
  const matSnow = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.86 });
  const matSnowShadow = new THREE.MeshStandardMaterial({ color: 0xd4e5f9, roughness: 0.88 });
  const matWood = new THREE.MeshStandardMaterial({ color: 0x7a4824, roughness: 0.85 });
  const matCandy = new THREE.MeshStandardMaterial({ map: tex.candyStripe, roughness: 0.3 });

  // Multi-clump sculpted snowdrift mound
  const mainDrift = new THREE.Mesh(
    new THREE.SphereGeometry(2.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    matSnow
  );
  mainDrift.scale.set(1.3, 0.44, 1.45);
  g.add(mainDrift);

  for (const [ox, oz, s] of [
    [-1.4, 0.45, 0.72],
    [1.4, 0.35, 0.68],
    [0.0, -0.9, 0.78],
  ]) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1.15 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      matSnowShadow
    );
    puff.scale.set(1.2, 0.42, 1.1);
    puff.position.set(ox, 0, oz);
    g.add(puff);
  }

  // Vintage wooden Alpine jump slats embedded along the crest
  for (const ox of [-0.9, 0, 0.9]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 2.3), matWood);
    slat.position.set(ox, 0.52, 0.2);
    slat.rotation.x = 0.24;
    g.add(slat);
  }

  // Twin mini striped jump-marker stakes framing the kicker
  for (const sx of [-1.85, 1.85]) {
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.35, 8), matCandy);
    stake.position.set(sx, 0.65, 0.65);
    g.add(stake);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7ef7ff })
    );
    bulb.position.set(sx, 1.38, 0.65);
    g.add(bulb);
  }

  addGroundDecal(g, tex.cyanGlowDisc, 2.8, 2.8, 0.05, true);
  return g;
}

/**
 * Handcrafted Frosted Alpine Boulder Cluster:
 * Multi-stone organic rock cluster topped with pillowy snow caps and a tiny snow-dusted pine sprig.
 */
export function createSnowRock(tex: DioramaTextures): THREE.Group {
  const g = new THREE.Group();
  const matStone = new THREE.MeshStandardMaterial({ color: 0x526178, roughness: 0.92 });
  const matStoneDark = new THREE.MeshStandardMaterial({ color: 0x3b485c, roughness: 0.95 });
  const matSnow = new THREE.MeshStandardMaterial({ color: 0xf2f8ff, roughness: 0.85 });
  const matPine = new THREE.MeshStandardMaterial({ color: 0x1b523d, roughness: 0.88 });

  // Clustered irregular stones (never a single bare polygon!)
  const stones = [
    { x: 0, y: 0.52, z: 0, sx: 1.25, sy: 0.82, sz: 1.0, r: 0.95, m: matStone },
    { x: -0.78, y: 0.34, z: 0.32, sx: 0.9, sy: 0.65, sz: 0.85, r: 0.62, m: matStoneDark },
    { x: 0.76, y: 0.32, z: -0.22, sx: 0.85, sy: 0.6, sz: 0.82, r: 0.58, m: matStoneDark },
  ];
  for (const s of stones) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s.r, 1), s.m);
    rock.scale.set(s.sx, s.sy, s.sz);
    rock.position.set(s.x, s.y, s.z);
    rock.rotation.set(s.x * 0.5, s.z * 1.4, 0.2);
    g.add(rock);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(s.r * 0.92, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.48),
      matSnow
    );
    cap.scale.set(s.sx * 0.95, s.sy * 0.55, s.sz * 0.95);
    cap.position.set(s.x, s.y + s.r * s.sy * 0.38, s.z);
    g.add(cap);
  }

  // Tiny cozy evergreen tuft peeking beside the boulder
  const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 7), matPine);
  sprig.position.set(-0.95, 0.42, 0.55);
  sprig.rotation.z = 0.22;
  g.add(sprig);

  addGroundDecal(g, tex.shadowDisc, 1.8, 1.25, 0.04, false);
  return g;
}

/**
 * Festive Personal-Best Record Flag planted in the snow at your previous Best Run!
 */
export function createBestFlag(tex: DioramaTextures): THREE.Group {
  const g = new THREE.Group();
  const matWood = new THREE.MeshStandardMaterial({ color: 0x7c4824, roughness: 0.84 });
  const matFlag = new THREE.MeshBasicMaterial({ color: 0xffcf54, side: THREE.DoubleSide });

  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.4, 8), matWood);
    pole.position.set(side * 8.5, 2.2, 0);
    g.add(pole);

    const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.8, 3), matFlag);
    pennant.rotation.z = side * -Math.PI * 0.5;
    pennant.position.set(side * 7.6, 3.85, 0);
    g.add(pennant);
  }

  // Sparkling gold record line across the snow!
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(17, 0.42),
    new THREE.MeshBasicMaterial({
      color: 0xffd766,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.07;
  g.add(line);

  addGroundDecal(g, tex.warmGlowDisc, 8.8, 1.5, 0.05, true);
  return g;
}

export function createDecoySnowman(tex: DioramaTextures): THREE.Group {
  const g = new THREE.Group();
  const matSnow = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.85 });
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 10), matSnow);
  b1.position.y = 0.68;
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.54, 10, 10), matSnow);
  b2.position.y = 1.65;
  const b3 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), matSnow);
  b3.position.y = 2.38;
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.46, 6),
    new THREE.MeshStandardMaterial({ color: 0xff701a, roughness: 0.6 })
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.38, 0.45);
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.09, 7, 12),
    new THREE.MeshStandardMaterial({ color: 0xd91e36, roughness: 0.85 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 2.04;
  g.add(b1, b2, b3, nose, scarf);
  addGroundDecal(g, tex.shadowDisc, 1.2, 0.8, 0.04, false);
  addGroundDecal(g, tex.warmGlowDisc, 1.9, 1.9, 0.05, true);
  return g;
}

export function createCocoaPickup(tex: DioramaTextures): THREE.Group {
  const g = new THREE.Group();
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.38, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0xd92544, emissive: 0x5c0c1c, emissiveIntensity: 0.6 })
  );
  mug.position.y = 1.0;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.06, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd773 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.0;
  g.add(mug, ring);
  addGroundDecal(g, tex.warmGlowDisc, 1.8, 1.8, 0.05, true);
  return g;
}

export function createLodgeArch(tex: DioramaTextures, width = 18): THREE.Group {
  const g = new THREE.Group();
  const matWood = new THREE.MeshStandardMaterial({ color: 0x7c4824, roughness: 0.84 });
  const matBulb = new THREE.MeshBasicMaterial({ color: 0xffe494 });

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 6.6, 8), matWood);
    post.position.set(side * (width * 0.5), 3.3, 0);
    g.add(post);

    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), matBulb);
    lantern.position.set(side * (width * 0.5), 6.8, 0);
    g.add(lantern);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(width + 1.6, 0.72, 0.68), matWood);
  beam.position.set(0, 6.1, 0);
  g.add(beam);

  for (let i = -8; i <= 8; i++) {
    const x = (i / 8) * (width * 0.48);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 7), matBulb);
    bulb.position.set(x, 5.6 + Math.cos(i * 0.4) * 0.16, 0.4);
    g.add(bulb);
  }

  addGroundDecal(g, tex.warmGlowDisc, width * 0.55, 2.8, 0.05, true);
  return g;
}

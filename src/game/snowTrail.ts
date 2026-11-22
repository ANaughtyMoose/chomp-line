import * as THREE from 'three';

/**
 * High-Resolution Ring-Buffer Snow Surface Canvas (1024x1024):
 * Renders rich crystalline moonlit powder snow with sparkling micro-glitter,
 * DEEP GLOSSY SAPPHIRE-BLUE CARVED SKI TRENCHES (matching the concept art!),
 * glowing amber Pyro-Carve fire tracks, and Yeti frost-cracked footprints.
 */
export class SnowTrailSurface {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly texture: THREE.CanvasTexture;

  private readonly size = 1024;
  private readonly worldWidth: number;
  private readonly worldLength: number;
  private scrollDistance = 0;
  private lastClearedRow = 0;

  constructor(worldWidth: number, worldLength: number) {
    this.worldWidth = worldWidth;
    this.worldLength = worldLength;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not initialize 2D snow trail canvas');
    this.ctx = ctx;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.reset();
  }

  public reset(): void {
    this.scrollDistance = 0;
    this.lastClearedRow = 0;
    this.paintBaseSnowRect(0, 0, this.size, this.size);
    this.texture.offset.set(0, 0);
    this.texture.needsUpdate = true;
  }

  private paintBaseSnowRect(x: number, y: number, w: number, h: number): void {
    // Soft twilight powder snow base with gentle icy blue variation
    this.ctx.fillStyle = '#e7f1fc';
    this.ctx.fillRect(x, y, w, h);

    // Subtle soft snowdrift shading bands + sparkling diamond powder specks
    const driftCount = Math.max(1, Math.floor((w * h) / 4800));
    for (let i = 0; i < driftCount; i++) {
      const dx = x + Math.random() * w;
      const dy = y + Math.random() * h;
      this.ctx.fillStyle =
        Math.random() > 0.5 ? 'rgba(196, 218, 245, 0.24)' : 'rgba(255, 255, 255, 0.42)';
      this.ctx.beginPath();
      this.ctx.ellipse(dx, dy, 18 + Math.random() * 28, 5 + Math.random() * 7, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const sparkleCount = Math.max(3, Math.floor((w * h) / 720));
    for (let i = 0; i < sparkleCount; i++) {
      const sx = x + Math.random() * w;
      const sy = y + Math.random() * h;
      this.ctx.fillStyle =
        Math.random() > 0.45 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(150, 200, 248, 0.45)';
      this.ctx.fillRect(sx, sy, 2, 2);
    }
  }

  public advance(dz: number): void {
    if (dz <= 0) return;
    this.scrollDistance += dz;

    const pxPerMeter = this.size / this.worldLength;
    const totalRows = Math.floor(this.scrollDistance * pxPerMeter);
    const deltaRows = totalRows - this.lastClearedRow;

    if (deltaRows > 0) {
      const clearCount = Math.min(this.size, deltaRows + 3);
      for (let i = 0; i < clearCount; i++) {
        const row = (((this.lastClearedRow + i) % this.size) + this.size) % this.size;
        this.paintBaseSnowRect(0, row, this.size, 1);
      }
      this.lastClearedRow = totalRows;
    }

    this.texture.offset.y = -(this.scrollDistance / this.worldLength) % 1;
    this.texture.needsUpdate = true;
  }

  private worldToCanvas(worldX: number, worldZ: number): { cx: number; cy: number } {
    const u = (worldX + this.worldWidth * 0.5) / this.worldWidth;
    const vBase = 0.5 - worldZ / this.worldLength;
    const vTex = vBase + this.texture.offset.y;
    const vWrapped = ((vTex % 1) + 1) % 1;
    const cx = Math.max(0, Math.min(this.size - 1, u * this.size));
    const cy = Math.max(0, Math.min(this.size - 1, (1 - vWrapped) * this.size));
    return { cx, cy };
  }

  /**
   * Stamps BOLD, GLOSSY SAPPHIRE-BLUE carved twin ski trenches straight out of the concept art!
   */
  public stampSkiTracks(
    worldX: number,
    worldZ: number,
    headingAngle: number,
    flaming: boolean,
    boosting: boolean,
    carvingHard: boolean
  ): void {
    const halfStance = 0.64;
    const cos = Math.cos(headingAngle);
    const sin = Math.sin(headingAngle);

    for (const side of [-1, 1]) {
      const sx = worldX + side * halfStance * cos;
      const sz = worldZ + side * halfStance * sin * 0.35;
      const { cx, cy } = this.worldToCanvas(sx, sz);

      // Crisp twin parallel sapphire-blue glossy ski grooves with snow visible between them!
      if (flaming) {
        this.ctx.fillStyle = 'rgba(235, 96, 22, 0.85)';
      } else if (boosting) {
        this.ctx.fillStyle = 'rgba(22, 118, 212, 0.82)';
      } else {
        this.ctx.fillStyle = 'rgba(38, 108, 192, 0.72)';
      }
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, boosting || carvingHard ? 3.1 : 2.35, 0, Math.PI * 2);
      this.ctx.fill();

      // Glossy cyan-white specular sheen inside each groove
      this.ctx.fillStyle = flaming
        ? 'rgba(255, 236, 148, 0.9)'
        : 'rgba(155, 226, 255, 0.76)';
      this.ctx.beginPath();
      this.ctx.arc(cx - 0.5, cy, boosting ? 1.35 : 1.0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.texture.needsUpdate = true;
  }

  public stampYetiFootprint(worldX: number, worldZ: number, leftFoot: boolean): void {
    const { cx, cy } = this.worldToCanvas(worldX + (leftFoot ? -0.9 : 0.9), worldZ);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 13.5, 16.5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(30, 88, 168, 0.72)';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 10.5, 13.0, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(130, 232, 255, 0.55)';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 5.2, 6.8, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.texture.needsUpdate = true;
  }

  public stampBoardTrack(worldX: number, worldZ: number): void {
    const { cx, cy } = this.worldToCanvas(worldX, worldZ);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = 'rgba(42, 114, 188, 0.55)';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
    this.ctx.fill();
    this.texture.needsUpdate = true;
  }
}

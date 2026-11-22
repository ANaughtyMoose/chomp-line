/**
 * Real Recorded Royalty-Free Christmas Music + Tactile Alpine Snow SFX!
 *
 * Music Credits (CC BY 4.0 — Kevin MacLeod, incompetech.com):
 *  - Cruising: "Deck the Halls B" (peppy, joyful holiday band)
 *  - 2,000m Yeti Chase: "Jingle Bells" (fast, manic stage-production sleigh chase)
 *
 * Uses HTMLAudioElement with preservesPitch=true so playbackRate dynamically accelerates
 * smoothly with your skiing speed without chipmunking the pitch!
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private carveGain: GainNode | null = null;
  private carveFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private cruiseAudio: HTMLAudioElement;
  private chaseAudio: HTMLAudioElement;

  private musicMuted = false;
  private sfxMuted = false;
  private chaseMode = false;
  private musicActive = false;
  private targetRate = 1.0;

  constructor() {
    this.cruiseAudio = this.makeTrack('/audio/cruise_xmas.mp3', 0.36);
    this.chaseAudio = this.makeTrack('/audio/chase_xmas.mp3', 0.42);
  }

  private makeTrack(src: string, volume: number): HTMLAudioElement {
    const a = new Audio(src);
    a.loop = true;
    a.preload = 'auto';
    a.volume = volume;
    // Preserve natural musical pitch while smoothly accelerating BPM!
    const anyA = a as HTMLAudioElement & {
      preservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    anyA.preservesPitch = true;
    anyA.webkitPreservesPitch = true;
    return a;
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxMuted ? 0 : 0.52;
      this.sfxBus.connect(this.ctx.destination);
      this.initAmbientSnowAudio();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setTempoFromSpeed(speedMps: number): void {
    // Smoothly accelerate the real recorded Christmas music from 0.98x -> 1.24x as speed climbs!
    const norm = Math.max(0, Math.min(1, (speedMps - 20) / 26));
    this.targetRate = 0.98 + norm * 0.26;
    const active = this.chaseMode ? this.chaseAudio : this.cruiseAudio;
    if (Math.abs(active.playbackRate - this.targetRate) > 0.015) {
      active.playbackRate = this.targetRate;
    }
  }

  public toggleMusic(): boolean {
    this.unlock();
    this.musicMuted = !this.musicMuted;
    this.cruiseAudio.muted = this.musicMuted;
    this.chaseAudio.muted = this.musicMuted;
    if (!this.musicMuted && this.musicActive) {
      const active = this.chaseMode ? this.chaseAudio : this.cruiseAudio;
      active.play().catch(() => {});
    }
    return this.musicMuted;
  }

  public toggleSfx(): boolean {
    this.unlock();
    this.sfxMuted = !this.sfxMuted;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : 0.52, this.ctx.currentTime, 0.05);
    }
    return this.sfxMuted;
  }

  public startMusic(chase: boolean): void {
    this.musicActive = true;
    this.chaseMode = chase;
    this.cruiseAudio.muted = this.musicMuted;
    this.chaseAudio.muted = this.musicMuted;

    if (chase) {
      this.cruiseAudio.pause();
      this.chaseAudio.currentTime = 0;
      this.chaseAudio.playbackRate = this.targetRate;
      if (!this.musicMuted) this.chaseAudio.play().catch(() => {});
    } else {
      this.chaseAudio.pause();
      this.cruiseAudio.currentTime = 0;
      this.cruiseAudio.playbackRate = this.targetRate;
      if (!this.musicMuted) this.cruiseAudio.play().catch(() => {});
    }
  }

  public setChaseMode(chase: boolean): void {
    if (this.chaseMode === chase) return;
    this.chaseMode = chase;
    if (!this.musicActive) return;

    if (chase) {
      this.cruiseAudio.pause();
      this.chaseAudio.currentTime = 0;
      this.chaseAudio.playbackRate = this.targetRate;
      if (!this.musicMuted) this.chaseAudio.play().catch(() => {});
    } else {
      this.chaseAudio.pause();
      this.cruiseAudio.playbackRate = this.targetRate;
      if (!this.musicMuted) this.cruiseAudio.play().catch(() => {});
    }
  }

  public stopMusic(): void {
    this.musicActive = false;
    this.cruiseAudio.pause();
    this.chaseAudio.pause();
  }

  private initAmbientSnowAudio(): void {
    if (!this.ctx || !this.sfxBus) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.996 * b0 + w * 0.028;
      b1 = 0.984 * b1 + w * 0.032;
      b2 = 0.945 * b2 + w * 0.05;
      data[i] = (b0 + b1 + b2 + w * 0.14) * 0.58;
    }

    const carveSrc = this.ctx.createBufferSource();
    carveSrc.buffer = buffer;
    carveSrc.loop = true;
    this.carveFilter = this.ctx.createBiquadFilter();
    this.carveFilter.type = 'bandpass';
    this.carveFilter.frequency.value = 1000;
    this.carveFilter.Q.value = 1.25;
    this.carveGain = this.ctx.createGain();
    this.carveGain.gain.value = 0;
    carveSrc.connect(this.carveFilter);
    this.carveFilter.connect(this.carveGain);
    this.carveGain.connect(this.sfxBus);
    carveSrc.start();

    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = buffer;
    windSrc.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 380;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxBus);
    windSrc.start();
  }

  public updateCarve(speedNorm: number, carveAmount: number, airborne: boolean): void {
    if (!this.ctx || !this.carveGain || !this.carveFilter || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    const targetCarve = airborne
      ? 0.004
      : Math.min(0.24, 0.025 + speedNorm * 0.06 + carveAmount * 0.16);
    const targetFreq = 720 + speedNorm * 620 + carveAmount * 1150;

    this.carveGain.gain.setTargetAtTime(targetCarve, now, 0.04);
    this.carveFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);

    const targetWind = Math.min(0.14, 0.015 + speedNorm * 0.1 + (airborne ? 0.04 : 0));
    this.windGain.gain.setTargetAtTime(targetWind, now, 0.07);
    this.windFilter.frequency.setTargetAtTime(280 + speedNorm * 520, now, 0.07);
  }

  public stopCarve(): void {
    if (!this.ctx || !this.carveGain || !this.windGain) return;
    const now = this.ctx.currentTime;
    this.carveGain.gain.setTargetAtTime(0, now, 0.07);
    this.windGain.gain.setTargetAtTime(0, now, 0.09);
  }

  private playSleighBell(start: number, vol: number): void {
    if (!this.ctx || !this.sfxBus) return;
    for (const f of [3280, 4420, 5890]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(vol * 0.35, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.085);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(start);
      osc.stop(start + 0.095);
    }
  }

  private sfxTone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    start: number,
    lowpass?: number
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(this.sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  public playSlingshot(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.24);
    this.playSleighBell(now + 0.02, 0.09);
  }

  public playGateChime(combo: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const base = 587.33 * Math.pow(1.06, Math.min(combo, 10));
    this.sfxTone(base, 0.16, 'sine', 0.16, now);
    this.sfxTone(base * 1.25, 0.2, 'sine', 0.14, now + 0.045);
    this.sfxTone(base * 1.5, 0.26, 'triangle', 0.12, now + 0.09);
    this.playSleighBell(now + 0.03, 0.09);
  }

  public playJump(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.16);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playPerfectStomp(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.sfxTone(120, 0.22, 'sine', 0.24, now);
    this.sfxTone(659.25, 0.18, 'triangle', 0.16, now + 0.02);
    this.sfxTone(987.77, 0.26, 'sine', 0.16, now + 0.06);
    this.playSleighBell(now + 0.04, 0.12);
  }

  public playFireIgnite(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.sfxTone(170, 0.26, 'sawtooth', 0.14, now, 480);
    this.sfxTone(340, 0.18, 'triangle', 0.1, now + 0.04);
  }

  public playOrnamentShatter(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    [2200, 2940, 3520, 4180].forEach((f, idx) => {
      this.sfxTone(f, 0.11, 'sine', 0.08, now + idx * 0.022);
    });
  }

  public playBark(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playCrash(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.sfxTone(125, 0.24, 'sawtooth', 0.22, now, 320);
    this.sfxTone(78, 0.28, 'triangle', 0.2, now + 0.03);
  }

  public playYetiRoar(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.52);
    filt.type = 'lowpass';
    filt.frequency.value = 380;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.58);
  }

  public playYetiStomp(intensity: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.24, 0.04 + intensity * 0.19);
    this.sfxTone(68, 0.16, 'sine', vol, now);
    this.sfxTone(46, 0.2, 'triangle', vol * 0.8, now);
  }

  public playChomp(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.sfxTone(190, 0.14, 'sawtooth', 0.22, now, 520);
    this.sfxTone(115, 0.18, 'sawtooth', 0.24, now + 0.14, 420);
    this.sfxTone(82, 0.35, 'triangle', 0.22, now + 0.28);
  }

  public playUpgradePick(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.sfxTone(f, 0.22, 'triangle', 0.15, now + i * 0.05);
    });
    this.playSleighBell(now + 0.12, 0.1);
  }
}

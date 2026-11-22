/**
 * Joyful, Bright, Major-Key Public-Domain Christmas Holiday Soundtrack + Tactile Alpine SFX!
 * - Tempo dynamically ACCELERATES smoothly with your downhill skiing speed (like Mario Kart / Tetris)!
 * - Cruising Suite: Bright, festive major-key "Jingle Bells" (1857) + "Deck the Halls" (1862)
 *   arranged for sparkling glockenspiel/celesta, warm sleigh bells, bouncy pizzicato bass, and cheerful holiday chords.
 * - Yeti Chase Suite: Exhilarating Tchaikovsky "Trepak / Russian Dance" from The Nutcracker (1892, Public Domain)
 *   — super festive, high-energy major-key sleigh-chase frenzy (ZERO haunting minor-key gloom!).
 */

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// Public-Domain Bright Christmas Suite (G Major — 100% joyful, festive, bouncy!)
// Format: [melodyMidi | 0, bassMidi | 0, chordMidis[], sleighBellFlag]
type Beat = [number, number, number[], boolean];

const JOYFUL_CHRISTMAS_SCORE: Beat[] = [
  // "Jingle Bells" chorus (G Major: B4 - B4 - B4 | B4 - B4 - B4 | B4 - D5 - G4 - A4 | B4)
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [71, 50, [], true], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [0, 50, [], false], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [71, 50, [], true], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [0, 50, [], false], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [74, 50, [], true], [0, 0, [], false],
  [67, 43, [55, 59, 62], true], [0, 0, [], false], [69, 45, [], true], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [0, 50, [], true], [0, 0, [], false],
  [0, 43, [], false], [0, 0, [], false], [0, 50, [], true], [0, 0, [], false],

  // "Oh what fun it is to ride..." (C5 - C5 - C5 - C5 | C5 - B4 - B4 - B4 | B4 - A4 - A4 - B4 | A4 - D5)
  [72, 48, [55, 60, 64], true], [0, 0, [], false], [72, 43, [], true], [0, 0, [], false],
  [72, 48, [55, 60, 64], true], [0, 0, [], false], [72, 43, [], true], [0, 0, [], false],
  [72, 43, [55, 59, 62], true], [0, 0, [], false], [71, 50, [], true], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [71, 50, [], true], [71, 0, [], false],
  [71, 45, [57, 61, 64], true], [0, 0, [], false], [69, 50, [], true], [0, 0, [], false],
  [69, 45, [57, 61, 64], true], [0, 0, [], false], [71, 50, [], true], [0, 0, [], false],
  [69, 50, [54, 57, 62], true], [0, 0, [], false], [0, 45, [], true], [0, 0, [], false],
  [74, 50, [54, 57, 62], true], [0, 0, [], false], [0, 45, [], true], [0, 0, [], false],

  // "Deck the Halls" joyful bridge (D5 - C5 - B4 - A4 | G4 - A4 - B4 - G4 | A4 - B4 - C5 - A4 | B4 - A4 - G4)
  [74, 43, [55, 59, 62], true], [0, 0, [], false], [72, 50, [], true], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [69, 50, [], true], [0, 0, [], false],
  [67, 43, [55, 59, 62], true], [0, 0, [], false], [69, 48, [55, 60, 64], true], [0, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [67, 50, [], true], [0, 0, [], false],
  [69, 48, [55, 60, 64], true], [71, 0, [], false], [72, 50, [54, 57, 62], true], [69, 0, [], false],
  [71, 43, [55, 59, 62], true], [0, 0, [], false], [69, 50, [54, 57, 62], true], [0, 0, [], false],
  [67, 43, [55, 59, 62], true], [0, 0, [], false], [66, 50, [54, 57, 62], true], [0, 0, [], false],
  [67, 43, [55, 59, 62], true], [0, 0, [], false], [0, 50, [], true], [0, 0, [], false],
];

// Public-Domain Thrilling Holiday Chase: Tchaikovsky's "Trepak (Russian Dance)" (1892, G Major!)
// Joyful, high-voltage Christmas frenzy — accelerates with speed!
const TREPAK_CHASE_SCORE: Beat[] = [
  [79, 43, [55, 59, 62], true], [78, 0, [], false], [79, 50, [54, 57, 62], true], [74, 0, [], false],
  [76, 48, [55, 60, 64], true], [74, 0, [], false], [72, 50, [54, 57, 62], true], [71, 0, [], false],
  [69, 45, [57, 60, 64], true], [71, 0, [], false], [72, 50, [54, 57, 62], true], [74, 0, [], false],
  [71, 43, [55, 59, 62], true], [67, 0, [], false], [74, 50, [], true], [0, 0, [], false],

  [79, 43, [55, 59, 62], true], [78, 0, [], false], [79, 50, [54, 57, 62], true], [81, 0, [], false],
  [83, 48, [55, 60, 64], true], [81, 0, [], false], [79, 50, [54, 57, 62], true], [78, 0, [], false],
  [76, 48, [55, 60, 64], true], [74, 0, [], false], [72, 50, [54, 57, 62], true], [74, 0, [], false],
  [79, 43, [55, 59, 62], true], [0, 50, [], true], [79, 43, [55, 59, 62], true], [0, 0, [], false],
];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;

  private carveGain: GainNode | null = null;
  private carveFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private musicMuted = false;
  private sfxMuted = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private chaseMode = false;
  private musicActive = false;
  private tempoScale = 1.0; // 1.0 -> 1.55 dynamically coupled to skiing speed!

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxMuted ? 0 : 0.55;
      this.sfxBus.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicMuted ? 0 : 0.30;

      // Bright festive concert-hall reverb (shorter & punchier than gloomy cathedral!)
      this.reverbNode = this.createFestiveReverb(this.ctx, 1.15);
      const wetGain = this.ctx.createGain();
      wetGain.gain.value = 0.28;
      const dryGain = this.ctx.createGain();
      dryGain.gain.value = 0.80;

      this.musicBus.connect(dryGain);
      dryGain.connect(this.ctx.destination);
      this.musicBus.connect(this.reverbNode);
      this.reverbNode.connect(wetGain);
      wetGain.connect(this.ctx.destination);

      this.initAmbientSnowAudio();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createFestiveReverb(ctx: AudioContext, seconds: number): ConvolverNode {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 3.2);
        data[i] = (Math.random() * 2 - 1) * decay * 0.38;
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    return conv;
  }

  public setTempoFromSpeed(speedMps: number): void {
    // Smoothly scales tempo from 1.0x at 20 m/s up to 1.55x at 44+ m/s!
    const norm = Math.max(0, Math.min(1, (speedMps - 20) / 24));
    this.tempoScale = 1.0 + norm * 0.55;
  }

  public toggleMusic(): boolean {
    this.unlock();
    this.musicMuted = !this.musicMuted;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(this.musicMuted ? 0 : 0.30, this.ctx.currentTime, 0.06);
    }
    return this.musicMuted;
  }

  public toggleSfx(): boolean {
    this.unlock();
    this.sfxMuted = !this.sfxMuted;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    return this.sfxMuted;
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

  public updateCarve(speedNorm: number, carveAmount: number, airborne: boolean, onIce = false): void {
    if (!this.ctx || !this.carveGain || !this.carveFilter || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    const targetCarve = airborne
      ? 0.004
      : Math.min(0.28, 0.03 + speedNorm * 0.08 + carveAmount * 0.18);
    const targetFreq = onIce
      ? 2300 + carveAmount * 1400
      : 740 + speedNorm * 680 + carveAmount * 1200;

    this.carveGain.gain.setTargetAtTime(targetCarve, now, 0.04);
    this.carveFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);

    const targetWind = Math.min(0.18, 0.02 + speedNorm * 0.14 + (airborne ? 0.05 : 0));
    this.windGain.gain.setTargetAtTime(targetWind, now, 0.07);
    this.windFilter.frequency.setTargetAtTime(280 + speedNorm * 580, now, 0.07);
  }

  public stopCarve(): void {
    if (!this.ctx || !this.carveGain || !this.windGain) return;
    const now = this.ctx.currentTime;
    this.carveGain.gain.setTargetAtTime(0, now, 0.07);
    this.windGain.gain.setTargetAtTime(0.01, now, 0.1);
  }

  public startMusic(chase: boolean): void {
    this.chaseMode = chase;
    if (this.musicActive) return;
    this.musicActive = true;
    this.musicStep = 0;
    this.scheduleMusicTick();
  }

  public setChaseMode(chase: boolean): void {
    if (this.chaseMode !== chase) {
      this.chaseMode = chase;
      this.musicStep = 0;
    }
  }

  public stopMusic(): void {
    this.musicActive = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusicTick(): void {
    if (!this.musicActive) return;
    if (this.ctx && this.musicBus && !this.musicMuted && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      const score = this.chaseMode ? TREPAK_CHASE_SCORE : JOYFUL_CHRISTMAS_SCORE;
      const [mel, bass, chord, bells] = score[this.musicStep % score.length];

      if (mel > 0) {
        this.playGlockenspiel(midi(mel), now, this.chaseMode ? 0.22 : 0.34, this.chaseMode ? 0.16 : 0.14);
      }
      if (bass > 0) {
        this.playPizzicatoBass(midi(bass), now, 0.28, 0.18);
      }
      if (chord.length > 0) {
        chord.forEach((c) => this.playWarmHolidayChord(midi(c), now, 0.42, 0.045));
      }
      if (bells) {
        this.playSleighBell(now, this.chaseMode ? 0.065 : 0.042, this.musicBus);
      }
      this.musicStep++;
    }

    // Music literally accelerates with your skiing speed!
    const baseMs = this.chaseMode ? 148 : 175;
    const stepMs = Math.max(92, Math.round(baseMs / this.tempoScale));
    this.musicTimer = window.setTimeout(() => this.scheduleMusicTick(), stepMs);
  }

  private playGlockenspiel(freq: number, start: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq * 2, start);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.24, start);
    g2.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.4);

    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc1.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(this.musicBus);
    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + dur + 0.03);
    osc2.stop(start + dur + 0.03);
  }

  private playPizzicatoBass(freq: number, start: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(freq * 5, start);
    filt.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.5), start + dur);

    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filt);
    filt.connect(g);
    g.connect(this.musicBus);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  private playWarmHolidayChord(freq: number, start: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    filt.type = 'lowpass';
    filt.frequency.value = 1200;

    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filt);
    filt.connect(g);
    g.connect(this.musicBus);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  private playSleighBell(start: number, vol: number, dest: AudioNode): void {
    if (!this.ctx) return;
    for (const f of [3280, 4420, 5890]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(vol * 0.35, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
      osc.connect(g);
      g.connect(dest);
      osc.start(start);
      osc.stop(start + 0.09);
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
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.24);
    this.playSleighBell(now + 0.02, 0.09, this.sfxBus);
  }

  public playRailSpark(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.sfxTone(1580 + Math.random() * 440, 0.08, 'triangle', 0.08, now);
  }

  public playGateChime(combo: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const base = 587.33 * Math.pow(1.06, Math.min(combo, 10));
    this.sfxTone(base, 0.16, 'sine', 0.16, now);
    this.sfxTone(base * 1.25, 0.2, 'sine', 0.14, now + 0.045);
    this.sfxTone(base * 1.5, 0.26, 'triangle', 0.12, now + 0.09);
    this.playSleighBell(now + 0.03, 0.09, this.sfxBus);
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
    this.playSleighBell(now + 0.04, 0.12, this.sfxBus);
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

  public playYetiBanished(): void {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.sfxTone(f, 0.26, 'triangle', 0.16, now + i * 0.055);
    });
    this.playSleighBell(now + 0.12, 0.14, this.sfxBus);
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
    this.playSleighBell(now + 0.12, 0.1, this.sfxBus);
  }
}

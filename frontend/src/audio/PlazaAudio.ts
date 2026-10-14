/**
 * Procedural Indian Evening Food Plaza Ambient Soundscape
 * 
 * Synthesizes an authentic dusk street market atmosphere using Web Audio API:
 * 1. Warm Dusk Tanpura Drone (Sa-Pa harmonic resonance in D)
 * 2. Gentle Bansuri (Indian bamboo flute) modal phrases in Raga Bhupali/Yaman
 * 3. Soft ambient tawa sizzle & street murmur (filtered texture)
 * 4. Distant brass cart chimes & dusk lantern bells
 */

class PlazaAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambianceGain: GainNode | null = null;
  private fluteTimer: number | null = null;
  private bellTimer: number | null = null;

  private readonly duskNotes = [
    146.83, 164.81, 185.00, 220.00, 246.94, // D3, E3, F#3, A3, B3
    293.66, 329.63, 369.99, 440.00, 493.88, 587.33, // D4, E4, F#4, A4, B4, D5
  ];

  private initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.ambianceGain = this.ctx.createGain();
    this.ambianceGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.ambianceGain.connect(this.masterGain);
  }

  public async start() {
    this.initContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.isPlaying) return;
    this.isPlaying = true;

    this.startTanpuraDrone();
    this.startStreetAmbience();
    this.scheduleBansuriNotes();
    this.scheduleStallChimes();
  }

  public stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.fluteTimer) window.clearTimeout(this.fluteTimer);
    if (this.bellTimer) window.clearTimeout(this.bellTimer);
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      setTimeout(() => {
        if (this.ctx && this.ctx.state !== 'closed') this.ctx.suspend();
      }, 700);
    }
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setDucking(ducked: boolean) {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;
    const target = ducked ? 0.1 : 0.35;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.35);
  }

  private startTanpuraDrone() {
    if (!this.ctx || !this.musicGain) return;
    const droneFreqs = [73.41, 146.83, 220.0, 293.66]; // Low Sa, Sa, Pa, High Sa

    droneFreqs.forEach((freq, idx) => {
      if (!this.ctx || !this.musicGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.detune.setValueAtTime((idx - 1.5) * 4.5, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450 + idx * 80, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const baseGain = idx === 0 ? 0.22 : 0.1;
      gain.gain.setValueAtTime(baseGain, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.25 + idx * 0.08, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(baseGain * 0.35, this.ctx.currentTime);
      lfo.connect(lfoGain.gain);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start();
      lfo.start();
    });
  }
  private playFluteNote(freq: number, duration: number) {
    if (!this.ctx || !this.musicGain || !this.isPlaying) return;

    const osc = this.ctx.createOscillator();
    const oscHarmonic = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(freq * 2, now);

    osc.frequency.exponentialRampToValueAtTime(freq * 1.008, now + duration * 0.4);
    osc.frequency.exponentialRampToValueAtTime(freq, now + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1700, now);
    filter.Q.setValueAtTime(1.8, now);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(0.18, now + 0.5);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    oscHarmonic.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.musicGain);

    osc.start(now);
    oscHarmonic.start(now);
    osc.stop(now + duration + 0.1);
    oscHarmonic.stop(now + duration + 0.1);
  }

  private scheduleBansuriNotes() {
    if (!this.isPlaying) return;

    const numNotes = Math.random() > 0.4 ? 2 : 1;
    const startIndex = Math.floor(Math.random() * (this.duskNotes.length - 4)) + 3;

    for (let i = 0; i < numNotes; i++) {
      const noteFreq = this.duskNotes[startIndex + (i % 2 === 0 ? 0 : 2)];
      const delay = i * 1300;
      setTimeout(() => {
        if (this.isPlaying) this.playFluteNote(noteFreq, 2.8 + Math.random() * 1.2);
      }, delay);
    }

    const nextInterval = 4500 + Math.random() * 4000;
    this.fluteTimer = window.setTimeout(() => this.scheduleBansuriNotes(), nextInterval);
  }

  private startStreetAmbience() {
    if (!this.ctx || !this.ambianceGain) return;

    const bufferSize = this.ctx.sampleRate * 2.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
      b6 = white * 0.115926;
    }

    const whiteNoiseSource = this.ctx.createBufferSource();
    whiteNoiseSource.buffer = noiseBuffer;
    whiteNoiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1300, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    whiteNoiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambianceGain);

    whiteNoiseSource.start();
  }

  private playBellChime(freq: number) {
    if (!this.ctx || !this.ambianceGain || !this.isPlaying) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

    osc.connect(gain);
    gain.connect(this.ambianceGain);

    osc.start(now);
    osc.stop(now + 3.1);
  }

  private scheduleStallChimes() {
    if (!this.isPlaying) return;
    const chimeFreqs = [1174.66, 1318.51, 1479.98, 1760.0, 1975.53];
    const randomFreq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
    this.playBellChime(randomFreq);

    const nextChime = 5500 + Math.random() * 6500;
    this.bellTimer = window.setTimeout(() => this.scheduleStallChimes(), nextChime);
  }
}

export const plazaAudio = new PlazaAudioEngine();

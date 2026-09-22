/** Small acoustic sketches: no samples, downloads, or gameplay random numbers. */
export type SoundCue = 'paper' | 'coins' | 'pick' | 'water' | 'steps' | 'hooves' | 'gold' | 'bell' | 'warning' | 'grave' | 'save' | 'bird';
export type SoundScene = 'harbour' | 'town' | 'creek' | 'diggings' | 'bush' | 'room';

export class SoundPalette {
  private readonly noise: AudioBuffer;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private seed = 0x6f17a231;

  constructor(private readonly ctx: BaseAudioContext, private readonly output: AudioNode) {
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = this.random() * 2 - 1;
  }

  private random(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 0x100000000;
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }

  private tone(at: number, frequency: number, duration: number, level: number, end = frequency, type: OscillatorType = 'sine'): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.output);
    this.track(osc, [gain]);
    osc.start(at);
    osc.stop(at + duration + 0.015);
  }

  private rustle(at: number, duration: number, level: number, frequency: number, q = 0.6): void {
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(frequency * 0.65, at + duration);
    filter.Q.value = q;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + Math.min(0.03, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.output);
    this.track(source, [filter, gain]);
    source.start(at, this.random());
    source.stop(at + duration + 0.02);
  }

  play(cue: SoundCue, level = 1): void {
    const at = this.ctx.currentTime + 0.008;
    const pitch = 0.97 + this.random() * 0.06;
    const tone = (offset: number, hz: number, duration: number, volume: number, end = hz, type: OscillatorType = 'sine') =>
      this.tone(at + offset, hz * pitch, duration, volume * level, end * pitch, type);
    const noise = (offset: number, duration: number, volume: number, hz: number, q?: number) =>
      this.rustle(at + offset, duration, volume * level, hz, q);
    switch (cue) {
      case 'paper':
        noise(0, 0.16, 0.1, 1800);
        noise(0.065, 0.11, 0.05, 3200);
        break;
      case 'coins':
        [0, 0.09, 0.21].forEach((t, i) => {
          tone(t, 2350 - i * 230, 0.15, 0.07);
          tone(t, 3541 - i * 170, 0.08, 0.025);
          noise(t, 0.035, 0.08, 4200);
        });
        break;
      case 'pick':
        [0, 0.3, 0.66].forEach((t) => {
          noise(t, 0.13, 0.19, 850);
          tone(t, 1470, 0.22, 0.075);
          tone(t, 2317, 0.09, 0.025);
        });
        break;
      case 'water':
        [0, 0.18, 0.4].forEach((t) => noise(t, 0.35, 0.15, 1100 + this.random() * 600));
        tone(0.28, 720, 0.1, 0.04, 330);
        tone(0.55, 940, 0.12, 0.03, 400);
        break;
      case 'steps':
      case 'hooves':
        [0, 0.24, 0.49, 0.73].forEach((t, i) => {
          noise(t, 0.1, 0.16, cue === 'steps' ? 700 : 380);
          tone(t, i % 2 ? 140 : 180, 0.075, 0.09, 80, 'triangle');
          if (cue === 'hooves') tone(t + 0.07, 260, 0.05, 0.065, 120, 'triangle');
        });
        break;
      case 'gold':
        [0, 0.15, 0.31].forEach((t, i) => {
          const f = [1046.5, 1318.5, 1568][i];
          tone(t, f, 0.65, 0.075);
          tone(t, f * 2.73, 0.18, 0.018);
        });
        break;
      case 'bell':
      case 'grave': {
        const f = cue === 'grave' ? 164.8 : 440;
        tone(0, f, 1.4, 0.09);
        tone(0, f * 2.76, 0.8, 0.03);
        tone(0, f * 4.07, 0.4, 0.015);
        break;
      }
      case 'warning':
        tone(0, 196, 0.22, 0.07, 146, 'triangle');
        noise(0, 0.11, 0.04, 500);
        break;
      case 'save':
        noise(0, 0.12, 0.09, 1600);
        tone(0.12, 180, 0.12, 0.12, 70, 'triangle');
        noise(0.12, 0.045, 0.12, 1100);
        break;
      case 'bird':
        tone(0, 1850, 0.13, 0.035, 2900);
        tone(0.17, 2400, 0.17, 0.027, 1500);
        break;
    }
  }

  /** A moving noise bed, with no long repeating recording or music loop. */
  ambience(scene: SoundScene): () => void {
    const at = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const breath = this.ctx.createGain();
    const fade = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    const water = scene === 'harbour' || scene === 'creek';
    const room = scene === 'room';
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = water ? 1250 : room ? 300 : 650;
    filter.Q.value = 0.4;
    breath.gain.value = room ? 0.012 : water ? 0.065 : 0.045;
    lfo.frequency.value = scene === 'harbour' ? 0.13 : 0.085;
    depth.gain.value = room ? 0.003 : water ? 0.038 : 0.023;
    fade.gain.setValueAtTime(0, at);
    fade.gain.linearRampToValueAtTime(1, at + 1.4);
    source.connect(filter).connect(breath).connect(fade).connect(this.output);
    lfo.connect(depth).connect(breath.gain);
    this.track(source, [filter, breath, fade]);
    this.track(lfo, [depth]);
    source.start(at, this.random());
    lfo.start(at);
    return () => {
      const now = this.ctx.currentTime;
      fade.gain.cancelScheduledValues(now);
      fade.gain.setValueAtTime(fade.gain.value, now);
      fade.gain.linearRampToValueAtTime(0, now + 0.25);
      source.stop(now + 0.3);
      lfo.stop(now + 0.3);
    };
  }

  stop(): void {
    for (const source of this.sources) {
      try { source.stop(); } catch { /* Already ended while the tab was suspended. */ }
      source.disconnect();
    }
    this.sources.clear();
  }
}

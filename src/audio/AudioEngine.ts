import { AUDIO } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import { loadPreferences } from '../storage/preferences';
import { ERA_MUSIC, type DrumKind, type EraMusic } from './eraMusic';

export type SfxName = 'select' | 'place' | 'upgrade' | 'move' | 'expand' | 'error' | 'research' | 'levelUp' | 'era';

interface ToneOptions {
  wave?: OscillatorType;
  gain?: number;
  attack?: number;
  /** Seconds from the start until the note has faded out. */
  length?: number;
  /** Vibrato rate in Hz (depth is fixed and subtle). */
  vibrato?: number;
  /** Lowpass cutoff in Hz. */
  filter?: number;
  /** Pitch glide target in Hz. */
  slideTo?: number;
}

const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/**
 * All sound is synthesized with WebAudio, so the game ships no audio files: per-era generative
 * music (a look-ahead step sequencer) and short effects. Browsers only allow audio after a user
 * gesture, so nothing plays until `unlock()` is called from one.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus!: GainNode;
  private musicFader!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private musicVolume: number;
  private sfxVolume: number;

  /** The music that should play (null for silence). */
  private wantedEra: EraId | null = null;
  private music: EraMusic | null = null;
  private musicToken = 0;
  private timer: number | undefined;
  private step = 0;
  private nextStepTime = 0;
  private leadDegree = 4;
  private seed = 1;
  private readonly lastSfx = new Map<SfxName, number>();

  constructor() {
    const preferences = loadPreferences();
    this.musicVolume = preferences.musicVolume;
    this.sfxVolume = preferences.sfxVolume;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Call from a user gesture: creates or resumes the audio context. */
  unlock(): void {
    if (!this.ctx) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.buildGraph(this.ctx);
      this.startMusic(this.wantedEra);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music * AUDIO.musicMix, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx * AUDIO.sfxMix, this.ctx.currentTime, 0.05);
  }

  /** Switches the music (with a crossfade); null fades to silence. */
  playMusic(era: EraId | null): void {
    if (era === this.wantedEra) return;
    this.wantedEra = era;
    const ctx = this.ctx;
    if (!ctx) return;
    const token = ++this.musicToken;
    const fade = this.music ? AUDIO.crossfadeSeconds / 2 : 0;
    this.musicFader.gain.cancelScheduledValues(ctx.currentTime);
    this.musicFader.gain.setTargetAtTime(0, ctx.currentTime, fade / 4 || 0.01);
    window.setTimeout(() => {
      if (token === this.musicToken) this.startMusic(this.wantedEra);
    }, fade * 1000);
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.sfxVolume === 0) return;
    const now = ctx.currentTime;
    if (now - (this.lastSfx.get(name) ?? -1) < AUDIO.sfxMinIntervalSeconds) return;
    this.lastSfx.set(name, now);
    const bus = this.sfxBus;
    const t = now + 0.01;

    switch (name) {
      case 'select':
        this.tone(bus, t, midiToHz(96), { wave: 'sine', gain: 0.12, length: 0.06 });
        break;
      case 'place':
        this.noiseHit(bus, t, { gain: 0.35, length: 0.12, type: 'lowpass', frequency: 500 });
        this.tone(bus, t, midiToHz(72), { wave: 'triangle', gain: 0.3, length: 0.14 });
        this.tone(bus, t + 0.07, midiToHz(79), { wave: 'triangle', gain: 0.26, length: 0.2 });
        break;
      case 'upgrade':
        [72, 76, 79, 84].forEach((note, i) =>
          this.tone(bus, t + i * 0.06, midiToHz(note), { wave: 'triangle', gain: 0.24, length: 0.22 }),
        );
        break;
      case 'move':
        this.noiseHit(bus, t, { gain: 0.25, length: 0.28, type: 'bandpass', frequency: 700, sweepTo: 2600 });
        break;
      case 'expand':
        [60, 67, 72, 76, 79].forEach((note, i) => {
          this.tone(bus, t + i * 0.08, midiToHz(note), { wave: 'sine', gain: 0.2, length: 0.5 });
          this.tone(bus, t + i * 0.08, midiToHz(note + 12), { wave: 'triangle', gain: 0.05, length: 0.3 });
        });
        break;
      case 'error':
        this.tone(bus, t, 220, { wave: 'square', gain: 0.1, length: 0.1, filter: 1400 });
        this.tone(bus, t + 0.11, 185, { wave: 'square', gain: 0.1, length: 0.18, filter: 1400 });
        break;
      case 'research':
        this.tone(bus, t, midiToHz(88), { wave: 'sine', gain: 0.22, length: 1.1 });
        this.tone(bus, t, midiToHz(107), { wave: 'sine', gain: 0.05, length: 0.5 });
        this.tone(bus, t + 0.14, midiToHz(95), { wave: 'sine', gain: 0.18, length: 1.2 });
        break;
      case 'levelUp':
        [67, 72, 76].forEach((note, i) =>
          this.tone(bus, t + i * 0.09, midiToHz(note), { wave: 'triangle', gain: 0.24, length: 0.18 }),
        );
        this.tone(bus, t + 0.27, midiToHz(79), { wave: 'triangle', gain: 0.26, length: 0.7, vibrato: 6 });
        this.tone(bus, t + 0.27, midiToHz(84), { wave: 'sine', gain: 0.1, length: 0.7 });
        break;
      case 'era':
        this.drum(bus, t, 'kick', 0.8);
        for (const note of [48, 55, 60, 64, 67, 72]) {
          this.tone(bus, t, midiToHz(note), { wave: 'triangle', gain: 0.09, attack: 0.5, length: 2.6, filter: 2400 });
        }
        [72, 76, 79, 84, 88, 91].forEach((note, i) =>
          this.tone(bus, t + 0.6 + i * 0.09, midiToHz(note), { wave: 'sine', gain: 0.1, length: 0.6 }),
        );
        break;
    }
  }

  private buildGraph(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    limiter.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * AUDIO.musicMix;
    this.musicBus.connect(limiter);
    this.musicFader = ctx.createGain();
    this.musicFader.gain.value = 0;
    this.musicFader.connect(this.musicBus);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume * AUDIO.sfxMix;
    this.sfxBus.connect(limiter);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  private readonly onVisibilityChange = (): void => {
    if (!this.ctx) return;
    // A hidden tab stays silent; the sequencer's clock pauses with the context.
    if (document.hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  };

  // --- Music -------------------------------------------------------------------------------

  private startMusic(era: EraId | null): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.music = null;
    const ctx = this.ctx;
    if (!ctx || !era) return;
    this.music = ERA_MUSIC[era];
    this.step = 0;
    this.leadDegree = this.music.scale.length;
    this.seed = 1 + era.length * 7919;
    this.nextStepTime = ctx.currentTime + 0.1;
    this.musicFader.gain.cancelScheduledValues(ctx.currentTime);
    this.musicFader.gain.setValueAtTime(0, ctx.currentTime);
    this.musicFader.gain.linearRampToValueAtTime(1, ctx.currentTime + AUDIO.crossfadeSeconds / 2);
    this.timer = window.setInterval(this.schedule, AUDIO.schedulerIntervalMs);
    this.schedule();
  }

  private readonly schedule = (): void => {
    const ctx = this.ctx;
    const music = this.music;
    if (!ctx || !music || ctx.state !== 'running') return;
    const stepSeconds = 60 / music.bpm / 4;
    // After a stall, rejoin the clock instead of bursting out the missed steps.
    if (this.nextStepTime < ctx.currentTime) this.nextStepTime = ctx.currentTime + 0.02;
    while (this.nextStepTime < ctx.currentTime + AUDIO.lookaheadSeconds) {
      this.playStep(music, this.step, this.nextStepTime, stepSeconds);
      this.step++;
      this.nextStepTime += stepSeconds;
    }
  };

  private playStep(music: EraMusic, step: number, t: number, stepSeconds: number): void {
    const bus = this.musicFader;
    const position = step % 16;
    const bar = Math.floor(step / 16);
    const chordRoot = music.progression[bar % music.progression.length];
    const barSeconds = stepSeconds * 16;

    if (position === 0 && music.pad) {
      for (const offset of [0, 2, 4]) {
        this.tone(bus, t, midiToHz(this.noteOf(music, chordRoot + offset)), {
          wave: music.pad.wave,
          gain: music.pad.gain / 3,
          attack: barSeconds * 0.3,
          length: barSeconds * 1.05,
          filter: music.pad.filter,
        });
      }
    }

    if (music.bass.pattern[position] === 'x') {
      // Mostly the chord root, with the fifth on off-beats for movement.
      const degree = position % 8 === 0 ? chordRoot : chordRoot + (position % 4 === 2 ? 4 : 0);
      this.tone(bus, t, midiToHz(this.noteOf(music, degree) + 12 * music.bass.octave - 12), {
        wave: music.bass.wave,
        gain: music.bass.gain,
        length: music.bass.decay,
        filter: music.bass.filter,
      });
    }

    for (const drum of music.drums) {
      if (drum.pattern[position] === 'x') this.drum(bus, t, drum.kind, drum.gain);
    }

    const lead = music.lead;
    if (position % lead.every === 0 && this.random() < lead.density) {
      // Wander by small steps, pulled towards the current chord's tones.
      const chordTones = [chordRoot, chordRoot + 2, chordRoot + 4].map((d) => d + music.scale.length);
      const target = chordTones[Math.floor(this.random() * chordTones.length)];
      const stepBy = Math.sign(target - this.leadDegree) * Math.ceil(this.random() * 2);
      this.leadDegree = Math.min(music.scale.length * 2, Math.max(0, this.leadDegree + (stepBy || 1)));
      this.tone(bus, t, midiToHz(this.noteOf(music, this.leadDegree) + 12 * lead.octave), {
        wave: lead.wave,
        gain: lead.gain,
        attack: lead.vibrato ? 0.04 : 0.005,
        length: lead.decay + stepSeconds * lead.every,
        vibrato: lead.vibrato || undefined,
        filter: lead.filter,
      });
    }
  }

  /** MIDI note of a scale degree (degrees past the scale wrap into higher octaves). */
  private noteOf(music: EraMusic, degree: number): number {
    const size = music.scale.length;
    const octave = Math.floor(degree / size);
    return music.root + octave * 12 + music.scale[((degree % size) + size) % size];
  }

  /** Deterministic pseudo-random numbers, so each era's music has a stable character. */
  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  // --- Voices ------------------------------------------------------------------------------

  private tone(bus: AudioNode, t: number, frequency: number, options: ToneOptions): void {
    const ctx = this.ctx!;
    const { wave = 'sine', gain = 0.2, attack = 0.005, length = 0.2 } = options;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, t);
    if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, t + length);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(gain, t + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(length, attack + 0.02));

    let output: AudioNode = osc;
    if (options.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = options.filter;
      osc.connect(filter);
      output = filter;
    }
    output.connect(envelope);
    envelope.connect(bus);

    const end = t + length + 0.05;
    if (options.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = options.vibrato;
      depth.gain.value = frequency * 0.012;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(end);
    }
    osc.start(t);
    osc.stop(end);
  }

  private noiseHit(
    bus: AudioNode,
    t: number,
    options: { gain: number; length: number; type: BiquadFilterType; frequency: number; sweepTo?: number; q?: number },
  ): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.setValueAtTime(options.frequency, t);
    if (options.sweepTo) filter.frequency.exponentialRampToValueAtTime(options.sweepTo, t + options.length);
    if (options.q) filter.Q.value = options.q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(options.gain, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + options.length);
    source.connect(filter).connect(envelope).connect(bus);
    // Start at a random offset so repeated hits don't sound identical.
    source.start(t, Math.random() * 0.5, options.length + 0.05);
  }

  private drum(bus: AudioNode, t: number, kind: DrumKind, gain: number): void {
    switch (kind) {
      case 'kick':
        this.tone(bus, t, 110, { wave: 'sine', gain, length: 0.28, slideTo: 40 });
        break;
      case 'tom':
        this.tone(bus, t, 170, { wave: 'sine', gain, length: 0.32, slideTo: 90 });
        break;
      case 'snare':
        this.noiseHit(bus, t, { gain, length: 0.16, type: 'bandpass', frequency: 1800, q: 0.8 });
        this.tone(bus, t, 190, { wave: 'triangle', gain: gain * 0.5, length: 0.08 });
        break;
      case 'shaker':
        this.noiseHit(bus, t, { gain, length: 0.07, type: 'highpass', frequency: 5000 });
        break;
      case 'tambourine':
        this.noiseHit(bus, t, { gain, length: 0.12, type: 'highpass', frequency: 7000 });
        break;
      case 'hat':
        this.noiseHit(bus, t, { gain, length: 0.04, type: 'highpass', frequency: 8000 });
        break;
      case 'metal':
        this.noiseHit(bus, t, { gain, length: 0.22, type: 'bandpass', frequency: 3200, q: 10 });
        this.tone(bus, t, 523, { wave: 'square', gain: gain * 0.15, length: 0.12, filter: 3000 });
        this.tone(bus, t, 790, { wave: 'square', gain: gain * 0.1, length: 0.1, filter: 3000 });
        break;
    }
  }
}

/** The game's single audio engine. */
export const audio = new AudioEngine();

import type { EraId } from '../progression/era';

/** Percussion voices the engine can synthesize. */
export type DrumKind = 'kick' | 'tom' | 'shaker' | 'snare' | 'tambourine' | 'hat' | 'metal';

/**
 * A generative piece of music: a mode, a chord progression (one chord per bar of 16 steps),
 * 16-step drum and bass patterns, and a lead that improvises over the chords.
 */
export interface EraMusic {
  bpm: number;
  /** MIDI note of the tonic. */
  root: number;
  /** Semitones of the mode above the tonic. */
  scale: readonly number[];
  /** Chord roots as scale degrees, one per bar. */
  progression: readonly number[];
  pad: { wave: OscillatorType; gain: number; filter: number } | null;
  bass: { wave: OscillatorType; pattern: string; octave: number; gain: number; decay: number; filter: number };
  lead: {
    wave: OscillatorType;
    octave: number;
    /** A note may start every `every` steps... */
    every: number;
    /** ...with this probability. */
    density: number;
    gain: number;
    decay: number;
    vibrato: number;
    filter: number;
  };
  /** 16-step patterns: 'x' plays the voice at the given gain. */
  drums: readonly { kind: DrumKind; pattern: string; gain: number }[];
}

export const ERA_MUSIC: Record<EraId, EraMusic> = {
  // Tribal: slow toms and shakers, a breathy flute over a drone.
  ancient: {
    bpm: 84,
    root: 50,
    scale: [0, 3, 5, 7, 10],
    progression: [0, 0, 3, 2],
    pad: { wave: 'sine', gain: 0.18, filter: 900 },
    bass: { wave: 'sine', pattern: 'x.......x.....x.', octave: -1, gain: 0.35, decay: 0.6, filter: 600 },
    lead: { wave: 'sine', octave: 1, every: 2, density: 0.38, gain: 0.14, decay: 0.55, vibrato: 5, filter: 3000 },
    drums: [
      { kind: 'tom', pattern: 'x.....x...x.....', gain: 0.5 },
      { kind: 'kick', pattern: 'x.......x.......', gain: 0.35 },
      { kind: 'shaker', pattern: '..x...x...x...xx', gain: 0.1 },
    ],
  },
  // Folk: a plucked lute in dorian, bouncing bass and tambourine.
  medieval: {
    bpm: 104,
    root: 55,
    scale: [0, 2, 3, 5, 7, 9, 10],
    progression: [0, 6, 3, 4],
    pad: { wave: 'triangle', gain: 0.08, filter: 1400 },
    bass: { wave: 'triangle', pattern: 'x...x.x.x...x.x.', octave: -1, gain: 0.3, decay: 0.3, filter: 900 },
    lead: { wave: 'triangle', octave: 1, every: 1, density: 0.42, gain: 0.16, decay: 0.28, vibrato: 0, filter: 4000 },
    drums: [
      { kind: 'kick', pattern: 'x.......x.......', gain: 0.3 },
      { kind: 'snare', pattern: '....x.......x...', gain: 0.18 },
      { kind: 'tambourine', pattern: 'x.xxx.xxx.xxx.xx', gain: 0.08 },
    ],
  },
  // Modern: a calm lo-fi groove, soft keys over a warm bass.
  modern: {
    bpm: 96,
    root: 53,
    scale: [0, 2, 4, 7, 9],
    progression: [0, 3, 4, 2],
    pad: { wave: 'triangle', gain: 0.1, filter: 1600 },
    bass: { wave: 'sine', pattern: 'x.....x...x.....', octave: -1, gain: 0.3, decay: 0.45, filter: 700 },
    lead: { wave: 'triangle', octave: 1, every: 2, density: 0.3, gain: 0.1, decay: 0.5, vibrato: 3, filter: 3200 },
    drums: [
      { kind: 'kick', pattern: 'x.......x.......', gain: 0.34 },
      { kind: 'snare', pattern: '....x.......x...', gain: 0.12 },
      { kind: 'hat', pattern: '..x...x...x...x.', gain: 0.06 },
    ],
  },
  // Mechanical: a driving saw bass, clanking metal and ticking hats.
  industrial: {
    bpm: 116,
    root: 45,
    scale: [0, 2, 3, 5, 7, 8, 10],
    progression: [0, 5, 2, 6],
    pad: null,
    bass: { wave: 'sawtooth', pattern: 'x.xxx.xxx.xxx.xx', octave: 0, gain: 0.22, decay: 0.16, filter: 700 },
    lead: { wave: 'square', octave: 2, every: 2, density: 0.22, gain: 0.06, decay: 0.3, vibrato: 0, filter: 2200 },
    drums: [
      { kind: 'kick', pattern: 'x...x...x...x...', gain: 0.45 },
      { kind: 'metal', pattern: '....x.......x..x', gain: 0.25 },
      { kind: 'hat', pattern: 'x.x.x.x.x.x.x.x.', gain: 0.07 },
    ],
  },
};

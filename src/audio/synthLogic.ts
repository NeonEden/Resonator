/**
 * Audio synthesis logic, math transforms, frequency conversions, arpeggiator engine,
 * and strict VCA envelope calculations
 */

export interface PatchJack {
  id: string;
  name: string;
  type: 'out' | 'in';
  group: 'LFO' | 'ENV' | 'OSC' | 'FILTER' | 'FX';
  signalValue?: number;
}

export interface PatchCable {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  glowColor: string;
}

export type ArpDivision = '1/8' | '1/16' | '1/8T' | '1/16T';
export type ArpPattern = 'up' | 'down' | 'upDown' | 'random';

export interface SynthParams {
  // OSCILLATORS
  waveform: OscillatorType;
  subLevel: number; // 0..1
  noiseLevel: number; // 0..1
  detune: number; // -50..50 cents
  octave: number; // -2..+2
  glide: number; // 0..0.5s

  // FM CROSS-MODULATION & RING MODULATOR
  fmDepth: number; // 0..1 (Frequency modulation index)
  fmRatio: number; // 0.5..8.0 (Harmonic ratio of modulator)
  ringModMix: number; // 0..1 (Ring modulator audio multiplier mix)

  // FILTER & ENVELOPE MOD
  cutoff: number; // 20..20000 Hz
  resonance: number; // 0.1..18 Q
  filterType: BiquadFilterType;
  envModAmount: number; // -1..1

  // 4-STAGE ADSR ENVELOPE (Amp & Filter)
  attack: number; // 0.005..3.0s
  decay: number; // 0.01..4.0s
  sustain: number; // 0..1
  release: number; // 0.02..5.0s

  // LFO
  lfoRate: number; // 0.1..20 Hz
  lfoDepth: number; // 0..1
  lfoWave: OscillatorType;

  // SPACE DELAY & MASTER FX
  drive: number; // 0..1
  delayTime: number; // 0.02..1.0s
  delayFeedback: number; // 0..0.85
  volume: number; // 0..1

  // ARPEGGIATOR
  arpEnabled: boolean;
  arpBpm: number; // 60..240
  arpDivision: ArpDivision;
  arpPattern: ArpPattern;
  arpOctaves: number; // 1..3
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  waveform: 'sawtooth',
  subLevel: 0.35,
  noiseLevel: 0.04,
  detune: 8,
  octave: 0,
  glide: 0.02,

  fmDepth: 0.0,
  fmRatio: 2.0,
  ringModMix: 0.0,

  cutoff: 2400,
  resonance: 4.5,
  filterType: 'lowpass',
  envModAmount: 0.5,

  attack: 0.015,
  decay: 0.4,
  sustain: 0.65,
  release: 0.4,

  lfoRate: 3.5,
  lfoDepth: 0.25,
  lfoWave: 'sine',

  drive: 0.35,
  delayTime: 0.28,
  delayFeedback: 0.45,
  volume: 0.75,

  arpEnabled: false,
  arpBpm: 124,
  arpDivision: '1/16',
  arpPattern: 'up',
  arpOctaves: 1,
};

/** Convert MIDI note number (e.g. 60 = C4) to frequency in Hz */
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/** Convert normalized slider value 0..1 to log frequency 20..20000 Hz */
export function normalizedToLogFrequency(val: number): number {
  const minFreq = 20;
  const maxFreq = 20000;
  const clamped = Math.max(0, Math.min(1, val));
  return minFreq * Math.pow(maxFreq / minFreq, clamped);
}

/** Convert frequency 20..20000 Hz back to 0..1 normalized */
export function logFrequencyToNormalized(freq: number): number {
  const minFreq = 20;
  const maxFreq = 20000;
  const clamped = Math.max(minFreq, Math.min(maxFreq, freq));
  return Math.log(clamped / minFreq) / Math.log(maxFreq / minFreq);
}

/** Generates distortion curve for analog warmth / drive */
export function makeDistortionCurve(amount: number = 0.3): Float32Array {
  const k = typeof amount === 'number' ? Math.max(0, amount) * 50 : 15;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
  }
  return curve;
}

/**
 * Strict VCA (Voltage Controlled Amplifier) ADSR Envelope Calculation.
 * Calculates exact peak gains, sustain floor, and stage intervals.
 */
export interface VcaEnvelopeStages {
  peakGain: number;
  sustainLevel: number;
  attackDuration: number;
  decayDuration: number;
  releaseDuration: number;
  idleFloor: number;
}

export function calculateVcaEnvelope(
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  velocity: number = 0.85
): VcaEnvelopeStages {
  const clampedVel = Math.max(0.01, Math.min(1.0, velocity));
  const peakGain = clampedVel * 0.42;
  const attackDuration = Math.max(0.004, attack);
  const decayDuration = Math.max(0.01, decay);
  const sustainLevel = Math.max(0.0, peakGain * Math.max(0.0, Math.min(1.0, sustain)));
  const releaseDuration = Math.max(0.01, release);
  const idleFloor = 0.0; // Mathematical absolute zero floor

  return {
    peakGain,
    sustainLevel,
    attackDuration,
    decayDuration,
    releaseDuration,
    idleFloor,
  };
}

/** Converts BPM and division into note duration in seconds */
export function divisionToIntervalSeconds(bpm: number, division: ArpDivision): number {
  const quarterNoteSec = 60 / Math.max(30, bpm);
  switch (division) {
    case '1/8':
      return quarterNoteSec * 0.5;
    case '1/16':
      return quarterNoteSec * 0.25;
    case '1/8T':
      return (quarterNoteSec * 0.5) * (2 / 3);
    case '1/16T':
      return (quarterNoteSec * 0.25) * (2 / 3);
    default:
      return quarterNoteSec * 0.25;
  }
}

/**
 * Builds the sequence of arpeggiated notes from held chord notes
 */
export function generateArpSequence(
  heldNotes: number[],
  pattern: ArpPattern,
  octaves: number = 1
): number[] {
  if (heldNotes.length === 0) return [];

  const sorted = [...heldNotes].sort((a, b) => a - b);
  const fullNotes: number[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    for (const note of sorted) {
      fullNotes.push(note + oct * 12);
    }
  }

  switch (pattern) {
    case 'up':
      return fullNotes;
    case 'down':
      return [...fullNotes].reverse();
    case 'upDown': {
      if (fullNotes.length <= 1) return fullNotes;
      const downNotes = [...fullNotes].slice(0, -1).reverse().slice(0, -1);
      return [...fullNotes, ...downNotes];
    }
    case 'random':
      return fullNotes;
    default:
      return fullNotes;
  }
}

/** Pre-configured sound presets */
export interface Preset {
  name: string;
  category: string;
  params: Partial<SynthParams>;
  cables: Array<{ fromId: string; toId: string }>;
}

export const PRESETS: Record<string, Preset> = {
  'obsidian-bass': {
    name: 'Obsidian 808',
    category: 'Bass // Solid',
    params: {
      waveform: 'triangle',
      subLevel: 0.85,
      noiseLevel: 0.01,
      detune: 4,
      octave: -1,
      cutoff: 420,
      resonance: 5.2,
      drive: 0.45,
      attack: 0.01,
      decay: 0.55,
      sustain: 0.15,
      release: 0.3,
      delayTime: 0.18,
      delayFeedback: 0.2,
      arpEnabled: false,
    },
    cables: [
      { fromId: 'env-out', toId: 'vcf-cut' },
      { fromId: 'sub-out', toId: 'vco-pitch' },
    ],
  },
  'plasma-lead': {
    name: 'Plasma Ion 01',
    category: 'Lead // Aggressive',
    params: {
      waveform: 'sawtooth',
      subLevel: 0.3,
      noiseLevel: 0.06,
      detune: 14,
      octave: 0,
      cutoff: 3800,
      resonance: 7.8,
      drive: 0.6,
      attack: 0.015,
      decay: 0.45,
      sustain: 0.7,
      release: 0.35,
      lfoRate: 5.2,
      lfoDepth: 0.35,
      delayTime: 0.32,
      delayFeedback: 0.5,
      arpEnabled: false,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vcf-cut' },
      { fromId: 'env-out', toId: 'vco-pitch' },
    ],
  },
  'filament-pad': {
    name: 'Filament Ambient',
    category: 'Pad // Luminous',
    params: {
      waveform: 'sawtooth',
      subLevel: 0.45,
      noiseLevel: 0.03,
      detune: 18,
      octave: 0,
      cutoff: 2400,
      resonance: 3.5,
      drive: 0.2,
      attack: 0.6,
      decay: 1.4,
      sustain: 0.85,
      release: 1.6,
      delayTime: 0.45,
      delayFeedback: 0.65,
      lfoRate: 1.2,
      lfoDepth: 0.3,
      arpEnabled: false,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vcf-res' },
      { fromId: 'noise-out', toId: 'vcf-cut' },
    ],
  },
  'opulence-arp': {
    name: 'Opulence Arp',
    category: 'Arp // Precision',
    params: {
      waveform: 'square',
      subLevel: 0.5,
      noiseLevel: 0.04,
      detune: 10,
      octave: 0,
      cutoff: 3200,
      resonance: 8.2,
      drive: 0.4,
      attack: 0.008,
      decay: 0.22,
      sustain: 0.2,
      release: 0.25,
      delayTime: 0.24,
      delayFeedback: 0.55,
      arpEnabled: true,
      arpBpm: 128,
      arpDivision: '1/16',
      arpPattern: 'upDown',
      arpOctaves: 2,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vcf-cut' },
      { fromId: 'sub-out', toId: 'vcf-res' },
    ],
  },
  'subterranean-drone': {
    name: 'Subterranean Core',
    category: 'Drone // Heavy',
    params: {
      waveform: 'square',
      subLevel: 0.75,
      noiseLevel: 0.1,
      detune: 22,
      octave: -2,
      cutoff: 950,
      resonance: 8.5,
      drive: 0.75,
      attack: 0.25,
      decay: 1.8,
      sustain: 0.9,
      release: 2.2,
      delayTime: 0.5,
      delayFeedback: 0.6,
      lfoRate: 0.4,
      lfoDepth: 0.6,
      arpEnabled: false,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vco-pitch' },
      { fromId: 'sub-out', toId: 'vcf-cut' },
    ],
  },
};

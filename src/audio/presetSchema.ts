/**
 * Strict JSON Schema definition and type declarations for Resonator presets
 */

export interface PresetOscModule {
  wave: 'sine' | 'tri' | 'saw' | 'square';
  detune: number; // cents (-50..50)
  octave: number; // (-2..2)
  subLevel: number; // (0..1)
  noiseLevel: number; // (0..1)
  lfoRate: number; // (0.1..20 Hz)
  lfoDepth: number; // (0..1)
  fmDepth?: number; // (0..1) Frequency modulation index
  fmRatio?: number; // (0.5..8.0) Modulator harmonic ratio
  ringModMix?: number; // (0..1) Ring modulation audio mix
}

export interface PresetFilterAdsr {
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0..1
  release: number; // seconds
}

export interface PresetFilterModule {
  cutoffHz: number; // 20..20000 Hz
  resonance: number; // 0.1..18 Q
  envMod: number; // -1..1
  adsr: PresetFilterAdsr;
}

export interface PresetOutputModule {
  time: number; // delay time in seconds (0.02..1.0)
  feedback: number; // 0..0.85
  drive: number; // 0..1
  volume: number; // 0..1
}

export interface PresetVisuals {
  plasmaColor: string; // Hex or CSS color, e.g. '#ffb545' (Amber) or '#59cbd0' (Cyan)
  thermalGlow: number | string; // 0..1 glow intensity or hex color string
}

export interface PresetCable {
  fromId: string;
  toId: string;
}

export interface ResonatorPresetJson {
  name: string;
  author: string; // Default "TOMAS.WAV"
  date: string; // ISO date string
  isUserPreset?: boolean;
  tags?: string[];
  osc: PresetOscModule;
  filter: PresetFilterModule;
  output: PresetOutputModule;
  visuals: PresetVisuals;
  coreVisual?: PresetVisuals;
  cables?: PresetCable[];
  arp?: {
    enabled: boolean;
    bpm: number;
    division: '1/8' | '1/16' | '1/8T' | '1/16T';
    pattern: 'up' | 'down' | 'upDown' | 'random';
    octaves: number;
  };
}

/** Standardizes waveform string between audio engine ('sawtooth'/'triangle') and preset ('saw'/'tri') */
export function normalizeWaveform(wave: string): 'sine' | 'tri' | 'saw' | 'square' {
  if (wave === 'sawtooth' || wave === 'saw') return 'saw';
  if (wave === 'triangle' || wave === 'tri') return 'tri';
  if (wave === 'square' || wave === 'sqr') return 'square';
  return 'sine';
}

export function toOscillatorType(wave: 'sine' | 'tri' | 'saw' | 'square'): OscillatorType {
  switch (wave) {
    case 'saw':
      return 'sawtooth';
    case 'tri':
      return 'triangle';
    case 'square':
      return 'square';
    default:
      return 'sine';
  }
}

/** Factory default presets mapped to the new specification schema */
export const FACTORY_PRESETS: ResonatorPresetJson[] = [
  {
    name: 'Obsidian 808',
    author: 'TOMAS.WAV',
    date: '2026-11-03T00:00:00.000Z',
    isUserPreset: false,
    osc: {
      wave: 'tri',
      detune: 4,
      octave: -1,
      subLevel: 0.85,
      noiseLevel: 0.01,
      lfoRate: 3.5,
      lfoDepth: 0.15,
    },
    filter: {
      cutoffHz: 420,
      resonance: 5.2,
      envMod: 0.45,
      adsr: {
        attack: 0.01,
        decay: 0.55,
        sustain: 0.15,
        release: 0.3,
      },
    },
    output: {
      time: 0.18,
      feedback: 0.2,
      drive: 0.45,
      volume: 0.75,
    },
    visuals: {
      plasmaColor: '#ff9d2e',
      thermalGlow: 0.7,
    },
    cables: [
      { fromId: 'env-out', toId: 'vcf-cut' },
      { fromId: 'sub-out', toId: 'vco-pitch' },
    ],
  },
  {
    name: 'Plasma Ion 01',
    author: 'TOMAS.WAV',
    date: '2026-11-03T00:00:00.000Z',
    isUserPreset: false,
    osc: {
      wave: 'saw',
      detune: 14,
      octave: 0,
      subLevel: 0.3,
      noiseLevel: 0.06,
      lfoRate: 5.2,
      lfoDepth: 0.35,
    },
    filter: {
      cutoffHz: 3800,
      resonance: 7.8,
      envMod: 0.6,
      adsr: {
        attack: 0.015,
        decay: 0.45,
        sustain: 0.7,
        release: 0.35,
      },
    },
    output: {
      time: 0.32,
      feedback: 0.5,
      drive: 0.6,
      volume: 0.75,
    },
    visuals: {
      plasmaColor: '#59cbd0',
      thermalGlow: 0.95,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vcf-cut' },
      { fromId: 'env-out', toId: 'vco-pitch' },
    ],
  },
  {
    name: 'Filament Ambient',
    author: 'TOMAS.WAV',
    date: '2026-11-03T00:00:00.000Z',
    isUserPreset: false,
    osc: {
      wave: 'saw',
      detune: 18,
      octave: 0,
      subLevel: 0.45,
      noiseLevel: 0.03,
      lfoRate: 1.2,
      lfoDepth: 0.3,
    },
    filter: {
      cutoffHz: 2400,
      resonance: 3.5,
      envMod: 0.2,
      adsr: {
        attack: 0.6,
        decay: 1.4,
        sustain: 0.85,
        release: 1.6,
      },
    },
    output: {
      time: 0.45,
      feedback: 0.65,
      drive: 0.2,
      volume: 0.75,
    },
    visuals: {
      plasmaColor: '#ffe58a',
      thermalGlow: 0.85,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vcf-res' },
      { fromId: 'noise-out', toId: 'vcf-cut' },
    ],
  },
  {
    name: 'Opulence Arp',
    author: 'TOMAS.WAV',
    date: '2026-11-03T00:00:00.000Z',
    isUserPreset: false,
    osc: {
      wave: 'square',
      detune: 10,
      octave: 0,
      subLevel: 0.5,
      noiseLevel: 0.04,
      lfoRate: 3.5,
      lfoDepth: 0.25,
    },
    filter: {
      cutoffHz: 3200,
      resonance: 8.2,
      envMod: 0.4,
      adsr: {
        attack: 0.008,
        decay: 0.22,
        sustain: 0.2,
        release: 0.25,
      },
    },
    output: {
      time: 0.24,
      feedback: 0.55,
      drive: 0.4,
      volume: 0.75,
    },
    visuals: {
      plasmaColor: '#ffb545',
      thermalGlow: 0.9,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vcf-cut' },
      { fromId: 'sub-out', toId: 'vcf-res' },
    ],
    arp: {
      enabled: true,
      bpm: 128,
      division: '1/16',
      pattern: 'upDown',
      octaves: 2,
    },
  },
  {
    name: 'Subterranean Core',
    author: 'TOMAS.WAV',
    date: '2026-11-03T00:00:00.000Z',
    isUserPreset: false,
    osc: {
      wave: 'square',
      detune: 22,
      octave: -2,
      subLevel: 0.75,
      noiseLevel: 0.1,
      lfoRate: 0.4,
      lfoDepth: 0.6,
    },
    filter: {
      cutoffHz: 950,
      resonance: 8.5,
      envMod: 0.75,
      adsr: {
        attack: 0.25,
        decay: 1.8,
        sustain: 0.9,
        release: 2.2,
      },
    },
    output: {
      time: 0.5,
      feedback: 0.6,
      drive: 0.75,
      volume: 0.75,
    },
    visuals: {
      plasmaColor: '#ff682c',
      thermalGlow: 0.8,
    },
    cables: [
      { fromId: 'lfo-out', toId: 'vco-pitch' },
      { fromId: 'sub-out', toId: 'vcf-cut' },
    ],
  },
];

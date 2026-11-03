import {
  ResonatorPresetJson,
  FACTORY_PRESETS,
  normalizeWaveform,
  toOscillatorType,
  PresetVisuals,
} from './presetSchema';

export { FACTORY_PRESETS };
export type { ResonatorPresetJson, PresetVisuals };
import { SynthParams, PatchCable } from './synthLogic';
import { audioEngine } from './AudioEngine';

const STORAGE_KEY = 'resonator_user_presets_v1';

/** Helper to convert thermalGlow (which can be a number 0..1 or hex color string) into numeric 0..1 */
export function normalizeThermalGlow(val: number | string | undefined | null): number {
  if (typeof val === 'number') {
    return Math.max(0.1, Math.min(1.0, val));
  }
  if (typeof val === 'string') {
    // If it's a hex color, calculate perceptual brightness
    const hex = val.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16) || 128;
      const g = parseInt(hex.substring(2, 4), 16) || 128;
      const b = parseInt(hex.substring(4, 6), 16) || 128;
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return Math.max(0.3, Math.min(1.0, luma));
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return Math.max(0.1, Math.min(1.0, parsed));
  }
  return 0.85;
}

/**
 * 1. getCurrentPreset:
 * Captures the exact state of all UI knobs, sliders, buttons, visual settings, and matrix cables.
 */
export function getCurrentPreset(
  params: SynthParams,
  visuals: PresetVisuals,
  cables: PatchCable[],
  name: string = 'Custom Preset',
  author: string = 'TOMAS.WAV',
  tags: string[] = ['Usuario']
): ResonatorPresetJson {
  return {
    name: name.trim() || 'Untitled Preset',
    author: author.trim() || 'TOMAS.WAV',
    date: new Date().toISOString(),
    isUserPreset: true,
    tags: tags.length > 0 ? tags : ['Usuario'],
    osc: {
      wave: normalizeWaveform(params.waveform),
      detune: params.detune,
      octave: params.octave,
      subLevel: params.subLevel,
      noiseLevel: params.noiseLevel,
      lfoRate: params.lfoRate,
      lfoDepth: params.lfoDepth,
      fmDepth: params.fmDepth ?? 0.0,
      fmRatio: params.fmRatio ?? 2.0,
      ringModMix: params.ringModMix ?? 0.0,
    },
    filter: {
      cutoffHz: params.cutoff,
      resonance: params.resonance,
      envMod: params.envModAmount,
      adsr: {
        attack: params.attack,
        decay: params.decay,
        sustain: params.sustain,
        release: params.release,
      },
    },
    output: {
      time: params.delayTime,
      feedback: params.delayFeedback,
      drive: params.drive,
      volume: params.volume,
    },
    visuals: {
      plasmaColor: visuals.plasmaColor || '#ffb545',
      thermalGlow: normalizeThermalGlow(visuals.thermalGlow),
    },
    cables: cables.map(c => ({ fromId: c.fromId, toId: c.toId })),
    arp: {
      enabled: params.arpEnabled,
      bpm: params.arpBpm,
      division: params.arpDivision,
      pattern: params.arpPattern,
      octaves: params.arpOctaves,
    },
  };
}

/**
 * 2. applyPreset:
 * Smoothly propagates the preset parameters into the Web Audio API engine
 * and synchronizes React DOM state.
 */
export function applyPreset(
  preset: ResonatorPresetJson,
  setParams: React.Dispatch<React.SetStateAction<SynthParams>>,
  setVisuals: React.Dispatch<React.SetStateAction<PresetVisuals>>,
  setCables: React.Dispatch<React.SetStateAction<PatchCable[]>>
): void {
  const oscType = toOscillatorType(preset.osc.wave);

  const fmDepth = typeof preset.osc.fmDepth === 'number' ? preset.osc.fmDepth : 0.0;
  const fmRatio = typeof preset.osc.fmRatio === 'number' ? preset.osc.fmRatio : 2.0;
  const ringModMix = typeof preset.osc.ringModMix === 'number' ? preset.osc.ringModMix : 0.0;

  // 1. Audio Engine Parameter Updates (interpolated ramps)
  audioEngine.setParam('waveform', oscType);
  audioEngine.setParam('detune', preset.osc.detune);
  audioEngine.setParam('octave', preset.osc.octave);
  audioEngine.setParam('subLevel', preset.osc.subLevel);
  audioEngine.setParam('noiseLevel', preset.osc.noiseLevel);
  audioEngine.setParam('lfoRate', preset.osc.lfoRate);
  audioEngine.setParam('lfoDepth', preset.osc.lfoDepth);

  // FM and Ring mod
  audioEngine.setParam('fmDepth', fmDepth);
  audioEngine.setParam('fmRatio', fmRatio);
  audioEngine.setParam('ringModMix', ringModMix);

  audioEngine.setParam('cutoff', preset.filter.cutoffHz);
  audioEngine.setParam('resonance', preset.filter.resonance);
  audioEngine.setParam('envModAmount', preset.filter.envMod);
  audioEngine.setParam('attack', preset.filter.adsr.attack);
  audioEngine.setParam('decay', preset.filter.adsr.decay);
  audioEngine.setParam('sustain', preset.filter.adsr.sustain);
  audioEngine.setParam('release', preset.filter.adsr.release);

  audioEngine.setParam('delayTime', preset.output.time);
  audioEngine.setParam('delayFeedback', preset.output.feedback);
  audioEngine.setParam('drive', preset.output.drive);
  audioEngine.setParam('volume', preset.output.volume);

  if (preset.arp) {
    audioEngine.setParam('arpEnabled', preset.arp.enabled);
    audioEngine.setParam('arpBpm', preset.arp.bpm);
    audioEngine.setParam('arpDivision', preset.arp.division);
    audioEngine.setParam('arpPattern', preset.arp.pattern);
    audioEngine.setParam('arpOctaves', preset.arp.octaves);
  }

  // 2. React State Sync (moves DOM knobs, sliders, and buttons physically)
  setParams(prev => ({
    ...prev,
    waveform: oscType,
    detune: preset.osc.detune,
    octave: preset.osc.octave,
    subLevel: preset.osc.subLevel,
    noiseLevel: preset.osc.noiseLevel,
    lfoRate: preset.osc.lfoRate,
    lfoDepth: preset.osc.lfoDepth,

    fmDepth,
    fmRatio,
    ringModMix,

    cutoff: preset.filter.cutoffHz,
    resonance: preset.filter.resonance,
    envModAmount: preset.filter.envMod,
    attack: preset.filter.adsr.attack,
    decay: preset.filter.adsr.decay,
    sustain: preset.filter.adsr.sustain,
    release: preset.filter.adsr.release,

    delayTime: preset.output.time,
    delayFeedback: preset.output.feedback,
    drive: preset.output.drive,
    volume: preset.output.volume,

    arpEnabled: preset.arp?.enabled ?? prev.arpEnabled,
    arpBpm: preset.arp?.bpm ?? prev.arpBpm,
    arpDivision: preset.arp?.division ?? prev.arpDivision,
    arpPattern: preset.arp?.pattern ?? prev.arpPattern,
    arpOctaves: preset.arp?.octaves ?? prev.arpOctaves,
  }));

  // 3. Visuals Sync (Core plasma hue and thermal glow from visuals or coreVisual)
  const incomingVisuals = preset.coreVisual || preset.visuals;
  const plasmaColor = incomingVisuals?.plasmaColor || '#ffb545';
  const thermalGlow = normalizeThermalGlow(incomingVisuals?.thermalGlow);

  setVisuals({
    plasmaColor,
    thermalGlow,
  });

  // 4. Matrix Cables Sync
  if (preset.cables) {
    const newCables: PatchCable[] = preset.cables.map((c, i) => ({
      id: `cable-loaded-${i}-${Date.now()}`,
      fromId: c.fromId,
      toId: c.toId,
      color: '#b27546',
      glowColor: plasmaColor,
    }));
    setCables(newCables);
    audioEngine.updatePatches(newCables);
  }
}

/**
 * 3. savePresetToLocalStorage:
 * Saves a preset into localStorage, replacing if name matches or adding new.
 */
export function savePresetToLocalStorage(preset: ResonatorPresetJson): ResonatorPresetJson[] {
  try {
    const userPresets = getUserPresetsFromStorage();
    const existingIdx = userPresets.findIndex(p => p.name.toLowerCase() === preset.name.toLowerCase());

    const updated: ResonatorPresetJson = {
      ...preset,
      isUserPreset: true,
      author: preset.author || 'TOMAS.WAV',
      date: new Date().toISOString(),
      tags: preset.tags && preset.tags.length > 0 ? preset.tags : ['Usuario'],
    };

    if (existingIdx >= 0) {
      userPresets[existingIdx] = updated;
    } else {
      userPresets.push(updated);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
    }
    return userPresets;
  } catch (e) {
    console.error('Failed to save preset to localStorage:', e);
    return [];
  }
}

/**
 * Reads user presets from localStorage
 */
export function getUserPresetsFromStorage(): ResonatorPresetJson[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse user presets from localStorage:', e);
    return [];
  }
}

/**
 * Deletes a user preset from localStorage by name
 */
export function deleteUserPresetFromStorage(name: string): ResonatorPresetJson[] {
  try {
    const userPresets = getUserPresetsFromStorage();
    const filtered = userPresets.filter(p => p.name.toLowerCase() !== name.toLowerCase());
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch (e) {
    console.error('Failed to delete user preset:', e);
    return [];
  }
}

/**
 * 4. loadPresetList:
 * Returns the unified list: Factory Presets + User Presets from localStorage.
 */
export function loadPresetList(): ResonatorPresetJson[] {
  const userPresets = getUserPresetsFromStorage();
  return [...FACTORY_PRESETS, ...userPresets];
}

/**
 * 5. exportPresetAsJson:
 * Triggers a native browser file download of the preset as a formatted .json file.
 */
export function exportPresetAsJson(preset: ResonatorPresetJson): void {
  try {
    const cleanName = preset.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const filename = `resonator_${cleanName}.json`;
    const dataStr = JSON.stringify(preset, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to export preset JSON:', e);
  }
}

/**
 * Validates and parses external JSON string into a valid ResonatorPresetJson
 */
export function parseAndValidatePresetJson(jsonStr: string): ResonatorPresetJson {
  const obj = JSON.parse(jsonStr);

  if (!obj || typeof obj !== 'object') {
    throw new Error('El archivo no contiene un objeto JSON válido');
  }

  // Validate or provide sane defaults
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Preset Neuronal';
  const author = typeof obj.author === 'string' ? obj.author : 'TOMAS.WAV // AI Neural Bridge';

  const osc = obj.osc || {};
  const filter = obj.filter || {};
  const output = obj.output || {};
  const adsr = filter.adsr || {};
  const incomingVisuals = obj.coreVisual || obj.visuals || {};

  const plasmaColor = typeof incomingVisuals.plasmaColor === 'string' ? incomingVisuals.plasmaColor : '#ffb545';
  const thermalGlow = normalizeThermalGlow(incomingVisuals.thermalGlow);

  const preset: ResonatorPresetJson = {
    name,
    author,
    date: obj.date || new Date().toISOString(),
    isUserPreset: true,
    tags: Array.isArray(obj.tags) ? obj.tags : ['Neuronal'],
    osc: {
      wave: normalizeWaveform(osc.wave || 'saw'),
      detune: typeof osc.detune === 'number' ? osc.detune : 0,
      octave: typeof osc.octave === 'number' ? osc.octave : 0,
      subLevel: typeof osc.subLevel === 'number' ? Math.max(0, Math.min(1, osc.subLevel)) : 0.3,
      noiseLevel: typeof osc.noiseLevel === 'number' ? Math.max(0, Math.min(1, osc.noiseLevel)) : 0.02,
      lfoRate: typeof osc.lfoRate === 'number' ? osc.lfoRate : 3.0,
      lfoDepth: typeof osc.lfoDepth === 'number' ? Math.max(0, Math.min(1, osc.lfoDepth)) : 0.2,
      fmDepth: typeof osc.fmDepth === 'number' ? Math.max(0, Math.min(1, osc.fmDepth)) : 0.0,
      fmRatio: typeof osc.fmRatio === 'number' ? Math.max(0.5, Math.min(8, osc.fmRatio)) : 2.0,
      ringModMix: typeof osc.ringModMix === 'number' ? Math.max(0, Math.min(1, osc.ringModMix)) : 0.0,
    },
    filter: {
      cutoffHz: typeof filter.cutoffHz === 'number' ? Math.max(20, Math.min(20000, filter.cutoffHz)) : 2000,
      resonance: typeof filter.resonance === 'number' ? Math.max(0.1, Math.min(18, filter.resonance)) : 4.0,
      envMod: typeof filter.envMod === 'number' ? Math.max(-1, Math.min(1, filter.envMod)) : 0.5,
      adsr: {
        attack: typeof adsr.attack === 'number' ? Math.max(0.005, Math.min(5, adsr.attack)) : 0.02,
        decay: typeof adsr.decay === 'number' ? Math.max(0.01, Math.min(5, adsr.decay)) : 0.4,
        sustain: typeof adsr.sustain === 'number' ? Math.max(0, Math.min(1, adsr.sustain)) : 0.6,
        release: typeof adsr.release === 'number' ? Math.max(0.02, Math.min(8, adsr.release)) : 0.4,
      },
    },
    output: {
      time: typeof output.time === 'number' ? Math.max(0.02, Math.min(1.5, output.time)) : 0.25,
      feedback: typeof output.feedback === 'number' ? Math.max(0, Math.min(0.85, output.feedback)) : 0.4,
      drive: typeof output.drive === 'number' ? Math.max(0, Math.min(1, output.drive)) : 0.3,
      volume: typeof output.volume === 'number' ? Math.max(0, Math.min(1, output.volume)) : 0.75,
    },
    visuals: {
      plasmaColor,
      thermalGlow,
    },
    coreVisual: {
      plasmaColor,
      thermalGlow,
    },
    cables: Array.isArray(obj.cables) ? obj.cables : [],
    arp: obj.arp ? {
      enabled: Boolean(obj.arp.enabled),
      bpm: typeof obj.arp.bpm === 'number' ? obj.arp.bpm : 120,
      division: obj.arp.division || '1/16',
      pattern: obj.arp.pattern || 'up',
      octaves: typeof obj.arp.octaves === 'number' ? obj.arp.octaves : 1,
    } : undefined,
  };

  return preset;
}

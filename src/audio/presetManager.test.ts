import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentPreset,
  parseAndValidatePresetJson,
  loadPresetList,
  normalizeThermalGlow,
} from './presetManager';
import { FACTORY_PRESETS } from './presetSchema';
import { DEFAULT_SYNTH_PARAMS } from './synthLogic';

test('getCurrentPreset captures full synth state with metadata and modules', () => {
  const visuals = { plasmaColor: '#ffb545', thermalGlow: 0.9 };
  const cables = [{ fromId: 'lfo-out', toId: 'vcf-cut', id: '1', color: '#b27546', glowColor: 'gold' }];
  const preset = getCurrentPreset(DEFAULT_SYNTH_PARAMS, visuals, cables, 'My Test Preset', 'TOMAS.WAV');

  assert.equal(preset.name, 'My Test Preset');
  assert.equal(preset.author, 'TOMAS.WAV');
  assert.ok(preset.date && !isNaN(Date.parse(preset.date)));
  assert.equal(preset.osc.wave, 'saw');
  assert.equal(preset.filter.cutoffHz, DEFAULT_SYNTH_PARAMS.cutoff);
  assert.equal(preset.output.time, DEFAULT_SYNTH_PARAMS.delayTime);
  assert.equal(preset.visuals.plasmaColor, '#ffb545');
  assert.equal(preset.cables?.length, 1);
  assert.equal(preset.osc.fmDepth, 0);
  assert.equal(preset.osc.ringModMix, 0);
});

test('parseAndValidatePresetJson parses valid JSON and standardizes waveform', () => {
  const jsonStr = JSON.stringify({
    name: 'External Synth',
    author: 'PRODUCER',
    osc: { wave: 'triangle', detune: 5, fmDepth: 0.4, fmRatio: 3.5, ringModMix: 0.25 },
    filter: { cutoffHz: 1200, resonance: 6.0, adsr: { attack: 0.05, decay: 0.5, sustain: 0.8, release: 1.0 } },
    output: { time: 0.3, feedback: 0.5, drive: 0.2, volume: 0.8 },
    coreVisual: { plasmaColor: '#59cbd0', thermalGlow: '#FFB545' },
    tags: ['Metálico', 'Atmósferas'],
  });

  const parsed = parseAndValidatePresetJson(jsonStr);
  assert.equal(parsed.name, 'External Synth');
  assert.equal(parsed.author, 'PRODUCER');
  assert.equal(parsed.osc.wave, 'tri'); // Normalized from 'triangle'
  assert.equal(parsed.osc.fmDepth, 0.4);
  assert.equal(parsed.osc.fmRatio, 3.5);
  assert.equal(parsed.osc.ringModMix, 0.25);
  assert.equal(parsed.filter.cutoffHz, 1200);
  assert.equal(parsed.visuals.plasmaColor, '#59cbd0');
  assert.ok(typeof parsed.visuals.thermalGlow === 'number');
  assert.ok(parsed.tags?.includes('Metálico'));
});

test('normalizeThermalGlow converts numeric and hex colors gracefully', () => {
  assert.equal(normalizeThermalGlow(0.8), 0.8);
  assert.equal(normalizeThermalGlow('0.65'), 0.65);
  const fromHex = normalizeThermalGlow('#FFB545');
  assert.ok(fromHex >= 0.3 && fromHex <= 1.0);
});

test('parseAndValidatePresetJson provides safe defaults for missing fields', () => {
  const minimalJson = JSON.stringify({ name: 'Minimal' });
  const parsed = parseAndValidatePresetJson(minimalJson);

  assert.equal(parsed.name, 'Minimal');
  assert.ok(parsed.author);
  assert.ok(parsed.osc.wave);
  assert.ok(parsed.filter.cutoffHz > 0);
  assert.ok(parsed.output.volume > 0);
});

test('parseAndValidatePresetJson throws descriptive error on invalid JSON', () => {
  assert.throws(() => {
    parseAndValidatePresetJson('NOT_A_JSON');
  });
});

test('FACTORY_PRESETS has 5 production presets matching schema', () => {
  assert.equal(FACTORY_PRESETS.length, 5);
  for (const p of FACTORY_PRESETS) {
    assert.ok(p.name);
    assert.equal(p.author, 'TOMAS.WAV');
    assert.ok(p.osc.wave);
    assert.ok(p.filter.cutoffHz);
    assert.ok(p.output.volume);
  }
});

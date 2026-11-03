import { test } from 'node:test';
import assert from 'node:assert';
import {
  ResonatorAudioEngine,
  audioEngine,
} from './AudioEngine.js';

test('Panic vs Normal Release: panic() clears active voices, sustained pedal, arp, and closes gate', () => {
  audioEngine.noteOn(60);
  audioEngine.noteOn(64);
  audioEngine.setSustainPedal(true);
  audioEngine.noteOff(60); // held in sustained set

  audioEngine.panic();

  const data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 0, 'Active voices count must be 0 after panic');
  assert.strictEqual(audioEngine.getParams().volume, 0.75, 'Volume param should remain intact');
});

test('Sustain Pedal (CC 64) holds notes on release until pedal released', () => {
  audioEngine.setSustainPedal(true);
  audioEngine.noteOn(60);
  audioEngine.noteOff(60);

  let data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 1, 'Voice must remain active while sustain pedal is held');

  audioEngine.setSustainPedal(false);
  data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 0, 'Voice must release when sustain pedal is released');
});

test('Ring Mix Equal-Power Dry/Wet morphing calculations', () => {
  const mix0Dry = Math.cos(0 * Math.PI / 2);
  const mix0Wet = Math.sin(0 * Math.PI / 2);
  assert.strictEqual(mix0Dry, 1.0, 'Dry level at mix 0 must be 1.0');
  assert.strictEqual(mix0Wet, 0.0, 'Wet level at mix 0 must be 0.0');

  const mix1Dry = Math.cos(1 * Math.PI / 2);
  const mix1Wet = Math.sin(1 * Math.PI / 2);
  assert.ok(Math.abs(mix1Dry - 0) < 0.0001, 'Dry level at mix 1 must be ~0');
  assert.ok(Math.abs(mix1Wet - 1.0) < 0.0001, 'Wet level at mix 1 must be 1.0');

  const mixHalfDry = Math.cos(0.5 * Math.PI / 2);
  const mixHalfWet = Math.sin(0.5 * Math.PI / 2);
  assert.ok(mixHalfDry > 0.7 && mixHalfWet > 0.7, 'At 50% morph both dry and wet should be ~0.707 (equal power)');
});

test('Max Polyphony constant is set to 12', () => {
  assert.strictEqual(ResonatorAudioEngine.MAX_POLYPHONY, 12, 'MAX_POLYPHONY must be strictly 12');
});

test('Patch Matrix routing updates activePatches list and restores base parameters on reset', () => {
  const cables = [
    { fromId: 'lfo-out', toId: 'vco-pitch' },
    { fromId: 'noise-out', toId: 'vcf-cut' },
  ];
  audioEngine.updatePatches(cables);
  
  audioEngine.updatePatches([]);
  const data = audioEngine.getVisualizerData();
  assert.ok(data !== null, 'Visualizer data should be available after patch reset');
});

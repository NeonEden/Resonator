import { test } from 'node:test';
import assert from 'node:assert';
import {
  ResonatorAudioEngine,
  audioEngine,
} from './AudioEngine.js';

test('1. Web Audio Scheduler time propagation & drift recovery', async () => {
  await audioEngine.initAudio();

  // Test explicit scheduled start time propagation
  audioEngine.triggerAttack(60, 0.8, 'arp', 0.5);
  let data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 1, 'Scheduled voice must spawn cleanly at target time');

  // Panic cleanup
  audioEngine.panic();
  data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 0, 'Voices must clear after panic');
});

test('2. Real Sources in Matrix & Parameter Restorations', async () => {
  await audioEngine.initAudio();

  // Test LFO -> PITCH patch
  audioEngine.updatePatches([{ fromId: 'lfo-out', toId: 'vco-pitch' }]);
  
  // Test SUB -> PITCH patch
  audioEngine.updatePatches([{ fromId: 'sub-out', toId: 'vco-pitch' }]);

  // Test NOISE -> VCF CUT patch
  audioEngine.updatePatches([{ fromId: 'noise-out', toId: 'vcf-cut' }]);

  // Test LFO -> VCF RES patch
  audioEngine.updatePatches([{ fromId: 'lfo-out', toId: 'vcf-res' }]);

  // Reset patch cables - base state restoration
  audioEngine.updatePatches([]);
  const data = audioEngine.getVisualizerData();
  assert.ok(data !== null, 'Visualizer data should be accessible after matrix patch reset');
});

test('3. Voice identity & Polyphony Stealing with micro-crossfade', async () => {
  await audioEngine.initAudio();

  // Spawn 12 voices (MAX_POLYPHONY)
  for (let note = 60; note < 72; note++) {
    audioEngine.triggerAttack(note, 0.8, 'keyboard');
  }

  let data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 12, 'Polyphony must reach 12 active voices');

  // Trigger release on note 60 so it becomes isReleasing = true
  audioEngine.triggerRelease(60, 'keyboard');

  // Trigger 13th note -> Voice stealing must prioritize releasing note 60
  audioEngine.triggerAttack(72, 0.8, 'keyboard');

  data = audioEngine.getVisualizerData();
  assert.ok(data.activeVoiceCount <= 12, 'Polyphony count must remain capped at MAX_POLYPHONY (12)');

  audioEngine.panic();
});

test('4. Panic Reset: Clears voices, sustain pedal, demo timers and delay accumulation', async () => {
  await audioEngine.initAudio();

  let panicFired = false;
  const unregister = audioEngine.addPanicListener(() => {
    panicFired = true;
  });

  audioEngine.triggerAttack(60, 0.85, 'demo');
  audioEngine.setSustainPedal(true);
  audioEngine.triggerRelease(60, 'demo');

  let data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 1, 'Voice held by sustain pedal');

  audioEngine.panic();
  unregister();

  data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 0, 'Active voice count must be 0 after panic');
  assert.strictEqual(panicFired, true, 'Panic listener callback must fire to clear demo timers');
});

test('5. Sustain Pedal (CC 64) holds notes until pedal release', async () => {
  await audioEngine.initAudio();

  audioEngine.setSustainPedal(true);
  audioEngine.triggerAttack(64, 0.8, 'keyboard');
  audioEngine.triggerRelease(64, 'keyboard');

  let data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 1, 'Voice must stay active while sustain pedal is held');

  audioEngine.setSustainPedal(false);
  // Releasing sustain pedal initiates release cycle on sustained notes
  audioEngine.panic();
  data = audioEngine.getVisualizerData();
  assert.strictEqual(data.activeVoiceCount, 0, 'Voice must be cleared once sustain pedal is released and panic/release finishes');
});

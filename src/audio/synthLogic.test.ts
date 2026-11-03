import test from 'node:test';
import assert from 'node:assert/strict';
import {
  midiToFrequency,
  normalizedToLogFrequency,
  logFrequencyToNormalized,
  makeDistortionCurve,
  generateArpSequence,
  divisionToIntervalSeconds,
  calculateVcaEnvelope,
  DEFAULT_SYNTH_PARAMS,
  PRESETS
} from './synthLogic';

test('midiToFrequency calculates accurate standard pitch (A4 = 440Hz, C4 = ~261.63Hz)', () => {
  const a4 = midiToFrequency(69);
  assert.ok(Math.abs(a4 - 440) < 0.001, `Expected 440, got ${a4}`);

  const c4 = midiToFrequency(60);
  assert.ok(Math.abs(c4 - 261.6255) < 0.01, `Expected ~261.63, got ${c4}`);

  const a3 = midiToFrequency(57);
  assert.ok(Math.abs(a3 - 220) < 0.001, `Expected 220, got ${a3}`);
});

test('normalizedToLogFrequency and logFrequencyToNormalized are inverse functions', () => {
  const testValues = [0, 0.25, 0.5, 0.75, 1.0];
  for (const val of testValues) {
    const freq = normalizedToLogFrequency(val);
    assert.ok(freq >= 20 && freq <= 20000, `Freq ${freq} should be in 20..20000`);
    const inverted = logFrequencyToNormalized(freq);
    assert.ok(Math.abs(inverted - val) < 0.001, `Inverse failed for ${val}, got ${inverted}`);
  }
});

test('calculateVcaEnvelope guarantees strict zero floor and proportional ADSR levels', () => {
  const stages = calculateVcaEnvelope(0.01, 0.3, 0.5, 0.4, 0.8);
  assert.equal(stages.idleFloor, 0.0, 'Idle noise floor must be exactly 0.0');
  assert.ok(stages.peakGain > 0, 'Peak gain must be positive');
  assert.ok(stages.sustainLevel < stages.peakGain, 'Sustain level must be lower than peak gain');
  assert.equal(stages.sustainLevel, stages.peakGain * 0.5, 'Sustain must scale correctly with sustain parameter');
  assert.ok(stages.attackDuration >= 0.004, 'Attack duration must be clamped safely');
  assert.ok(stages.releaseDuration >= 0.01, 'Release duration must be clamped safely');
});

test('generateArpSequence orders notes correctly for up, down, upDown patterns', () => {
  const chord = [60, 64, 67]; // C major
  const upSeq = generateArpSequence(chord, 'up', 1);
  assert.deepEqual(upSeq, [60, 64, 67]);

  const downSeq = generateArpSequence(chord, 'down', 1);
  assert.deepEqual(downSeq, [67, 64, 60]);

  const upDownSeq = generateArpSequence(chord, 'upDown', 1);
  assert.deepEqual(upDownSeq, [60, 64, 67, 64]);

  const oct2Seq = generateArpSequence([60], 'up', 2);
  assert.deepEqual(oct2Seq, [60, 72]);
});

test('divisionToIntervalSeconds calculates exact note durations', () => {
  const sixteenth = divisionToIntervalSeconds(120, '1/16');
  assert.ok(Math.abs(sixteenth - 0.125) < 0.0001);

  const eighth = divisionToIntervalSeconds(120, '1/8');
  assert.ok(Math.abs(eighth - 0.25) < 0.0001);
});

test('makeDistortionCurve produces valid symmetric audio transfer function', () => {
  const curve = makeDistortionCurve(0.5);
  assert.equal(curve.length, 44100);
  const centerIdx = Math.floor(curve.length / 2);
  assert.ok(Math.abs(curve[centerIdx]) < 0.05);
  assert.ok(curve[0] >= -1 && curve[0] <= 0);
  assert.ok(curve[curve.length - 1] <= 1 && curve[curve.length - 1] >= 0);
});

test('presets are well formed and conform to SynthParams schema', () => {
  for (const [key, preset] of Object.entries(PRESETS)) {
    assert.ok(preset.name.length > 0, `Preset ${key} has no name`);
    assert.ok(preset.category.length > 0, `Preset ${key} has no category`);
    if (preset.params.cutoff) {
      assert.ok(preset.params.cutoff >= 20 && preset.params.cutoff <= 20000);
    }
  }
});

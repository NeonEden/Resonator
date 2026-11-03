import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResonatorAudioEngine, SynthVoice } from './AudioEngine';
import { isSupportedPatch } from './patchRouting';

type Event = { method: string; value?: number; time: number };
class TestParam {
  value = 1;
  events: Event[] = [];
  setValueAtTime(value: number, time: number) { this.events.push({ method: 'set', value, time }); this.value = value; }
  linearRampToValueAtTime(value: number, time: number) { this.events.push({ method: 'linear', value, time }); }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push({ method: 'exponential', value, time }); }
  setTargetAtTime(value: number, time: number) { this.events.push({ method: 'target', value, time }); this.value = value; }
  cancelScheduledValues(time: number) { this.events.push({ method: 'cancel', time }); }
  cancelAndHoldAtTime(time: number) { this.events.push({ method: 'hold', time }); }
}
class TestNode {
  gain = new TestParam(); frequency = new TestParam(); detune = new TestParam();
  Q = new TestParam(); delayTime = new TestParam(); threshold = new TestParam();
  knee = new TestParam(); ratio = new TestParam(); attack = new TestParam(); release = new TestParam();
  connections = new Set<unknown>();
  starts: number[] = []; stopTime = Infinity; ended = false;
  onended: (() => void) | null = null;
  type = 'sine'; buffer: unknown; loop = false; curve: unknown; oversample = 'none';
  fftSize = 1024; smoothingTimeConstant = 0; frequencyBinCount = 512;
  connect(target: unknown) { this.connections.add(target); return target; }
  disconnect(target?: unknown) { if (target) this.connections.delete(target); else this.connections.clear(); }
  start(time = 0) { this.starts.push(time); }
  stop(time = 0) { this.stopTime = time; }
  getByteTimeDomainData(array: Uint8Array) { array.fill(128); }
  getByteFrequencyData(array: Uint8Array) { array.fill(0); }
}
class TestContext {
  currentTime = 0; state = 'running'; sampleRate = 44100;
  destination = new TestNode(); nodes: TestNode[] = []; oscillators: TestNode[] = [];
  createGain() { const node = new TestNode(); this.nodes.push(node); return node; }
  createOscillator() { const node = this.createGain(); this.oscillators.push(node); return node; }
  createBiquadFilter() { return this.createGain(); }
  createWaveShaper() { return this.createGain(); }
  createDelay() { return this.createGain(); }
  createDynamicsCompressor() { return this.createGain(); }
  createAnalyser() { return this.createGain(); }
  createBufferSource() { return this.createGain(); }
  createBuffer(channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  async resume() { this.state = 'running'; }
  advance(time: number) {
    this.currentTime = time;
    for (const node of this.nodes) {
      if (!node.ended && node.stopTime <= time) { node.ended = true; node.onended?.(); }
    }
  }
}
async function setup() {
  const ctx = new TestContext();
  const engine = new ResonatorAudioEngine(() => ctx as unknown as AudioContext);
  assert.equal(await engine.initAudio(), true);
  return { ctx, engine };
}
// Inspect the graph and individual voice state without adding public product APIs for tests.
function voices(engine: ResonatorAudioEngine) {
  return (engine as unknown as { activeVoices: Map<string, SynthVoice> }).activeVoices;
}
function internals(engine: ResonatorAudioEngine) {
  return engine as unknown as {
    lfoOsc: TestNode; lfoGainToPitch: TestNode; lfoGainToFilter: TestNode;
    noiseSourceGlobal: TestNode; noiseGainToFilter: TestNode; masterFilter: TestNode;
    delayNode: TestNode; delaySendGain: TestNode; delayFeedbackGain: TestNode;
  };
}
function param(value: AudioParam) { return value as unknown as TestParam; }

test('A future attack and release preserve their audio times and hold the envelope', async () => {
  const { ctx, engine } = await setup();
  engine.triggerAttack(60, 0.8, 'demo', 0.5);
  const voice = [...voices(engine).values()][0];
  assert.deepEqual((voice.mainOsc as unknown as TestNode).starts, [0.5]);
  engine.triggerRelease(60, 'demo', 0.75);
  const events = param(voice.voiceVca.gain).events;
  assert.ok(events.some(e => e.method === 'hold' && e.time === 0.75));
  assert.ok(!events.some(e => e.method === 'set' && e.time === 0.75));
  assert.equal(voice.isReleasing, false);
  ctx.advance(0.76);
  assert.equal(voice.isReleasing, true);
  assert.equal(voices(engine).size, 1);
  ctx.advance(10);
  assert.equal(voices(engine).size, 0);
  engine.panic();
});

test('Same pitch from keyboard, MIDI and demo has independent ownership', async () => {
  const { ctx, engine } = await setup();
  engine.triggerAttack(60, 0.8, 'keyboard');
  engine.triggerAttack(60, 0.8, 'midi:device:0');
  engine.triggerAttack(60, 0.8, 'demo');
  assert.equal(voices(engine).size, 3);
  engine.triggerRelease(60, 'demo');
  ctx.advance(10);
  assert.deepEqual([...voices(engine).values()].map(v => v.source).sort(), ['keyboard', 'midi:device:0']);
  engine.panic();
});

test('Sustain retains only the released voice on its MIDI source and completes release normally', async () => {
  const { ctx, engine } = await setup();
  engine.triggerAttack(60, 0.8, 'midi:a:0');
  engine.triggerAttack(60, 0.8, 'midi:b:0');
  engine.setSustainPedal(true, 'midi:a:0');
  engine.triggerRelease(60, 'midi:a:0');
  engine.triggerRelease(60, 'midi:b:0');
  ctx.advance(10);
  assert.equal(voices(engine).size, 1);
  engine.setSustainPedal(false, 'midi:a:0');
  assert.equal([...voices(engine).values()][0].isReleasing, true);
  ctx.advance(20);
  assert.equal(voices(engine).size, 0);
});

test('Stealing selects a releasing voice, fades it, and panic stops even retired voices', async () => {
  const { ctx, engine } = await setup();
  for (let note = 60; note < 72; note++) engine.triggerAttack(note);
  const victim = [...voices(engine).values()][5];
  engine.triggerRelease(victim.note);
  engine.triggerAttack(80);
  assert.equal(voices(engine).size, 12);
  assert.equal(voices(engine).has(victim.id), false);
  assert.ok(param(victim.voiceVca.gain).events.some(e => e.method === 'linear' && e.time === 0.008));
  engine.panic();
  assert.equal(victim.isTerminated, true);
  ctx.advance(2);
  assert.equal(voices(engine).size, 0);
});

test('Real noise routing restores zero depth and SUB modulation stays inside each voice', async () => {
  const { engine } = await setup();
  engine.updatePatches([{ fromId: 'noise-out', toId: 'vcf-cut' }, { fromId: 'sub-out', toId: 'vco-pitch' }, { fromId: 'sub-out', toId: 'vcf-res' }]);
  engine.setParam('noiseLevel', 0.5);
  const graph = internals(engine);
  assert.ok(graph.noiseSourceGlobal.connections.has(graph.noiseGainToFilter));
  assert.ok(graph.noiseGainToFilter.connections.has(graph.masterFilter.frequency));
  assert.equal(graph.noiseGainToFilter.gain.value, 700);
  engine.triggerAttack(60); engine.triggerAttack(64);
  const [a,b] = [...voices(engine).values()];
  const ownRouting = (voice: SynthVoice) => voice as unknown as { subGainToPitch: TestNode; subGainToRes: TestNode };
  assert.ok((a.subOsc as unknown as TestNode).connections.has(ownRouting(a).subGainToPitch));
  assert.ok(ownRouting(a).subGainToPitch.connections.has(a.mainOsc.detune));
  assert.ok(!ownRouting(a).subGainToPitch.connections.has(b.mainOsc.detune));
  assert.ok(ownRouting(a).subGainToRes.connections.has(a.voiceFilter.Q));
  engine.updatePatches([]);
  assert.equal(graph.noiseGainToFilter.gain.value, 0);
  assert.equal(ownRouting(a).subGainToPitch.gain.value, 0);
  assert.equal(ownRouting(a).subGainToRes.gain.value, 0);
  assert.equal(isSupportedPatch({ fromId: 'env-out', toId: 'vcf-cut' }), false);
  assert.equal(isSupportedPatch({ fromId: 'noise-out', toId: 'vco-pitch' }), false);
  engine.panic();
});

test('Panic disconnects the old delay, notifies UI cancellation and resets sustain', async () => {
  const { engine } = await setup();
  const graph = internals(engine), oldDelay = graph.delayNode;
  engine.triggerAttack(60);
  engine.setSustainPedal(true);
  let cancellations = 0;
  engine.addPanicListener(() => cancellations++);
  engine.panic();
  assert.equal(cancellations, 1);
  assert.equal(oldDelay.connections.size, 0);
  assert.ok(!graph.delaySendGain.connections.has(oldDelay));
  assert.ok(!graph.delayFeedbackGain.connections.has(oldDelay));
  assert.ok(graph.delaySendGain.connections.has(graph.delayNode));
  engine.triggerAttack(61); engine.triggerRelease(61);
  assert.equal([...voices(engine).values()][0].isReleasing, true);
  engine.panic();
});

test('Arpeggiator schedules ahead, recovers after delay, and cancels queued voices on stop', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { ctx, engine } = await setup();
  engine.setParam('arpBpm', 240); engine.setParam('arpDivision', '1/16'); engine.setParam('arpEnabled', true);
  engine.triggerAttack(60);
  const scheduled = [...voices(engine).values()];
  assert.ok(scheduled.some(v => v.createdAtTime > ctx.currentTime));
  for (const voice of scheduled) assert.equal((voice.mainOsc as unknown as TestNode).starts[0], voice.createdAtTime);
  ctx.advance(2);
  t.mock.timers.tick(25);
  assert.ok([...voices(engine).values()].some(v => v.createdAtTime >= 2.005));
  const queued = [...voices(engine).values()];
  engine.triggerRelease(60);
  assert.equal(voices(engine).size, 0);
  assert.ok(queued.every(v => v.isTerminated));
  t.mock.timers.tick(1000);
  assert.equal(voices(engine).size, 0);
  engine.panic();
});


test('Concurrent unlock shares a context and key-up cancels a pending note', async () => {
  const ctx = new TestContext(); ctx.state = 'suspended';
  let unlock!: () => void;
  const gate = new Promise<void>(resolve => { unlock = resolve; });
  ctx.resume = async () => { await gate; ctx.state = 'running'; };
  let contexts = 0;
  const engine = new ResonatorAudioEngine(() => { contexts++; return ctx as unknown as AudioContext; });
  engine.triggerAttack(60);
  engine.triggerRelease(60);
  const initialized = engine.initAudio();
  unlock(); await initialized; await Promise.resolve();
  assert.equal(contexts, 1);
  assert.equal(voices(engine).size, 0);
  engine.panic();
});

test('Panic while audio unlocks prevents a pending demo from starting', async () => {
  const ctx = new TestContext(); ctx.state = 'suspended';
  let unlock!: () => void;
  const gate = new Promise<void>(resolve => { unlock = resolve; });
  ctx.resume = async () => { await gate; ctx.state = 'running'; };
  const engine = new ResonatorAudioEngine(() => ctx as unknown as AudioContext);
  engine.triggerAttack(60, 0.8, 'demo');
  engine.panic();
  const initialized = engine.initAudio();
  unlock(); await initialized; await Promise.resolve();
  assert.equal(voices(engine).size, 0);
  engine.panic();
});

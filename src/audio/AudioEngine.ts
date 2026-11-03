/**
 * Web Audio API Engine for Resonator // Model 01 Opulence
 * Implements strict per-voice VCA gating and master VCA gating mechanism
 * to ensure complete silence (zero noise floor) when no keys are active,
 * sample-accurate time propagation, real matrix sources, voice stealing with micro-crossfade,
 * and robust panic cleanup.
 */

import {
  SynthParams,
  DEFAULT_SYNTH_PARAMS,
  midiToFrequency,
  makeDistortionCurve,
  calculateVcaEnvelope,
  generateArpSequence,
  divisionToIntervalSeconds,
} from './synthLogic';

// --- Lightweight Web Audio Mock for Node Test Runner Execution ---
function getAudioContextClass(): typeof AudioContext {
  if (typeof window !== 'undefined' && window.AudioContext) {
    return window.AudioContext;
  }
  if (typeof window !== 'undefined' && (window as any).webkitAudioContext) {
    return (window as any).webkitAudioContext;
  }
  
  // Minimal Stub for Node testing environment
  return class MockAudioContext {
    public state: AudioContextState = 'running';
    public currentTime = 0;
    public sampleRate = 44100;
    public destination = {} as AudioNode;

    private createAudioParam() {
      return {
        value: 1,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        setTargetAtTime: () => {},
        cancelScheduledValues: () => {},
        connect: () => {},
        disconnect: () => {},
      };
    }

    private createMockNode() {
      return {
        connect: () => {},
        disconnect: () => {},
        gain: this.createAudioParam(),
        frequency: this.createAudioParam(),
        Q: this.createAudioParam(),
        detune: this.createAudioParam(),
        delayTime: this.createAudioParam(),
        threshold: this.createAudioParam(),
        knee: this.createAudioParam(),
        ratio: this.createAudioParam(),
        attack: this.createAudioParam(),
        release: this.createAudioParam(),
        start: () => {},
        stop: () => {},
        buffer: null,
        loop: false,
        curve: null,
        oversample: 'none',
        type: 'sine',
        fftSize: 1024,
        smoothingTimeConstant: 0.8,
        frequencyBinCount: 512,
        getByteTimeDomainData: (arr: Uint8Array) => arr.fill(128),
        getByteFrequencyData: (arr: Uint8Array) => arr.fill(0),
      };
    }

    createGain() { return this.createMockNode(); }
    createOscillator() { return this.createMockNode(); }
    createBiquadFilter() { return this.createMockNode(); }
    createWaveShaper() { return this.createMockNode(); }
    createDelay() { return this.createMockNode(); }
    createDynamicsCompressor() { return this.createMockNode(); }
    createAnalyser() { return this.createMockNode(); }
    createBuffer(channels: number, length: number, rate: number) {
      return {
        getChannelData: () => new Float32Array(length),
        length,
        duration: length / rate,
        sampleRate: rate,
        numberOfChannels: channels,
      };
    }
    createBufferSource() { return this.createMockNode(); }
    async resume() { this.state = 'running'; }
  } as unknown as typeof AudioContext;
}

let voiceCounter = 0;

/**
 * Individual Synthesizer Voice with strict VCA gating lifecycle
 */
export class SynthVoice {
  public readonly id: string;
  public readonly source: string;
  public readonly note: number;
  public readonly frequency: number;
  public readonly createdAtTime: number;

  private ctx: AudioContext;
  private destination: AudioNode;
  private params: SynthParams;
  private noiseBuffer: AudioBuffer | null;
  private lfoGainToPitch: GainNode | null;
  private subGainToPitch: GainNode | null;

  public mainOsc: OscillatorNode;
  public subOsc: OscillatorNode;
  public subGain: GainNode;
  public noiseSource: AudioBufferSourceNode | null = null;
  public noiseGain: GainNode | null = null;

  // FM Cross-Modulation
  public fmModulator: OscillatorNode;
  public fmGain: GainNode;

  // Ring Modulator
  public dryGain: GainNode;
  public ringModOsc: OscillatorNode;
  public ringModMultiplier: GainNode;
  public ringMixGain: GainNode;

  public voiceFilter: BiquadFilterNode;
  public voiceVca: GainNode; // Strict VCA Gate

  public isReleasing = false;
  public isTerminated = false;
  private releaseTimeoutId: any = null;

  constructor(
    note: number,
    ctx: AudioContext,
    destination: AudioNode,
    params: SynthParams,
    noiseBuffer: AudioBuffer | null,
    pitchBendSemitones: number,
    lfoGainToPitch: GainNode | null,
    subGainToPitch: GainNode | null,
    source: string = 'keyboard',
    startTime?: number
  ) {
    voiceCounter++;
    this.id = `${source}:${note}:${voiceCounter}`;
    this.source = source;
    this.note = note;
    this.ctx = ctx;
    this.destination = destination;
    this.params = params;
    this.noiseBuffer = noiseBuffer;
    this.lfoGainToPitch = lfoGainToPitch;
    this.subGainToPitch = subGainToPitch;

    const baseFreq = midiToFrequency(note + params.octave * 12);
    const bendFactor = Math.pow(2, pitchBendSemitones / 12);
    this.frequency = baseFreq * bendFactor;

    const now = Math.max(startTime ?? ctx.currentTime, ctx.currentTime);
    this.createdAtTime = now;

    // 1. Main Oscillator
    this.mainOsc = ctx.createOscillator();
    this.mainOsc.type = params.waveform;
    this.mainOsc.frequency.setValueAtTime(this.frequency, now);
    this.mainOsc.detune.setValueAtTime(params.detune, now);

    // 2. FM Modulator (Frequency Modulation Cross-Synthesis)
    this.fmModulator = ctx.createOscillator();
    this.fmModulator.type = 'sine';
    const fmRatio = params.fmRatio ?? 2.0;
    this.fmModulator.frequency.setValueAtTime(this.frequency * fmRatio, now);

    this.fmGain = ctx.createGain();
    const fmDepth = params.fmDepth ?? 0.0;
    this.fmGain.gain.setValueAtTime(this.frequency * fmDepth * 4.0, now);
    this.fmModulator.connect(this.fmGain);
    this.fmGain.connect(this.mainOsc.frequency);

    // 3. Ring Modulator & Equal-Power Dry/Wet Morphing
    this.ringModOsc = ctx.createOscillator();
    this.ringModOsc.type = 'triangle';
    this.ringModOsc.frequency.setValueAtTime(this.frequency * 1.5, now);

    this.ringModMultiplier = ctx.createGain();
    this.ringModMultiplier.gain.setValueAtTime(0, now);
    this.ringModOsc.connect(this.ringModMultiplier.gain);

    const ringMix = Math.max(0, Math.min(1, params.ringModMix ?? 0.0));
    const dryLevel = Math.cos(ringMix * Math.PI / 2);
    const wetLevel = Math.sin(ringMix * Math.PI / 2);

    this.dryGain = ctx.createGain();
    this.dryGain.gain.setValueAtTime(dryLevel, now);
    this.mainOsc.connect(this.dryGain);

    this.ringMixGain = ctx.createGain();
    this.ringMixGain.gain.setValueAtTime(wetLevel, now);
    this.mainOsc.connect(this.ringModMultiplier);
    this.ringModMultiplier.connect(this.ringMixGain);

    // 4. Sub Oscillator (-1 octave)
    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'triangle';
    this.subOsc.frequency.setValueAtTime(this.frequency * 0.5, now);

    this.subGain = ctx.createGain();
    this.subGain.gain.setValueAtTime(params.subLevel, now);
    this.subOsc.connect(this.subGain);

    // 5. Noise Source
    this.noiseSource = ctx.createBufferSource();
    if (this.noiseBuffer) {
      this.noiseSource.buffer = this.noiseBuffer;
      this.noiseSource.loop = true;
    }
    this.noiseGain = ctx.createGain();
    const initNoise = typeof params.noiseLevel === 'number' ? params.noiseLevel * 0.35 : 0.0;
    this.noiseGain.gain.setValueAtTime(initNoise, now);
    if (this.noiseSource) {
      this.noiseSource.connect(this.noiseGain);
    }

    // 6. Voice Dynamic Filter
    this.voiceFilter = ctx.createBiquadFilter();
    this.voiceFilter.type = 'lowpass';
    this.voiceFilter.frequency.setValueAtTime(Math.max(30, params.cutoff * 0.3), now);

    // 7. Strict Voice VCA (Voltage Controlled Amplifier)
    this.voiceVca = ctx.createGain();
    this.voiceVca.gain.setValueAtTime(0.0, now);

    // Connect node chain:
    this.dryGain.connect(this.voiceFilter);
    this.ringMixGain.connect(this.voiceFilter);
    this.subGain.connect(this.voiceFilter);
    this.noiseGain.connect(this.voiceFilter);

    this.voiceFilter.connect(this.voiceVca);
    this.voiceVca.connect(this.destination);

    // Real Matrix Patch Routings for Pitch
    if (this.lfoGainToPitch) {
      try { this.lfoGainToPitch.connect(this.mainOsc.detune); } catch {}
    }
    if (this.subGainToPitch) {
      try { this.subGain.connect(this.subGainToPitch); } catch {}
      try { this.subGainToPitch.connect(this.mainOsc.detune); } catch {}
    }
  }

  /**
   * Sample-Accurate Attack Trigger
   */
  public triggerAttack(velocity: number = 0.85, startTime?: number): void {
    if (this.isTerminated) return;
    const now = Math.max(startTime ?? this.ctx.currentTime, this.ctx.currentTime);

    const env = calculateVcaEnvelope(
      this.params.attack,
      this.params.decay,
      this.params.sustain,
      this.params.release,
      velocity
    );

    // Start oscillators cleanly on target scheduled time
    try { this.mainOsc.start(now); } catch {}
    try { this.subOsc.start(now); } catch {}
    try { this.fmModulator.start(now); } catch {}
    try { this.ringModOsc.start(now); } catch {}
    if (this.noiseSource) {
      try { this.noiseSource.start(now); } catch {}
    }

    // 1. VCA Envelope Attack -> Decay -> Sustain
    this.voiceVca.gain.cancelScheduledValues(now);
    this.voiceVca.gain.setValueAtTime(0.0, now);
    this.voiceVca.gain.linearRampToValueAtTime(env.peakGain, now + env.attackDuration);
    this.voiceVca.gain.exponentialRampToValueAtTime(
      Math.max(0.00001, env.sustainLevel),
      now + env.attackDuration + env.decayDuration
    );

    // 2. Filter Envelope Attack -> Decay -> Sustain sweep
    const envCutoffOffset = this.params.envModAmount * 6500;
    const peakFilterFreq = Math.max(30, Math.min(18000, this.params.cutoff + envCutoffOffset * velocity));
    const sustainFilterFreq = Math.max(30, Math.min(18000, this.params.cutoff * (0.3 + 0.7 * this.params.sustain)));

    this.voiceFilter.frequency.cancelScheduledValues(now);
    this.voiceFilter.frequency.setValueAtTime(Math.max(30, this.params.cutoff * 0.25), now);
    this.voiceFilter.frequency.exponentialRampToValueAtTime(peakFilterFreq, now + env.attackDuration);
    this.voiceFilter.frequency.exponentialRampToValueAtTime(sustainFilterFreq, now + env.attackDuration + env.decayDuration);
  }

  /**
   * Sample-Accurate Release Trigger
   */
  public triggerRelease(startTime?: number, onComplete?: () => void, releaseDurationOverride?: number): void {
    if (this.isReleasing || this.isTerminated) return;
    this.isReleasing = true;

    const now = Math.max(startTime ?? this.ctx.currentTime, this.ctx.currentTime);
    const releaseTime = releaseDurationOverride ?? Math.max(0.02, this.params.release);

    const currentGain = Math.max(0.00001, this.voiceVca.gain.value);
    this.voiceVca.gain.cancelScheduledValues(now);
    this.voiceVca.gain.setValueAtTime(currentGain, now);
    this.voiceVca.gain.exponentialRampToValueAtTime(0.00001, now + releaseTime);
    this.voiceVca.gain.linearRampToValueAtTime(0.0, now + releaseTime + 0.005);

    this.voiceFilter.frequency.cancelScheduledValues(now);
    this.voiceFilter.frequency.setValueAtTime(this.voiceFilter.frequency.value, now);
    this.voiceFilter.frequency.exponentialRampToValueAtTime(30, now + releaseTime);

    const msUntilCleanup = Math.max(10, (now + releaseTime + 0.015 - this.ctx.currentTime) * 1000);
    this.releaseTimeoutId = setTimeout(() => {
      this.dispose();
      if (onComplete) onComplete();
    }, msUntilCleanup);
  }

  /**
   * Micro-crossfade 8ms ramp down for smooth voice replacement / stealing
   */
  public microFadeOutAndDispose(now: number): void {
    if (this.isTerminated) return;
    this.isReleasing = true;

    const fadeDur = 0.008; // 8ms linear ramp
    const currentGain = Math.max(0.00001, this.voiceVca.gain.value);
    this.voiceVca.gain.cancelScheduledValues(now);
    this.voiceVca.gain.setValueAtTime(currentGain, now);
    this.voiceVca.gain.linearRampToValueAtTime(0.0, now + fadeDur);

    const ms = Math.max(1, (now + fadeDur + 0.002 - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      this.dispose();
    }, ms);
  }

  public updatePitch(frequency: number): void {
    if (this.isTerminated) return;
    const now = this.ctx.currentTime;
    this.mainOsc.frequency.setTargetAtTime(frequency, now, 0.015);
    this.subOsc.frequency.setTargetAtTime(frequency * 0.5, now, 0.015);
    const fmRatio = this.params.fmRatio ?? 2.0;
    this.fmModulator.frequency.setTargetAtTime(frequency * fmRatio, now, 0.015);
    this.ringModOsc.frequency.setTargetAtTime(frequency * 1.5, now, 0.015);
  }

  public updateDetune(cents: number): void {
    if (this.isTerminated) return;
    this.mainOsc.detune.setTargetAtTime(cents, this.ctx.currentTime, 0.02);
  }

  public updateFm(depth: number, ratio: number): void {
    if (this.isTerminated) return;
    const now = this.ctx.currentTime;
    this.fmModulator.frequency.setTargetAtTime(this.frequency * ratio, now, 0.015);
    this.fmGain.gain.setTargetAtTime(this.frequency * depth * 4.0, now, 0.015);
  }

  public updateRingMod(mix: number): void {
    if (this.isTerminated) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, mix));
    const dryLevel = Math.cos(clamped * Math.PI / 2);
    const wetLevel = Math.sin(clamped * Math.PI / 2);
    this.dryGain.gain.setTargetAtTime(dryLevel, now, 0.015);
    this.ringMixGain.gain.setTargetAtTime(wetLevel, now, 0.015);
  }

  public updateSubLevel(level: number): void {
    if (this.isTerminated) return;
    this.subGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.015);
  }

  public updateNoiseLevel(level: number): void {
    if (this.isTerminated || !this.noiseGain) return;
    this.noiseGain.gain.setTargetAtTime(level * 0.35, this.ctx.currentTime, 0.015);
  }

  public dispose(): void {
    if (this.isTerminated) return;
    this.isTerminated = true;

    if (this.releaseTimeoutId !== null) {
      clearTimeout(this.releaseTimeoutId);
      this.releaseTimeoutId = null;
    }

    try {
      this.mainOsc.stop();
      this.subOsc.stop();
      try { this.fmModulator.stop(); } catch {}
      try { this.ringModOsc.stop(); } catch {}
      if (this.noiseSource) {
        try { this.noiseSource.stop(); } catch {}
      }

      this.mainOsc.disconnect();
      this.subOsc.disconnect();
      this.subGain.disconnect();
      this.fmModulator.disconnect();
      this.fmGain.disconnect();
      this.ringModOsc.disconnect();
      this.ringModMultiplier.disconnect();
      this.ringMixGain.disconnect();
      if (this.noiseGain) this.noiseGain.disconnect();
      this.voiceFilter.disconnect();
      this.voiceVca.disconnect();
    } catch {
      // already stopped or disconnected
    }
  }
}

/**
 * Resonator Audio Engine with Dual-Tier VCA Gating & Real Patch Matrix
 */
export class ResonatorAudioEngine {
  private ctx: AudioContext | null = null;
  private params: SynthParams = { ...DEFAULT_SYNTH_PARAMS };
  private activeVoices: Map<string, SynthVoice> = new Map();
  private noiseBuffer: AudioBuffer | null = null;

  // Master Nodes
  private voicesMixBus: GainNode | null = null;
  private masterVcaGate: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private driveNode: WaveShaperNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;
  private delaySendGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Matrix Real Signal Routing Nodes
  private lfoOsc: OscillatorNode | null = null;
  private lfoGainToFilter: GainNode | null = null;
  private lfoGainToPitch: GainNode | null = null;
  private lfoGainToRes: GainNode | null = null;
  private subGainToPitch: GainNode | null = null;
  private subGainToRes: GainNode | null = null;
  private noiseSourceGlobal: AudioBufferSourceNode | null = null;
  private noiseGainToFilter: GainNode | null = null;

  // Analysis buffers
  private timeDataBuffer: Uint8Array | null = null;
  private freqDataBuffer: Uint8Array | null = null;

  // Performance & Sustain State
  private isInitialized = false;
  private pitchBendSemitones = 0;
  private modWheelAmount = 0;
  private activePatches: Array<{ fromId: string; toId: string }> = [];
  private isSustainPedalDown = false;
  private sustainedMidiNotes: Set<number> = new Set();
  public static readonly MAX_POLYPHONY = 12;

  // Arpeggiator Clock & State
  private heldArpNotes: number[] = [];
  private arpIndex = 0;
  private arpTimerId: any = null;
  private currentArpNote: number | null = null;

  // Listeners
  private panicListeners: Set<() => void> = new Set();
  private onMidiStatusChange?: (status: string) => void;

  constructor() {}

  public addPanicListener(cb: () => void): () => void {
    this.panicListeners.add(cb);
    return () => this.panicListeners.delete(cb);
  }

  public async initAudio(): Promise<boolean> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return true;
    }

    try {
      const AudioCtxClass = getAudioContextClass();
      this.ctx = new AudioCtxClass();
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.createNoiseBuffer();
      this.buildSignalChain();
      this.initLfo();
      this.setupMidi();

      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn('AudioContext failed to initialize:', e);
      return false;
    }
  }

  public getContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = output[i];
      output[i] *= 3.0;
    }
    this.noiseBuffer = buffer;
  }

  private buildSignalChain() {
    if (!this.ctx) return;

    this.voicesMixBus = this.ctx.createGain();
    this.voicesMixBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.masterVcaGate = this.ctx.createGain();
    this.masterVcaGate.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = this.params.filterType;
    this.masterFilter.frequency.setValueAtTime(this.params.cutoff, this.ctx.currentTime);
    this.masterFilter.Q.setValueAtTime(this.params.resonance, this.ctx.currentTime);

    this.driveNode = this.ctx.createWaveShaper();
    this.driveNode.curve = makeDistortionCurve(this.params.drive) as any;
    this.driveNode.oversample = '2x';

    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.params.delayTime, this.ctx.currentTime);

    this.delaySendGain = this.ctx.createGain();
    this.delaySendGain.gain.setValueAtTime(this.params.delayFeedback > 0.01 ? 0.7 : 0, this.ctx.currentTime);

    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.setValueAtTime(this.params.delayFeedback, this.ctx.currentTime);

    this.delayFilter = this.ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(3400, this.ctx.currentTime);

    this.delayNode.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-10, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(6, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(14, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.12, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.params.volume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;
    this.timeDataBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.freqDataBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    this.voicesMixBus.connect(this.masterVcaGate);
    this.masterVcaGate.connect(this.masterFilter);
    this.masterFilter.connect(this.driveNode);
    this.driveNode.connect(this.limiter);

    this.driveNode.connect(this.delaySendGain);
    this.delaySendGain.connect(this.delayNode);
    this.delayFilter.connect(this.limiter);

    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private initLfo() {
    if (!this.ctx || !this.masterFilter) return;

    this.lfoOsc = this.ctx.createOscillator();
    this.lfoOsc.type = this.params.lfoWave;
    this.lfoOsc.frequency.setValueAtTime(this.params.lfoRate, this.ctx.currentTime);

    this.lfoGainToFilter = this.ctx.createGain();
    const lfoAmount = this.params.lfoDepth * (this.params.cutoff * 0.6);
    this.lfoGainToFilter.gain.setValueAtTime(lfoAmount, this.ctx.currentTime);

    this.lfoOsc.connect(this.lfoGainToFilter);
    this.lfoGainToFilter.connect(this.masterFilter.frequency);

    this.lfoGainToPitch = this.ctx.createGain();
    this.lfoGainToPitch.gain.setValueAtTime(0, this.ctx.currentTime);
    this.lfoOsc.connect(this.lfoGainToPitch);

    this.lfoGainToRes = this.ctx.createGain();
    this.lfoGainToRes.gain.setValueAtTime(0, this.ctx.currentTime);
    this.lfoOsc.connect(this.lfoGainToRes);
    this.lfoGainToRes.connect(this.masterFilter.Q);

    this.subGainToPitch = this.ctx.createGain();
    this.subGainToPitch.gain.setValueAtTime(0, this.ctx.currentTime);

    this.subGainToRes = this.ctx.createGain();
    this.subGainToRes.gain.setValueAtTime(0, this.ctx.currentTime);
    this.subGainToRes.connect(this.masterFilter.Q);

    if (this.noiseBuffer) {
      this.noiseSourceGlobal = this.ctx.createBufferSource();
      this.noiseSourceGlobal.buffer = this.noiseBuffer;
      this.noiseSourceGlobal.loop = true;
      this.noiseGainToFilter = this.ctx.createGain();
      this.noiseGainToFilter.gain.setValueAtTime(0, this.ctx.currentTime);
      this.noiseSourceGlobal.connect(this.noiseGainToFilter);
      this.noiseGainToFilter.connect(this.masterFilter.frequency);
      try { this.noiseSourceGlobal.start(); } catch {}
    }

    try { this.lfoOsc.start(); } catch {}
  }

  private updateMasterVcaGate(now: number, releaseDuration: number = 0.05): void {
    if (!this.masterVcaGate) return;
    if (this.activeVoices.size > 0 || this.heldArpNotes.length > 0) {
      this.masterVcaGate.gain.cancelScheduledValues(now);
      this.masterVcaGate.gain.setTargetAtTime(1.0, now, 0.002);
    } else {
      this.masterVcaGate.gain.setTargetAtTime(0.0, now + releaseDuration, 0.015);
    }
  }

  public setupMidi(onStatus?: (status: string) => void) {
    if (onStatus) this.onMidiStatusChange = onStatus;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      if (this.onMidiStatusChange) this.onMidiStatusChange('MIDI NO DISPONIBLE');
      return;
    }

    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        let connectedCount = 0;
        for (const input of midiAccess.inputs.values()) {
          connectedCount++;
          input.onmidimessage = (msg) => this.handleMidiMessage(msg);
        }
        if (this.onMidiStatusChange) {
          this.onMidiStatusChange(connectedCount > 0 ? `MIDI CONECTADO (${connectedCount})` : 'MIDI LISTO');
        }

        midiAccess.onstatechange = () => {
          let count = 0;
          for (const input of midiAccess.inputs.values()) {
            count++;
            input.onmidimessage = (msg) => this.handleMidiMessage(msg);
          }
          if (this.onMidiStatusChange) {
            this.onMidiStatusChange(count > 0 ? `MIDI CONECTADO (${count})` : 'MIDI LISTO');
          }
        };
      })
      .catch(() => {
        if (this.onMidiStatusChange) this.onMidiStatusChange('MIDI NO AUTORIZADO');
      });
  }

  private handleMidiMessage(event: { data: Uint8Array | number[] | null }) {
    if (!event.data) return;
    const [status, data1, data2] = event.data;
    const command = status >> 4;

    switch (command) {
      case 0x9: // Note On
        if (data2 > 0) {
          this.triggerAttack(data1, data2 / 127, 'midi');
        } else {
          this.triggerRelease(data1, 'midi');
        }
        break;
      case 0x8: // Note Off
        this.triggerRelease(data1, 'midi');
        break;
      case 0xe: // Pitch Bend
        const bend = ((data2 << 7) + data1 - 8192) / 8192;
        this.setPitchBend(bend * 2);
        break;
      case 0xb: // CC
        if (data1 === 1) {
          this.setModWheel(data2 / 127);
        } else if (data1 === 64) {
          this.setSustainPedal(data2 >= 64);
        }
        break;
    }
  }

  /**
   * Attack Trigger with source identification and sample-accurate startTime
   */
  public triggerAttack(
    midiNote: number,
    velocity: number = 0.85,
    source: string = 'keyboard',
    startTime?: number
  ): void {
    if (!this.ctx || !this.voicesMixBus) {
      this.initAudio().then(() => this.triggerAttack(midiNote, velocity, source, startTime));
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.params.arpEnabled) {
      if (!this.heldArpNotes.includes(midiNote)) {
        this.heldArpNotes.push(midiNote);
      }
      this.startArpeggiator();
      return;
    }

    this.spawnVoice(midiNote, velocity, source, undefined, startTime);
  }

  public setSustainPedal(isDown: boolean): void {
    this.isSustainPedalDown = isDown;
    if (!isDown) {
      for (const note of this.sustainedMidiNotes) {
        this.triggerRelease(note);
      }
      this.sustainedMidiNotes.clear();
    }
  }

  /**
   * Polyphony Stealing Strategy with Micro-crossfade:
   * 1. Prioritize voices in release (`isReleasing === true`).
   * 2. If none, steal oldest voice.
   * 3. Apply 8ms linear crossfade ramp to prevent clicks.
   */
  private selectVoiceToSteal(): SynthVoice | null {
    if (this.activeVoices.size === 0) return null;

    // First search for releasing voices
    for (const voice of this.activeVoices.values()) {
      if (voice.isReleasing) {
        return voice;
      }
    }

    // Fallback: oldest active voice
    let oldest: SynthVoice | null = null;
    for (const voice of this.activeVoices.values()) {
      if (!oldest || voice.createdAtTime < oldest.createdAtTime) {
        oldest = voice;
      }
    }
    return oldest;
  }

  /**
   * Spawns voice instance with time propagation and identity management
   */
  private spawnVoice(
    midiNote: number,
    velocity: number = 0.85,
    source: string = 'keyboard',
    customDuration?: number,
    startTime?: number
  ): void {
    if (!this.ctx || !this.voicesMixBus) return;
    const now = Math.max(startTime ?? this.ctx.currentTime, this.ctx.currentTime);

    this.sustainedMidiNotes.delete(midiNote);

    // Micro-crossfade any active voice of same midiNote (smooth retrigger)
    for (const [key, voice] of Array.from(this.activeVoices.entries())) {
      if (voice.note === midiNote) {
        voice.microFadeOutAndDispose(now);
        this.activeVoices.delete(key);
      }
    }

    // Polyphony stealing when reaching MAX_POLYPHONY limit
    if (this.activeVoices.size >= ResonatorAudioEngine.MAX_POLYPHONY) {
      const victim = this.selectVoiceToSteal();
      if (victim) {
        victim.microFadeOutAndDispose(now);
        this.activeVoices.delete(victim.id);
      }
    }

    const voice = new SynthVoice(
      midiNote,
      this.ctx,
      this.voicesMixBus,
      this.params,
      this.noiseBuffer,
      this.pitchBendSemitones,
      this.lfoGainToPitch,
      this.subGainToPitch,
      source,
      now
    );

    this.activeVoices.set(voice.id, voice);
    this.updateMasterVcaGate(now);
    voice.triggerAttack(velocity, now);

    if (customDuration !== undefined) {
      const releaseTimeAt = now + customDuration;
      voice.triggerRelease(releaseTimeAt, () => {
        this.activeVoices.delete(voice.id);
        if (this.ctx) {
          this.updateMasterVcaGate(this.ctx.currentTime, 0.05);
        }
      });
    }
  }

  /**
   * Release Trigger matching note & source with sample-accurate clock
   */
  public triggerRelease(midiNote: number, source?: string, startTime?: number): void {
    if (this.params.arpEnabled) {
      this.heldArpNotes = this.heldArpNotes.filter((n) => n !== midiNote);
      if (this.heldArpNotes.length === 0) {
        this.stopArpeggiator();
      }
    }

    if (this.isSustainPedalDown) {
      this.sustainedMidiNotes.add(midiNote);
      return;
    }

    if (!this.ctx) return;
    const now = Math.max(startTime ?? this.ctx.currentTime, this.ctx.currentTime);

    // Find non-releasing voice matching note
    for (const [key, voice] of Array.from(this.activeVoices.entries())) {
      if (voice.note === midiNote && (!source || voice.source === source) && !voice.isReleasing) {
        voice.triggerRelease(now, () => {
          this.activeVoices.delete(key);
          if (this.ctx) {
            this.updateMasterVcaGate(this.ctx.currentTime, 0.05);
          }
        });
      }
    }

    this.updateMasterVcaGate(now, this.params.release);
  }

  public noteOn(midiNote: number, velocity: number = 0.85): void {
    this.triggerAttack(midiNote, velocity, 'keyboard');
  }

  public noteOff(midiNote: number): void {
    this.triggerRelease(midiNote, 'keyboard');
  }

  /**
   * Panic / Emergency Reset:
   * Clears active voices, demo timers, sustain, arpeggiator, and rebuilds delay node without leaks.
   */
  public panic(): void {
    // Notify UI / App listeners to cancel pending demo timers
    for (const cb of this.panicListeners) {
      try { cb(); } catch {}
    }

    for (const voice of this.activeVoices.values()) {
      voice.dispose();
    }
    this.activeVoices.clear();
    this.heldArpNotes = [];
    this.sustainedMidiNotes.clear();
    this.isSustainPedalDown = false;
    this.stopArpeggiator();

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.masterVcaGate) {
      this.masterVcaGate.gain.cancelScheduledValues(now);
      this.masterVcaGate.gain.setValueAtTime(0.0, now);
    }

    // Explicit disconnection to prevent node accumulation on delay rebuild
    if (this.delayNode) {
      try { this.delayNode.disconnect(); } catch {}
    }
    if (this.delaySendGain) {
      try { this.delaySendGain.disconnect(); } catch {}
    }
    if (this.delayFilter) {
      try { this.delayFilter.disconnect(); } catch {}
    }
    if (this.delayFeedbackGain) {
      try { this.delayFeedbackGain.disconnect(); } catch {}
    }

    try {
      this.delayNode = this.ctx.createDelay(2.0);
      this.delayNode.delayTime.setValueAtTime(this.params.delayTime, now);

      if (this.delayFilter && this.delayFeedbackGain) {
        this.delayNode.connect(this.delayFilter);
        this.delayFilter.connect(this.delayFeedbackGain);
        this.delayFeedbackGain.connect(this.delayNode);
      }
      if (this.driveNode && this.delaySendGain) {
        this.driveNode.connect(this.delaySendGain);
        this.delaySendGain.connect(this.delayNode);
      }
      if (this.delayFilter && this.limiter) {
        this.delayFilter.connect(this.limiter);
      }
    } catch {}

    const fb = Math.min(0.85, this.params.delayFeedback);
    if (this.delayFeedbackGain && this.delaySendGain) {
      this.delayFeedbackGain.gain.setTargetAtTime(fb, now, 0.02);
      this.delaySendGain.gain.setTargetAtTime(fb > 0.01 ? 0.7 : 0, now, 0.02);
    }
  }

  public allNotesOff(): void {
    this.panic();
  }

  /**
   * Arpeggiator Scheduler with Drift Recovery and Sample-Accurate Timing
   */
  private startArpeggiator() {
    if (this.arpTimerId !== null) return;

    this.arpIndex = 0;
    let nextNoteTime = this.ctx ? this.ctx.currentTime : 0;
    const scheduleAheadTime = 0.12; // 120ms lookahead
    const timerInterval = 25; // 25ms loop

    const scheduler = () => {
      if (this.heldArpNotes.length === 0 || !this.params.arpEnabled || !this.ctx) {
        this.stopArpeggiator();
        return;
      }

      const currentCtxTime = this.ctx.currentTime;

      // Drift recovery if scheduler lagged behind
      if (nextNoteTime < currentCtxTime) {
        nextNoteTime = currentCtxTime + 0.005;
      }

      while (nextNoteTime < currentCtxTime + scheduleAheadTime) {
        const seq = generateArpSequence(this.heldArpNotes, this.params.arpPattern, this.params.arpOctaves);
        if (seq.length === 0) break;

        const noteToPlay =
          this.params.arpPattern === 'random'
            ? seq[Math.floor(Math.random() * seq.length)]
            : seq[this.arpIndex % seq.length];

        this.arpIndex++;
        const currentInterval = divisionToIntervalSeconds(this.params.arpBpm, this.params.arpDivision);
        const noteDuration = currentInterval * 0.75;

        // Spawn voice with exact programmed time
        this.spawnVoice(noteToPlay, 0.85, 'arp', noteDuration, nextNoteTime);

        nextNoteTime += currentInterval;
      }

      this.arpTimerId = setTimeout(scheduler, timerInterval);
    };

    scheduler();
  }

  private stopArpeggiator() {
    if (this.arpTimerId !== null) {
      clearTimeout(this.arpTimerId);
      this.arpTimerId = null;
    }
    if (this.currentArpNote !== null) {
      this.triggerRelease(this.currentArpNote, 'arp');
      this.currentArpNote = null;
    }
    if (this.ctx) {
      this.updateMasterVcaGate(this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Live Smooth Parameter Controls
   */
  public setParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
    this.params[key] = value;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    switch (key) {
      case 'cutoff':
        if (this.masterFilter) {
          this.masterFilter.frequency.setTargetAtTime(value as number, now, 0.015);
        }
        if (this.lfoGainToFilter) {
          const lfoAmount = this.params.lfoDepth * ((value as number) * 0.6);
          this.lfoGainToFilter.gain.setTargetAtTime(lfoAmount, now, 0.015);
        }
        break;

      case 'resonance':
        if (this.masterFilter) {
          this.masterFilter.Q.setTargetAtTime(value as number, now, 0.015);
        }
        break;

      case 'filterType':
        if (this.masterFilter) {
          this.masterFilter.type = value as BiquadFilterType;
        }
        break;

      case 'waveform':
        for (const voice of this.activeVoices.values()) {
          voice.mainOsc.type = value as OscillatorType;
        }
        break;

      case 'detune':
        for (const voice of this.activeVoices.values()) {
          voice.updateDetune(value as number);
        }
        break;

      case 'subLevel':
        for (const voice of this.activeVoices.values()) {
          voice.updateSubLevel(value as number);
        }
        break;

      case 'noiseLevel':
        for (const voice of this.activeVoices.values()) {
          voice.updateNoiseLevel(value as number);
        }
        break;

      case 'fmDepth':
      case 'fmRatio':
        for (const voice of this.activeVoices.values()) {
          voice.updateFm(this.params.fmDepth ?? 0.0, this.params.fmRatio ?? 2.0);
        }
        break;

      case 'ringModMix':
        for (const voice of this.activeVoices.values()) {
          voice.updateRingMod(value as number);
        }
        break;

      case 'drive':
        if (this.driveNode) {
          this.driveNode.curve = makeDistortionCurve(value as number) as any;
        }
        break;

      case 'delayTime':
        if (this.delayNode) {
          this.delayNode.delayTime.setTargetAtTime(value as number, now, 0.02);
        }
        break;

      case 'delayFeedback':
        if (this.delayFeedbackGain && this.delaySendGain) {
          const fb = Math.min(0.85, value as number);
          this.delayFeedbackGain.gain.setTargetAtTime(fb, now, 0.02);
          this.delaySendGain.gain.setTargetAtTime(fb > 0.01 ? 0.7 : 0, now, 0.02);
        }
        break;

      case 'volume':
        if (this.masterGain) {
          this.masterGain.gain.setTargetAtTime(value as number, now, 0.015);
        }
        break;

      case 'lfoRate':
        if (this.lfoOsc) {
          this.lfoOsc.frequency.setTargetAtTime(value as number, now, 0.02);
        }
        break;

      case 'lfoDepth':
        if (this.lfoGainToFilter && this.masterFilter) {
          const lfoAmt = (value as number) * (this.params.cutoff * 0.6);
          this.lfoGainToFilter.gain.setTargetAtTime(lfoAmt, now, 0.02);
        }
        break;

      case 'lfoWave':
        if (this.lfoOsc) {
          this.lfoOsc.type = value as OscillatorType;
        }
        break;

      case 'arpEnabled':
        if (!(value as boolean)) {
          this.stopArpeggiator();
        }
        break;
    }
  }

  public setPitchBend(semitones: number): void {
    this.pitchBendSemitones = semitones;
    if (!this.ctx) return;
    const factor = Math.pow(2, semitones / 12);
    for (const voice of this.activeVoices.values()) {
      voice.updatePitch(voice.frequency * factor);
    }
  }

  public setModWheel(amount: number): void {
    this.modWheelAmount = amount;
    if (!this.ctx || !this.lfoGainToFilter) return;
    const now = this.ctx.currentTime;
    const lfoAmt = (this.params.lfoDepth + amount * 0.6) * (this.params.cutoff * 0.7);
    this.lfoGainToFilter.gain.setTargetAtTime(lfoAmt, now, 0.015);
  }

  /**
   * Real Patch Matrix Node Routing with Exact Named Audio Sources
   */
  public updatePatches(cables: Array<{ fromId: string; toId: string }>): void {
    this.activePatches = cables;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Pitch Modulations
    const lfoToPitch = cables.some((c) => c.fromId === 'lfo-out' && c.toId === 'vco-pitch');
    const subToPitch = cables.some((c) => c.fromId === 'sub-out' && c.toId === 'vco-pitch');

    if (this.lfoGainToPitch) {
      this.lfoGainToPitch.gain.setTargetAtTime(lfoToPitch ? 35 : 0, now, 0.02);
    }
    if (this.subGainToPitch) {
      this.subGainToPitch.gain.setTargetAtTime(subToPitch ? 15 : 0, now, 0.02);
    }

    if (this.masterFilter) {
      // 2. Cutoff Modulations
      const lfoToCut = cables.some((c) => c.fromId === 'lfo-out' && c.toId === 'vcf-cut');
      const noiseToCut = cables.some((c) => c.fromId === 'noise-out' && c.toId === 'vcf-cut');

      if (this.lfoGainToFilter) {
        const baseLfoAmt = this.params.lfoDepth * (this.params.cutoff * 0.6);
        const lfoCutAmt = lfoToCut ? baseLfoAmt * 2.5 : baseLfoAmt;
        this.lfoGainToFilter.gain.setTargetAtTime(lfoCutAmt, now, 0.02);
      }

      if (this.noiseGainToFilter) {
        const noiseAmt = noiseToCut ? 1400 * (this.params.noiseLevel || 0.2) : 0;
        this.noiseGainToFilter.gain.setTargetAtTime(noiseAmt, now, 0.02);
      }

      // 3. Resonance Q Modulations
      const lfoToRes = cables.some((c) => c.fromId === 'lfo-out' && c.toId === 'vcf-res');
      const subToRes = cables.some((c) => c.fromId === 'sub-out' && c.toId === 'vcf-res');

      if (this.lfoGainToRes) {
        this.lfoGainToRes.gain.setTargetAtTime(lfoToRes ? 4.5 : 0, now, 0.02);
      }
      if (this.subGainToRes) {
        this.subGainToRes.gain.setTargetAtTime(subToRes ? 3.5 * (this.params.subLevel || 0.3) : 0, now, 0.02);
      }
    }
  }

  public getVisualizerData(): {
    timeDomain: Uint8Array;
    frequency: Uint8Array;
    rmsEnergy: number;
    spectralCentroid: number;
    activeVoiceCount: number;
  } {
    if (!this.analyser || !this.timeDataBuffer || !this.freqDataBuffer) {
      return {
        timeDomain: new Uint8Array(256),
        frequency: new Uint8Array(256),
        rmsEnergy: 0,
        spectralCentroid: 0,
        activeVoiceCount: this.activeVoices.size,
      };
    }

    this.analyser.getByteTimeDomainData(this.timeDataBuffer as any);
    this.analyser.getByteFrequencyData(this.freqDataBuffer as any);

    let sumSq = 0;
    for (let i = 0; i < this.timeDataBuffer.length; i++) {
      const norm = (this.timeDataBuffer[i] - 128) / 128;
      sumSq += norm * norm;
    }
    const rms = Math.sqrt(sumSq / this.timeDataBuffer.length);

    let num = 0;
    let denom = 0;
    for (let i = 0; i < this.freqDataBuffer.length; i++) {
      const mag = this.freqDataBuffer[i];
      num += i * mag;
      denom += mag;
    }
    const centroid = denom > 0 ? num / denom / this.freqDataBuffer.length : 0.2;

    return {
      timeDomain: this.timeDataBuffer,
      frequency: this.freqDataBuffer,
      rmsEnergy: Math.min(1.0, rms * 2.8),
      spectralCentroid: centroid,
      activeVoiceCount: this.activeVoices.size,
    };
  }

  public getParams(): SynthParams {
    return { ...this.params };
  }
}

export const audioEngine = new ResonatorAudioEngine();

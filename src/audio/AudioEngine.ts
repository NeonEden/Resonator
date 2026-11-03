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
import { isSupportedPatch } from './patchRouting';

function getAudioContextClass(): typeof AudioContext {
  const audioWindow = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioCtx = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioCtx) throw new Error('Este navegador no admite Web Audio.');
  return AudioCtx;
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
  private subGainToPitch: GainNode;
  private subGainToRes: GainNode;

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

  private releaseAt = Infinity;
  public get isReleasing(): boolean { return this.ctx.currentTime >= this.releaseAt; }
  public isTerminated = false;


  constructor(
    note: number,
    ctx: AudioContext,
    destination: AudioNode,
    params: SynthParams,
    noiseBuffer: AudioBuffer | null,
    pitchBendSemitones: number,
    lfoGainToPitch: GainNode | null,

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
    this.subGainToPitch = ctx.createGain();
    this.subGainToRes = ctx.createGain();
    this.subGainToPitch.gain.value = 0;
    this.subGainToRes.gain.value = 0;

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
    this.subOsc.connect(this.subGainToPitch);
    this.subGainToPitch.connect(this.mainOsc.detune);
    this.subOsc.connect(this.subGainToRes);
    this.subGainToRes.connect(this.voiceFilter.Q);
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
    if (this.isTerminated) return;

    const now = Math.max(startTime ?? this.ctx.currentTime, this.ctx.currentTime);
    if (now >= this.releaseAt) return;
    this.releaseAt = now;
    const releaseTime = releaseDurationOverride ?? Math.max(0.02, this.params.release);

    // Preserve the envelope value at the scheduled release time, including during attack.
    this.voiceVca.gain.cancelAndHoldAtTime(now);
    // Linear release supports an exact zero sustain without an exponential discontinuity.
    this.voiceVca.gain.linearRampToValueAtTime(0.0, now + releaseTime);
    this.voiceFilter.frequency.cancelAndHoldAtTime(now);
    this.voiceFilter.frequency.exponentialRampToValueAtTime(30, now + releaseTime);

    this.finishAt(now + releaseTime + 0.015, onComplete);
  }

  /**
   * Micro-crossfade 8ms ramp down for smooth voice replacement / stealing
   */
  public microFadeOutAndDispose(now: number, onComplete?: () => void): void {
    if (this.isTerminated) return;
    this.releaseAt = now;

    const fadeDur = 0.008; // 8ms linear ramp
    this.voiceVca.gain.cancelAndHoldAtTime(now);
    this.voiceVca.gain.linearRampToValueAtTime(0.0, now + fadeDur);

    this.finishAt(now + fadeDur, onComplete);
  }

  private finishAt(time: number, onComplete?: () => void): void {
    // Audio time keeps teardown aligned even when the tab is throttled or audio is suspended.
    this.mainOsc.onended = () => {
      this.dispose();
      onComplete?.();
    };
    this.mainOsc.stop(time);
    this.subOsc.stop(time);
    this.fmModulator.stop(time);
    this.ringModOsc.stop(time);
    this.noiseSource?.stop(time);
  }

  public updateSubPatches(pitch: boolean, resonance: boolean): void {
    this.subGainToPitch.gain.setTargetAtTime(pitch ? 15 : 0, this.ctx.currentTime, 0.02);
    this.subGainToRes.gain.setTargetAtTime(resonance ? 3.5 : 0, this.ctx.currentTime, 0.02);
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
    this.mainOsc.onended = null;


    try {
      this.mainOsc.stop();
      this.subOsc.stop();
      try { this.fmModulator.stop(); } catch {}
      try { this.ringModOsc.stop(); } catch {}
      if (this.noiseSource) {
        try { this.noiseSource.stop(); } catch {}
      }

      this.lfoGainToPitch?.disconnect(this.mainOsc.detune);
      this.mainOsc.disconnect();
      this.dryGain.disconnect();
      this.subGainToPitch.disconnect();
      this.subGainToRes.disconnect();
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
  private sustainSources = new Set<string>();
  private sustainedVoices = new Set<string>();
  private fadingVoices = new Set<SynthVoice>();
  private initialization: Promise<boolean> | null = null;
  private generation = 0;
  private pendingAttacks = new Map<string, symbol>();
  private arpInputs = new Map<string, number>();
  public static readonly MAX_POLYPHONY = 12;

  // Arpeggiator Clock & State
  private heldArpNotes: number[] = [];
  private arpIndex = 0;
  private arpTimerId: any = null;

  // Listeners
  private panicListeners: Set<() => void> = new Set();
  private onMidiStatusChange?: (status: string) => void;

  constructor(private readonly createContext: () => AudioContext = () => new (getAudioContextClass())()) {}

  public addPanicListener(cb: () => void): () => void {
    this.panicListeners.add(cb);
    return () => this.panicListeners.delete(cb);
  }

  public initAudio(): Promise<boolean> {
    if (!this.initialization) {
      this.initialization = this.initializeAudio().finally(() => { this.initialization = null; });
    }
    return this.initialization;
  }

  private async initializeAudio(): Promise<boolean> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return true;
    }

    try {
      this.ctx = this.createContext();
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.createNoiseBuffer();
      this.buildSignalChain();
      this.initLfo();
      this.setupMidi();

      this.isInitialized = true;
      this.updatePatches(this.activePatches);
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
    const lfoAmount = (this.params.lfoDepth + this.modWheelAmount * 0.6) * (this.params.cutoff * 0.6);
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
          input.onmidimessage = (msg) => this.handleMidiMessage(msg, input.id);
        }
        if (this.onMidiStatusChange) {
          this.onMidiStatusChange(connectedCount > 0 ? `MIDI CONECTADO (${connectedCount})` : 'MIDI LISTO');
        }

        midiAccess.onstatechange = (event) => {
          const port = event.port;
          if (port?.type === 'input' && port.state === 'disconnected') {
            for (let channel = 0; channel < 16; channel++) {
              const source = 'midi:' + port.id + ':' + channel;
              this.setSustainPedal(false, source);
              this.releaseSource(source);
            }
          }
          let count = 0;
          for (const input of midiAccess.inputs.values()) {
            count++;
            input.onmidimessage = (msg) => this.handleMidiMessage(msg, input.id);
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

  private handleMidiMessage(event: { data: Uint8Array | number[] | null }, device = 'default') {
    if (!event.data) return;
    const [status, data1, data2] = event.data;
    const command = status >> 4;
    const source = 'midi:' + device + ':' + (status & 15);

    switch (command) {
      case 0x9: // Note On
        if (data2 > 0) {
          this.triggerAttack(data1, data2 / 127, source);
        } else {
          this.triggerRelease(data1, source);
        }
        break;
      case 0x8: // Note Off
        this.triggerRelease(data1, source);
        break;
      case 0xe: // Pitch Bend
        const bend = ((data2 << 7) + data1 - 8192) / 8192;
        this.setPitchBend(bend * 2);
        break;
      case 0xb: // CC
        if (data1 === 1) {
          this.setModWheel(data2 / 127);
        } else if (data1 === 64) {
          this.setSustainPedal(data2 >= 64, source);
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
    if (!this.isInitialized || !this.ctx || !this.voicesMixBus) {
      const generation = this.generation;
      const key = source + ':' + midiNote;
      const token = Symbol();
      this.pendingAttacks.set(key, token);
      this.initAudio().then(ok => {
        if (ok && generation === this.generation && this.pendingAttacks.get(key) === token) {
          this.pendingAttacks.delete(key);
          this.triggerAttack(midiNote, velocity, source, startTime);
        }
      });
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.params.arpEnabled) {
      this.arpInputs.set(source + ':' + midiNote, midiNote);
      if (!this.heldArpNotes.includes(midiNote)) {
        this.heldArpNotes.push(midiNote);
      }
      this.startArpeggiator();
      return;
    }

    this.spawnVoice(midiNote, velocity, source, undefined, startTime);
  }

  public setSustainPedal(isDown: boolean, source = '*'): void {
    if (isDown) this.sustainSources.add(source);
    else this.sustainSources.delete(source);
    for (const id of this.sustainedVoices) {
      const voice = this.activeVoices.get(id);
      if (voice && !this.sustainSources.has('*') && !this.sustainSources.has(voice.source)) {
        this.releaseVoice(voice);
      }
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

    // Micro-crossfade any active voice of same midiNote (smooth retrigger)
    for (const [key, voice] of Array.from(this.activeVoices.entries())) {
      if (voice.note === midiNote && voice.source === source) {
        this.retireVoice(voice, now);
        this.activeVoices.delete(key);
      }
    }

    // Polyphony stealing when reaching MAX_POLYPHONY limit
    if (this.activeVoices.size >= ResonatorAudioEngine.MAX_POLYPHONY) {
      const victim = this.selectVoiceToSteal();
      if (victim) {
        this.retireVoice(victim, now);
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
      source,
      now
    );

    this.activeVoices.set(voice.id, voice);
    voice.updateSubPatches(
      this.activePatches.some(c => c.fromId === 'sub-out' && c.toId === 'vco-pitch'),
      this.activePatches.some(c => c.fromId === 'sub-out' && c.toId === 'vcf-res')
    );
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

  private retireVoice(voice: SynthVoice, time: number): void {
    this.sustainedVoices.delete(voice.id);
    this.fadingVoices.add(voice);
    voice.microFadeOutAndDispose(time, () => this.fadingVoices.delete(voice));
  }

  private releaseVoice(voice: SynthVoice, time?: number): void {
    this.sustainedVoices.delete(voice.id);
    voice.triggerRelease(time, () => {
      this.activeVoices.delete(voice.id);
      if (this.ctx) this.updateMasterVcaGate(this.ctx.currentTime, 0.05);
    });
  }

  /**
   * Release Trigger matching note & source with sample-accurate clock
   */
  public triggerRelease(midiNote: number, source?: string, startTime?: number): void {
    this.pendingAttacks.delete((source ?? 'keyboard') + ':' + midiNote);
    if (this.params.arpEnabled) {
      this.arpInputs.delete((source ?? 'keyboard') + ':' + midiNote);
      this.heldArpNotes = [...new Set(this.arpInputs.values())];
      if (this.heldArpNotes.length === 0) this.stopArpeggiator();
    }

    if (!this.ctx) return;
    const now = Math.max(startTime ?? this.ctx.currentTime, this.ctx.currentTime);
    for (const voice of this.activeVoices.values()) {
      if (voice.note !== midiNote || voice.source !== (source ?? 'keyboard') || voice.isReleasing) continue;
      if ((this.sustainSources.has('*') || this.sustainSources.has(voice.source)) && voice.source !== 'demo' && voice.source !== 'arp') {
        this.sustainedVoices.add(voice.id);
      } else {
        this.releaseVoice(voice, now);
      }
    }

    this.updateMasterVcaGate(now, this.params.release);
  }

  public releaseSource(source: string): void {
    for (const key of this.pendingAttacks.keys()) {
      if (key.startsWith(source + ':')) this.pendingAttacks.delete(key);
    }
    for (const [key] of this.arpInputs) {
      if (key.startsWith(source + ':')) this.arpInputs.delete(key);
    }
    this.heldArpNotes = [...new Set(this.arpInputs.values())];
    if (this.heldArpNotes.length === 0) this.stopArpeggiator();
    for (const voice of this.activeVoices.values()) {
      if (voice.source === source) this.releaseVoice(voice);
    }
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
    this.generation++;
    for (const voice of this.fadingVoices) voice.dispose();
    this.fadingVoices.clear();
    // Notify UI / App listeners to cancel pending demo timers
    for (const cb of this.panicListeners) {
      try { cb(); } catch {}
    }

    for (const voice of this.activeVoices.values()) {
      voice.dispose();
    }
    this.activeVoices.clear();
    this.heldArpNotes = [];
    this.sustainedVoices.clear();
    this.sustainSources.clear();
    this.pendingAttacks.clear();
    this.arpInputs.clear();
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
    for (const [id, voice] of this.activeVoices) {
      if (voice.source === 'arp') {
        if (this.ctx && voice.createdAtTime > this.ctx.currentTime) {
          voice.dispose();
          this.activeVoices.delete(id);
        } else {
          this.releaseVoice(voice);
        }
      }
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

      case 'octave':
        this.setPitchBend(this.pitchBendSemitones);
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
          this.arpInputs.clear();
          this.heldArpNotes = [];
        }
        break;
    }
    if (['cutoff', 'lfoDepth', 'noiseLevel', 'subLevel'].includes(key)) this.updatePatches(this.activePatches);
  }

  public setPitchBend(semitones: number): void {
    this.pitchBendSemitones = semitones;
    if (!this.ctx) return;
    const factor = Math.pow(2, semitones / 12);
    for (const voice of this.activeVoices.values()) {
      voice.updatePitch(midiToFrequency(voice.note + this.params.octave * 12) * factor);
    }
  }

  public setModWheel(amount: number): void {
    this.modWheelAmount = amount;
    if (!this.ctx || !this.lfoGainToFilter) return;
    const now = this.ctx.currentTime;
    this.updatePatches(this.activePatches);
  }

  /**
   * Real Patch Matrix Node Routing with Exact Named Audio Sources
   */
  public updatePatches(cables: Array<{ fromId: string; toId: string }>): void {
    this.activePatches = cables.filter(isSupportedPatch);
    cables = this.activePatches;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Pitch Modulations
    const lfoToPitch = cables.some((c) => c.fromId === 'lfo-out' && c.toId === 'vco-pitch');
    const subToPitch = cables.some((c) => c.fromId === 'sub-out' && c.toId === 'vco-pitch');

    if (this.lfoGainToPitch) {
      this.lfoGainToPitch.gain.setTargetAtTime(lfoToPitch ? 35 : 0, now, 0.02);
    }
    const subToRes = cables.some(c => c.fromId === 'sub-out' && c.toId === 'vcf-res');
    for (const voice of this.activeVoices.values()) voice.updateSubPatches(subToPitch, subToRes);

    if (this.masterFilter) {
      // 2. Cutoff Modulations
      const lfoToCut = cables.some((c) => c.fromId === 'lfo-out' && c.toId === 'vcf-cut');
      const noiseToCut = cables.some((c) => c.fromId === 'noise-out' && c.toId === 'vcf-cut');

      if (this.lfoGainToFilter) {
        const baseLfoAmt = (this.params.lfoDepth + this.modWheelAmount * 0.6) * (this.params.cutoff * 0.6);
        const lfoCutAmt = lfoToCut ? baseLfoAmt * 2.5 : baseLfoAmt;
        this.lfoGainToFilter.gain.setTargetAtTime(lfoCutAmt, now, 0.02);
      }

      if (this.noiseGainToFilter) {
        const noiseAmt = noiseToCut ? 1400 * this.params.noiseLevel : 0;
        this.noiseGainToFilter.gain.setTargetAtTime(noiseAmt, now, 0.02);
      }

      // 3. Resonance Q Modulations
      const lfoToRes = cables.some((c) => c.fromId === 'lfo-out' && c.toId === 'vcf-res');


      if (this.lfoGainToRes) {
        this.lfoGainToRes.gain.setTargetAtTime(lfoToRes ? 4.5 : 0, now, 0.02);
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

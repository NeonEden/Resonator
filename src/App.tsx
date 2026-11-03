/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  audioEngine,
} from './audio/AudioEngine';
import {
  SynthParams,
  DEFAULT_SYNTH_PARAMS,
  PatchCable,
} from './audio/synthLogic';
import {
  ResonatorPresetJson,
  PresetVisuals,
  getCurrentPreset,
  applyPreset,
  savePresetToLocalStorage,
  loadPresetList,
  deleteUserPresetFromStorage,
  parseAndValidatePresetJson,
} from './audio/presetManager';
import { PlasmaCore } from './components/PlasmaCore';
import { Knob } from './components/Knob';
import { Slider } from './components/Slider';
import { OscilloscopeDisplay } from './components/OscilloscopeDisplay';
import { PatchMatrix } from './components/PatchMatrix';
import { Keyboard } from './components/Keyboard';
import { PitchModWheels } from './components/PitchModWheels';
import { ArpController } from './components/ArpController';
import { PresetBar } from './components/PresetBar';
import { NeuralBridge } from './components/NeuralBridge';
import { PresetLibraryModal } from './components/PresetLibraryModal';
import { Power, Radio } from 'lucide-react';

export default function App() {
  const [params, setParams] = useState<SynthParams>({ ...DEFAULT_SYNTH_PARAMS });
  const [presetList, setPresetList] = useState<ResonatorPresetJson[]>(() => loadPresetList());
  const [activePresetName, setActivePresetName] = useState<string>('Plasma Ion 01');
  const [visuals, setVisuals] = useState<PresetVisuals>({
    plasmaColor: '#59cbd0',
    thermalGlow: 0.95,
  });
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [isAudioRunning, setIsAudioRunning] = useState<boolean>(false);
  const [midiStatus, setMidiStatus] = useState<string>('MIDI: LISTO');
  const [cables, setCables] = useState<PatchCable[]>([
    {
      id: 'cable-init-1',
      fromId: 'lfo-out',
      toId: 'vcf-cut',
      color: '#b27546',
      glowColor: 'rgba(255, 181, 69, 0.7)',
    },
    {
      id: 'cable-init-2',
      fromId: 'env-out',
      toId: 'vco-pitch',
      color: '#ad7655',
      glowColor: 'rgba(89, 203, 208, 0.6)',
    },
  ]);

  // Initial load: Apply default preset
  useEffect(() => {
    const defaultP = presetList.find(p => p.name === 'Plasma Ion 01') || presetList[0];
    if (defaultP) {
      applyPreset(defaultP, setParams, setVisuals, setCables);
    }
  }, []);

  // Audio Context unlock handler (clean, silent initialization, zero noise floor)
  const handleEngageAudio = async () => {
    const success = await audioEngine.initAudio();
    if (success) {
      setIsAudioRunning(true);
      audioEngine.setupMidi((status) => setMidiStatus(status));
    }
  };

  // Sync cables with audio engine modulation
  useEffect(() => {
    audioEngine.updatePatches(cables);
  }, [cables]);

  // Note On / Off triggers (Strict VCA Attack and Release cycles)
  const handleNoteOn = useCallback((note: number) => {
    if (!isAudioRunning) {
      handleEngageAudio();
    }
    setActiveNotes(prev => new Set(prev).add(note));
    audioEngine.triggerAttack(note);
  }, [isAudioRunning]);

  const handleNoteOff = useCallback((note: number) => {
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
    audioEngine.triggerRelease(note);
  }, []);

  // Update a specific synthesizer parameter
  const updateParam = <K extends keyof SynthParams>(key: K, val: SynthParams[K]) => {
    setParams(prev => ({ ...prev, [key]: val }));
    audioEngine.setParam(key, val);
  };

  // --- AUDIO PREVIEW TRANSLATION TRIGGER ---
  const playPresetPreview = useCallback(async (customPreset?: ResonatorPresetJson) => {
    // 1. Ensure Audio Context is initialized and active
    const success = await audioEngine.initAudio();
    if (success) {
      setIsAudioRunning(true);
      audioEngine.setupMidi((status) => setMidiStatus(status));
    }

    // 2. Calculate preview pitch based on patch octave
    const oct = customPreset ? customPreset.osc.octave : params.octave;
    const rootNote = Math.max(36, Math.min(84, 60 + (oct || 0) * 12));

    // 3. Play a rich 2-stage melodic chord phrase (Root -> Fifth)
    audioEngine.triggerAttack(rootNote, 0.85);

    const t1 = setTimeout(() => {
      audioEngine.triggerAttack(rootNote + 7, 0.75);
    }, 180);

    const t2 = setTimeout(() => {
      audioEngine.triggerRelease(rootNote);
      audioEngine.triggerRelease(rootNote + 7);
    }, 620);
  }, [params.octave]);

  // --- PRESET MANAGEMENT HANDLERS ---
  const handleSelectPreset = (preset: ResonatorPresetJson) => {
    setActivePresetName(preset.name);
    applyPreset(preset, setParams, setVisuals, setCables);
    playPresetPreview(preset);
  };

  const handleSavePreset = (name: string, author: string) => {
    const newPreset = getCurrentPreset(params, visuals, cables, name, author);
    savePresetToLocalStorage(newPreset);
    setPresetList(loadPresetList());
    setActivePresetName(newPreset.name);
  };

  const handleDeletePreset = (name: string) => {
    deleteUserPresetFromStorage(name);
    const updated = loadPresetList();
    setPresetList(updated);
    if (activePresetName === name && updated.length > 0) {
      handleSelectPreset(updated[0]);
    }
  };

  const handleImportPreset = (imported: ResonatorPresetJson) => {
    savePresetToLocalStorage(imported);
    const updated = loadPresetList();
    setPresetList(updated);
    setActivePresetName(imported.name);
    applyPreset(imported, setParams, setVisuals, setCables);
    playPresetPreview(imported);
  };

  const handlePresetGenerated = async (generated: ResonatorPresetJson) => {
    savePresetToLocalStorage(generated);
    const updated = loadPresetList();
    setPresetList(updated);
    setActivePresetName(generated.name);
    applyPreset(generated, setParams, setVisuals, setCables);
    await playPresetPreview(generated);
  };

  // Waveform options
  const waveforms: Array<{ label: string; value: OscillatorType }> = [
    { label: 'TRI', value: 'triangle' },
    { label: 'SIN', value: 'sine' },
    { label: 'SAW', value: 'sawtooth' },
    { label: 'SQR', value: 'square' },
  ];

  return (
    <div className="min-h-screen bg-[#080a0c] text-[#e2e2e5] flex flex-col items-center justify-start p-3 md:p-6 select-none">
      
      {/* Top Studio Header */}
      <header className="w-full max-w-[1240px] flex items-center justify-between gap-4 py-2 px-4 mb-2 border-b border-[#292c2d]">
        <div className="flex items-center gap-3">
          <span className="font-['Cinzel'] text-sm tracking-[0.25em] text-[#ffd9aa] font-bold">
            RESONATOR
          </span>
          <span className="hidden sm:inline font-['JetBrains_Mono'] text-[10px] tracking-widest text-[#9e8e7c]">
            MODEL 01 // OPULENCE
          </span>
        </div>

        {/* MIDI Status & System Power Toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#121416] border border-[#3d4143] text-[8px] font-['JetBrains_Mono'] text-[#9e8e7c]">
            <Radio className="w-3 h-3 text-[#ffb545]" />
            <span>{midiStatus}</span>
          </div>

          <button
            onClick={handleEngageAudio}
            className={`flex items-center gap-2 px-3 py-1 rounded-[3px] border transition-all text-xs font-['JetBrains_Mono'] font-bold ${
              isAudioRunning
                ? 'bg-[#182a1e] border-[#59cbd0] text-[#59cbd0] shadow-[0_0_12px_rgba(89,203,208,0.3)]'
                : 'bg-[#2a1b14] border-[#ffb545] text-[#ffb545] hover:bg-[#382218] animate-pulse'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isAudioRunning ? 'SISTEMA ACTIVO' : 'ENCENDER'}</span>
          </button>
        </div>
      </header>

      {/* Preset Management Bar: Select, Guardar, Exportar, Importar con Drag & Drop */}
      <PresetBar
        presetList={presetList}
        activePresetName={activePresetName}
        onSelectPreset={handleSelectPreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onImportPreset={handleImportPreset}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onPlayPreview={() => playPresetPreview()}
        activeAuthor="TOMAS.WAV"
      />

      {/* Main Synthesizer Unit: Master Obsidian Chassis */}
      <main className="w-full max-w-[1240px] rounded-lg chassis-obsidian border border-[#3d4143] p-4 md:p-6 relative shadow-[0_40px_100px_rgba(0,0,0,0.95)]">
        
        {/* Subtle Obsidian Stone Vein Highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,181,69,0.04),transparent_60%)] pointer-events-none rounded-lg" />

        {/* Deeply Engraved Gold Title Header */}
        <div className="w-full flex items-center justify-center py-1 mb-2 relative z-10">
          <h1 className="gold-engraved text-2xl md:text-3xl font-bold tracking-[0.45em] uppercase">
            R E S O N A T O R
          </h1>
        </div>

        {/* NEURAL BRIDGE: AI Sound Synthesis & Patch Librarian */}
        <NeuralBridge
          onPresetGenerated={handlePresetGenerated}
          onOpenLibrary={() => setIsLibraryOpen(true)}
          onSaveCurrentPreset={() => {
            const name = prompt('Nombre para este preset:', `${activePresetName} (Neuronal)`);
            if (name) handleSavePreset(name, 'TOMAS.WAV');
          }}
          onPlayPreview={() => playPresetPreview()}
          onEngageAudio={handleEngageAudio}
          currentPresetName={activePresetName}
          currentAuthor={presetList.find(p => p.name === activePresetName)?.author || 'TOMAS.WAV'}
          currentWave={params.waveform}
          currentCutoff={params.cutoff}
          currentFmDepth={params.fmDepth ?? 0}
          currentRingMix={params.ringModMix ?? 0}
          currentPlasmaColor={visuals.plasmaColor}
        />

        {/* Top 5-Bay Modular Eurorack Rack System */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 relative z-10">
          
          {/* ================= PANEL 1: OSC (Oscillator) - 3 cols ================= */}
          <div className="md:col-span-3 rounded-[3px] panel-brushed border border-[#3d4143] p-3 flex flex-col justify-between relative shadow-lg">
            <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-[1px] h-full bg-[#121416]" />
            </div>
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-full h-[1px] bg-[#121416]" />
            </div>

            <div className="text-center pb-2 border-b border-[#3d4143]/60">
              <span className="font-['Space_Grotesk'] text-xs font-bold tracking-[0.2em] text-[#e7e0d3] uppercase">
                OSC
              </span>
            </div>

            {/* Waveform Selector */}
            <div className="flex justify-center gap-1 my-2">
              {waveforms.map(w => (
                <button
                  key={w.value}
                  onClick={() => updateParam('waveform', w.value)}
                  className={`px-1.5 py-0.5 rounded-[2px] text-[8px] font-['JetBrains_Mono'] font-bold transition-all ${
                    params.waveform === w.value
                      ? 'bg-[#ffb545] text-[#291800] shadow-[0_0_6px_#ffb545]'
                      : 'bg-[#141618] text-[#9e8e7c] hover:text-[#e7e0d3] border border-[#292c2d]'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {/* Knobs Row 1: Detune, Octave, LFO Rate */}
            <div className="grid grid-cols-3 gap-1 my-1">
              <Knob
                label="DETUNE"
                value={params.detune}
                min={-30}
                max={30}
                step={1}
                unit="c"
                size="sm"
                onChange={v => updateParam('detune', v)}
              />
              <Knob
                label="OCT"
                value={params.octave}
                min={-2}
                max={2}
                step={1}
                size="sm"
                onChange={v => updateParam('octave', v)}
              />
              <Knob
                label="LFO RATE"
                value={params.lfoRate}
                min={0.2}
                max={15}
                step={0.1}
                unit="Hz"
                size="sm"
                onChange={v => updateParam('lfoRate', v)}
              />
            </div>

            {/* Knobs Row 2: FM Cross-Modulation & Ring Modulator */}
            <div className="grid grid-cols-3 gap-1 my-1 pt-1 border-t border-[#3d4143]/40">
              <Knob
                label="FM PROF"
                value={Math.round((params.fmDepth ?? 0) * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                size="sm"
                onChange={v => updateParam('fmDepth', v / 100)}
              />
              <Knob
                label="FM RATIO"
                value={params.fmRatio ?? 2.0}
                min={0.5}
                max={8.0}
                step={0.1}
                unit="x"
                size="sm"
                onChange={v => updateParam('fmRatio', v)}
              />
              <Knob
                label="RING MIX"
                value={Math.round((params.ringModMix ?? 0) * 100)}
                min={0}
                max={100}
                step={1}
                unit="%"
                size="sm"
                onChange={v => updateParam('ringModMix', v / 100)}
              />
            </div>

            {/* Sliders Row: Sub Level, Noise, LFO Depth */}
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#3d4143]/50">
              <Slider
                label="SUB"
                value={params.subLevel}
                min={0}
                max={1}
                step={0.01}
                height={75}
                onChange={v => updateParam('subLevel', v)}
              />
              <Slider
                label="NOISE"
                value={params.noiseLevel}
                min={0}
                max={0.5}
                step={0.01}
                height={75}
                onChange={v => updateParam('noiseLevel', v)}
              />
              <Slider
                label="LFO DEP"
                value={params.lfoDepth}
                min={0}
                max={1}
                step={0.01}
                height={75}
                onChange={v => updateParam('lfoDepth', v)}
              />
            </div>
          </div>

          {/* ================= PANEL 2: FILTER (VCF) - 3 cols ================= */}
          <div className="md:col-span-3 rounded-[3px] panel-brushed border border-[#3d4143] p-3 flex flex-col justify-between relative shadow-lg">
            <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-[1px] h-full bg-[#121416]" />
            </div>
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-full h-[1px] bg-[#121416]" />
            </div>

            <div className="text-center pb-2 border-b border-[#3d4143]/60">
              <span className="font-['Space_Grotesk'] text-xs font-bold tracking-[0.2em] text-[#e7e0d3] uppercase">
                FILTER // VCF
              </span>
            </div>

            {/* Filter Knobs: Corte, Resonancia, Env Mod */}
            <div className="grid grid-cols-3 gap-1 my-2">
              <Knob
                label="CORTE"
                sublabel="FREQ"
                value={params.cutoff}
                min={30}
                max={16000}
                logScale
                unit="Hz"
                size="md"
                onChange={v => updateParam('cutoff', v)}
              />
              <Knob
                label="RESON"
                sublabel="Q"
                value={params.resonance}
                min={0.1}
                max={18}
                step={0.1}
                size="md"
                onChange={v => updateParam('resonance', v)}
              />
              <Knob
                label="ENV MOD"
                value={params.envModAmount}
                min={-1}
                max={1}
                step={0.05}
                size="md"
                onChange={v => updateParam('envModAmount', v)}
              />
            </div>

            {/* Full 4-Stage ADSR Envelope Sliders */}
            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-[#3d4143]/50">
              <Slider
                label="ATK"
                value={params.attack}
                min={0.005}
                max={2.0}
                step={0.01}
                unit="s"
                height={75}
                onChange={v => updateParam('attack', v)}
              />
              <Slider
                label="DEC"
                value={params.decay}
                min={0.02}
                max={3.0}
                step={0.02}
                unit="s"
                height={75}
                onChange={v => updateParam('decay', v)}
              />
              <Slider
                label="SUS"
                value={params.sustain}
                min={0}
                max={1.0}
                step={0.01}
                height={75}
                onChange={v => updateParam('sustain', v)}
              />
              <Slider
                label="REL"
                value={params.release}
                min={0.03}
                max={4.0}
                step={0.02}
                unit="s"
                height={75}
                onChange={v => updateParam('release', v)}
              />
            </div>
          </div>

          {/* ================= PANEL 3: THE CENTRAL PLASMA CORE - 2 cols ================= */}
          <div className="md:col-span-2 rounded-[3px] panel-brushed border border-[#3d4143] p-1.5 flex flex-col items-center justify-center relative shadow-2xl">
            <PlasmaCore
              isPlaying={activeNotes.size > 0 || params.arpEnabled}
              activeVoices={activeNotes.size}
              plasmaColor={visuals.plasmaColor}
              thermalGlow={visuals.thermalGlow}
            />
          </div>

          {/* ================= PANEL 4: OUTPUT & SPACE DELAY - 2 cols ================= */}
          <div className="md:col-span-2 rounded-[3px] panel-brushed border border-[#3d4143] p-2 flex flex-col justify-between relative shadow-lg">
            <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-[1px] h-full bg-[#121416]" />
            </div>
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-full h-[1px] bg-[#121416]" />
            </div>

            <div className="text-center pb-1 border-b border-[#3d4143]/60">
              <span className="font-['Space_Grotesk'] text-xs font-bold tracking-[0.2em] text-[#e7e0d3] uppercase">
                OUTPUT // FX
              </span>
            </div>

            {/* Phosphor CRT display */}
            <div className="my-1">
              <OscilloscopeDisplay isPlaying={activeNotes.size > 0 || params.arpEnabled} />
            </div>

            {/* Output Knobs: Delay Time, Delay Feedback, Drive, Volume */}
            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[#3d4143]/50">
              <Knob
                label="TIME"
                value={params.delayTime}
                min={0.05}
                max={0.9}
                step={0.01}
                unit="s"
                size="sm"
                onChange={v => updateParam('delayTime', v)}
              />
              <Knob
                label="FEEDBK"
                value={params.delayFeedback}
                min={0}
                max={0.85}
                step={0.02}
                size="sm"
                onChange={v => updateParam('delayFeedback', v)}
              />
              <Knob
                label="DRIVE"
                value={params.drive}
                min={0}
                max={1}
                step={0.02}
                size="sm"
                onChange={v => updateParam('drive', v)}
              />
              <Knob
                label="VOL"
                value={params.volume}
                min={0}
                max={1}
                step={0.02}
                size="sm"
                onChange={v => updateParam('volume', v)}
              />
            </div>
          </div>

          {/* ================= PANEL 5: MATRIX (Patch Bay) - 2 cols ================= */}
          <div className="md:col-span-2 rounded-[3px] panel-brushed border border-[#3d4143] p-1.5 flex flex-col justify-between relative shadow-lg">
            <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-[1px] h-full bg-[#121416]" />
            </div>
            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner">
              <div className="w-full h-[1px] bg-[#121416]" />
            </div>

            <PatchMatrix
              cables={cables}
              onCablesChange={setCables}
            />
          </div>

        </div>

        {/* Lower Instrument Section: Performance Controllers (Wheels & Arp) + Keyboard */}
        <div className="mt-4 flex flex-col md:flex-row items-stretch gap-2 border-t border-[#3d4143]/80 pt-3">
          
          {/* Performance & Modulation Block (Wheels + Arp) */}
          <div className="flex items-stretch gap-2 shrink-0">
            <PitchModWheels
              octave={params.octave}
              glide={params.glide}
              onOctaveChange={v => updateParam('octave', v)}
              onGlideChange={v => updateParam('glide', v)}
              onPitchBend={semitones => audioEngine.setPitchBend(semitones)}
              onModWheel={amount => audioEngine.setModWheel(amount)}
            />

            {/* Rhythmic Arpeggiator Controller */}
            <div className="w-[125px]">
              <ArpController
                enabled={params.arpEnabled}
                bpm={params.arpBpm}
                division={params.arpDivision}
                pattern={params.arpPattern}
                octaves={params.arpOctaves}
                onToggle={en => updateParam('arpEnabled', en)}
                onBpmChange={b => updateParam('arpBpm', b)}
                onDivisionChange={d => updateParam('arpDivision', d)}
                onPatternChange={p => updateParam('arpPattern', p)}
                onOctavesChange={o => updateParam('arpOctaves', o)}
              />
            </div>
          </div>

          {/* Main 25-Key Ebony & Copper Physical Keyboard */}
          <div className="flex-1">
            <Keyboard
              activeNotes={activeNotes}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
            />
          </div>
        </div>

        {/* Bottom Technical Specifications Strip */}
        <div className="mt-3 flex items-center justify-between px-2 pt-2 border-t border-[#1a1c1e] text-[8px] font-['JetBrains_Mono'] text-[#9e8e7c]">
          <span>CALIBRATED VOLTAGE // 24V ANALOG BUS</span>
          <span className="hidden sm:inline">TECLAS: [A-K] OCTAVA INFERIOR // [K-'] OCTAVA SUPERIOR</span>
          <span>ANALOG MODEL 01 // OPULENCE 2026</span>
        </div>

      </main>

      {/* Footer Info */}
      <footer className="mt-4 text-center">
        <p className="font-['JetBrains_Mono'] text-[10px] text-[#9e8e7c]">
          Resonator (Model 01 // Opulence) · Synthesizer Web Modular con Estética Obsidian Futurism
        </p>
      </footer>

      {/* Preset Library Drawer / Modal with Unlimited Slots, Tag Filtering and Search */}
      <PresetLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        presetList={presetList}
        activePresetName={activePresetName}
        onSelectPreset={handleSelectPreset}
        onDeletePreset={handleDeletePreset}
        onPlayPreview={(preset) => playPresetPreview(preset)}
        onImportPreset={(rawJson) => {
          try {
            const parsed = parseAndValidatePresetJson(rawJson);
            handleImportPreset(parsed);
          } catch (e: any) {
            console.error('Error importando preset:', e);
          }
        }}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { Sparkles, Brain, Loader2, BookmarkPlus, Library, Wand2, AlertCircle, Volume2 } from 'lucide-react';
import { ResonatorPresetJson } from '../audio/presetSchema';
import { parseAndValidatePresetJson } from '../audio/presetManager';

interface NeuralBridgeProps {
  onPresetGenerated: (preset: ResonatorPresetJson) => void;
  onOpenLibrary: () => void;
  onSaveCurrentPreset: () => void;
  onPlayPreview?: () => void;
  onEngageAudio?: () => void;
  currentPresetName: string;
  currentAuthor: string;
  currentWave: string;
  currentCutoff: number;
  currentFmDepth: number;
  currentRingMix: number;
  currentPlasmaColor: string;
}

const INSPIRATION_CHIPS = [
  { label: 'Catedral Sumergida', prompt: 'Catedral gótica sumergida a 3000 metros bajo el océano, reverb colosal y lamento espectral' },
  { label: '808 de Traición', prompt: '808 sub-bajo hiper-saturado y pesado con distorsión analógica de válvula y ataque percusivo' },
  { label: 'Campanas de Titanio', prompt: 'Campana cuántica de titanio y cristal alienígena con modulación en anillo y brillo armónico' },
  { label: 'Lluvia Cyberpunk', prompt: 'Lluvia ácida sobre neón mojado en una azotea de Shinjuku, pad atmosférico oscuro' },
  { label: 'Vórtice Ácido', prompt: 'Línea de bajo ácida agresiva y resonante tipo 308 sobrecargado con filtro chirriante' },
  { label: 'Nebulosa de Plasma', prompt: 'Arpegio cósmico flotante en el centro de una supernova con delay infinito y armónicos puros' },
];

export const NeuralBridge: React.FC<NeuralBridgeProps> = ({
  onPresetGenerated,
  onOpenLibrary,
  onSaveCurrentPreset,
  onPlayPreview,
  onEngageAudio,
  currentPresetName,
  currentAuthor,
  currentWave,
  currentCutoff,
  currentFmDepth,
  currentRingMix,
  currentPlasmaColor,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);

  const handleGenerate = async (targetPrompt?: string) => {
    const textToUse = (targetPrompt || prompt).trim();
    if (!textToUse) {
      setErrorMsg('Escribe un concepto sonoro o selecciona una sugerencia.');
      return;
    }

    if (onEngageAudio) {
      onEngageAudio();
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/generate-sound-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToUse }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor (${response.status})`);
      }

      const data = await response.json();
      if (!data.preset) {
        throw new Error('Respuesta inválida del traductor neuronal.');
      }

      // Validate & clean schema
      const validatedPreset = parseAndValidatePresetJson(JSON.stringify(data.preset));
      setLastSource(data.source === 'gemini-3.8-flash' ? 'GEMINI 3.8 FLASH' : 'MOTOR NEURONAL RESIDUAL');
      onPresetGenerated(validatedPreset);
    } catch (err: any) {
      console.error('Error generating preset:', err);
      setErrorMsg(err.message || 'Error procesando síntesis sonora.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isGenerating) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <section className="w-full rounded-[4px] bg-[#101214] border border-[#3d4143] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.85)] p-3 md:p-4 mb-3 relative overflow-hidden">
      
      {/* Background Micro-Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1d2024_1px,transparent_1px),linear-gradient(to_bottom,#1d2024_1px,transparent_1px)] bg-[size:24px_24px] opacity-15 pointer-events-none" />

      {/* Decorative Bronze Screws */}
      <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner pointer-events-none">
        <div className="w-[1px] h-full bg-[#121416]" />
      </div>
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ad7655] border border-[#291800] flex items-center justify-center shadow-inner pointer-events-none">
        <div className="w-full h-[1px] bg-[#121416]" />
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#292c2d] relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-[2px] bg-[#1a140d] border border-[#ffb545]/60 flex items-center justify-center shadow-[0_0_10px_rgba(255,181,69,0.25)]">
            <Brain className="w-3.5 h-3.5 text-[#ffb545]" />
          </div>
          <div>
            <h2 className="font-['Space_Grotesk'] text-xs font-bold tracking-[0.2em] text-[#f2ede4] uppercase flex items-center gap-2">
              NEURAL BRIDGE // SÍNTESIS GENERATIVA
              <span className="hidden sm:inline-block text-[8px] px-1.5 py-0.5 rounded-[2px] bg-[#1f2824] border border-[#59cbd0]/40 text-[#59cbd0] font-['JetBrains_Mono']">
                {lastSource || 'GEMINI 3.8 FLASH'}
              </span>
            </h2>
            <p className="font-['JetBrains_Mono'] text-[9px] text-[#8e8579] tracking-wider">
              Traductor de conceptos abstractos, atmósferas y emociones a parámetros analógicos en tiempo real
            </p>
          </div>
        </div>

        {/* Action shortcut to open full library */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#16181b] hover:bg-[#202327] border border-[#3d4143] text-[#cfc5b6] hover:text-[#ffd9aa] text-[10px] font-['JetBrains_Mono'] font-bold tracking-wider transition-colors shadow-sm"
          >
            <Library className="w-3 h-3 text-[#ffb545]" />
            <span>BIBLIOTECA ILIMITADA</span>
          </button>
        </div>
      </div>

      {/* Prompt input bar with physical OLED look */}
      <div className="relative z-10 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Introduce cualquier idea (ej. 'lluvia ácida en Tokio', 'catedral gótica sumergida', '808 de traición')..."
            disabled={isGenerating}
            className="w-full bg-[#0a0c0e] border border-[#3d4143] focus:border-[#ffb545] focus:shadow-[0_0_15px_rgba(255,181,69,0.3)] rounded-[3px] py-2 px-3 text-xs md:text-sm font-['JetBrains_Mono'] text-[#f2ede4] placeholder-[#57534d] outline-none transition-all disabled:opacity-60"
          />
          {prompt && (
            <button
              onClick={() => setPrompt('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#6d665e] hover:text-[#ffd9aa] font-mono px-1"
            >
              LIMPIAR
            </button>
          )}
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={() => handleGenerate()}
          disabled={isGenerating || !prompt.trim()}
          className={`flex items-center justify-center gap-2 px-5 py-2 rounded-[3px] font-['Space_Grotesk'] text-xs font-bold tracking-widest uppercase transition-all shadow-md ${
            isGenerating
              ? 'bg-[#2b1f14] border border-[#ffb545] text-[#ffb545] cursor-wait'
              : prompt.trim()
              ? 'bg-gradient-to-r from-[#b37542] via-[#e6a25e] to-[#b37542] text-[#1c1108] border border-[#ffd59e] hover:brightness-110 shadow-[0_0_16px_rgba(230,162,94,0.45)]'
              : 'bg-[#181a1d] border border-[#292c2d] text-[#635f58] cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#ffb545]" />
              <span className="font-['JetBrains_Mono'] text-[11px]">TRANSDUCIENDO...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              <span>TRANSDUCIR SONIDO</span>
            </>
          )}
        </button>
      </div>

      {/* Inspiration Quick Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 relative z-10">
        <span className="font-['JetBrains_Mono'] text-[8px] uppercase tracking-widest text-[#7a7266] mr-1 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-[#ffb545]" /> INSPIRACIÓN:
        </span>
        {INSPIRATION_CHIPS.map(chip => (
          <button
            key={chip.label}
            type="button"
            disabled={isGenerating}
            onClick={() => {
              setPrompt(chip.prompt);
              handleGenerate(chip.prompt);
            }}
            className="px-2 py-0.5 rounded-[2px] bg-[#141618] hover:bg-[#22262a] border border-[#2c2f32] hover:border-[#ffb545]/60 text-[#a89d8d] hover:text-[#ffd9aa] text-[9px] font-['JetBrains_Mono'] transition-all disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="mt-2.5 p-2 rounded-[2px] bg-[#291310] border border-[#ff4d26]/60 text-[#ff8d75] text-[10px] font-['JetBrains_Mono'] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#ff4d26] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Synth State Readout Banner */}
      <div className="mt-3 pt-2.5 border-t border-[#292c2d] flex flex-wrap items-center justify-between gap-2 text-[9px] font-['JetBrains_Mono'] text-[#9e8e7c] relative z-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[#655d53]">ACTIVO:</span>
            <span className="text-[#ffd9aa] font-bold">{currentPresetName}</span>
            <span className="text-[#7d7162]">({currentAuthor})</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[#7d7162]">
            <span>ONDA: <strong className="text-[#d8cfc4]">{currentWave.toUpperCase()}</strong></span>
            <span>•</span>
            <span>CORTE: <strong className="text-[#d8cfc4]">{Math.round(currentCutoff)}Hz</strong></span>
            <span>•</span>
            <span>FM: <strong className="text-[#59cbd0]">{Math.round(currentFmDepth * 100)}%</strong></span>
            <span>•</span>
            <span>ANILLO: <strong className="text-[#59cbd0]">{Math.round(currentRingMix * 100)}%</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Plasma core color dot indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#655d53]">NÚCLEO:</span>
            <div
              className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px]"
              style={{ backgroundColor: currentPlasmaColor, boxShadow: `0 0 8px ${currentPlasmaColor}` }}
              title={`Color de plasma: ${currentPlasmaColor}`}
            />
          </div>

          {/* Audio Preview Demo Button */}
          {onPlayPreview && (
            <button
              type="button"
              onClick={onPlayPreview}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-[2px] bg-[#182a1e] hover:bg-[#203a2a] border border-[#59cbd0]/60 text-[#59cbd0] text-[9px] font-['JetBrains_Mono'] font-bold transition-all shadow-[0_0_8px_rgba(89,203,208,0.25)]"
              title="Escuchar demostración sonora del preset activo"
            >
              <Volume2 className="w-2.5 h-2.5 text-[#59cbd0]" />
              <span>PROBAR DEMO</span>
            </button>
          )}

          {/* Quick Save Button */}
          <button
            type="button"
            onClick={onSaveCurrentPreset}
            className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#1a1713] hover:bg-[#2b2218] border border-[#ffb545]/50 text-[#ffd9aa] text-[9px] font-['JetBrains_Mono'] font-bold transition-all"
            title="Guardar estado sonoro actual en el banco de presets"
          >
            <BookmarkPlus className="w-2.5 h-2.5 text-[#ffb545]" />
            <span>GUARDAR EN BANCO</span>
          </button>
        </div>
      </div>
    </section>
  );
};

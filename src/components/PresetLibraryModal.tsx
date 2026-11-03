import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Download,
  Upload,
  Trash2,
  Play,
  Sparkles,
  Tag,
  Radio,
  Sliders,
  Layers,
  Calendar,
  User,
  Check,
  Volume2,
} from 'lucide-react';
import { ResonatorPresetJson } from '../audio/presetSchema';
import { exportPresetAsJson } from '../audio/presetManager';

interface PresetLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetList: ResonatorPresetJson[];
  activePresetName: string;
  onSelectPreset: (preset: ResonatorPresetJson) => void;
  onDeletePreset: (name: string) => void;
  onImportPreset: (jsonStr: string) => void;
  onPlayPreview?: (preset: ResonatorPresetJson) => void;
}

const PRESET_TAGS = [
  'TODOS',
  'USUARIO',
  'FÁBRICA',
  'ATMÓSFERAS',
  'BAJOS',
  'METÁLICO',
  'ACÍDICO',
  'EXPERIMENTAL',
];

export const PresetLibraryModal: React.FC<PresetLibraryModalProps> = ({
  isOpen,
  onClose,
  presetList,
  activePresetName,
  onSelectPreset,
  onDeletePreset,
  onImportPreset,
  onPlayPreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('TODOS');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredPresets = useMemo(() => {
    return presetList.filter(p => {
      // 1. Tag filter
      if (selectedTag === 'USUARIO' && !p.isUserPreset) return false;
      if (selectedTag === 'FÁBRICA' && p.isUserPreset) return false;
      if (selectedTag !== 'TODOS' && selectedTag !== 'USUARIO' && selectedTag !== 'FÁBRICA') {
        const matchesTag = p.tags?.some(t => t.toUpperCase() === selectedTag) ||
          p.name.toUpperCase().includes(selectedTag) ||
          (selectedTag === 'BAJOS' && (p.osc.subLevel > 0.6 || p.osc.octave < 0)) ||
          (selectedTag === 'ATMÓSFERAS' && (p.filter.adsr.attack > 0.3 || p.output.feedback > 0.5)) ||
          (selectedTag === 'METÁLICO' && ((p.osc.fmDepth ?? 0) > 0.2 || (p.osc.ringModMix ?? 0) > 0.2)) ||
          (selectedTag === 'ACÍDICO' && p.filter.resonance > 8);
        if (!matchesTag) return false;
      }

      // 2. Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inName = p.name.toLowerCase().includes(q);
      const inAuthor = (p.author || '').toLowerCase().includes(q);
      const inTags = p.tags?.some(t => t.toLowerCase().includes(q));
      return inName || inAuthor || inTags;
    });
  }, [presetList, selectedTag, searchQuery]);

  const handleExportAll = () => {
    try {
      const dataStr = JSON.stringify(presetList, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `resonator_full_bank_${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export preset library:', e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (content) {
        onImportPreset(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg bg-[#111316] border border-[#3d4143] shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden relative">
        
        {/* Obsidian Header Frame */}
        <div className="flex items-center justify-between p-4 border-b border-[#292c2d] bg-[#16181c] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[3px] bg-[#241a10] border border-[#ffb545] flex items-center justify-center shadow-[0_0_12px_rgba(255,181,69,0.3)]">
              <Layers className="w-4 h-4 text-[#ffb545]" />
            </div>
            <div>
              <h2 className="font-['Cinzel'] text-sm md:text-base font-bold tracking-[0.25em] text-[#ffd9aa] uppercase">
                BIBLIOTECA DE PRESETS // RESONATOR
              </h2>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#8e8579] tracking-wider">
                {presetList.length} PRESETS ALMACENADOS • GESTIÓN Y PERSISTENCIA ILIMITADA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#141618] hover:bg-[#202327] border border-[#3d4143] text-[#cfc5b6] hover:text-[#ffd9aa] text-[10px] font-['JetBrains_Mono'] font-bold tracking-wider transition-all"
              title="Importar archivo JSON"
            >
              <Upload className="w-3 h-3 text-[#ffb545]" />
              <span className="hidden sm:inline">IMPORTAR</span>
            </button>

            <button
              onClick={handleExportAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#141618] hover:bg-[#202327] border border-[#3d4143] text-[#cfc5b6] hover:text-[#ffd9aa] text-[10px] font-['JetBrains_Mono'] font-bold tracking-wider transition-all"
              title="Exportar banco completo como JSON"
            >
              <Download className="w-3 h-3 text-[#ffb545]" />
              <span className="hidden sm:inline">EXPORTAR BANCO</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[2px] bg-[#181a1d] hover:bg-[#25282c] border border-[#3d4143] flex items-center justify-center text-[#9e8e7c] hover:text-[#ffd9aa] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 md:p-4 bg-[#141619] border-b border-[#292c2d] flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-[#6d665e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, autor o etiqueta..."
              className="w-full bg-[#0c0e10] border border-[#2d3033] focus:border-[#ffb545] rounded-[3px] py-1.5 pl-8 pr-3 text-xs font-['JetBrains_Mono'] text-[#f2ede4] placeholder-[#55504a] outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#6d665e] hover:text-[#ffd9aa] font-mono"
              >
                ×
              </button>
            )}
          </div>

          {/* Tag Chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {PRESET_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-2 py-1 rounded-[2px] text-[9px] font-['JetBrains_Mono'] font-bold tracking-wider transition-all ${
                  selectedTag === tag
                    ? 'bg-[#ffb545] text-[#291800] shadow-[0_0_8px_rgba(255,181,69,0.4)]'
                    : 'bg-[#181a1d] text-[#9e8e7c] hover:text-[#ffd9aa] border border-[#2d3033]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Presets Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 custom-scrollbar">
          {filteredPresets.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[#6e675d] font-['JetBrains_Mono'] text-xs">
              No se encontraron presets para la búsqueda o filtro seleccionado.
            </div>
          ) : (
            filteredPresets.map(preset => {
              const isActive = activePresetName.toLowerCase() === preset.name.toLowerCase();
              const plasmaColor = preset.visuals?.plasmaColor || preset.coreVisual?.plasmaColor || '#ffb545';
              const isUser = Boolean(preset.isUserPreset);
              const fmDepth = preset.osc.fmDepth ?? 0;
              const ringMix = preset.osc.ringModMix ?? 0;

              return (
                <div
                  key={preset.name}
                  className={`p-3 rounded-[3px] border transition-all flex flex-col justify-between relative group ${
                    isActive
                      ? 'bg-[#182024] border-[#59cbd0] shadow-[0_0_15px_rgba(89,203,208,0.2)]'
                      : 'bg-[#141619] border-[#2d3033] hover:border-[#ffb545]/60 hover:bg-[#181a1e]'
                  }`}
                >
                  <div>
                    {/* Header: Name, Pill & Color */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {/* Plasma glow indicator dot */}
                        <div
                          className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px]"
                          style={{ backgroundColor: plasmaColor, boxShadow: `0 0 8px ${plasmaColor}` }}
                        />
                        <div>
                          <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[#f2ede4] group-hover:text-[#ffd9aa] transition-colors leading-tight">
                            {preset.name}
                          </h3>
                          <span className="font-['JetBrains_Mono'] text-[9px] text-[#7d7467] block">
                            {preset.author || 'TOMAS.WAV'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[8px] font-['JetBrains_Mono'] font-bold px-1.5 py-0.5 rounded-[2px] ${
                            isUser
                              ? 'bg-[#291e12] border border-[#ffb545]/60 text-[#ffb545]'
                              : 'bg-[#162224] border border-[#59cbd0]/60 text-[#59cbd0]'
                          }`}
                        >
                          {isUser ? 'USUARIO' : 'FÁBRICA'}
                        </span>

                        {isActive && (
                          <span className="text-[8px] font-['JetBrains_Mono'] font-bold px-1.5 py-0.5 rounded-[2px] bg-[#182a1e] border border-[#59cbd0] text-[#59cbd0]">
                            ACTIVO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acoustic Parameters Grid */}
                    <div className="grid grid-cols-4 gap-1 p-2 rounded-[2px] bg-[#0c0e10] border border-[#242629] mb-2 font-['JetBrains_Mono'] text-[8px] text-[#8e8579]">
                      <div>
                        <span className="block text-[#575148]">ONDA</span>
                        <strong className="text-[#d8cfc4]">{preset.osc.wave.toUpperCase()}</strong>
                      </div>
                      <div>
                        <span className="block text-[#575148]">CORTE</span>
                        <strong className="text-[#d8cfc4]">{Math.round(preset.filter.cutoffHz)}Hz</strong>
                      </div>
                      <div>
                        <span className="block text-[#575148]">RES</span>
                        <strong className="text-[#d8cfc4]">{preset.filter.resonance.toFixed(1)}Q</strong>
                      </div>
                      <div>
                        <span className="block text-[#575148]">MOD</span>
                        <strong className="text-[#59cbd0]">
                          {fmDepth > 0 ? `FM ${Math.round(fmDepth * 100)}%` : ringMix > 0 ? `RM ${Math.round(ringMix * 100)}%` : 'SUB'}
                        </strong>
                      </div>
                    </div>

                    {/* Tags List */}
                    {preset.tags && preset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {preset.tags.map(t => (
                          <span
                            key={t}
                            className="text-[8px] font-['JetBrains_Mono'] px-1.5 py-0.2 rounded-[2px] bg-[#1d2024] text-[#a09485] border border-[#2a2d31]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#242629] mt-1">
                    <button
                      type="button"
                      onClick={() => exportPresetAsJson(preset)}
                      className="flex items-center gap-1 text-[9px] font-['JetBrains_Mono'] text-[#8e8579] hover:text-[#ffd9aa] transition-colors"
                      title="Descargar este preset como archivo .json"
                    >
                      <Download className="w-3 h-3 text-[#ffb545]" />
                      <span>JSON</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {onPlayPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPreset(preset);
                            onPlayPreview(preset);
                          }}
                          className="p-1 rounded-[2px] bg-[#182a1e] hover:bg-[#203a2a] border border-[#59cbd0]/60 text-[#59cbd0] transition-colors"
                          title="Probar sonido de este preset"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isUser && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar preset de usuario "${preset.name}"?`)) {
                              onDeletePreset(preset.name);
                            }
                          }}
                          className="p-1 rounded-[2px] text-[#6e675d] hover:text-[#ff4d26] hover:bg-[#291310] transition-colors"
                          title="Eliminar preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectPreset(preset);
                          onClose();
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-[2px] text-[10px] font-['JetBrains_Mono'] font-bold tracking-wider transition-all ${
                          isActive
                            ? 'bg-[#182a1e] border border-[#59cbd0] text-[#59cbd0]'
                            : 'bg-[#291b12] hover:bg-[#3d2719] border border-[#ffb545]/60 text-[#ffd9aa]'
                        }`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{isActive ? 'RE-CARGAR' : 'CARGAR'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#141619] border-t border-[#292c2d] flex items-center justify-between text-[9px] font-['JetBrains_Mono'] text-[#7a7164]">
          <span>Obsidian Futurism // Resonator Model 01 Opulence</span>
          <span>Soporta importación por archivo o arrastre `.json`</span>
        </div>
      </div>
    </div>
  );
};

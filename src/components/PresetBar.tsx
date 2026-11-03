import React, { useState, useRef } from 'react';
import {
  ResonatorPresetJson,
  exportPresetAsJson,
  parseAndValidatePresetJson,
} from '../audio/presetManager';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Check,
  Disc,
  X,
  Volume2
} from 'lucide-react';

interface PresetBarProps {
  presetList: ResonatorPresetJson[];
  activePresetName: string;
  onSelectPreset: (preset: ResonatorPresetJson) => void;
  onSavePreset: (name: string, author: string) => void;
  onDeletePreset: (name: string) => void;
  onImportPreset: (preset: ResonatorPresetJson) => void;
  onOpenLibrary?: () => void;
  onPlayPreview?: () => void;
  activeAuthor?: string;
}

export const PresetBar: React.FC<PresetBarProps> = ({
  presetList,
  activePresetName,
  onSelectPreset,
  onSavePreset,
  onDeletePreset,
  onImportPreset,
  onOpenLibrary,
  onPlayPreview,
  activeAuthor = 'TOMAS.WAV',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [authorName, setAuthorName] = useState(activeAuthor || 'TOMAS.WAV');
  const [isDragOver, setIsDragOver] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenSaveModal = () => {
    setNewPresetName(`Preset ${presetList.length + 1}`);
    setAuthorName('TOMAS.WAV');
    setIsModalOpen(true);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSavePreset(newPresetName.trim(), authorName.trim() || 'TOMAS.WAV');
    setIsModalOpen(false);
    showToast(`Guardado: "${newPresetName.trim()}"`);
  };

  const handleExportCurrent = () => {
    const current = presetList.find(p => p.name === activePresetName) || presetList[0];
    if (current) {
      exportPresetAsJson(current);
      showToast(`Exportado: "${current.name}.json"`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processJsonFile(file);
    e.target.value = '';
  };

  const processJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = parseAndValidatePresetJson(content);
        onImportPreset(parsed);
        showToast(`Importado: "${parsed.name}"`);
      } catch (err: any) {
        showToast(`Error de archivo: ${err.message || 'JSON inválido'}`);
      }
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      processJsonFile(file);
    } else {
      showToast('Por favor suelta un archivo .json válido');
    }
  };

  const currentPreset = presetList.find(p => p.name === activePresetName);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full max-w-[1240px] rounded-[3px] panel-brushed border transition-colors p-2.5 mb-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.8)] ${
        isDragOver ? 'border-[#ffb545] bg-[#221812]' : 'border-[#3d4143]'
      }`}
    >
      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left Section: Preset Selection Pills with Factory vs User separation */}
      <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto py-1">
        <div className="flex items-center gap-1.5 shrink-0">
          <Disc className="w-3.5 h-3.5 text-[#ffb545]" />
          <span className="font-['JetBrains_Mono'] text-[9px] font-bold tracking-widest text-[#9e8e7c] uppercase">
            PRESETS:
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {presetList.map((preset) => {
            const isActive = preset.name === activePresetName;

            return (
              <div key={preset.name} className="flex items-center group shrink-0">
                <button
                  onClick={() => onSelectPreset(preset)}
                  className={`px-2.5 py-1 text-[9px] font-['JetBrains_Mono'] font-bold rounded-[2px] transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#ffb545] text-[#291800] shadow-[0_0_10px_rgba(255,181,69,0.5)]'
                      : 'bg-[#141618] text-[#d6c4af] hover:bg-[#202224] border border-[#3d4143]'
                  }`}
                >
                  <span>{preset.name}</span>
                  {preset.isUserPreset && (
                    <span className="text-[7px] text-[#59cbd0] font-normal uppercase">
                      USR
                    </span>
                  )}
                </button>

                {/* Delete button only for user-created presets */}
                {preset.isUserPreset && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePreset(preset.name);
                      showToast(`Eliminado: "${preset.name}"`);
                    }}
                    className="p-1 text-[#9e8e7c] hover:text-[#ff682c] transition-colors ml-0.5"
                    title={`Eliminar preset "${preset.name}"`}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle Tag: Active Preset Metadata (Author & Date) */}
      <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#121416] border border-[#2a2d30] text-[8px] font-['JetBrains_Mono'] text-[#9e8e7c] shrink-0">
        <span className="text-[#ffd9aa] font-bold">AUTOR:</span>
        <span className="text-[#e7e0d3]">{currentPreset?.author || 'TOMAS.WAV'}</span>
        <span className="text-[#45382c]">|</span>
        <span>{currentPreset?.date ? new Date(currentPreset.date).toLocaleDateString() : 'DEFAULT'}</span>
      </div>

      {/* Right Section: Preset Action Buttons (+ Guardar, Exportar, Importar, Biblioteca) */}
      <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
        {/* Probar Demo Sound Preview */}
        {onPlayPreview && (
          <button
            onClick={onPlayPreview}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#182a1e] hover:bg-[#203a2a] border border-[#59cbd0]/60 text-[8px] font-['JetBrains_Mono'] font-bold text-[#59cbd0] transition-all hover:shadow-[0_0_8px_rgba(89,203,208,0.3)]"
            title="Escuchar prueba de sonido del preset activo"
          >
            <Volume2 className="w-3 h-3 text-[#59cbd0]" />
            <span>DEMO</span>
          </button>
        )}
        {/* Biblioteca Ilimitada */}
        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#1a1713] hover:bg-[#2b2218] border border-[#ffb545]/80 text-[8px] font-['JetBrains_Mono'] font-bold text-[#ffd9aa] transition-all hover:shadow-[0_0_8px_rgba(255,181,69,0.3)]"
            title="Abrir biblioteca ilimitada de presets"
          >
            <span>BIBLIOTECA</span>
          </button>
        )}

        {/* + Guardar Preset */}
        <button
          onClick={handleOpenSaveModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#1e2022] hover:bg-[#282a2c] border border-[#ffb545]/60 text-[8px] font-['JetBrains_Mono'] font-bold text-[#ffb545] transition-all hover:shadow-[0_0_8px_rgba(255,181,69,0.3)]"
          title="Guardar estado actual en LocalStorage"
        >
          <Plus className="w-3 h-3" />
          <span>GUARDAR</span>
        </button>

        {/* Exportar .JSON */}
        <button
          onClick={handleExportCurrent}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#141618] hover:bg-[#202224] border border-[#3d4143] text-[8px] font-['JetBrains_Mono'] font-bold text-[#d6c4af] transition-colors"
          title="Descargar preset activo como archivo .json"
        >
          <Download className="w-3 h-3" />
          <span>EXPORTAR</span>
        </button>

        {/* Importar .JSON (con Drag & Drop) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#141618] hover:bg-[#202224] border border-[#3d4143] text-[8px] font-['JetBrains_Mono'] font-bold text-[#59cbd0] transition-colors"
          title="Cargar o arrastrar archivo .json"
        >
          <Upload className="w-3 h-3" />
          <span>IMPORTAR</span>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-[2px] bg-[#0c0e10] border border-[#ffb545] shadow-[0_0_12px_rgba(255,181,69,0.5)] flex items-center gap-2 text-[10px] font-['JetBrains_Mono'] text-[#ffd9aa]">
          <Check className="w-3 h-3 text-[#59cbd0]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Save Preset Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-md chassis-obsidian border border-[#ffb545]/60 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.95)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#3d4143] mb-4">
              <span className="font-['Space_Grotesk'] text-sm font-bold tracking-[0.15em] text-[#ffd9aa] uppercase">
                GUARDAR PRESET // OPULENCE
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#9e8e7c] hover:text-[#e7e0d3] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="flex flex-col gap-3">
              <div>
                <label className="block text-[9px] font-['JetBrains_Mono'] font-bold text-[#9e8e7c] uppercase mb-1">
                  NOMBRE DEL PRESET:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Ej: Obsidian Sub 02"
                  className="w-full px-3 py-2 rounded-[2px] bg-[#0c0e10] border border-[#514535] text-xs font-['JetBrains_Mono'] text-[#ffd9aa] focus:border-[#ffb545] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-['JetBrains_Mono'] font-bold text-[#9e8e7c] uppercase mb-1">
                  AUTOR:
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="TOMAS.WAV"
                  className="w-full px-3 py-2 rounded-[2px] bg-[#0c0e10] border border-[#514535] text-xs font-['JetBrains_Mono'] text-[#d6c4af] focus:border-[#ffb545] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#3d4143] mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-[2px] bg-[#141618] hover:bg-[#202224] text-[9px] font-['JetBrains_Mono'] font-bold text-[#9e8e7c]"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[2px] bg-[#ffb545] hover:bg-[#ffd9aa] text-[9px] font-['JetBrains_Mono'] font-bold text-[#291800] shadow-[0_0_8px_rgba(255,181,69,0.5)]"
                >
                  GUARDAR PRESET
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

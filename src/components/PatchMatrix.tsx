import React, { useState } from 'react';
import { PatchCable } from '../audio/synthLogic';

interface JackDef {
  id: string;
  name: string;
  type: 'out' | 'in';
  col: number; // 0, 1, 2
  row: number; // 0, 1, 2
}

// 9 Jack Sockets in a 3x3 Eurorack grid
const MATRIX_JACKS: JackDef[] = [
  // Row 0: Primary Signal Outs
  { id: 'lfo-out', name: 'LFO', type: 'out', col: 0, row: 0 },
  { id: 'env-out', name: 'ENV', type: 'out', col: 1, row: 0 },
  { id: 'noise-out', name: 'NOISE', type: 'out', col: 2, row: 0 },

  // Row 1: Sub & Modulation Outs
  { id: 'sub-out', name: 'SUB', type: 'out', col: 0, row: 1 },
  { id: 'gate-out', name: 'GATE', type: 'out', col: 1, row: 1 },
  { id: 'rnd-out', name: 'RND', type: 'out', col: 2, row: 1 },

  // Row 2: Modulation Target Ins
  { id: 'vcf-cut', name: 'VCF CUT', type: 'in', col: 0, row: 2 },
  { id: 'vcf-res', name: 'VCF RES', type: 'in', col: 1, row: 2 },
  { id: 'vco-pitch', name: 'PITCH', type: 'in', col: 2, row: 2 },
];

interface PatchMatrixProps {
  cables: PatchCable[];
  onCablesChange: (cables: PatchCable[]) => void;
}

export const PatchMatrix: React.FC<PatchMatrixProps> = ({ cables, onCablesChange }) => {
  const [selectedJackId, setSelectedJackId] = useState<string | null>(null);

  const handleJackClick = (jack: JackDef) => {
    if (!selectedJackId) {
      setSelectedJackId(jack.id);
    } else {
      if (selectedJackId === jack.id) {
        setSelectedJackId(null);
        return;
      }

      const sourceJack = MATRIX_JACKS.find(j => j.id === selectedJackId);
      const targetJack = jack;

      // Allow connecting an OUT to an IN (or IN to OUT)
      if (sourceJack && targetJack && sourceJack.type !== targetJack.type) {
        const fromId = sourceJack.type === 'out' ? sourceJack.id : targetJack.id;
        const toId = sourceJack.type === 'in' ? sourceJack.id : targetJack.id;

        const exists = cables.some(c => c.fromId === fromId && c.toId === toId);
        if (exists) {
          onCablesChange(cables.filter(c => !(c.fromId === fromId && c.toId === toId)));
        } else {
          const newCable: PatchCable = {
            id: `cable-${Date.now()}`,
            fromId,
            toId,
            color: '#b27546',
            glowColor: 'rgba(255, 181, 69, 0.65)',
          };
          onCablesChange([...cables, newCable]);
        }
      }
      setSelectedJackId(null);
    }
  };

  const removeCable = (cableId: string) => {
    onCablesChange(cables.filter(c => c.id !== cableId));
  };

  // Grid coordinates in SVG units (0 to 300 width, 0 to 220 height)
  const getJackCenter = (jack: JackDef) => {
    const x = 50 + jack.col * 100;
    const y = 38 + jack.row * 70;
    return { x, y };
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-2 select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-1 mb-1">
        <span className="font-['Space_Grotesk'] text-xs font-bold tracking-[0.18em] text-[#e7e0d3] uppercase">
          MATRIX
        </span>
        <button
          onClick={() => onCablesChange([])}
          className="text-[8px] font-['JetBrains_Mono'] tracking-wider text-[#9e8e7c] hover:text-[#ffb545] transition-colors"
          title="Clear all cables"
        >
          RESET
        </button>
      </div>

      {/* Surface Frame */}
      <div className="relative w-full h-[195px] rounded-sm bg-[#141618] border border-[#3d4143] shadow-[inset_0_3px_10px_rgba(0,0,0,0.9)] overflow-visible">
        {/* Subtle dot matrix grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#2f3235_1px,transparent_1px)] bg-[size:12px_12px] opacity-40 pointer-events-none" />

        {/* Dynamic Braided Copper Patch Cables SVG */}
        <svg
          viewBox="0 0 300 220"
          className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
        >
          <defs>
            <linearGradient id="copperBraidReal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd9aa" />
              <stop offset="25%" stopColor="#d49b56" />
              <stop offset="50%" stopColor="#ad7655" />
              <stop offset="75%" stopColor="#5c1a00" />
              <stop offset="100%" stopColor="#ffb545" />
            </linearGradient>

            <filter id="cableGlowBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {cables.map((cable, idx) => {
            const fromJack = MATRIX_JACKS.find(j => j.id === cable.fromId);
            const toJack = MATRIX_JACKS.find(j => j.id === cable.toId);
            if (!fromJack || !toJack) return null;

            const p1 = getJackCenter(fromJack);
            const p2 = getJackCenter(toJack);

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const archOffset = 30 + dist * 0.25 + (idx % 2 === 0 ? 10 : -10);

            const cp1x = p1.x + dx * 0.25;
            const cp1y = Math.max(10, Math.min(p1.y, p2.y) - archOffset);
            const cp2x = p1.x + dx * 0.75;
            const cp2y = Math.max(10, Math.min(p1.y, p2.y) - archOffset);

            return (
              <g
                key={cable.id}
                className="cursor-pointer pointer-events-auto group"
                onClick={() => removeCable(cable.id)}
              >
                {/* 1. Deep Cast Drop Shadow onto Graphite Panel */}
                <path
                  d={`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y + 16}, ${cp2x} ${cp2y + 16}, ${p2.x} ${p2.y}`}
                  stroke="rgba(0, 0, 0, 0.85)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* 2. Outer Luminous Electrical Glow */}
                <path
                  d={`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`}
                  stroke={cable.glowColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                  filter="url(#cableGlowBlur)"
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                />

                {/* 3. Braided Copper Cable Body */}
                <path
                  d={`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`}
                  stroke="url(#copperBraidReal)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="5 2.5"
                  fill="none"
                />

                {/* 4. Fine Specular Core Filament */}
                <path
                  d={`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`}
                  stroke="#fff4cc"
                  strokeWidth="1"
                  strokeLinecap="round"
                  fill="none"
                  className="opacity-60"
                />

                {/* Knurled Copper Plug Barrels at Jack Sockets */}
                <circle cx={p1.x} cy={p1.y} r="6.5" fill="#59351a" stroke="#ffd9aa" strokeWidth="1.5" />
                <circle cx={p1.x} cy={p1.y} r="3" fill="#ffe58a" />

                <circle cx={p2.x} cy={p2.y} r="6.5" fill="#59351a" stroke="#ffd9aa" strokeWidth="1.5" />
                <circle cx={p2.x} cy={p2.y} r="3" fill="#ffe58a" />
              </g>
            );
          })}
        </svg>

        {/* 3x3 Concentric Copper Jack Sockets */}
        <div className="grid grid-cols-3 grid-rows-3 h-full w-full relative z-20 py-1">
          {MATRIX_JACKS.map((jack) => {
            const isSelected = selectedJackId === jack.id;
            const hasConnection = cables.some(c => c.fromId === jack.id || c.toId === jack.id);

            return (
              <button
                key={jack.id}
                data-testid={`jack-${jack.id}`}
                aria-label={`Jack ${jack.name} (${jack.type === 'out' ? 'Salida' : 'Entrada'})`}
                className="flex flex-col items-center justify-center cursor-pointer group focus:outline-none"
                onClick={() => handleJackClick(jack)}
              >
                {/* Concentric Multi-Tiered Copper Jack */}
                <div className="relative w-8 h-8 flex items-center justify-center">
                  {/* Hexagonal Nut / Outer Retaining Collar */}
                  <div
                    className={`absolute inset-0 rounded-full border transition-all duration-150 ${
                      isSelected
                        ? 'border-[#ffb545] shadow-[0_0_12px_#ffb545] bg-[#3a2512]'
                        : hasConnection
                        ? 'border-[#ad7655] bg-[#221812] shadow-[0_0_6px_rgba(173,118,85,0.4)]'
                        : 'border-[#514535] bg-[#1a1c1e] group-hover:border-[#ffd9aa]'
                    }`}
                  />

                  {/* Copper Barrel Ring */}
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#ffd9aa] via-[#ad7655] to-[#5c1a00] p-0.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center">
                    {/* Inner 3.5mm Bore */}
                    <div className="w-3 h-3 rounded-full bg-[#0c0e10] shadow-[inset_0_2px_4px_rgba(0,0,0,0.95)] flex items-center justify-center">
                      {hasConnection && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ffb545] shadow-[0_0_4px_#ffb545]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Jack Label */}
                <span
                  className={`mt-1 font-['JetBrains_Mono'] text-[8px] font-bold tracking-wider leading-none ${
                    jack.type === 'out' ? 'text-[#ffb545]' : 'text-[#59cbd0]'
                  }`}
                >
                  {jack.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Helper & Route Explanation Banner */}
      <div className="w-full text-center mt-1 px-1">
        <span className="font-['JetBrains_Mono'] text-[8px] text-[#9e8e7c] block truncate">
          {selectedJackId
            ? `PARCHEAR DESDE ${MATRIX_JACKS.find(j => j.id === selectedJackId)?.name} → ELIGE ENTRADA/SALIDA`
            : cables.length > 0
            ? `${cables.length} RUTAS ACTIVAS: ${cables.map(c => `${c.fromId.split('-')[0].toUpperCase()}→${c.toId.replace('vcf-', '').replace('vco-', '').toUpperCase()}`).join(', ')}`
            : 'CLIC EN JACKS PARA MODULAR EN TIEMPO REAL'}
        </span>
        <span className="font-['JetBrains_Mono'] text-[7px] text-[#7a6f62] block truncate mt-0.5">
          [GATE / RND Reservados para Expansión CV Secuenciador]
        </span>
      </div>
    </div>
  );
};

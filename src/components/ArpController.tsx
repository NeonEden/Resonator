import React from 'react';
import { ArpDivision, ArpPattern } from '../audio/synthLogic';
import { Knob } from './Knob';

interface ArpControllerProps {
  enabled: boolean;
  bpm: number;
  division: ArpDivision;
  pattern: ArpPattern;
  octaves: number;
  onToggle: (enabled: boolean) => void;
  onBpmChange: (bpm: number) => void;
  onDivisionChange: (div: ArpDivision) => void;
  onPatternChange: (pattern: ArpPattern) => void;
  onOctavesChange: (octs: number) => void;
}

export const ArpController: React.FC<ArpControllerProps> = ({
  enabled,
  bpm,
  division,
  pattern,
  octaves,
  onToggle,
  onBpmChange,
  onDivisionChange,
  onPatternChange,
  onOctavesChange,
}) => {
  const divisions: ArpDivision[] = ['1/8', '1/16', '1/8T', '1/16T'];
  const patterns: Array<{ label: string; value: ArpPattern }> = [
    { label: 'UP', value: 'up' },
    { label: 'DN', value: 'down' },
    { label: 'U/D', value: 'upDown' },
    { label: 'RND', value: 'random' },
  ];

  return (
    <div className="flex flex-col items-center justify-between h-full bg-[#181a1c] rounded-[3px] border border-[#3d4143] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)] select-none">
      {/* Header with Master Arp Enable Button */}
      <div className="w-full flex items-center justify-between pb-1 border-b border-[#292c2d]">
        <button
          onClick={() => onToggle(!enabled)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] border text-[8px] font-['JetBrains_Mono'] font-bold transition-all ${
            enabled
              ? 'bg-[#ffb545] border-[#ffe58a] text-[#291800] shadow-[0_0_8px_#ffb545]'
              : 'bg-[#121416] border-[#514535] text-[#9e8e7c] hover:text-[#e7e0d3]'
          }`}
          aria-label="Toggle Arpeggiator"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-[#291800]' : 'bg-[#514535]'}`} />
          ARP {enabled ? 'ON' : 'OFF'}
        </button>

        {/* Octaves Range */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3].map(oct => (
            <button
              key={oct}
              onClick={() => onOctavesChange(oct)}
              className={`w-3.5 h-3.5 rounded-[1px] text-[7px] font-['JetBrains_Mono'] font-bold transition-colors ${
                octaves === oct
                  ? 'bg-[#59cbd0] text-[#002021]'
                  : 'bg-[#121416] text-[#9e8e7c] hover:bg-[#202224]'
              }`}
            >
              {oct}x
            </button>
          ))}
        </div>
      </div>

      {/* BPM Rotary Dial */}
      <div className="my-1">
        <Knob
          label="BPM"
          value={bpm}
          min={60}
          max={200}
          step={1}
          size="sm"
          onChange={onBpmChange}
        />
      </div>

      {/* Rhythmic Division Selector */}
      <div className="grid grid-cols-2 gap-1 w-full my-0.5">
        {divisions.map(div => (
          <button
            key={div}
            onClick={() => onDivisionChange(div)}
            className={`py-0.5 px-1 rounded-[2px] text-[7px] font-['JetBrains_Mono'] font-bold text-center transition-colors ${
              division === div
                ? 'bg-[#ffd9aa] text-[#452b00]'
                : 'bg-[#121416] text-[#9e8e7c] hover:text-[#e7e0d3]'
            }`}
          >
            {div}
          </button>
        ))}
      </div>

      {/* Pattern Selector */}
      <div className="grid grid-cols-2 gap-1 w-full pt-1 border-t border-[#292c2d]">
        {patterns.map(pat => (
          <button
            key={pat.value}
            onClick={() => onPatternChange(pat.value)}
            className={`py-0.5 px-0.5 rounded-[2px] text-[7px] font-['JetBrains_Mono'] font-bold text-center transition-colors ${
              pattern === pat.value
                ? 'bg-[#59cbd0] text-[#002021]'
                : 'bg-[#121416] text-[#9e8e7c] hover:text-[#e7e0d3]'
            }`}
          >
            {pat.label}
          </button>
        ))}
      </div>
    </div>
  );
};

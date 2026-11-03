import React, { useRef, useState } from 'react';
import { Knob } from './Knob';

interface PitchModWheelsProps {
  octave: number;
  glide: number;
  onOctaveChange: (oct: number) => void;
  onGlideChange: (glide: number) => void;
  onPitchBend: (semitones: number) => void;
  onModWheel: (amount: number) => void;
}

export const PitchModWheels: React.FC<PitchModWheelsProps> = ({
  octave,
  glide,
  onOctaveChange,
  onGlideChange,
  onPitchBend,
  onModWheel,
}) => {
  const [pitchBendVal, setPitchBendVal] = useState(0); // -1..1
  const [modVal, setModVal] = useState(0); // 0..1

  // Handle spring-loaded pitch bend wheel
  const handlePitchPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const initialVal = pitchBendVal;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const normalized = Math.max(-1, Math.min(1, initialVal + deltaY / 60));
      setPitchBendVal(normalized);
      onPitchBend(normalized * 2); // +/- 2 semitones
    };

    const handlePointerUp = () => {
      // Spring return to center
      setPitchBendVal(0);
      onPitchBend(0);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Handle continuous modulation wheel
  const handleModPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const initialVal = modVal;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const normalized = Math.max(0, Math.min(1, initialVal + deltaY / 80));
      setModVal(normalized);
      onModWheel(normalized);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="flex flex-col items-center justify-between h-[155px] w-[95px] bg-[#1a1c1e] rounded-b-md border-t border-r border-[#3d4143] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85)]">
      {/* Top utility knobs: Octave & Glide */}
      <div className="grid grid-cols-2 gap-1 w-full pt-1">
        <Knob
          label="OCT"
          value={octave}
          min={-2}
          max={2}
          step={1}
          size="sm"
          onChange={onOctaveChange}
        />
        <Knob
          label="GLIDE"
          value={glide}
          min={0}
          max={0.5}
          step={0.01}
          unit="s"
          size="sm"
          onChange={onGlideChange}
        />
      </div>

      {/* Performance Wheels Row */}
      <div className="flex items-center justify-around w-full mt-1">
        {/* Pitch Bend Wheel (Spring-loaded) */}
        <div className="flex flex-col items-center">
          <div
            onPointerDown={handlePitchPointerDown}
            className="relative w-7 h-16 rounded-[3px] bg-[#0c0e10] border border-[#514535] shadow-[inset_0_4px_8px_rgba(0,0,0,0.95)] flex items-center justify-center cursor-ns-resize overflow-hidden touch-none"
            role="slider"
            aria-label="Pitch Bend Wheel"
            aria-valuenow={Math.round(pitchBendVal * 100)}
            aria-valuemin={-100}
            aria-valuemax={100}
            tabIndex={0}
          >
            {/* Knurled Copper Cylindrical Wheel with Teeth */}
            <div
              className="w-5 h-14 rounded-[2px] transition-transform duration-75 flex flex-col justify-around py-1 shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              style={{
                background: 'linear-gradient(180deg, #ffd9aa 0%, #ad7655 45%, #5c1a00 100%)',
                transform: `translateY(${-pitchBendVal * 12}px)`,
              }}
            >
              {/* Tactile horizontal ribs */}
              <div className="w-full h-[1.5px] bg-[#ffe58a]" />
              <div className="w-full h-[1.5px] bg-[#5c1a00]" />
              <div className="w-full h-[1.5px] bg-[#ffe58a]" />
              <div className="w-full h-[1.5px] bg-[#5c1a00]" />
              <div className="w-full h-[1.5px] bg-[#ffe58a]" />
            </div>
          </div>
          <span className="mt-1 font-['JetBrains_Mono'] text-[8px] font-bold text-[#e7e0d3] tracking-wider uppercase">
            BEND
          </span>
        </div>

        {/* Modulation Wheel (Continuous) */}
        <div className="flex flex-col items-center">
          <div
            onPointerDown={handleModPointerDown}
            className="relative w-7 h-16 rounded-[3px] bg-[#0c0e10] border border-[#514535] shadow-[inset_0_4px_8px_rgba(0,0,0,0.95)] flex items-center justify-center cursor-ns-resize overflow-hidden touch-none"
            role="slider"
            aria-label="Modulation Wheel"
            aria-valuenow={Math.round(modVal * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
          >
            {/* Knurled Copper Cylindrical Wheel */}
            <div
              className="w-5 h-14 rounded-[2px] transition-transform duration-75 flex flex-col justify-around py-1 shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              style={{
                background: 'linear-gradient(180deg, #ffd9aa 0%, #ad7655 45%, #5c1a00 100%)',
                transform: `translateY(${-modVal * 12}px)`,
              }}
            >
              <div className="w-full h-[1.5px] bg-[#ffe58a]" />
              <div className="w-full h-[1.5px] bg-[#5c1a00]" />
              <div className="w-full h-[1.5px] bg-[#ffe58a]" />
              <div className="w-full h-[1.5px] bg-[#5c1a00]" />
              <div className="w-full h-[1.5px] bg-[#ffe58a]" />
            </div>
          </div>
          <span className="mt-1 font-['JetBrains_Mono'] text-[8px] font-bold text-[#e7e0d3] tracking-wider uppercase">
            MOD
          </span>
        </div>
      </div>
    </div>
  );
};

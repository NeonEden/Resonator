import React, { useRef, useState } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  height?: number;
  unit?: string;
  onChange: (val: number) => void;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  height = 90,
  unit = '',
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const updateFromPosition = (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      // Invert Y so bottom is 0 and top is 1
      const yNorm = 1 - (clientY - rect.top) / rect.height;
      const clampedNorm = Math.max(0, Math.min(1, yNorm));
      let rawVal = min + clampedNorm * (max - min);
      if (step >= 1) {
        rawVal = Math.round(rawVal / step) * step;
      }
      onChange(rawVal);
    };

    updateFromPosition(e.clientY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateFromPosition(moveEvent.clientY);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = (max - min) * 0.05;
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -(max - min) * 0.05;
    if (delta !== 0) {
      e.preventDefault();
      onChange(Math.max(min, Math.min(max, value + delta)));
    }
  };

  return (
    <div
      className="flex flex-col items-center select-none group cursor-pointer"
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Slider Trench */}
      <div
        ref={trackRef}
        className="relative w-6 flex items-center justify-center touch-none py-2"
        style={{ height }}
        onPointerDown={handlePointerDown}
      >
        {/* Recessed metal slot trench */}
        <div className="w-1.5 h-full rounded-sm slider-trench border border-[#1a1c1e] relative">
          {/* Subtle calibration ticks along side */}
          <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-between py-1 opacity-40 pointer-events-none">
            <span className="w-1.5 h-[1px] bg-[#9e8e7c]" />
            <span className="w-1 h-[1px] bg-[#9e8e7c]" />
            <span className="w-1.5 h-[1px] bg-[#9e8e7c]" />
            <span className="w-1 h-[1px] bg-[#9e8e7c]" />
            <span className="w-1.5 h-[1px] bg-[#9e8e7c]" />
          </div>

          {/* Active fill indicator line */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b-sm bg-[#ffb545]/40 transition-all duration-75"
            style={{ height: `${norm * 100}%` }}
          />
        </div>

        {/* Machined Copper Slider Knob Cap */}
        <div
          className="absolute w-7 h-4 rounded-[2px] transition-all duration-75 flex items-center justify-center pointer-events-none"
          style={{
            bottom: `calc(${norm * 100}% - 8px)`,
            background: 'linear-gradient(180deg, #ffd9aa 0%, #ad7655 40%, #5c1a00 100%)',
            boxShadow: '0 3px 6px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.6)',
            border: '1px solid #ffb953',
          }}
        >
          {/* Center tactile rib line */}
          <div className="w-full h-[1.5px] bg-[#ffe58a] shadow-[0_0_3px_#ffb545]" />
        </div>

        {/* Floating Tooltip */}
        {isDragging && (
          <div className="absolute -top-6 px-1.5 py-0.5 rounded bg-[#0c0e10] border border-[#ffb545] shadow-[0_0_6px_rgba(255,181,69,0.4)] pointer-events-none z-50">
            <span className="font-['JetBrains_Mono'] text-[9px] font-bold text-[#ffb545]">
              {value < 10 && !Number.isInteger(value) ? value.toFixed(2) : Math.round(value)} {unit}
            </span>
          </div>
        )}
      </div>

      {/* Silk-Screened Label */}
      <span className="mt-1 font-['JetBrains_Mono'] text-[9px] font-bold tracking-[0.12em] text-[#d6c4af] uppercase text-center">
        {label}
      </span>
    </div>
  );
};

import React, { useState, useRef, useCallback } from 'react';

interface KnobProps {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  logScale?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'copper' | 'amber' | 'cyan';
  onChange: (val: number) => void;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  sublabel,
  value,
  min,
  max,
  step = 1,
  unit = '',
  logScale = false,
  size = 'md',
  color = 'copper',
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(0);

  // Normalize value to 0..1 range
  const getNormalized = (v: number) => {
    if (logScale) {
      const minLog = Math.log(Math.max(0.001, min));
      const maxLog = Math.log(max);
      return (Math.log(Math.max(0.001, v)) - minLog) / (maxLog - minLog);
    }
    return (v - min) / (max - min);
  };

  // Convert 0..1 to actual value
  const fromNormalized = (n: number) => {
    const clamped = Math.max(0, Math.min(1, n));
    if (logScale) {
      const minLog = Math.log(Math.max(0.001, min));
      const maxLog = Math.log(max);
      return Math.exp(minLog + clamped * (maxLog - minLog));
    }
    return min + clamped * (max - min);
  };

  const norm = getNormalized(value);
  // Knobs rotate -135deg to +135deg (total 270 degrees)
  const angle = -135 + norm * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = norm;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startYRef.current - moveEvent.clientY;
      // 150px drag covers full 0..1 span
      const newNorm = Math.max(0, Math.min(1, startValRef.current + deltaY / 150));
      let rawVal = fromNormalized(newNorm);
      if (step >= 1) {
        rawVal = Math.round(rawVal / step) * step;
      }
      onChange(rawVal);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * (logScale ? 0.05 : (max - min) * 0.03);
    const nextVal = Math.max(min, Math.min(max, value + delta));
    onChange(step >= 1 ? Math.round(nextVal / step) * step : nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = step;
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -step;
    if (delta !== 0) {
      e.preventDefault();
      const nextVal = Math.max(min, Math.min(max, value + delta));
      onChange(nextVal);
    }
  };

  // Dimensions
  const dim = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;

  const formatDisplay = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  };

  return (
    <div
      className="flex flex-col items-center select-none group cursor-ns-resize"
      onWheel={handleWheel}
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Outer Dial Assembly */}
      <div
        className="relative flex items-center justify-center touch-none"
        style={{ width: dim + 12, height: dim + 12 }}
        onPointerDown={handlePointerDown}
      >
        {/* Beveled Retaining Collar / Hex Nut base */}
        <div
          className="absolute rounded-full border border-[#514535] bg-[#1a1c1e] shadow-[0_2px_6px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)]"
          style={{ width: dim + 8, height: dim + 8 }}
        />

        {/* Circular Calibration Arc Markers */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={dim + 12}
          height={dim + 12}
          viewBox={`0 0 ${dim + 12} ${dim + 12}`}
        >
          {/* Active travel track arc */}
          <circle
            cx={(dim + 12) / 2}
            cy={(dim + 12) / 2}
            r={dim / 2 + 3}
            fill="none"
            stroke={isDragging ? '#ffb545' : '#45382c'}
            strokeWidth="1.5"
            strokeDasharray={`${norm * 85} 200`}
            strokeDashoffset="-25"
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        {/* Stationary Illuminated Knob Body (Fixed Top-Left Light Source) */}
        <div
          className="relative rounded-full flex items-center justify-center border border-[#ad7655]/60 bg-gradient-to-br from-[#3e4246] via-[#202326] to-[#0d0f11] shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.35),0_6px_14px_rgba(0,0,0,0.9)]"
          style={{
            width: dim,
            height: dim,
          }}
        >
          {/* Knurled Outer Metallic Ridge Rim */}
          <div className="absolute inset-0 rounded-full border border-[#ffd9aa]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] pointer-events-none" />

          {/* Machined Inner Core */}
          <div className="w-[72%] h-[72%] rounded-full bg-gradient-to-br from-[#2a2d30] via-[#141618] to-[#08090a] border border-[#59351a] shadow-[inset_0_2px_4px_rgba(0,0,0,0.95)] flex items-center justify-center relative overflow-hidden">
            
            {/* ROTATING INDICATOR DISC (Only indicator line rotates!) */}
            <div
              className="absolute inset-0 flex items-start justify-center pt-0.5 transition-transform duration-75"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              {/* Screen-Printed Luminous Amber/Ivory Indicator Marker */}
              <div className="w-[2.5px] h-[40%] rounded-full bg-gradient-to-b from-[#ffffff] via-[#ffe58a] to-[#ffb545] shadow-[0_0_6px_#ffb545]" />
            </div>

            {/* Stationary Center Brass Cap (Fixed Top-Left Reflection) */}
            <div className="w-[30%] h-[30%] rounded-full bg-gradient-to-br from-[#ffd9aa] via-[#ad7655] to-[#3a1d08] border border-[#ffb545]/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]" />
          </div>
        </div>

        {/* Interactive Hover / Drag Tooltip with Monospace Value */}
        {isDragging && (
          <div className="absolute -top-7 px-2 py-0.5 rounded bg-[#0c0e10] border border-[#ffb545] shadow-[0_0_8px_rgba(255,181,69,0.5)] z-50 pointer-events-none">
            <span className="font-['JetBrains_Mono'] text-[10px] font-bold text-[#ffb545] tracking-wider whitespace-nowrap">
              {formatDisplay(value)} {unit}
            </span>
          </div>
        )}
      </div>

      {/* Screen-Printed Stenciled Label */}
      <span className="mt-1 font-['JetBrains_Mono'] text-[10px] font-bold tracking-[0.14em] text-[#e7e0d3] uppercase text-center">
        {label}
      </span>
      {sublabel && (
        <span className="font-['JetBrains_Mono'] text-[8px] font-medium tracking-[0.08em] text-[#9e8e7c] uppercase">
          {sublabel}
        </span>
      )}
    </div>
  );
};

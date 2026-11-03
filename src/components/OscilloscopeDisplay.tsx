import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';

interface OscilloscopeDisplayProps {
  isPlaying: boolean;
}

export const OscilloscopeDisplay: React.FC<OscilloscopeDisplayProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'wave' | 'fft'>('wave');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const data = audioEngine.getVisualizerData();

      // Screen background with phosphor decay trail
      ctx.fillStyle = 'rgba(9, 14, 19, 0.35)';
      ctx.fillRect(0, 0, width, height);

      // Subtle CRT grid lines
      ctx.strokeStyle = 'rgba(40, 60, 75, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 20; x < width; x += 25) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 15; y < height; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Center crosshair axis
      ctx.strokeStyle = 'rgba(89, 203, 208, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      if (mode === 'wave') {
        // Waveform Oscilloscope Trace
        const buffer = data.timeDomain;
        ctx.beginPath();
        const sliceWidth = width / buffer.length;
        let x = 0;

        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 128.0; // 0..2
          // If silent, show quiet resting jitter line
          const idleOffset = isPlaying ? 0 : Math.sin(i * 0.2 + Date.now() * 0.003) * 0.02;
          const y = ((v + idleOffset) * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineWidth = 2.0;
        ctx.strokeStyle = isPlaying ? '#ffb545' : '#81766b';
        ctx.shadowColor = isPlaying ? '#ffb545' : '#59cbd0';
        ctx.shadowBlur = isPlaying ? 10 : 3;
        ctx.stroke();

        // Secondary cyan edge highlight
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = '#ffe58a';
        ctx.shadowBlur = 0;
        ctx.stroke();
      } else {
        // FFT Spectrum Analyzer Bars
        const buffer = data.frequency;
        const barWidth = (width / 48) - 1.5;
        let x = 4;

        for (let i = 0; i < 48; i++) {
          const val = buffer[i * 2] || 0;
          const barHeight = Math.max(2, (val / 255) * (height - 12));
          const y = height - barHeight - 4;

          const grad = ctx.createLinearGradient(x, y, x, height);
          grad.addColorStop(0, '#ffe58a');
          grad.addColorStop(0.3, '#ffb545');
          grad.addColorStop(1, '#59cbd0');

          ctx.fillStyle = grad;
          ctx.fillRect(x, y, barWidth, barHeight);
          x += barWidth + 1.5;
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [mode, isPlaying]);

  return (
    <div className="flex flex-col items-center">
      {/* Recessed CRT Glass Chassis */}
      <div className="relative w-full h-[110px] rounded-sm crt-screen border border-[#244577]/60 overflow-hidden">
        {/* Subtle glass reflection scanline effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,20,22,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] pointer-events-none z-20" />
        <div className="absolute inset-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.95)] pointer-events-none z-20" />

        {/* Telemetry Stream Overlay */}
        <div className="absolute top-1.5 left-2 right-2 flex justify-between items-center z-30 pointer-events-none">
          <span className="font-['JetBrains_Mono'] text-[8px] font-bold tracking-widest text-[#59cbd0]/80 uppercase">
            {mode === 'wave' ? 'OSC // PHOSPHOR' : 'FFT // SPECTRA'}
          </span>
          <span className="font-['JetBrains_Mono'] text-[8px] font-bold tracking-widest text-[#ffb545]/90">
            {isPlaying ? '48.0 kHz' : 'STANDBY'}
          </span>
        </div>

        {/* Mode Toggle Button in bottom corner */}
        <button
          onClick={() => setMode(mode === 'wave' ? 'fft' : 'wave')}
          className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-[2px] bg-[#121416]/80 hover:bg-[#1a1c1e] border border-[#514535] text-[7px] font-['JetBrains_Mono'] font-bold text-[#d6c4af] z-30 transition-colors"
          title="Toggle Waveform / FFT Spectrum"
        >
          {mode === 'wave' ? '→ FFT' : '→ WAVE'}
        </button>

        <canvas
          ref={canvasRef}
          width={170}
          height={100}
          className="w-full h-full object-cover relative z-10"
        />
      </div>

      <span className="mt-1 font-['JetBrains_Mono'] text-[9px] font-bold tracking-[0.15em] text-[#e7e0d3] uppercase">
        SIGNAL MONITOR
      </span>
    </div>
  );
};

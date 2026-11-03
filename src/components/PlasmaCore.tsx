import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';

interface PlasmaCoreProps {
  isPlaying: boolean;
  activeVoices: number;
  plasmaColor?: string;
  thermalGlow?: number | string;
}

export const PlasmaCore: React.FC<PlasmaCoreProps> = ({
  isPlaying,
  activeVoices,
  plasmaColor = '#ffb545',
  thermalGlow = 0.85,
}) => {
  const numericGlow = typeof thermalGlow === 'number' ? thermalGlow : 0.85;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // High energy plasma particles
    const particleCount = 55;
    const particles = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 45,
      y: (Math.random() - 0.5) * 120,
      z: (Math.random() - 0.5) * 45,
      vx: (Math.random() - 0.5) * 0.9,
      vy: -0.7 - Math.random() * 1.5,
      size: 1.2 + Math.random() * 2.8,
      hue: Math.random() > 0.4 ? 42 : 185,
      life: Math.random(),
      maxLife: 0.5 + Math.random() * 0.8,
    }));

    const render = () => {
      time += 0.04;

      const visualData = audioEngine.getVisualizerData();
      const energy = Math.max(visualData.rmsEnergy, isPlaying ? 0.45 : 0.08) * (numericGlow / 0.85);
      const centroid = visualData.spectralCentroid;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Recessed dark chamber background
      ctx.fillStyle = '#0a0d10';
      ctx.fillRect(0, 0, width, height);

      // 2. Diffuse Chamber Wall Glow (Cyan on left, Violet on right, Tinted Core in center)
      const leftWallGlow = ctx.createRadialGradient(
        15, centerY, 5,
        15, centerY, width * 0.6
      );
      leftWallGlow.addColorStop(0, `rgba(89, 203, 208, ${0.15 + energy * 0.35})`);
      leftWallGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftWallGlow;
      ctx.fillRect(0, 0, width, height);

      const rightWallGlow = ctx.createRadialGradient(
        width - 15, centerY, 5,
        width - 15, centerY, width * 0.6
      );
      rightWallGlow.addColorStop(0, `rgba(180, 80, 220, ${0.12 + energy * 0.3})`);
      rightWallGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightWallGlow;
      ctx.fillRect(0, 0, width, height);

      // Center Core Glow tinted with preset plasmaColor
      const centerGlow = ctx.createRadialGradient(
        centerX, centerY, 10,
        centerX, centerY, width * 0.55
      );
      centerGlow.addColorStop(0, plasmaColor);
      centerGlow.addColorStop(0.4, `rgba(255, 104, 44, ${0.15 + energy * 0.3})`);
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Glass Capsule Container
      const tubeWidth = width * 0.62;
      const tubeHeight = height * 0.86;
      const tubeLeft = (width - tubeWidth) / 2;
      const tubeTop = (height - tubeHeight) / 2;
      const tubeRadius = 16;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(tubeLeft, tubeTop, tubeWidth, tubeHeight, tubeRadius);
      ctx.clip();

      // Deep vacuum inner field
      const tubeBg = ctx.createLinearGradient(tubeLeft, tubeTop, tubeLeft + tubeWidth, tubeTop);
      tubeBg.addColorStop(0, 'rgba(8, 14, 20, 0.95)');
      tubeBg.addColorStop(0.3, 'rgba(16, 26, 34, 0.75)');
      tubeBg.addColorStop(0.7, 'rgba(28, 22, 18, 0.75)');
      tubeBg.addColorStop(1, 'rgba(10, 12, 16, 0.95)');
      ctx.fillStyle = tubeBg;
      ctx.fillRect(tubeLeft, tubeTop, tubeWidth, tubeHeight);

      // 4. Central Filament Vortex
      const swirlSpeed = 1.0 + energy * 4.0;
      const swirlRot = time * swirlSpeed;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Twin helical spiral filaments
      const helixSegments = 64;
      for (let strand = -1; strand <= 1; strand += 2) {
        ctx.beginPath();
        for (let i = 0; i <= helixSegments; i++) {
          const t = i / helixSegments;
          const py = (t - 0.5) * (tubeHeight * 0.74);
          const phase = t * Math.PI * 4.2 + swirlRot * strand;
          const radius = (14 + Math.sin(t * Math.PI) * 16) * (1 + energy * 0.3);
          const px = Math.sin(phase) * radius;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.lineWidth = 2.5 + energy * 2.2;
        ctx.strokeStyle = strand > 0 ? plasmaColor : '#ffe58a';
        ctx.shadowColor = strand > 0 ? '#ff682c' : '#59cbd0';
        ctx.shadowBlur = 12 + energy * 20;
        ctx.stroke();
      }

      // Hot center core ball
      const flameGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 32 + energy * 25);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.18, '#ffe58a');
      flameGrad.addColorStop(0.45, plasmaColor);
      flameGrad.addColorStop(0.75, 'rgba(89, 203, 208, 0.35)');
      flameGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(0, 0, 34 + energy * 22, 0, Math.PI * 2);
      ctx.fillStyle = flameGrad;
      ctx.fill();

      // Ionization discharge particles
      for (const p of particles) {
        p.y += p.vy * (1 + energy * 2.5);
        p.x += Math.sin(time * 3 + p.z) * 0.8;
        p.life += 0.025 * (1 + energy);

        if (p.life > p.maxLife || p.y < -tubeHeight * 0.42) {
          p.x = (Math.random() - 0.5) * 22;
          p.y = tubeHeight * 0.38;
          p.life = 0;
          p.hue = Math.random() > 0.4 ? 42 : 185;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * (0.5 + energy * 0.5);
        const col = p.hue === 42 ? plasmaColor : `rgba(89, 203, 208, ${alpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + energy * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.shadowColor = plasmaColor;
        ctx.shadowBlur = 9;
        ctx.fill();
      }

      ctx.restore();

      // 5. Specular Highlights on Curved Glass Surface
      const leftSpec = ctx.createLinearGradient(tubeLeft, tubeTop, tubeLeft + 14, tubeTop);
      leftSpec.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      leftSpec.addColorStop(0.4, 'rgba(255, 255, 255, 0.15)');
      leftSpec.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = leftSpec;
      ctx.fillRect(tubeLeft, tubeTop, 14, tubeHeight);

      const rightSpec = ctx.createLinearGradient(tubeLeft + tubeWidth - 10, tubeTop, tubeLeft + tubeWidth, tubeTop);
      rightSpec.addColorStop(0, 'rgba(255, 255, 255, 0)');
      rightSpec.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
      ctx.fillStyle = rightSpec;
      ctx.fillRect(tubeLeft + tubeWidth - 10, tubeTop, 10, tubeHeight);

      ctx.restore(); // remove clip

      // Top & Bottom Machined Retaining Rings
      const drawCollar = (y: number) => {
        const collarGrad = ctx.createLinearGradient(tubeLeft, y, tubeLeft + tubeWidth, y);
        collarGrad.addColorStop(0, '#59351a');
        collarGrad.addColorStop(0.25, '#d49b56');
        collarGrad.addColorStop(0.5, '#ffd9aa');
        collarGrad.addColorStop(0.75, '#b27546');
        collarGrad.addColorStop(1, '#3b220e');

        ctx.save();
        ctx.fillStyle = collarGrad;
        ctx.beginPath();
        ctx.roundRect(tubeLeft - 3, y, tubeWidth + 6, 8, 3);
        ctx.fill();
        ctx.restore();
      };

      drawCollar(tubeTop + 4);
      drawCollar(tubeTop + tubeHeight - 12);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, plasmaColor, thermalGlow]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-1 select-none">
      {/* 3D Recessed Chamber */}
      <div className="relative w-full h-[245px] rounded-sm plasma-chamber border border-[#3d4143] overflow-hidden flex items-center justify-center shadow-[inset_0_4px_20px_rgba(0,0,0,0.95)]">
        <div className="absolute inset-0 border border-[#16181b] pointer-events-none z-20" />
        
        <canvas
          ref={canvasRef}
          width={180}
          height={240}
          className="w-full h-full object-contain relative z-10"
        />

        {/* Ambient ionization flare reflection */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-transparent via-[#ffb545]/5 to-transparent pointer-events-none transition-opacity duration-300 ${
            isPlaying ? 'opacity-80' : 'opacity-20'
          }`}
        />
      </div>

      {/* Telemetry Indicator */}
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full transition-colors"
          style={{
            backgroundColor: isPlaying ? plasmaColor : '#514535',
            boxShadow: isPlaying ? `0 0 8px ${plasmaColor}` : 'none',
          }}
        />
        <span className="font-['JetBrains_Mono'] text-[8px] font-bold tracking-[0.2em] text-[#d6c4af] uppercase">
          VACUUM CORE // {activeVoices > 0 ? `${activeVoices} VOICES` : 'STANDBY'}
        </span>
      </div>
    </div>
  );
};

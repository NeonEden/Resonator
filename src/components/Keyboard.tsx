import React, { useEffect } from 'react';

export interface KeyDef {
  midiNote: number;
  noteName: string;
  isBlack: boolean;
  boundary?: number; // Boundary index between white keys for black keys
  keyLabel?: string;
}

// 25 Keys: C3 (48) to C5 (72)
const KEYBOARD_KEYS: KeyDef[] = [
  // Octave 3 (White index 0 to 6)
  { midiNote: 48, noteName: 'C3', isBlack: false, keyLabel: 'A' },
  { midiNote: 49, noteName: 'C#3', isBlack: true, boundary: 1, keyLabel: 'W' },
  { midiNote: 50, noteName: 'D3', isBlack: false, keyLabel: 'S' },
  { midiNote: 51, noteName: 'D#3', isBlack: true, boundary: 2, keyLabel: 'E' },
  { midiNote: 52, noteName: 'E3', isBlack: false, keyLabel: 'D' },
  { midiNote: 53, noteName: 'F3', isBlack: false, keyLabel: 'F' },
  { midiNote: 54, noteName: 'F#3', isBlack: true, boundary: 4, keyLabel: 'T' },
  { midiNote: 55, noteName: 'G3', isBlack: false, keyLabel: 'G' },
  { midiNote: 56, noteName: 'G#3', isBlack: true, boundary: 5, keyLabel: 'Y' },
  { midiNote: 57, noteName: 'A3', isBlack: false, keyLabel: 'H' },
  { midiNote: 58, noteName: 'A#3', isBlack: true, boundary: 6, keyLabel: 'U' },
  { midiNote: 59, noteName: 'B3', isBlack: false, keyLabel: 'J' },

  // Octave 4 (White index 7 to 13)
  { midiNote: 60, noteName: 'C4', isBlack: false, keyLabel: 'K' },
  { midiNote: 61, noteName: 'C#4', isBlack: true, boundary: 8, keyLabel: 'O' },
  { midiNote: 62, noteName: 'D4', isBlack: false, keyLabel: 'L' },
  { midiNote: 63, noteName: 'D#4', isBlack: true, boundary: 9, keyLabel: 'P' },
  { midiNote: 64, noteName: 'E4', isBlack: false, keyLabel: ';' },
  { midiNote: 65, noteName: 'F4', isBlack: false, keyLabel: "'" },
  { midiNote: 66, noteName: 'F#4', isBlack: true, boundary: 11, keyLabel: '5' },
  { midiNote: 67, noteName: 'G4', isBlack: false, keyLabel: 'B' },
  { midiNote: 68, noteName: 'G#4', isBlack: true, boundary: 12, keyLabel: '6' },
  { midiNote: 69, noteName: 'A4', isBlack: false, keyLabel: 'N' },
  { midiNote: 70, noteName: 'A#4', isBlack: true, boundary: 13, keyLabel: '7' },
  { midiNote: 71, noteName: 'B4', isBlack: false, keyLabel: 'M' },

  // Final high C (White index 14)
  { midiNote: 72, noteName: 'C5', isBlack: false, keyLabel: ',' },
];

interface KeyboardProps {
  activeNotes: Set<number>;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
}

export const Keyboard: React.FC<KeyboardProps> = ({
  activeNotes,
  onNoteOn,
  onNoteOff,
}) => {
  // Keyboard mapping for computer keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const keyUpper = e.key.toUpperCase();
      const match = KEYBOARD_KEYS.find(k => k.keyLabel === keyUpper || k.keyLabel === e.key);
      if (match && !activeNotes.has(match.midiNote)) {
        onNoteOn(match.midiNote);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyUpper = e.key.toUpperCase();
      const match = KEYBOARD_KEYS.find(k => k.keyLabel === keyUpper || k.keyLabel === e.key);
      if (match) {
        onNoteOff(match.midiNote);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeNotes, onNoteOn, onNoteOff]);

  const whiteKeys = KEYBOARD_KEYS.filter(k => !k.isBlack);
  const totalWhite = whiteKeys.length; // 15
  const blackKeyWidthPct = 4.2; // Width in percentage of keyboard bed

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      {/* Keyboard Bed / Machined Recessed Enclosure */}
      <div className="relative w-full h-[155px] bg-[#0c0e10] rounded-b-md p-1.5 shadow-[inset_0_4px_14px_rgba(0,0,0,0.98),0_10px_25px_rgba(0,0,0,0.85)] border-t border-[#1a1c1e] touch-none">
        
        {/* Natural / White Keys Container */}
        <div className="flex w-full h-full relative">
          {whiteKeys.map((key) => {
            const isActive = activeNotes.has(key.midiNote);

            return (
              <button
                key={key.midiNote}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  onNoteOn(key.midiNote);
                }}
                onPointerCancel={() => onNoteOff(key.midiNote)}
                onLostPointerCapture={() => onNoteOff(key.midiNote)}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onNoteOff(key.midiNote);
                }}
                onPointerLeave={() => {
                  if (isActive) onNoteOff(key.midiNote);
                }}
                className={`relative flex-1 h-full mx-[1px] rounded-b-[3px] transition-transform duration-75 flex flex-col justify-end items-center pb-2.5 ${
                  isActive
                    ? 'translate-y-[3px] shadow-[inset_0_3px_6px_rgba(0,0,0,0.95),0_0_14px_rgba(255,181,69,0.45)] bg-gradient-to-br from-[#121416] via-[#202325] to-[#2a2d30]'
                    : 'shadow-[0_6px_10px_rgba(0,0,0,0.85),inset_0_1.5px_1px_rgba(255,255,255,0.22)] bg-gradient-to-br from-[#2f3236] via-[#1f2123] to-[#141618] hover:brightness-115'
                }`}
                style={{
                  border: '1px solid #36393b',
                  borderTop: 'none',
                }}
                aria-label={`Key ${key.noteName}`}
              >
                {/* Ebony wood grain vertical subtle lines */}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_48%,rgba(255,255,255,0.02)_50%,transparent_52%)] pointer-events-none" />

                {/* Copper key lip accent */}
                <div
                  className={`w-[60%] h-[2px] rounded-full mb-1 transition-colors ${
                    isActive ? 'bg-[#ffb545] shadow-[0_0_8px_#ffb545]' : 'bg-[#514535]/60'
                  }`}
                />

                {/* Note name & key mapping */}
                <div className="flex flex-col items-center pointer-events-none">
                  <span className="font-['JetBrains_Mono'] text-[8px] font-bold text-[#9e8e7c]">
                    {key.noteName}
                  </span>
                  {key.keyLabel && (
                    <span className="font-['JetBrains_Mono'] text-[7px] text-[#59cbd0]/80 font-bold">
                      {key.keyLabel}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Black / Sharp Keys - Positioned precisely on boundaries */}
          {KEYBOARD_KEYS.map((key) => {
            if (!key.isBlack || key.boundary === undefined) return null;
            const isActive = activeNotes.has(key.midiNote);

            // Center of boundary B with 15 white keys
            const centerPct = (key.boundary / totalWhite) * 100;
            const leftPct = centerPct - blackKeyWidthPct / 2;

            return (
              <button
                key={key.midiNote}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  onNoteOn(key.midiNote);
                }}
                onPointerCancel={() => onNoteOff(key.midiNote)}
                onLostPointerCapture={() => onNoteOff(key.midiNote)}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNoteOff(key.midiNote);
                }}
                onPointerLeave={() => {
                  if (isActive) onNoteOff(key.midiNote);
                }}
                className={`absolute top-0 h-[64%] rounded-b-[2px] z-30 transition-transform duration-75 flex flex-col justify-end items-center pb-1.5 ${
                  isActive
                    ? 'translate-y-[2px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),0_0_12px_rgba(255,181,69,0.6)] bg-[#0d0f11]'
                    : 'shadow-[0_8px_14px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.25)] bg-gradient-to-b from-[#1c1e20] via-[#121416] to-[#0a0c0e] hover:brightness-125'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${blackKeyWidthPct}%`,
                  border: '1px solid #4a3a2a',
                  borderTop: 'none',
                }}
                aria-label={`Key ${key.noteName}`}
              >
                {/* Copper top rim highlight */}
                <div
                  className={`w-[70%] h-[2px] rounded-full mb-1 transition-colors ${
                    isActive ? 'bg-[#ffb545] shadow-[0_0_8px_#ffb545]' : 'bg-[#ad7655]/70'
                  }`}
                />

                {key.keyLabel && (
                  <span className="font-['JetBrains_Mono'] text-[7px] text-[#ffb545] font-bold pointer-events-none">
                    {key.keyLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

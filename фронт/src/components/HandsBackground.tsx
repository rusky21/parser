import React from 'react';

export const HandsBackground: React.FC = () => {
  return (
    <div
      className="pointer-events-none fixed inset-y-0 right-0 w-full sm:w-[65vw] lg:w-[58vw] z-0 overflow-hidden select-none flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src="/hands-hd.png"
          alt="Dotted Creation of Adam Hands"
          className="w-full h-auto max-h-[88vh] object-contain object-center opacity-95 transition-opacity duration-1000 filter drop-shadow-[0_0_25px_rgba(255,255,255,0.08)]"
        />

        {/* Subtle ethereal spark aura right between the fingertips */}
        <div className="absolute top-[49%] left-[47%] -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full bg-white/[0.06] blur-2xl pointer-events-none animate-pulse" />

        {/* Subtle vertical vignette so edges blend into black */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none opacity-60" />
      </div>
    </div>
  );
};

import React, { useRef, useEffect } from 'react';

interface VideoBackgroundProps {
  isVisible?: boolean;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ isVisible = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = true;
    video.muted = true;

    if (isVisible) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented or pending
        });
      }
    } else {
      video.pause();
    }
  }, [isVisible]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-black"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover object-center"
        src="/bg-video.mp4"
      />
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { VideoFile } from '../services/db';

interface HeroProps {
  video: VideoFile;
  onPlay: () => void;
}

const PlayIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>);

export const Hero: React.FC<HeroProps> = ({ video, onPlay }) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (video.poster) {
      url = URL.createObjectURL(video.poster);
      setPosterUrl(url);
    }

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [video]);

  return (
    <div className="relative h-[56.25vw] max-h-[80vh] w-full">
      {posterUrl && (
        <img src={posterUrl} alt={video.name} className="absolute top-0 left-0 w-full h-full object-cover" />
      )}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-8 md:p-16 w-full md:w-1/2 lg:w-2/5">
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg leading-tight">
          {video.name.replace(/\.[^/.]+$/, "")}
        </h2>
        <p className="text-gray-300 mt-2">{video.parentPath}</p>
        <button
          onClick={onPlay}
          className="mt-6 bg-brand-red text-white font-bold py-2 px-6 rounded-md text-lg flex items-center space-x-2 hover:bg-red-700 transition-colors"
        >
          <PlayIcon className="w-6 h-6"/>
          <span>Play</span>
        </button>
      </div>
    </div>
  );
};
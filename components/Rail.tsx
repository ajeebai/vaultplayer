

import React from 'react';
import { VideoTile } from './VideoTile';
import { VideoFile } from '../services/db';

interface RailProps {
  title: string;
  categoryPath?: string;
  videos: VideoFile[];
  onSelectVideo: (video: VideoFile) => void;
  onToggleFavorite: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  onSelectCategory: (category: string) => void;
  onUnsupportedMedia: (media: VideoFile) => void;
  onPrioritizeMedia: (media: VideoFile) => void;
}

export const Rail: React.FC<RailProps> = ({ title, categoryPath, videos, onSelectVideo, onToggleFavorite, onUpdateTags, onSelectCategory, onUnsupportedMedia, onPrioritizeMedia }) => {
  
  const handleTitleClick = () => {
    if (categoryPath) {
      onSelectCategory(categoryPath);
    }
  }

  return (
    <section>
      <h2 
        className={`text-xl md:text-2xl font-bold mb-4 text-white ${categoryPath ? 'cursor-pointer hover:text-brand-red transition-colors' : ''}`}
        onClick={handleTitleClick}
      >
        {title}
      </h2>
      <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-brand-light-gray scrollbar-track-transparent">
        {videos.map(videoFile => (
          <VideoTile 
            key={videoFile.fullPath} 
            video={videoFile} 
            onSelectVideo={onSelectVideo} 
            onToggleFavorite={onToggleFavorite}
            onUpdateTags={onUpdateTags}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
          />
        ))}
      </div>
    </section>
  );
};

// Add custom scrollbar styles to the head
const style = document.createElement('style');
style.innerHTML = `
.scrollbar-thin::-webkit-scrollbar {
    height: 8px;
}
.scrollbar-thumb-brand-light-gray::-webkit-scrollbar-thumb {
    background-color: #303030;
    border-radius: 10px;
}
.scrollbar-thumb-brand-light-gray::-webkit-scrollbar-thumb:hover {
    background-color: #404040;
}
.scrollbar-track-transparent::-webkit-scrollbar-track {
    background: transparent;
}
`;
document.head.appendChild(style);
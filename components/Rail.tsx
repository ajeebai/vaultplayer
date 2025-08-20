

import React from 'react';
import { VideoTile } from './VideoTile';
import { VideoFile } from '../services/db';

interface RailProps {
  title: string;
  categoryPath?: string;
  videos: VideoFile[];
  onSelectVideo: (video: VideoFile) => void;
  onToggleFavorite: (fullPath: string) => void;
  onToggleHidden: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  onSelectCategory: (category: string) => void;
  onUnsupportedMedia: (media: VideoFile) => void;
  onPrioritizeMedia: (media: VideoFile) => void;
  onClear?: () => void;
}

const ClearIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);


export const Rail: React.FC<RailProps> = ({ title, categoryPath, videos, onSelectVideo, onToggleFavorite, onToggleHidden, onUpdateTags, onSelectCategory, onUnsupportedMedia, onPrioritizeMedia, onClear }) => {
  
  const handleTitleClick = () => {
    if (categoryPath) {
      onSelectCategory(categoryPath);
    }
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 
          className={`text-xl md:text-2xl font-bold text-white ${categoryPath ? 'cursor-pointer hover:text-brand-red transition-colors' : ''}`}
          onClick={handleTitleClick}
        >
          {title}
        </h2>
        {onClear && (
            <button onClick={onClear} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1 rounded-md hover:bg-brand-light-gray">
                <ClearIcon className="w-4 h-4" />
                <span>Clear</span>
            </button>
        )}
      </div>
      <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 scrollbar-thin scrollbar-thumb-brand-light-gray scrollbar-track-transparent">
        {videos.map(videoFile => (
          <VideoTile 
            key={videoFile.fullPath} 
            video={videoFile} 
            onSelectVideo={onSelectVideo} 
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
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


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
  allCategoryVideos: VideoFile[];
  onPlayRemix: (videos: VideoFile[]) => void;
}

const ClearIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>);
const ShuffleIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>);


export const Rail: React.FC<RailProps> = ({ title, categoryPath, videos, onSelectVideo, onToggleFavorite, onToggleHidden, onUpdateTags, onSelectCategory, onUnsupportedMedia, onPrioritizeMedia, onClear, allCategoryVideos, onPlayRemix }) => {
  
  const handleTitleClick = () => {
    if (categoryPath) {
      onSelectCategory(categoryPath);
    }
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <h2 
              className={`text-xl md:text-2xl font-bold text-white ${categoryPath ? 'cursor-pointer hover:text-brand-red transition-colors' : ''}`}
              onClick={handleTitleClick}
            >
              {title}
            </h2>
            <button
              onClick={() => onPlayRemix(allCategoryVideos)}
              disabled={allCategoryVideos.length === 0}
              className="text-gray-400 hover:text-brand-red transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
              title={`Remix ${title}`}
            >
              <ShuffleIcon className="w-5 h-5" />
            </button>
        </div>
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
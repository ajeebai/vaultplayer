
import React from 'react';
import { VideoTile } from './VideoTile';
import { VideoFile } from '../services/db';

interface VideoGridProps {
  media: VideoFile[];
  onSelectVideo: (video: VideoFile) => void;
  onToggleFavorite: (fullPath: string) => void;
  onToggleHidden: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  onUnsupportedMedia: (media: VideoFile) => void;
  onPrioritizeMedia: (media: VideoFile) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ media, onSelectVideo, onToggleFavorite, onToggleHidden, onUpdateTags, onUnsupportedMedia, onPrioritizeMedia }) => {
  if (media.length === 0) {
    return <div className="text-center text-gray-400">No media to display in this view.</div>;
  }
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
      {media.map(videoFile => (
        <div key={videoFile.fullPath}>
           <VideoTile 
            video={videoFile} 
            onSelectVideo={onSelectVideo} 
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
            isGrid={true}
          />
        </div>
      ))}
    </div>
  );
};
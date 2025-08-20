
import React, { useState, useEffect, useRef } from 'react';
import { VideoFile } from '../services/db';
import { formatDuration } from '../utils/formatters';

const PlusIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>);
const CheckIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>);
const TagIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M18.25 2.25H9.5a.75.75 0 000 1.5h8.75a.75.75 0 000-1.5zM18.25 8.75H9.5a.75.75 0 000 1.5h8.75a.75.75 0 000-1.5zM18.25 15.25H9.5a.75.75 0 000 1.5h8.75a.75.75 0 000-1.5z"></path><path fillRule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 0L1.22 3.72a.75.75 0 000 1.06l4 4a.75.75 0 001.06 0l1.25-1.25V2.47L3.53 2.47zm3.22 5.28L2.78 3.78l-.22.22v4.44l4.44-.22 1.25-1.25-4-4z" clipRule="evenodd"></path></svg>);
const UnsupportedIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M21.25 2.75H2.75a1 1 0 00-1 1v16.5a1 1 0 001 1h18.5a1 1 0 001-1V3.75a1 1 0 00-1-1zM19.75 19.25H4.25V4.75h15.5v14.5z"/><path d="M7.75 6.75h2.5v2.5h-2.5zm5 0h2.5v2.5h-2.5zm-5 5h2.5v2.5h-2.5zm5 0h2.5v2.5h-2.5z"/><path fillRule="evenodd" d="M4.22 2.72a.75.75 0 011.06 0L21.22 18.66a.75.75 0 11-1.06 1.06L2.72 4.28a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>);
const EyeSlashIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 001.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z" /><path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A5.25 5.25 0 0115.75 12zM12.53 15.713l-4.244-4.244a5.25 5.25 0 006.71 6.71l-1.43-1.43c-.428.1-.88.152-1.336.152a3 3 0 01-3-3c0-.456.052-.908.152-1.336l-1.43-1.43z" /><path d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c1.441 0 2.845.313 4.142.87l-1.518 1.518A11.222 11.222 0 0012.001 6C7.527 6 3.73 8.79 2.44 12.882a1.75 1.75 0 000 1.238c.192.58.427 1.13.702 1.654l-1.518 1.518A11.454 11.454 0 011.323 12.553z" /></svg>);

interface VideoTileProps {
  video: VideoFile;
  onSelectVideo: (video: VideoFile) => void;
  onToggleFavorite: (fullPath: string) => void;
  onToggleHidden: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  onUnsupportedMedia: (media: VideoFile) => void;
  onPrioritizeMedia: (media: VideoFile) => void;
  isGrid?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({ video, onSelectVideo, onToggleFavorite, onToggleHidden, onUpdateTags, onUnsupportedMedia, onPrioritizeMedia, isGrid = false }) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState(video.tags?.join(', ') || '');
  
  const tileRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const isPlayable = video.isPlayable !== false;

  useEffect(() => {
    let url: string | null = null;
    // When the video prop changes, reset the loaded state
    setIsImageLoaded(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (video.poster) {
            url = URL.createObjectURL(video.poster);
            setPosterUrl(url);
          }
          if (video.isPlayable === undefined) {
            onPrioritizeMedia(video);
          }
          if (tileRef.current) {
            observer.unobserve(tileRef.current);
          }
        }
      },
      { rootMargin: '200px' }
    );

    if (tileRef.current) {
      observer.observe(tileRef.current);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
      if (tileRef.current) observer.unobserve(tileRef.current);
    };
  }, [video, onPrioritizeMedia]);
  
  const progressPercent = video.duration && video.playbackPosition ? (video.playbackPosition / video.duration) * 100 : 0;

  useEffect(() => {
    if (isEditingTags && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isEditingTags]);

  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newTags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    onUpdateTags(video.fullPath, newTags);
    setIsEditingTags(false);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(video.fullPath);
  };

  const handleHideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleHidden(video.fullPath);
  };

  const handleTagIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTags(true);
  };
  
  const handleTileClick = () => {
    if (!isPlayable) {
      onUnsupportedMedia(video);
      return;
    }
    onSelectVideo(video);
  }

  const tileClassName = `flex-shrink-0 ${isGrid ? 'w-full aspect-video' : 'w-36 sm:w-48 md:w-64 aspect-[2/3] md:aspect-video'} bg-brand-gray rounded-lg overflow-hidden cursor-pointer group relative shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-brand-red-glow ${video.isHidden ? 'opacity-60 hover:opacity-100' : ''}`;

  return (
    <div
      ref={tileRef}
      className={tileClassName}
      onClick={handleTileClick}
    >
      <div className="absolute inset-0 bg-brand-gray">
        {/* Skeleton loader is always visible until the image is loaded and faded in */}
        {isPlayable && (
          <div className={`w-full h-full bg-brand-light-gray transition-opacity duration-500 ${isImageLoaded ? 'opacity-0' : 'animate-pulse opacity-100'}`} />
        )}
        
        {posterUrl && isPlayable && (
          <img 
            src={posterUrl} 
            alt={video.name} 
            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 group-hover:scale-110 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setIsImageLoaded(true)}
          />
        )}
        
        {!isPlayable && (
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-gray-300 p-2 text-center text-sm break-words">
              <UnsupportedIcon className="w-8 h-8 mb-2 text-gray-400" />
              <span className="break-all">{video.name.replace(/\.[^/.]+$/, "")}</span>
              <span className="text-xs text-gray-500 mt-1">Unsupported Format</span>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* --- On-hover controls --- */}
      <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button onClick={handleHideClick} title={video.isHidden ? "Unhide" : "Hide"} className="bg-black/60 rounded-full p-2 text-white hover:bg-white hover:text-black transition-colors"><EyeSlashIcon className="w-4 h-4" /></button>
        <button onClick={handleTagIconClick} title="Edit Tags" className="bg-black/60 rounded-full p-2 text-white hover:bg-white hover:text-black transition-colors"><TagIcon className="w-4 h-4" /></button>
        <button onClick={handleFavoriteClick} title="Add to Favorites" className="bg-black/60 rounded-full p-2 text-white hover:bg-white hover:text-black transition-colors">
          {video.isFavorite ? <CheckIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
        </button>
      </div>
      
      {video.duration && isPlayable && (
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatDuration(video.duration)}
        </span>
      )}
      
      <div className="absolute bottom-2 left-2 right-2 text-white drop-shadow-md pr-20">
        <p className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity truncate">
          {video.name.replace(/\.[^/.]+$/, "")}
        </p>
         {video.tags && video.tags.length > 0 && (
          <p className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity truncate">
            {video.tags.join(', ')}
          </p>
        )}
      </div>

      {progressPercent > 0 && progressPercent < 95 && isPlayable && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-500/50">
          <div className="h-full bg-brand-red" style={{width: `${progressPercent}%`}}></div>
        </div>
      )}
      
      {/* --- Tag editing overlay --- */}
      {isEditingTags && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
          <form onSubmit={handleTagSubmit} className="w-full">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={() => setIsEditingTags(false)}
              placeholder="Tags (comma-separated)"
              className="w-full bg-brand-light-gray text-white text-sm p-2 rounded border border-brand-gray focus:ring-brand-red focus:border-brand-red"
            />
          </form>
        </div>
      )}
    </div>
  );
};

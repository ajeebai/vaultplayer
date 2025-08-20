
import React, { useState, useEffect, useRef } from 'react';
import { VideoFile } from '../services/db';
import { formatDuration } from '../utils/formatters';
import { getFileWithPermission } from '../utils/fileSystem';

const PlusIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>);
const CheckIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>);
const TagIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M18.25 2.25H9.5a.75.75 0 000 1.5h8.75a.75.75 0 000-1.5zM18.25 8.75H9.5a.75.75 0 000 1.5h8.75a.75.75 0 000-1.5zM18.25 15.25H9.5a.75.75 0 000 1.5h8.75a.75.75 0 000-1.5z"></path><path fillRule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 0L1.22 3.72a.75.75 0 000 1.06l4 4a.75.75 0 001.06 0l1.25-1.25V2.47L3.53 2.47zm3.22 5.28L2.78 3.78l-.22.22v4.44l4.44-.22 1.25-1.25-4-4z" clipRule="evenodd"></path></svg>);
const UnsupportedIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M21.25 2.75H2.75a1 1 0 00-1 1v16.5a1 1 0 001 1h18.5a1 1 0 001-1V3.75a1 1 0 00-1-1zM19.75 19.25H4.25V4.75h15.5v14.5z"/><path d="M7.75 6.75h2.5v2.5h-2.5zm5 0h2.5v2.5h-2.5zm-5 5h2.5v2.5h-2.5zm5 0h2.5v2.5h-2.5z"/><path fillRule="evenodd" d="M4.22 2.72a.75.75 0 011.06 0L21.22 18.66a.75.75 0 11-1.06 1.06L2.72 4.28a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>);

interface VideoTileProps {
  video: VideoFile;
  onSelectVideo: (video: VideoFile) => void;
  onToggleFavorite: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  onUnsupportedMedia: (media: VideoFile) => void;
  onPrioritizeMedia: (media: VideoFile) => void;
  isGrid?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({ video, onSelectVideo, onToggleFavorite, onUpdateTags, onUnsupportedMedia, onPrioritizeMedia, isGrid = false }) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState(video.tags?.join(', ') || '');
  const [isHovering, setIsHovering] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  
  const tileRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const isPlayable = video.isPlayable !== false; // Default to true if undefined

  useEffect(() => {
    let url: string | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (video.poster && !posterUrl) {
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
  }, [video, onPrioritizeMedia, posterUrl, setPosterUrl]);
  
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

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(async () => {
      if (isPlayable && !videoPreviewUrl) {
        try {
          const file = await getFileWithPermission(video.fileHandle);
          const url = URL.createObjectURL(file);
          setVideoPreviewUrl(url);
        } catch (e) { console.warn("Could not load preview", e); }
      }
      setIsHovering(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovering(false);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
  };

  const tileClassName = `flex-shrink-0 ${isGrid ? 'w-full aspect-video' : 'w-36 sm:w-48 md:w-64 aspect-[2/3] md:aspect-video'} bg-brand-gray rounded-lg overflow-hidden cursor-pointer group relative shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-brand-red-glow`;

  return (
    <div
      ref={tileRef}
      className={tileClassName}
      onClick={handleTileClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
        <div className="absolute inset-0 transition-opacity duration-500">
            {isPlayable && videoPreviewUrl && isHovering ? (
                <video
                  src={videoPreviewUrl}
                  autoPlay
                  muted
                  loop
                  className="w-full h-full object-cover"
                />
            ) : posterUrl && isPlayable ? (
                <img src={posterUrl} alt={video.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 p-2 text-center text-sm break-words bg-brand-light-gray">
                    {!isPlayable && <UnsupportedIcon className="w-8 h-8 mb-2 text-gray-400" />}
                    <span>{video.poster && isPlayable ? 'Loading...' : video.name.replace(/\.[^/.]+$/, "")}</span>
                    {!isPlayable && <span className="text-xs text-gray-500 mt-1">Unsupported Format</span>}
                </div>
            )}
        </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* --- On-hover controls --- */}
      <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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

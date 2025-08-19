import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MediaFile } from '../services/db';
import { getFileWithPermission } from '../utils/fileSystem';

const CloseIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronLeftIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path></svg>);
const ChevronRightIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path></svg>);

interface ImageViewerProps {
  image: MediaFile;
  playlist: MediaFile[];
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ image: initialImage, playlist, onClose }) => {
  const [currentImage, setCurrentImage] = useState(initialImage);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  
  const controlsTimeoutRef = useRef<number | null>(null);

  const currentIndex = useMemo(() => {
    return playlist.findIndex(item => item.fullPath === currentImage.fullPath);
  }, [playlist, currentImage]);
  
  const hasNext = currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  const showControls = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => setIsControlsVisible(false), 3000);
  }, []);

  const handleNext = useCallback(() => {
    if (hasNext) {
      setCurrentImage(playlist[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, playlist]);

  const handlePrevious = useCallback(() => {
    if (hasPrevious) {
      setCurrentImage(playlist[currentIndex - 1]);
    }
  }, [hasPrevious, currentIndex, playlist]);
  
  useEffect(() => {
    showControls();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, onClose, showControls]);
  
  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;
    
    const loadImage = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      try {
        const file = await getFileWithPermission(currentImage.fileHandle);
        objectUrl = URL.createObjectURL(file);
        if (isMounted) {
          setImageUrl(objectUrl);
        }
      } catch (e) {
        console.error("Failed to load image", e);
        if (isMounted) setImageUrl(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentImage]);
  
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onMouseMove={showControls}
      onClick={onClose}
    >
      <div className="absolute inset-0 flex items-center justify-center p-8">
        {isLoading && <div className="text-white text-lg animate-pulse">Loading...</div>}
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={currentImage.name}
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>

      {/* Controls */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent flex justify-between items-center pointer-events-auto">
          <h2 className="text-white text-lg font-bold truncate">{currentImage.name.replace(/\.[^/.]+$/, "")}</h2>
          <button onClick={onClose} className="text-white flex-shrink-0">
            <CloseIcon className="w-8 h-8"/>
          </button>
        </div>

        {/* Previous Button */}
        {hasPrevious && (
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2 hover:bg-black/60 transition-colors pointer-events-auto"
          >
            <ChevronLeftIcon className="w-10 h-10" />
          </button>
        )}

        {/* Next Button */}
        {hasNext && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2 hover:bg-black/60 transition-colors pointer-events-auto"
          >
            <ChevronRightIcon className="w-10 h-10" />
          </button>
        )}
      </div>
    </div>
  );
};
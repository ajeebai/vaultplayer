import React, { useMemo } from 'react';
import { Hero } from './Hero';
import { Rail } from './Rail';
import { VideoGrid } from './VideoGrid';
import { Breadcrumbs } from './Breadcrumbs';
import { VideoFile } from '../services/db';
import { CategoryNode } from '../types';
import { findNodeByPath, getAllMediaFromNode } from '../utils/category';

interface LibraryProps {
  media: VideoFile[];
  categoryTree: CategoryNode[];
  onSelectVideo: (video: VideoFile) => void;
  isLoading: boolean;
  progress: number;
  progressMessage: string;
  searchQuery: string;
  onToggleFavorite: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  selectedCategoryPath: string | null;
  onSelectCategory: (path: string | null) => void;
  selectedTag: string | null;
  onUnsupportedMedia: (media: VideoFile) => void;
  onGoHome: () => void;
  hasLibraries: boolean;
  isFavoritesView: boolean;
  onPrioritizeMedia: (media: VideoFile) => void;
  showUnsupported: boolean;
  onClearContinueWatching?: () => void;
}

const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const chunkArray = <T,>(array: T[], numChunks: number): T[][] => {
    if (numChunks <= 1) return [array];
    const result: T[][] = [];
    const baseChunkSize = Math.floor(array.length / numChunks);
    const remainder = array.length % numChunks;
    let startIndex = 0;

    for (let i = 0; i < numChunks; i++) {
        const chunkSize = baseChunkSize + (i < remainder ? 1 : 0);
        result.push(array.slice(startIndex, startIndex + chunkSize));
        startIndex += chunkSize;
    }
    return result;
};


export const Library: React.FC<LibraryProps> = ({ 
  media, 
  categoryTree,
  onSelectVideo, 
  isLoading, 
  progress, 
  progressMessage, 
  searchQuery,
  isFavoritesView,
  onToggleFavorite,
  onUpdateTags,
  selectedCategoryPath,
  onSelectCategory,
  selectedTag,
  onUnsupportedMedia,
  onGoHome,
  hasLibraries,
  onPrioritizeMedia,
  showUnsupported,
  onClearContinueWatching,
}) => {

  const displayedMedia = useMemo(() => {
    return showUnsupported ? media : media.filter(v => v.isPlayable !== false);
  }, [media, showUnsupported]);

  const searchFilteredMedia = useMemo(() => {
    if (!searchQuery) return displayedMedia;
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    return displayedMedia.filter(mediaFile =>
      mediaFile.name.toLowerCase().includes(lowerCaseQuery) ||
      mediaFile.parentPath.toLowerCase().includes(lowerCaseQuery) ||
      (mediaFile.tags && mediaFile.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery)))
    );
  }, [displayedMedia, searchQuery]);
  
  const currentCategoryNode = useMemo(() => {
    if (!selectedCategoryPath) return null;
    return findNodeByPath(categoryTree, selectedCategoryPath);
  }, [categoryTree, selectedCategoryPath]);
  
  const heroMedia = useMemo(() => {
    if (displayedMedia.length === 0 || selectedCategoryPath || selectedTag) return null;
    const favorites = displayedMedia.filter(v => v.isFavorite && v.poster);
    const source = favorites.length > 0 ? favorites : displayedMedia.filter(v => v.poster);
    if (source.length > 0) return source[Math.floor(Math.random() * source.length)];
    return displayedMedia.length > 0 ? displayedMedia[Math.floor(Math.random() * displayedMedia.length)] : null;
  }, [displayedMedia, selectedCategoryPath, selectedTag]);

  const getShuffledMediaForNode = (node: CategoryNode): VideoFile[] => {
    const allNodeMedia = getAllMediaFromNode(node);
    const filteredNodeMedia = showUnsupported ? allNodeMedia : allNodeMedia.filter(v => v.isPlayable !== false);
    return shuffle(filteredNodeMedia);
  };

  // Show full-screen loader only on initial scan before any media are listed
  if (isLoading && media.length === 0 && hasLibraries) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="w-1/2 max-w-md">
          <p className="text-center text-lg mb-2">{progressMessage}</p>
          <div className="w-full bg-brand-light-gray rounded-full h-2.5">
            <div className="bg-brand-red h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  const renderRailsForNodes = (nodes: CategoryNode[]) => {
    return nodes.flatMap((node) => {
      const mediaForNode = getShuffledMediaForNode(node);
      if (mediaForNode.length === 0) return [];

      const CHUNK_THRESHOLD = 7;
      if (mediaForNode.length < CHUNK_THRESHOLD) {
        return [<Rail
          key={node.path}
          title={node.name}
          categoryPath={node.path}
          videos={mediaForNode}
          onSelectVideo={onSelectVideo}
          onToggleFavorite={onToggleFavorite}
          onUpdateTags={onUpdateTags}
          onSelectCategory={onSelectCategory}
          onUnsupportedMedia={onUnsupportedMedia}
          onPrioritizeMedia={onPrioritizeMedia}
        />];
      }
      
      const numChunks = mediaForNode.length < (CHUNK_THRESHOLD * 2) ? 2 : 3;
      const mediaChunks = chunkArray(mediaForNode, numChunks);

      return mediaChunks.map((chunk, index) => {
          const title = numChunks > 1 ? `${node.name} (${index + 1}/${numChunks})` : node.name;
          return (
              <Rail
                  key={`${node.path}-${index}`}
                  title={title}
                  categoryPath={node.path}
                  videos={chunk}
                  onSelectVideo={onSelectVideo}
                  onToggleFavorite={onToggleFavorite}
                  onUpdateTags={onUpdateTags}
                  onSelectCategory={onSelectCategory}
                  onUnsupportedMedia={onUnsupportedMedia}
                  onPrioritizeMedia={onPrioritizeMedia}
              />
          );
      });
    });
  }

  const renderHomeRails = () => {
    const favorites = displayedMedia.filter(v => v.isFavorite);
    const continueWatching = displayedMedia
      .filter(v => v.playbackPosition && v.duration && (v.playbackPosition / v.duration) < 0.95)
      .sort((a, b) => (b.lastWatched?.getTime() || 0) - (a.lastWatched?.getTime() || 0))
      .slice(0, 20);

    return (
      <div className="space-y-8">
        {continueWatching.length > 0 && (
          <Rail
            title="Continue Watching"
            videos={continueWatching}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
            onClear={onClearContinueWatching}
          />
        )}
        {favorites.length > 0 && !isFavoritesView && !selectedCategoryPath && !searchQuery && !selectedTag &&(
          <Rail
            title="Favorites"
            videos={favorites}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
          />
        )}
        {renderRailsForNodes(categoryTree)}
      </div>
    );
  };
  
  const renderContent = () => {
    if (searchQuery) {
      return <VideoGrid media={searchFilteredMedia} onSelectVideo={onSelectVideo} onToggleFavorite={onToggleFavorite} onUpdateTags={onUpdateTags} onUnsupportedMedia={onUnsupportedMedia} onPrioritizeMedia={onPrioritizeMedia} />;
    }
    if (isFavoritesView) {
      return <VideoGrid media={displayedMedia.filter(v => v.isFavorite)} onSelectVideo={onSelectVideo} onToggleFavorite={onToggleFavorite} onUpdateTags={onUpdateTags} onUnsupportedMedia={onUnsupportedMedia} onPrioritizeMedia={onPrioritizeMedia} />;
    }
    if (selectedTag) {
      return <VideoGrid media={displayedMedia.filter(v => v.tags?.includes(selectedTag))} onSelectVideo={onSelectVideo} onToggleFavorite={onToggleFavorite} onUpdateTags={onUpdateTags} onUnsupportedMedia={onUnsupportedMedia} onPrioritizeMedia={onPrioritizeMedia} />;
    }
    if (currentCategoryNode) {
      const filesInFolder = showUnsupported 
        ? currentCategoryNode.media
        : currentCategoryNode.media.filter(v => v.isPlayable !== false);

      return (
        <>
          <Breadcrumbs path={selectedCategoryPath || ''} onSelectCategory={onSelectCategory} onGoHome={onGoHome} />
          <div className="space-y-8 mt-4">
            {filesInFolder.length > 0 && (
              <Rail
                title={`Files in ${currentCategoryNode.name}`}
                videos={filesInFolder}
                onSelectVideo={onSelectVideo}
                onToggleFavorite={onToggleFavorite}
                onUpdateTags={onUpdateTags}
                onSelectCategory={onSelectCategory}
                onUnsupportedMedia={onUnsupportedMedia}
                onPrioritizeMedia={onPrioritizeMedia}
              />
            )}
            {renderRailsForNodes(currentCategoryNode.children)}
          </div>
        </>
      );
    }
    
    // Default home view with Hero and Rails
    return (
      <>
        {heroMedia && <Hero video={heroMedia} onPlay={() => onSelectVideo(heroMedia)} />}
        <div className="p-4 md:p-8">
          {renderHomeRails()}
        </div>
      </>
    );
  }

  return (
    <div>
      {/* Sticky Progress Bar for background processing */}
      {isLoading && media.length > 0 && (
          <div className="sticky top-[77px] z-30 -mt-[77px] pt-[77px] bg-brand-black/80 backdrop-blur-sm">
              <div className="w-full p-2 text-center">
                  <p className="text-sm mb-1">{progressMessage}</p>
                  <div className="w-full max-w-lg mx-auto bg-brand-light-gray rounded-full h-1.5">
                      <div className="bg-brand-red h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
              </div>
          </div>
      )}
      <div className={`p-4 md:p-8 ${heroMedia || selectedCategoryPath ? '' : 'pt-8'}`}>
        {renderContent()}
      </div>
    </div>
  );
};
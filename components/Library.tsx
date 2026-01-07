
import React, { useMemo } from 'react';
import { Hero } from './Hero';
import { Rail } from './Rail';
import { VideoGrid } from './VideoGrid';
import { Breadcrumbs } from './Breadcrumbs';
import { VideoFile } from '../services/db';
import { CategoryNode } from '../types';
import { findNodeByPath, getAllMediaFromNode } from '../utils/category';

const ShuffleIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>);

interface LibraryProps {
  media: VideoFile[];
  categoryTree: CategoryNode[];
  onSelectVideo: (video: VideoFile) => void;
  isLoading: boolean;
  progress: number;
  progressMessage: string;
  searchQuery: string;
  onToggleFavorite: (fullPath: string) => void;
  onToggleHidden: (fullPath: string) => void;
  onUpdateTags: (fullPath: string, tags: string[]) => void;
  selectedCategoryPath: string | null;
  onSelectCategory: (path: string | null) => void;
  selectedTag: string | null;
  onUnsupportedMedia: (media: VideoFile) => void;
  onGoHome: () => void;
  hasLibraries: boolean;
  isFavoritesView: boolean;
  onPrioritizeMedia: (media: VideoFile) => void;
  showHidden: boolean;
  sortOrder: string;
  onClearContinueWatching?: () => void;
  onPlayRemix: (videos: VideoFile[]) => void;
}

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
  onToggleHidden,
  onUpdateTags,
  selectedCategoryPath,
  onSelectCategory,
  selectedTag,
  onUnsupportedMedia,
  onGoHome,
  hasLibraries,
  onPrioritizeMedia,
  showHidden,
  sortOrder,
  onClearContinueWatching,
  onPlayRemix,
}) => {
  const sortedMedia = useMemo(() => {
    const sorted = [...media];
    switch (sortOrder) {
        case 'date-desc':
            sorted.sort((a, b) => (b.dateAdded || 0) - (b.dateAdded || 0));
            break;
        case 'date-asc':
            sorted.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
            break;
        case 'name-asc':
        default:
            sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            break;
    }
    return sorted;
  }, [media, sortOrder]);

  const displayedMedia = useMemo(() => {
    if (showHidden) {
      return sortedMedia;
    }
    return sortedMedia.filter(v => !v.isHidden && v.isPlayable !== false);
  }, [sortedMedia, showHidden]);

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
  
  const showHero = !searchQuery && !selectedCategoryPath && !selectedTag && !isFavoritesView;

  const heroMedia = useMemo(() => {
    if (!showHero || displayedMedia.length === 0) return null;

    const withPosters = displayedMedia.filter(v => v.poster && v.isPlayable !== false);
    if (withPosters.length > 0) {
        return withPosters[Math.floor(Math.random() * withPosters.length)];
    }
    const playable = displayedMedia.filter(v => v.isPlayable !== false);
    return playable.length > 0 ? playable[Math.floor(Math.random() * playable.length)] : null;
  }, [displayedMedia, showHero]);

  const getMediaForNode = (node: CategoryNode): VideoFile[] => {
    const allNodeMedia = getAllMediaFromNode(node);
    return displayedMedia.filter(m => allNodeMedia.some(nm => nm.fullPath === m.fullPath));
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

  const renderCategorySections = (nodes: CategoryNode[], forceRail: boolean = false) => {
    return nodes.flatMap((node) => {
      const mediaForNode = getMediaForNode(node);
      const allNodeMedia = getAllMediaFromNode(node);
      if (mediaForNode.length === 0) return [];

      // If a category has no sub-folders and we are NOT forcing a rail, display its contents in a grid.
      if (!forceRail && node.children.length === 0) {
        return [(
          <section key={node.path} className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 
                className="text-xl md:text-2xl font-bold text-white cursor-pointer hover:text-brand-red transition-colors"
                onClick={() => onSelectCategory(node.path)}
              >
                {node.name}
              </h2>
              <button
                onClick={() => onPlayRemix(allNodeMedia)}
                disabled={allNodeMedia.length === 0}
                className="text-gray-400 hover:text-brand-red transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                title={`Remix ${node.name}`}
              >
                <ShuffleIcon className="w-5 h-5" />
              </button>
            </div>
            <VideoGrid 
              media={mediaForNode}
              onSelectVideo={onSelectVideo}
              onToggleFavorite={onToggleFavorite}
              onToggleHidden={onToggleHidden}
              onUpdateTags={onUpdateTags}
              onUnsupportedMedia={onUnsupportedMedia}
              onPrioritizeMedia={onPrioritizeMedia}
            />
          </section>
        )];
      }

      // Otherwise (it's a branch OR we are forcing a rail), display its content as a single rail.
      const videosToShow = mediaForNode.slice(0, 15);
      
      return [<Rail
        key={node.path}
        title={node.name}
        categoryPath={node.path}
        videos={videosToShow}
        onSelectVideo={onSelectVideo}
        onToggleFavorite={onToggleFavorite}
        onToggleHidden={onToggleHidden}
        onUpdateTags={onUpdateTags}
        onSelectCategory={onSelectCategory}
        onUnsupportedMedia={onUnsupportedMedia}
        onPrioritizeMedia={onPrioritizeMedia}
        allCategoryVideos={allNodeMedia}
        onPlayRemix={onPlayRemix}
      />];
    });
  }

  const renderHomeRails = () => {
    const allFavorites = displayedMedia.filter(v => v.isFavorite);
    const favoritesForDisplay = allFavorites.slice(0, 20);

    const allContinueWatching = displayedMedia
      .filter(v => v.playbackPosition && v.duration && (v.playbackPosition / v.duration) < 0.95)
      .sort((a, b) => (b.lastWatched?.getTime() || 0) - (a.lastWatched?.getTime() || 0));
    const continueWatchingForDisplay = allContinueWatching.slice(0, 20);
      
    const allRootFiles = displayedMedia.filter(v => v.parentPath === '');
    const rootFilesForDisplay = allRootFiles.slice(0, 20);

    return (
      <div className="space-y-12">
        {allContinueWatching.length > 0 && (
          <Rail
            title="Continue Watching"
            videos={continueWatchingForDisplay}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
            onClear={onClearContinueWatching}
            allCategoryVideos={allContinueWatching}
            onPlayRemix={onPlayRemix}
          />
        )}
        {allFavorites.length > 0 && (
          <Rail
            title="Favorites"
            videos={favoritesForDisplay}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
            allCategoryVideos={allFavorites}
            onPlayRemix={onPlayRemix}
          />
        )}
        {allRootFiles.length > 0 && (
          <Rail
            title="Files"
            videos={rootFilesForDisplay}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
            allCategoryVideos={allRootFiles}
            onPlayRemix={onPlayRemix}
          />
        )}
        {renderCategorySections(categoryTree, true)}
      </div>
    );
  };
  
  const renderContent = () => {
    if (searchQuery) {
      return <VideoGrid media={searchFilteredMedia} onSelectVideo={onSelectVideo} onToggleFavorite={onToggleFavorite} onToggleHidden={onToggleHidden} onUpdateTags={onUpdateTags} onUnsupportedMedia={onUnsupportedMedia} onPrioritizeMedia={onPrioritizeMedia} />;
    }
    if (isFavoritesView) {
      return <VideoGrid media={displayedMedia.filter(v => v.isFavorite)} onSelectVideo={onSelectVideo} onToggleFavorite={onToggleFavorite} onToggleHidden={onToggleHidden} onUpdateTags={onUpdateTags} onUnsupportedMedia={onUnsupportedMedia} onPrioritizeMedia={onPrioritizeMedia} />;
    }
    if (selectedTag) {
      return <VideoGrid media={displayedMedia.filter(v => v.tags?.includes(selectedTag))} onSelectVideo={onSelectVideo} onToggleFavorite={onToggleFavorite} onToggleHidden={onToggleHidden} onUpdateTags={onUpdateTags} onUnsupportedMedia={onUnsupportedMedia} onPrioritizeMedia={onPrioritizeMedia} />;
    }
    
    if (currentCategoryNode) {
      const mediaForNode = getMediaForNode(currentCategoryNode);
      const allMediaForNode = getAllMediaFromNode(currentCategoryNode);
      // If the currently selected category is a LEAF node, display a single grid of its content.
      if (currentCategoryNode.children.length === 0) {
        return (
          <>
            <Breadcrumbs path={selectedCategoryPath || ''} onSelectCategory={onSelectCategory} onGoHome={onGoHome} />
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold text-white">{currentCategoryNode.name}</h2>
                <button
                  onClick={() => onPlayRemix(allMediaForNode)}
                  disabled={allMediaForNode.length === 0}
                  className="text-gray-400 hover:text-brand-red transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                  title={`Remix ${currentCategoryNode.name}`}
                >
                  <ShuffleIcon className="w-5 h-5" />
                </button>
              </div>
              <VideoGrid
                media={mediaForNode}
                onSelectVideo={onSelectVideo}
                onToggleFavorite={onToggleFavorite}
                onToggleHidden={onToggleHidden}
                onUpdateTags={onUpdateTags}
                onUnsupportedMedia={onUnsupportedMedia}
                onPrioritizeMedia={onPrioritizeMedia}
              />
            </div>
          </>
        );
      }

      // If the currently selected category is a BRANCH node:
      const filesInFolder = displayedMedia.filter(v => v.parentPath === currentCategoryNode.path);

      return (
        <>
          <Breadcrumbs path={selectedCategoryPath || ''} onSelectCategory={onSelectCategory} onGoHome={onGoHome} />
          <div className="space-y-12 mt-4">
            {/* 1. Show a rail for files directly inside this branch */}
            {filesInFolder.length > 0 && (
                <Rail
                    title={`Files in ${currentCategoryNode.name}`}
                    videos={filesInFolder}
                    onSelectVideo={onSelectVideo}
                    onToggleFavorite={onToggleFavorite}
                    onToggleHidden={onToggleHidden}
                    onUpdateTags={onUpdateTags}
                    onUnsupportedMedia={onUnsupportedMedia}
                    onPrioritizeMedia={onPrioritizeMedia}
                    onSelectCategory={() => {}} // This rail's title is not for navigation
                    categoryPath={undefined}
                    allCategoryVideos={filesInFolder}
                    onPlayRemix={onPlayRemix}
                />
            )}
            {/* 2. Render its children, allowing leaf children to become grids */}
            {renderCategorySections(currentCategoryNode.children, false)}
          </div>
        </>
      );
    }
    
    // Default home view
    return renderHomeRails();
  }

  return (
    <div>
      {heroMedia && <Hero video={heroMedia} onPlay={() => onSelectVideo(heroMedia)} />}
      <div className={`p-4 md:p-8 ${!heroMedia ? 'pt-8' : ''}`}>
        {renderContent()}
      </div>
    </div>
  );
};
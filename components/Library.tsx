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
  onClearContinueWatching?: () => void;
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
  onClearContinueWatching,
}) => {

  const displayedMedia = useMemo(() => {
    // Unplayable media is handled at the VideoTile level, which shows an 'unsupported' state.
    // Here we only apply the user's visibility settings for hidden files.
    return showHidden ? media : media.filter(v => !v.isHidden);
  }, [media, showHidden]);

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
    if (displayedMedia.length === 0) return null;

    let sourcePool: VideoFile[] = displayedMedia; // Default to all displayed media

    if (currentCategoryNode) {
        const nodeMediaPaths = new Set(getAllMediaFromNode(currentCategoryNode).map(m => m.fullPath));
        sourcePool = displayedMedia.filter(m => nodeMediaPaths.has(m.fullPath));
    } else if (isFavoritesView) {
        sourcePool = displayedMedia.filter(v => v.isFavorite);
    } else if (selectedTag) {
        sourcePool = displayedMedia.filter(v => v.tags?.includes(selectedTag));
    } else if (searchQuery) {
        sourcePool = searchFilteredMedia;
    }

    const withPosters = sourcePool.filter(v => v.poster && v.isPlayable !== false);
    const selectionPool = withPosters.length > 0 ? withPosters : sourcePool.filter(v => v.isPlayable !== false);

    if (selectionPool.length > 0) {
        return selectionPool[Math.floor(Math.random() * selectionPool.length)];
    }
    
    // Final fallback to any displayed media if current view is empty for some reason
    return displayedMedia.length > 0 ? displayedMedia[Math.floor(Math.random() * displayedMedia.length)] : null;
  }, [displayedMedia, currentCategoryNode, selectedTag, isFavoritesView, searchQuery, searchFilteredMedia]);

  const getMediaForNode = (node: CategoryNode): VideoFile[] => {
    const allNodeMedia = getAllMediaFromNode(node);
    // The order is preserved from the main media array, which is stable.
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
      if (mediaForNode.length === 0) return [];

      // If a category has no sub-folders and we are NOT forcing a rail, display its contents in a grid.
      if (!forceRail && node.children.length === 0) {
        return [(
          <section key={node.path} className="space-y-4">
            <h2 
              className="text-xl md:text-2xl font-bold text-white cursor-pointer hover:text-brand-red transition-colors"
              onClick={() => onSelectCategory(node.path)}
            >
              {node.name}
            </h2>
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
      />];
    });
  }

  const renderHomeRails = () => {
    const favorites = displayedMedia.filter(v => v.isFavorite);
    const continueWatching = displayedMedia
      .filter(v => v.playbackPosition && v.duration && (v.playbackPosition / v.duration) < 0.95)
      .sort((a, b) => (b.lastWatched?.getTime() || 0) - (a.lastWatched?.getTime() || 0))
      .slice(0, 20);
    const rootFiles = displayedMedia.filter(v => v.parentPath === '');

    return (
      <div className="space-y-12">
        {continueWatching.length > 0 && (
          <Rail
            title="Continue Watching"
            videos={continueWatching}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
            onClear={onClearContinueWatching}
          />
        )}
        {favorites.length > 0 && (
          <Rail
            title="Favorites"
            videos={favorites}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
          />
        )}
        {rootFiles.length > 0 && (
          <Rail
            title="Files"
            videos={rootFiles}
            onSelectVideo={onSelectVideo}
            onToggleFavorite={onToggleFavorite}
            onToggleHidden={onToggleHidden}
            onUpdateTags={onUpdateTags}
            onSelectCategory={onSelectCategory}
            onUnsupportedMedia={onUnsupportedMedia}
            onPrioritizeMedia={onPrioritizeMedia}
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
      // If the currently selected category is a LEAF node, display a single grid of its content.
      if (currentCategoryNode.children.length === 0) {
        return (
          <>
            <Breadcrumbs path={selectedCategoryPath || ''} onSelectCategory={onSelectCategory} onGoHome={onGoHome} />
            <div className="mt-4">
              <VideoGrid
                media={getMediaForNode(currentCategoryNode)}
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
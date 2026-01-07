
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { FileDropZone } from './components/FileDropZone';
import { VideoFile, MediaDB } from './services/db';
import { useVideoScanner } from './hooks/useVideoScanner';
import { Header } from './components/Header';
import { AppState, View, CategoryNode, LibraryInfo } from './types';
import { buildCategoryTree } from './utils/category';
import { verifyPermission } from './utils/fileSystem';
import { Footer } from './components/Footer';

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 14.25A8.99 8.99 0 0012 21a8.99 8.99 0 008-6.75M20 9.75A8.99 8.99 0 0012 3a8.99 8.99 0 00-8 6.75" /></svg>);

const ManageLibrariesModal: React.FC<{ 
  libraries: LibraryInfo[], 
  activeLibraryId: string | null, 
  onSwitch: (id: string) => void, 
  onDelete: (id: string) => void, 
  onRename: (id: string, newName: string) => void,
  onRefresh: (id: string) => void,
  onClose: () => void,
}> = ({ libraries, activeLibraryId, onSwitch, onDelete, onRename, onRefresh, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleRename = (library: LibraryInfo) => {
    setEditingId(library.id);
    setNewName(library.name);
  };
  
  const handleSaveRename = (id: string) => {
    if (newName.trim()) {
      onRename(id, newName.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-brand-gray rounded-lg shadow-xl p-8 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">Manage Libraries</h2>
        <p className="text-sm text-gray-400 mb-6">Vault automatically remembers your last 5 libraries. Manage your history here.</p>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {libraries.map(lib => (
            <div key={lib.id} className="flex items-center justify-between bg-brand-light-gray p-4 rounded-md">
              {editingId === lib.id ? (
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onBlur={() => handleSaveRename(lib.id)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveRename(lib.id)}
                  className="bg-brand-gray text-white p-2 rounded border border-brand-red flex-grow"
                  autoFocus
                />
              ) : (
                <span className="font-medium">{lib.name} {lib.id === activeLibraryId && <span className="text-xs text-brand-red ml-2">(Active)</span>}</span>
              )}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => onRefresh(lib.id)}
                  title="Refresh Library"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                    <RefreshIcon className="w-5 h-5" />
                </button>
                {lib.id !== activeLibraryId && (
                  <button onClick={() => onSwitch(lib.id)} className="text-gray-300 hover:text-white text-sm">Switch To</button>
                )}
                <button onClick={() => handleRename(lib)} className="text-gray-300 hover:text-white text-sm">Rename</button>
                <button onClick={() => onDelete(lib.id)} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="py-2 px-6 rounded-md bg-brand-red text-white font-bold hover:bg-red-700 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

const FolderOpenIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>);

const UnsupportedMediaModal: React.FC<{ media: VideoFile; onClose: () => void; }> = ({ media, onClose }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    const isMac = useMemo(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0, []);
    
    const folderPath = useMemo(() => {
      const lastSlash = media.fullPath.lastIndexOf('/');
      if (lastSlash === -1) return '(root folder)'; // Should not happen if path is correct
      return media.fullPath.substring(0, lastSlash);
    }, [media.fullPath]);

    const handleShowInFolder = useCallback(() => {
        if (folderPath === '(root folder)') {
            alert("Cannot determine folder path for root files.");
            return;
        }
        navigator.clipboard.writeText(folderPath).then(() => {
            setIsCopied(true);
            setShowInstructions(true);
            const timer = setTimeout(() => setIsCopied(false), 3000);
            return () => clearTimeout(timer);
        }).catch(err => {
            console.error('Failed to copy path: ', err);
            alert('Could not copy path to clipboard.');
        });
    }, [folderPath]);

    const reasonCode = media.unsupportedReason?.code;
    let reasonMessage = "This video's format or internal codec is not supported by your browser.";
    if (reasonCode === 3 || reasonCode === 4) { // MEDIA_ERR_DECODE or MEDIA_ERR_SRC_NOT_SUPPORTED
        reasonMessage = "Your browser cannot play this video because it uses an unsupported codec (e.g., H.265/HEVC). This is a common browser limitation.";
    }

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-brand-gray rounded-lg shadow-xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-2">Unsupported Video</h2>
                <p className="text-gray-400 mb-4">{reasonMessage}</p>
                 <div className="bg-brand-black p-3 rounded-md mb-6 text-sm">
                    <p className="text-gray-400 mb-1">File:</p>
                    <code className="text-white break-all font-mono">{media.name}</code>
                    <p className="text-gray-400 mt-2 mb-1">In Folder:</p>
                    <code className="text-white break-all font-mono">{folderPath}</code>
                </div>
                
                <p className="text-gray-400 mb-6">
                    While Vault can't open this file, you can open its folder on your computer to watch it with a desktop player like <a href="https://www.videolan.org/vlc/" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">VLC Media Player</a>.
                </p>
                
                <button 
                  onClick={handleShowInFolder}
                  className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-md bg-brand-red text-white font-bold hover:bg-red-700 transition-colors"
                >
                    <FolderOpenIcon className="w-6 h-6" />
                    <span>Open Containing Folder</span>
                </button>
                
                <div className={`mt-4 text-center text-sm transition-all duration-300 ${showInstructions ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                    <p className="text-green-400 font-semibold">{isCopied ? 'Folder path copied to clipboard!' : ' '}</p>
                    <p className="text-gray-300 mt-1">
                        {isMac 
                            ? <>In Finder, press <kbd>⌘+Shift+G</kbd>, paste the path, and press Enter.</>
                            : <>In File Explorer, click the address bar, paste the path, and press Enter.</>
                        }
                    </p>
                </div>

                <div className="flex justify-end mt-8">
                    <button onClick={onClose} className="py-2 px-6 rounded-md bg-brand-light-gray text-white font-bold hover:bg-gray-500 transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    view: View.Loading,
    media: [],
    currentlyViewing: null,
    searchQuery: '',
    isLoading: true,
    progress: 0,
    progressMessage: '',
  });
  const [isPickerSupported, setIsPickerSupported] = useState(false);
  const [isFavoritesView, setIsFavoritesView] = useState(false);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [activeLibrary, setActiveLibrary] = useState<LibraryInfo | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [unsupportedMedia, setUnsupportedMedia] = useState<VideoFile | null>(null);
  const [theme, setTheme] = useState('vault');
  const [playlist, setPlaylist] = useState<VideoFile[] | null>(null);
  const [showHidden, setShowHidden] = useState(() => {
    return localStorage.getItem('vault-showHidden') === 'true';
  });
  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('vault-sortOrder') || 'name-asc';
  });

  const db = useMemo(() => new MediaDB(), []);
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('vault-theme') || 'vault';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vault-theme', theme);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('vault-showHidden', String(showHidden));
  }, [showHidden]);

  useEffect(() => {
    localStorage.setItem('vault-sortOrder', sortOrder);
  }, [sortOrder]);

  const handleToggleTheme = () => {
    setTheme(current => {
      if (current === 'vault') return 'velvet';
      if (current === 'velvet') return 'dreamscape';
      return 'vault';
    });
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    appState.media.forEach(v => {
        if (v.tags) {
            v.tags.forEach(t => tagSet.add(t));
        }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [appState.media]);

  const { startScan, startProcessingUnprocessed, prioritizeMedia } = useVideoScanner(useCallback((update: { type: string; payload: any }) => {
    switch (update.type) {
      case 'progress':
        setAppState(prev => ({ ...prev, isLoading: true, progress: update.payload.progress, progressMessage: update.payload.message }));
        break;
      case 'deleted_files':
        setAppState(prev => ({
            ...prev,
            media: prev.media.filter(v => !update.payload.includes(v.fullPath))
        }));
        break;
      case 'update_files':
         setAppState(prev => {
            const updatesMap = new Map(update.payload.map((v: VideoFile) => [v.fullPath, v]));
            const existingPathsInState = new Set(prev.media.map(v => v.fullPath));
    
            // Update existing items in place to preserve order
            const updatedMedia = prev.media.map(v => updatesMap.get(v.fullPath) || v);
            
            // Find items that are in the update but not in the original state, and append them
            const newFiles = update.payload.filter((v: VideoFile) => !existingPathsInState.has(v.fullPath));
            
            return { ...prev, media: [...updatedMedia, ...newFiles] };
        });
        break;
      case 'error':
        console.error("Scanner worker error:", update.payload);
        setAppState(prev => ({ ...prev, isLoading: false, progressMessage: `Error: ${update.payload}` }));
        break;
      case 'complete':
        setAppState(prev => {
          return { ...prev, isLoading: false, progress: 100, progressMessage: 'Library up to date!' };
        });
        break;
    }
  }, []));

  const loadLibrary = useCallback(async (library: LibraryInfo) => {
    setAppState(prev => ({...prev, view: View.Loading, isLoading: true, media: [], progress: 0, progressMessage: ''}));
    setActiveLibrary(library);
    await db.setAppState('activeLibraryId', library.id);

    const hasPermission = await verifyPermission(library.handle, false);
    
    const mediaFiles = await db.getAllMedia(library.id);

    if (mediaFiles.length > 0) {
      setAppState(prev => ({ ...prev, media: mediaFiles, view: View.Library, isLoading: false }));
      if (hasPermission) {
        startProcessingUnprocessed(library.id);
      } else {
        console.warn(`Permission not available for "${library.name}". Background processing is paused.`);
      }
    } else {
      if (hasPermission) {
        setAppState(prev => ({ ...prev, view: View.Library, isLoading: true, progressMessage: 'Scanning folder...' }));
        startScan(library.handle, library.id);
      } else {
        console.warn(`Permission not available for "${library.name}". Cannot scan for media.`);
        setAppState(prev => ({ ...prev, view: View.Library, isLoading: false, media: [] }));
      }
    }
  }, [db, startScan, startProcessingUnprocessed]);


  useEffect(() => {
    let supported = 'showDirectoryPicker' in window;
    try {
        if (supported && window.self !== window.top) { supported = false; }
    } catch (e) { supported = false; }
    setIsPickerSupported(supported);

    const initializeApp = async () => {
      try {
        setAppState(prev => ({ ...prev, view: View.Loading, isLoading: true, progressMessage: 'Initializing...' }));
        let savedLibraries = await db.getAppState<LibraryInfo[]>('libraries') || [];

        setLibraries(savedLibraries);

        if (savedLibraries.length > 0) {
            let activeId = await db.getAppState<string>('activeLibraryId');
            let libraryToLoad = savedLibraries.find(l => l.id === activeId) || savedLibraries[0];
            await loadLibrary(libraryToLoad);
        } else {
            setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
        }
      } catch(e) {
          console.error("Fatal error during app initialization:", e);
          setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false, progressMessage: "Error loading library. Please try again."}));
      }
    };
    initializeApp();
  }, [db, loadLibrary]);
  
  useEffect(() => {
    setCategoryTree(buildCategoryTree(appState.media));
  }, [appState.media]);

  const handlePlayPlaylist = async (playlist: VideoFile[], startWith?: VideoFile) => {
    if (!activeLibrary) {
      console.error("Cannot open media, no active library.");
      alert("An error occurred: No active library selected.");
      return;
    }

    if (playlist.length === 0) return;
    
    const firstVideo = startWith || playlist[0];

    if (firstVideo.isPlayable === false) {
      setUnsupportedMedia(firstVideo);
      return;
    }

    const hasPermission = await verifyPermission(activeLibrary.handle, true);

    if (hasPermission) {
      setPlaylist(playlist);
      setAppState(prev => ({ ...prev, view: View.Player, currentlyViewing: firstVideo }));
    } else {
      alert("Vault does not have permission to access this folder.\n\nThis can happen after a browser restart or if the app is running in a restricted context (like an iframe).\n\nPlease try adding the library again from the main screen to re-grant access.");
    }
  }

  const handlePlayRemix = (videos: VideoFile[]) => {
      if (videos.length === 0) return;

      const playableVideos = videos.filter(v => v.isPlayable !== false);
      if (playableVideos.length === 0) {
          alert("No playable videos found in this category to create a remix.");
          return;
      }

      const shuffled = [...playableVideos].sort(() => 0.5 - Math.random());
      const remixPlaylist = shuffled.slice(0, 8);
      handlePlayPlaylist(remixPlaylist);
  };

  const handleSelectVideo = async (videoFile: VideoFile) => {
    setPlaylist(null);
    if (videoFile.isPlayable === false) {
      setUnsupportedMedia(videoFile);
      return;
    }
    
    if (!activeLibrary) {
      console.error("Cannot open media, no active library.");
      alert("An error occurred: No active library selected.");
      return;
    }
    
    const hasPermission = await verifyPermission(activeLibrary.handle, true);

    if (hasPermission) {
      setAppState(prev => ({ ...prev, view: View.Player, currentlyViewing: videoFile }));
    } else {
      alert("Vault does not have permission to access this folder.\n\nThis can happen after a browser restart or if the app is running in a restricted context (like an iframe).\n\nPlease try adding the library again from the main screen to re-grant access.");
    }
  };

  const handleClosePlayer = async () => {
    if (!activeLibrary) return;
    setPlaylist(null); // Clear playlist on close
    const mediaFiles = await db.getAllMedia(activeLibrary.id);
    setAppState(prev => ({ ...prev, media: mediaFiles, view: View.Library, currentlyViewing: null }));
  };
  
  const handleDirectorySelected = async (handle: FileSystemDirectoryHandle) => {
    setIsFavoritesView(false);
    setSelectedCategoryPath(null);
    setSelectedTag(null);
  
    const isSameEntryChecks = await Promise.all(libraries.map(lib => lib.handle.isSameEntry(handle)));
    const existingIndex = isSameEntryChecks.findIndex(isSame => isSame);
  
    let newLibrary: LibraryInfo;
    let tempLibraries = [...libraries];
  
    if (existingIndex > -1) {
      newLibrary = tempLibraries.splice(existingIndex, 1)[0];
    } else {
      newLibrary = { id: crypto.randomUUID(), name: handle.name, handle };
    }
  
    let updatedLibraries = [newLibrary, ...tempLibraries];
    
    if (existingIndex === -1 && updatedLibraries.length > 5) {
      const oldestLibrary = updatedLibraries.pop();
      if (oldestLibrary) {
        await db.clearMedia(oldestLibrary.id); 
      }
    }
  
    setLibraries(updatedLibraries);
    await db.setAppState('libraries', updatedLibraries);
    await loadLibrary(newLibrary);
  };

  const handleSwitchLibrary = async (libraryId: string) => {
    const libraryToSwitch = libraries.find(l => l.id === libraryId);
    if (libraryToSwitch && libraryToSwitch.id !== activeLibrary?.id) {
      await loadLibrary(libraryToSwitch);
    }
  };

  const handleDeleteLibrary = async (libraryId: string) => {
    const libraryToDelete = libraries.find(l => l.id === libraryId);
    if (!libraryToDelete) return;
  
    if (window.confirm(`Are you sure you want to delete the library "${libraryToDelete.name}"? All its cached data will be removed. The original folder will not be affected.`)) {
      const newLibraries = libraries.filter(l => l.id !== libraryId);
      setLibraries(newLibraries);
      await db.setAppState('libraries', newLibraries);
      await db.clearMedia(libraryId);

      if (activeLibrary?.id === libraryId) {
        if (newLibraries.length > 0) {
          await loadLibrary(newLibraries[0]);
        } else {
          setActiveLibrary(null);
          setAppState(prev => ({ ...prev, view: View.Welcome, media: [], isLoading: false, searchQuery: '' }));
        }
      }
    }
  };

  const handleRenameLibrary = async (libraryId: string, newName:string) => {
      const newLibraries = libraries.map(l => l.id === libraryId ? {...l, name: newName} : l);
      setLibraries(newLibraries);
      await db.setAppState('libraries', newLibraries);
      if (activeLibrary?.id === libraryId) {
        setActiveLibrary(prev => prev ? {...prev, name: newName} : null);
      }
  };

  const handleRefreshLibrary = useCallback(async (libraryId: string) => {
    const library = libraries.find(l => l.id === libraryId);
    if (!library) return;

    setIsManageOpen(false);

    const hasPermission = await verifyPermission(library.handle, true);
    if (!hasPermission) {
        alert(`Vault does not have permission to access "${library.name}".\n\nThis can happen after a browser restart or if the app is running in a restricted context (like an iframe).\n\nPlease try adding the library again to re-grant access.`);
        return;
    }
    
    if (activeLibrary?.id !== libraryId || appState.media.length === 0) {
      setAppState(prev => ({ ...prev, isLoading: true, media: [], progress: 0, progressMessage: `Refreshing "${library.name}"...` }));
    } else {
      setAppState(prev => ({ ...prev, isLoading: true, progress: 0, progressMessage: `Refreshing "${library.name}"...` }));
    }
    
    const existingMedia = await db.getAllMedia(libraryId);
    startScan(library.handle, library.id, existingMedia);
  }, [db, libraries, startScan, activeLibrary, appState.media]);

  const updateMediaItem = (updatedVideo: VideoFile) => {
    setAppState(prev => ({
      ...prev,
      media: prev.media.map(v => v.fullPath === updatedVideo.fullPath ? updatedVideo : v),
    }));
  };

  const handleToggleFavorite = useCallback(async (fullPath: string) => {
    if (!activeLibrary) return;
    const updated = await db.toggleFavorite(activeLibrary.id, fullPath);
    if (updated) updateMediaItem(updated);
  }, [db, activeLibrary]);

  const handleToggleHidden = useCallback(async (fullPath: string) => {
    if (!activeLibrary) return;
    const updated = await db.toggleHidden(activeLibrary.id, fullPath);
    if (updated) updateMediaItem(updated);
  }, [db, activeLibrary]);

  const handleUpdateTags = useCallback(async (fullPath: string, tags: string[]) => {
    if (!activeLibrary) return;
    const updated = await db.updateTags(activeLibrary.id, fullPath, tags);
    if (updated) updateMediaItem(updated);
  }, [db, activeLibrary]);
  
  const handleClearContinueWatching = async () => {
    if (!activeLibrary) return;
    const updatedPaths = await db.clearContinueWatching(activeLibrary.id);
    setAppState(prev => ({
        ...prev,
        media: prev.media.map(v => {
            if (updatedPaths.includes(v.fullPath)) {
                const { playbackPosition, lastWatched, ...rest } = v;
                return rest;
            }
            return v;
        }),
    }));
  };
  
  const handleGoHome = () => {
    setAppState(prev => ({ ...prev, searchQuery: '' }));
    setIsFavoritesView(false);
    setSelectedCategoryPath(null);
    setSelectedTag(null);
  };
  
  const handleSelectCategory = (path: string | null) => {
    setAppState(prev => ({ ...prev, searchQuery: '' }));
    setIsFavoritesView(false);
    setSelectedTag(null);
    setSelectedCategoryPath(path);
  };

  const handleSelectTag = (tag: string) => {
    setAppState(prev => ({ ...prev, searchQuery: '' }));
    setIsFavoritesView(false);
    setSelectedCategoryPath(null);
    setSelectedTag(tag);
  };

  const renderView = () => {
    switch (appState.view) {
      case View.Player:
        if (appState.currentlyViewing && activeLibrary) {
          return <Player 
            video={appState.currentlyViewing} 
            on_close={handleClosePlayer} 
            allVideos={appState.media}
            activeLibrary={activeLibrary}
            playlist={playlist}
            onSwitchVideo={handleSelectVideo}
          />;
        }
        return null;
      case View.Library:
        return (
          <>
            {activeLibrary && (
              <Header 
                onSearch={(query) => setAppState(prev => ({ ...prev, searchQuery: query }))}
                onDirectorySelected={handleDirectorySelected}
                categoryTree={categoryTree}
                onSelectCategory={handleSelectCategory}
                allTags={allTags}
                onSelectTag={handleSelectTag}
                onGoHome={handleGoHome}
                libraries={libraries}
                activeLibrary={activeLibrary}
                onSwitchLibrary={(id) => { handleGoHome(); handleSwitchLibrary(id); }}
                onManageLibraries={() => setIsManageOpen(true)}
                isPickerSupported={isPickerSupported}
                onToggleTheme={handleToggleTheme}
                isLoading={appState.isLoading}
                progress={appState.progress}
                progressMessage={appState.progressMessage}
                showHidden={showHidden}
                onToggleHidden={() => setShowHidden(s => !s)}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                onDeleteLibrary={handleDeleteLibrary}
              />
            )}
            <Library 
              media={appState.media}
              categoryTree={categoryTree}
              onSelectVideo={handleSelectVideo}
              isLoading={appState.isLoading}
              progress={appState.progress}
              progressMessage={appState.progressMessage}
              searchQuery={appState.searchQuery}
              onToggleFavorite={handleToggleFavorite}
              onToggleHidden={handleToggleHidden}
              // Fix: Corrected typo. The handler for updating tags is `handleUpdateTags`, not `onUpdateTags`.
              onUpdateTags={handleUpdateTags}
              selectedCategoryPath={selectedCategoryPath}
              onSelectCategory={handleSelectCategory}
              selectedTag={selectedTag}
              onUnsupportedMedia={setUnsupportedMedia}
              onGoHome={handleGoHome}
              hasLibraries={libraries.length > 0}
              isFavoritesView={isFavoritesView}
              onPrioritizeMedia={prioritizeMedia}
              showHidden={showHidden}
              sortOrder={sortOrder}
              onClearContinueWatching={handleClearContinueWatching}
              onPlayRemix={handlePlayRemix}
            />
            <Footer />
          </>
        );
      case View.Welcome:
        return <FileDropZone onDirectorySelected={handleDirectorySelected} isPickerSupported={isPickerSupported} />;
      case View.Loading:
      default:
        return (
          <div className="flex items-center justify-center h-screen">
            <p className="text-xl animate-pulse">{appState.progressMessage || 'Loading...'}</p>
          </div>
        );
    }
  };

  return (
    <>
        {renderView()}
        {isManageOpen && (
          <ManageLibrariesModal
            libraries={libraries}
            activeLibraryId={activeLibrary?.id || null}
            onSwitch={(id) => { setIsManageOpen(false); handleGoHome(); handleSwitchLibrary(id); }}
            onDelete={handleDeleteLibrary}
            onRename={handleRenameLibrary}
            onRefresh={handleRefreshLibrary}
            onClose={() => setIsManageOpen(false)}
          />
        )}
        {unsupportedMedia && (
            <UnsupportedMediaModal media={unsupportedMedia} onClose={() => setUnsupportedMedia(null)} />
        )}
    </>
  );
};

export default App;

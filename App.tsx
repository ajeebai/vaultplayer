
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [activeLibrary, setActiveLibrary] = useState<LibraryInfo | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [unsupportedMedia, setUnsupportedMedia] = useState<VideoFile | null>(null);
  const [theme, setTheme] = useState('vault');
  const [showHidden, setShowHidden] = useState(() => localStorage.getItem('vault-showHidden') === 'true');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('vault-sortOrder') || 'name-asc');

  const db = useMemo(() => new MediaDB(), []);

  const { startScan, startProcessingUnprocessed } = useVideoScanner(useCallback((update: { type: string; payload: any }) => {
    switch (update.type) {
      case 'progress':
        setAppState(prev => ({ ...prev, isLoading: true, progress: update.payload.progress, progressMessage: update.payload.message }));
        break;
      case 'update_files':
         setAppState(prev => {
            const updatesMap = new Map(update.payload.map((v: VideoFile) => [v.fullPath, v]));
            const existingPaths = new Set(prev.media.map(v => v.fullPath));
            const updatedMedia = prev.media.map(v => updatesMap.get(v.fullPath) || v);
            const newFiles = update.payload.filter((v: VideoFile) => !existingPaths.has(v.fullPath));
            return { ...prev, media: [...updatedMedia, ...newFiles] };
        });
        break;
      case 'complete':
        setAppState(prev => ({ ...prev, isLoading: false, progress: 100, progressMessage: 'Ready' }));
        break;
      case 'error':
        setAppState(prev => ({ ...prev, isLoading: false, progressMessage: 'Scanner failed: ' + update.payload }));
        break;
    }
  }, []));

  const loadLibrary = useCallback(async (library: LibraryInfo) => {
    setAppState(prev => ({...prev, view: View.Loading, isLoading: true, media: [], progress: 0, progressMessage: 'Opening...'}));
    setActiveLibrary(library);
    await db.setAppState('activeLibraryId', library.id);

    const hasPermission = await verifyPermission(library.handle, false);
    const mediaFiles = await db.getAllMedia(library.id);

    if (!hasPermission && !isPickerSupported && mediaFiles.length > 0) {
        setAppState(prev => ({ 
            ...prev, 
            media: mediaFiles, 
            view: View.Library, 
            isLoading: false, 
            progressMessage: 'Session expired. Re-link folder to play.' 
        }));
        return;
    }

    if (mediaFiles.length > 0) {
      setAppState(prev => ({ ...prev, media: mediaFiles, view: View.Library, isLoading: false }));
      if (hasPermission) startProcessingUnprocessed(library.id);
    } else if (hasPermission) {
      setAppState(prev => ({ ...prev, view: View.Library, isLoading: true }));
      startScan(library.handle, library.id);
    } else {
       setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
    }
  }, [db, startScan, startProcessingUnprocessed, isPickerSupported]);

  useEffect(() => {
    setIsPickerSupported('showDirectoryPicker' in window);
    const init = async () => {
      const saved = await db.getAppState<LibraryInfo[]>('libraries') || [];
      setLibraries(saved);
      if (saved.length > 0) {
          let activeId = await db.getAppState<string>('activeLibraryId');
          let lib = saved.find(l => l.id === activeId) || saved[0];
          loadLibrary(lib);
      } else {
          setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
      }
    };
    init();
    setTheme(localStorage.getItem('vault-theme') || 'vault');
  }, [db, loadLibrary]);
  
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vault-theme', theme);
  }, [theme]);

  useEffect(() => setCategoryTree(buildCategoryTree(appState.media)), [appState.media]);

  const handleDirectorySelected = async (handle: FileSystemDirectoryHandle | File[]) => {
    let name = Array.isArray(handle) ? (handle[0]?.webkitRelativePath?.split('/')[0] || "Imported") : handle.name;
    let newLib: LibraryInfo = { id: crypto.randomUUID(), name, handle };
    const updated = [newLib, ...libraries.filter(l => l.id !== newLib.id)].slice(0, 5);
    setLibraries(updated);
    await db.setAppState('libraries', updated);
    loadLibrary(newLib);
  };

  return (
    <>
        {appState.view === View.Player && appState.currentlyViewing && activeLibrary ? (
            <Player 
                video={appState.currentlyViewing} 
                on_close={async () => setAppState(prev => ({ ...prev, view: View.Library, currentlyViewing: null }))} 
                allVideos={appState.media} activeLibrary={activeLibrary} 
                onSwitchVideo={(v) => setAppState(prev => ({ ...prev, currentlyViewing: v }))}
            />
        ) : appState.view === View.Library && activeLibrary ? (
            <>
                <Header 
                    onSearch={q => setAppState(prev => ({ ...prev, searchQuery: q }))}
                    onDirectorySelected={handleDirectorySelected}
                    categoryTree={categoryTree}
                    onSelectCategory={() => {}} 
                    allTags={[]} 
                    onSelectTag={() => {}}
                    onGoHome={() => setAppState(prev => ({...prev, searchQuery: ''}))}
                    libraries={libraries}
                    activeLibrary={activeLibrary}
                    onSwitchLibrary={id => { const l = libraries.find(l => l.id === id); if(l) loadLibrary(l); }}
                    onManageLibraries={() => setIsManageOpen(true)}
                    isPickerSupported={isPickerSupported}
                    onToggleTheme={() => setTheme(t => t === 'vault' ? 'velvet' : 'vault')}
                    isLoading={appState.isLoading}
                    progress={appState.progress}
                    progressMessage={appState.progressMessage}
                    showHidden={showHidden}
                    onToggleHidden={() => setShowHidden(s => !s)}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    onDeleteLibrary={async id => {
                        const newLibs = libraries.filter(l => l.id !== id);
                        setLibraries(newLibs);
                        await db.setAppState('libraries', newLibs);
                        await db.clearMedia(id);
                        if (activeLibrary.id === id) window.location.reload();
                    }}
                />
                <Library 
                    media={appState.media} categoryTree={categoryTree}
                    onSelectVideo={v => v.isPlayable === false ? setUnsupportedMedia(v) : setAppState(prev => ({ ...prev, view: View.Player, currentlyViewing: v }))}
                    isLoading={appState.isLoading} progress={appState.progress} progressMessage={appState.progressMessage}
                    searchQuery={appState.searchQuery}
                    onToggleFavorite={() => {}} onToggleHidden={() => {}} onUpdateTags={() => {}}
                    selectedCategoryPath={null} onSelectCategory={() => {}}
                    selectedTag={null} onUnsupportedMedia={setUnsupportedMedia}
                    onGoHome={() => {}} hasLibraries={true} isFavoritesView={false}
                    onPrioritizeMedia={() => {}} showHidden={showHidden} sortOrder={sortOrder}
                    onPlayRemix={() => {}}
                />
                <Footer />
            </>
        ) : appState.view === View.Welcome ? (
            <FileDropZone onDirectorySelected={handleDirectorySelected} isPickerSupported={isPickerSupported} />
        ) : (
            <div className="flex items-center justify-center h-screen"><p className="animate-pulse">Loading Library...</p></div>
        )}
    </>
  );
};

export default App;


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
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [activeLibrary, setActiveLibrary] = useState<LibraryInfo | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [unsupportedMedia, setUnsupportedMedia] = useState<VideoFile | null>(null);
  const [theme, setTheme] = useState('vault');
  const [playlist, setPlaylist] = useState<VideoFile[] | null>(null);
  const [showHidden, setShowHidden] = useState(() => localStorage.getItem('vault-showHidden') === 'true');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('vault-sortOrder') || 'name-asc');

  const db = useMemo(() => new MediaDB(), []);
  
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vault-theme', theme);
  }, [theme]);

  const { startScan, startScanFromFiles, startProcessingUnprocessed, prioritizeMedia } = useVideoScanner(useCallback((update: { type: string; payload: any }) => {
    switch (update.type) {
      case 'progress':
        setAppState(prev => ({ ...prev, isLoading: true, progress: update.payload.progress, progressMessage: update.payload.message }));
        break;
      case 'update_files':
         setAppState(prev => {
            const updatesMap = new Map(update.payload.map((v: VideoFile) => [v.fullPath, v]));
            const existingPathsInState = new Set(prev.media.map(v => v.fullPath));
            const updatedMedia = prev.media.map(v => updatesMap.get(v.fullPath) || v);
            const newFiles = update.payload.filter((v: VideoFile) => !existingPathsInState.has(v.fullPath));
            return { ...prev, media: [...updatedMedia, ...newFiles] };
        });
        break;
      case 'complete':
        setAppState(prev => ({ ...prev, isLoading: false, progress: 100, progressMessage: 'Complete!' }));
        break;
    }
  }, []));

  const loadLibrary = useCallback(async (library: LibraryInfo) => {
    setAppState(prev => ({...prev, view: View.Loading, isLoading: true, media: [], progress: 0, progressMessage: ''}));
    setActiveLibrary(library);
    await db.setAppState('activeLibraryId', library.id);

    const mediaFiles = await db.getAllMedia(library.id);

    if (mediaFiles.length > 0) {
      setAppState(prev => ({ ...prev, media: mediaFiles, view: View.Library, isLoading: false }));
      if (library.handle) {
          const hasPermission = await verifyPermission(library.handle, false);
          if (hasPermission) startProcessingUnprocessed(library.id);
      }
    } else if (library.handle) {
        const hasPermission = await verifyPermission(library.handle, false);
        if (hasPermission) startScan(library.handle, library.id);
        else setAppState(prev => ({ ...prev, view: View.Library, isLoading: false }));
    } else {
        setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
    }
  }, [db, startScan, startProcessingUnprocessed]);

  useEffect(() => {
    setIsPickerSupported('showDirectoryPicker' in window);
    const initializeApp = async () => {
        let savedLibraries = await db.getAppState<LibraryInfo[]>('libraries') || [];
        setLibraries(savedLibraries);
        if (savedLibraries.length > 0) {
            let activeId = await db.getAppState<string>('activeLibraryId');
            let libraryToLoad = savedLibraries.find(l => l.id === activeId) || savedLibraries[0];
            await loadLibrary(libraryToLoad);
        } else {
            setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
        }
    };
    initializeApp();
  }, [db, loadLibrary]);
  
  useEffect(() => setCategoryTree(buildCategoryTree(appState.media)), [appState.media]);

  const handleDirectorySelected = async (selection: FileSystemDirectoryHandle | File[]) => {
    let handle: FileSystemDirectoryHandle | undefined;
    let name: string;
    let files: File[] | undefined;

    if (Array.isArray(selection)) {
        files = selection;
        name = files[0]?.webkitRelativePath.split('/')[0] || 'Selected Folder';
    } else {
        handle = selection;
        name = handle.name;
    }

    const newLibrary: LibraryInfo = { id: crypto.randomUUID(), name, handle };
    const updatedLibraries = [newLibrary, ...libraries.slice(0, 4)];
    setLibraries(updatedLibraries);
    await db.setAppState('libraries', updatedLibraries);
    
    setAppState(prev => ({ ...prev, view: View.Library, isLoading: true, media: [], progress: 0 }));
    setActiveLibrary(newLibrary);

    if (files) startScanFromFiles(files, newLibrary.id);
    else if (handle) startScan(handle, newLibrary.id);
  };

  const handleSelectVideo = async (videoFile: VideoFile) => {
    if (videoFile.isPlayable === false) { setUnsupportedMedia(videoFile); return; }
    setAppState(prev => ({ ...prev, view: View.Player, currentlyViewing: videoFile }));
  };

  return (
    <>
        {appState.view === View.Welcome && <FileDropZone onDirectorySelected={handleDirectorySelected} isPickerSupported={isPickerSupported} />}
        {appState.view === View.Library && activeLibrary && (
          <>
            <Header 
                onSearch={(q) => setAppState(prev => ({ ...prev, searchQuery: q }))}
                onDirectorySelected={handleDirectorySelected}
                categoryTree={categoryTree}
                onSelectCategory={setSelectedCategoryPath}
                allTags={[]}
                onSelectTag={setSelectedTag}
                onGoHome={() => { setSelectedCategoryPath(null); setSelectedTag(null); }}
                libraries={libraries}
                activeLibrary={activeLibrary}
                onSwitchLibrary={(id) => loadLibrary(libraries.find(l => l.id === id)!)}
                onManageLibraries={() => setIsManageOpen(true)}
                isPickerSupported={isPickerSupported}
                onToggleTheme={() => setTheme(t => t === 'vault' ? 'velvet' : 'vault')}
                isLoading={appState.isLoading}
                progress={appState.progress}
                progressMessage={appState.progressMessage}
                showHidden={showHidden}
                onToggleHidden={() => setShowHidden(!showHidden)}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                onDeleteLibrary={() => {}}
            />
            <Library 
              media={appState.media}
              categoryTree={categoryTree}
              onSelectVideo={handleSelectVideo}
              isLoading={appState.isLoading}
              progress={appState.progress}
              progressMessage={appState.progressMessage}
              searchQuery={appState.searchQuery}
              onToggleFavorite={() => {}}
              onToggleHidden={() => {}}
              onUpdateTags={() => {}}
              selectedCategoryPath={selectedCategoryPath}
              onSelectCategory={setSelectedCategoryPath}
              selectedTag={selectedTag}
              onUnsupportedMedia={setUnsupportedMedia}
              onGoHome={() => {}}
              hasLibraries={true}
              isFavoritesView={false}
              onPrioritizeMedia={prioritizeMedia}
              showHidden={showHidden}
              sortOrder={sortOrder}
              onPlayRemix={() => {}}
            />
            <Footer />
          </>
        )}
        {appState.view === View.Player && appState.currentlyViewing && (
            <Player 
                video={appState.currentlyViewing} 
                on_close={() => setAppState(prev => ({ ...prev, view: View.Library }))} 
                allVideos={appState.media} 
                activeLibrary={activeLibrary!} 
                onSwitchVideo={handleSelectVideo} 
            />
        )}
        {unsupportedMedia && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-[100]" onClick={() => setUnsupportedMedia(null)}>
            <div className="bg-brand-gray p-8 rounded-xl max-w-md">
                <h2 className="text-2xl font-bold mb-4">Unsupported Format</h2>
                <p className="text-gray-400">Firefox has stricter codec support than Chrome. This file likely uses H.265/HEVC which Firefox does not support natively.</p>
                <button onClick={() => setUnsupportedMedia(null)} className="mt-6 bg-brand-red px-6 py-2 rounded font-bold w-full">Close</button>
            </div>
        </div>}
    </>
  );
};

export default App;

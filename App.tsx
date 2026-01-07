
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
    
    const folderPath = useMemo(() => {
      const lastSlash = media.fullPath.lastIndexOf('/');
      if (lastSlash === -1) return '(root folder)';
      return media.fullPath.substring(0, lastSlash);
    }, [media.fullPath]);

    const handleShowInFolder = useCallback(() => {
        if (folderPath === '(root folder)') return;
        navigator.clipboard.writeText(folderPath).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 3000);
        });
    }, [folderPath]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-brand-gray rounded-lg shadow-xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-2">Unsupported Video</h2>
                <p className="text-gray-400 mb-4">This video cannot be played in your browser (likely an unsupported codec like H.265).</p>
                 <div className="bg-brand-black p-3 rounded-md mb-6 text-sm">
                    <p className="text-gray-400 mb-1">File:</p>
                    <code className="text-white break-all font-mono">{media.name}</code>
                </div>
                <button onClick={handleShowInFolder} className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-md bg-brand-red text-white font-bold hover:bg-red-700 transition-colors">
                    <FolderOpenIcon className="w-6 h-6" />
                    <span>{isCopied ? 'Copied!' : 'Copy Folder Path'}</span>
                </button>
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
  const [showHidden, setShowHidden] = useState(() => localStorage.getItem('vault-showHidden') === 'true');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('vault-sortOrder') || 'name-asc');

  const db = useMemo(() => new MediaDB(), []);
  
  useEffect(() => {
    setTheme(localStorage.getItem('vault-theme') || 'vault');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vault-theme', theme);
  }, [theme]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    appState.media.forEach(v => v.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [appState.media]);

  const { startScan, startProcessingUnprocessed, prioritizeMedia } = useVideoScanner(useCallback((update: { type: string; payload: any }) => {
    switch (update.type) {
      case 'progress':
        setAppState(prev => ({ ...prev, isLoading: true, progress: update.payload.progress, progressMessage: update.payload.message }));
        break;
      case 'deleted_files':
        setAppState(prev => ({ ...prev, media: prev.media.filter(v => !update.payload.includes(v.fullPath)) }));
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
        setAppState(prev => ({ ...prev, isLoading: false, progress: 100, progressMessage: 'Ready!' }));
        break;
      case 'error':
        setAppState(prev => ({ ...prev, isLoading: false, progress: 0, progressMessage: 'Error: ' + update.payload }));
        break;
    }
  }, []));

  const loadLibrary = useCallback(async (library: LibraryInfo) => {
    setAppState(prev => ({...prev, view: View.Loading, isLoading: true, media: [], progress: 0, progressMessage: 'Authenticating...'}));
    setActiveLibrary(library);
    await db.setAppState('activeLibraryId', library.id);

    // Permission check
    const hasPermission = await verifyPermission(library.handle, false);
    
    // Detection of "Dead Handles" for Firefox persistence issues
    if (!hasPermission && !isPickerSupported) {
        // In browsers without FS Access API, libraries cannot be refreshed after a page reload
        // We provide a grace period where we show cached metadata, but warn the user.
        const mediaFiles = await db.getAllMedia(library.id);
        if (mediaFiles.length > 0) {
            setAppState(prev => ({ 
                ...prev, 
                media: mediaFiles, 
                view: View.Library, 
                isLoading: false, 
                progressMessage: 'Session expired. Metadata is cached, but files cannot be played until folder is re-selected.' 
            }));
            return;
        }
    }

    const mediaFiles = await db.getAllMedia(library.id);
    if (mediaFiles.length > 0) {
      setAppState(prev => ({ ...prev, media: mediaFiles, view: View.Library, isLoading: false }));
      if (hasPermission) {
          startProcessingUnprocessed(library.id);
      }
    } else if (hasPermission) {
      setAppState(prev => ({ ...prev, view: View.Library, isLoading: true, progressMessage: 'Scanning...' }));
      startScan(library.handle, library.id);
    } else {
       setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
    }
  }, [db, startScan, startProcessingUnprocessed, isPickerSupported]);

  useEffect(() => {
    setIsPickerSupported('showDirectoryPicker' in window);
    const init = async () => {
      const savedLibraries = await db.getAppState<LibraryInfo[]>('libraries') || [];
      setLibraries(savedLibraries);
      if (savedLibraries.length > 0) {
          let activeId = await db.getAppState<string>('activeLibraryId');
          let libraryToLoad = savedLibraries.find(l => l.id === activeId) || savedLibraries[0];
          loadLibrary(libraryToLoad);
      } else {
          setAppState(prev => ({ ...prev, view: View.Welcome, isLoading: false }));
      }
    };
    init();
  }, [db, loadLibrary]);
  
  useEffect(() => setCategoryTree(buildCategoryTree(appState.media)), [appState.media]);

  const handleDirectorySelected = async (handle: FileSystemDirectoryHandle | File[]) => {
    setIsFavoritesView(false);
    setSelectedCategoryPath(null);
    setSelectedTag(null);
  
    let name = Array.isArray(handle) ? (handle.length > 0 ? (handle[0] as File).webkitRelativePath.split('/')[0] || "Imported Library" : "Imported Library") : handle.name;
    let newLibrary: LibraryInfo = { id: crypto.randomUUID(), name, handle };

    const updatedLibraries = [newLibrary, ...libraries.filter(l => l.id !== newLibrary.id)].slice(0, 5);
    setLibraries(updatedLibraries);
    await db.setAppState('libraries', updatedLibraries);
    loadLibrary(newLibrary);
  };

  const renderView = () => {
    switch (appState.view) {
      case View.Player:
        if (appState.currentlyViewing && activeLibrary) {
          return <Player 
            video={appState.currentlyViewing} on_close={async () => {
              const mediaFiles = await db.getAllMedia(activeLibrary.id);
              setAppState(prev => ({ ...prev, media: prev.media.map(v => v.fullPath === appState.currentlyViewing?.fullPath ? {...v, ...appState.currentlyViewing} : v), view: View.Library, currentlyViewing: null }));
            }} 
            allVideos={appState.media} activeLibrary={activeLibrary} playlist={playlist}
            onSwitchVideo={(v) => setAppState(prev => ({ ...prev, currentlyViewing: v }))}
          />;
        }
        return null;
      case View.Library:
        return (
          <>
            {activeLibrary && (
              <Header 
                onSearch={q => setAppState(prev => ({ ...prev, searchQuery: q }))}
                onDirectorySelected={handleDirectorySelected}
                categoryTree={categoryTree}
                onSelectCategory={setSelectedCategoryPath}
                allTags={allTags}
                onSelectTag={setSelectedTag}
                onGoHome={() => { setAppState(prev => ({...prev, searchQuery: ''})); setIsFavoritesView(false); setSelectedCategoryPath(null); }}
                libraries={libraries}
                activeLibrary={activeLibrary}
                onSwitchLibrary={id => { const lib = libraries.find(l => l.id === id); if(lib) loadLibrary(lib); }}
                onManageLibraries={() => setIsManageOpen(true)}
                isPickerSupported={isPickerSupported}
                onToggleTheme={() => setTheme(t => t === 'vault' ? 'velvet' : t === 'velvet' ? 'dreamscape' : 'vault')}
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
                  if (activeLibrary.id === id) {
                    if (newLibs.length > 0) loadLibrary(newLibs[0]);
                    else setAppState(prev => ({...prev, view: View.Welcome, media: []}));
                  }
                }}
              />
            )}
            <Library 
              media={appState.media} categoryTree={categoryTree}
              onSelectVideo={v => {
                if(v.isPlayable === false) setUnsupportedMedia(v);
                else setAppState(prev => ({ ...prev, view: View.Player, currentlyViewing: v }));
              }}
              isLoading={appState.isLoading} progress={appState.progress} progressMessage={appState.progressMessage}
              searchQuery={appState.searchQuery}
              onToggleFavorite={async path => { if(!activeLibrary) return; const v = await db.toggleFavorite(activeLibrary.id, path); if(v) setAppState(prev => ({ ...prev, media: prev.media.map(m => m.fullPath === v.fullPath ? v : m) })); }}
              onToggleHidden={async path => { if(!activeLibrary) return; const v = await db.toggleHidden(activeLibrary.id, path); if(v) setAppState(prev => ({ ...prev, media: prev.media.map(m => m.fullPath === v.fullPath ? v : m) })); }}
              onUpdateTags={async (path, tags) => { if(!activeLibrary) return; const v = await db.updateTags(activeLibrary.id, path, tags); if(v) setAppState(prev => ({ ...prev, media: prev.media.map(m => m.fullPath === v.fullPath ? v : m) })); }}
              selectedCategoryPath={selectedCategoryPath} onSelectCategory={setSelectedCategoryPath}
              selectedTag={selectedTag} onUnsupportedMedia={setUnsupportedMedia}
              onGoHome={() => { setIsFavoritesView(false); setSelectedCategoryPath(null); }}
              hasLibraries={libraries.length > 0} isFavoritesView={isFavoritesView}
              onPrioritizeMedia={prioritizeMedia} showHidden={showHidden} sortOrder={sortOrder}
              onPlayRemix={v => setPlaylist(v)}
            />
            <Footer />
          </>
        );
      case View.Welcome:
        return <FileDropZone onDirectorySelected={handleDirectorySelected} isPickerSupported={isPickerSupported} />;
      default:
        return <div className="flex items-center justify-center h-screen"><p className="animate-pulse">Loading...</p></div>;
    }
  };

  return (
    <>
        {renderView()}
        {isManageOpen && (
          <ManageLibrariesModal
            libraries={libraries} activeLibraryId={activeLibrary?.id || null}
            onSwitch={id => { setIsManageOpen(false); const lib = libraries.find(l => l.id === id); if(lib) loadLibrary(lib); }}
            onDelete={async id => { const newLibs = libraries.filter(l => l.id !== id); setLibraries(newLibs); await db.setAppState('libraries', newLibs); await db.clearMedia(id); if (activeLibrary?.id === id) window.location.reload(); }}
            onRename={async (id, name) => { const newLibs = libraries.map(l => l.id === id ? {...l, name} : l); setLibraries(newLibs); await db.setAppState('libraries', newLibs); }}
            onRefresh={async id => { const lib = libraries.find(l => l.id === id); if(lib) startScan(lib.handle, lib.id, await db.getAllMedia(id)); setIsManageOpen(false); }}
            onClose={() => setIsManageOpen(false)}
          />
        )}
        {unsupportedMedia && <UnsupportedMediaModal media={unsupportedMedia} onClose={() => setUnsupportedMedia(null)} />}
    </>
  );
};

export default App;

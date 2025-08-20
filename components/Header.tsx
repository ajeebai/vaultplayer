
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CategoryNode, LibraryInfo } from '../types';

interface HeaderProps {
  onSearch: (query: string) => void;
  onDirectorySelected: (handle: FileSystemDirectoryHandle) => void;
  categoryTree: CategoryNode[];
  onSelectCategory: (path: string) => void;
  allTags: string[];
  onSelectTag: (tag: string) => void;
  onGoHome: () => void;
  libraries: LibraryInfo[];
  activeLibrary: LibraryInfo;
  onSwitchLibrary: (id: string) => void;
  onManageLibraries: () => void;
  isPickerSupported: boolean;
  onToggleTheme: () => void;
  showUnsupported: boolean;
  onToggleUnsupported: () => void;
}

const SearchIcon: React.FC<{className?: string; onClick?: () => void;}> = ({className, onClick}) => (<svg onClick={onClick} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>);
const ChevronDownIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>);
const ChevronRightIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>);
const CheckIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>);
const PaletteIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5.67-1.5 1.5S5.67 15 6.5 15s1.5-.67 1.5-1.5S7.33 12 6.5 12zm3-4c-.83 0-1.5.67-1.5 1.5S8.67 11 9.5 11s1.5-.67 1.5-1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm3 4c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"></path></svg>);
const EyeIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" /></svg>);
const EyeSlashIcon: React.FC<{className?: string}> = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 001.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z" /><path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A5.25 5.25 0 0115.75 12zM12.53 15.713l-4.244-4.244a5.25 5.25 0 006.71 6.71l-1.43-1.43c-.428.1-.88.152-1.336.152a3 3 0 01-3-3c0-.456.052-.908.152-1.336l-1.43-1.43z" /><path d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c1.441 0 2.845.313 4.142.87l-1.518 1.518A11.222 11.222 0 0012.001 6C7.527 6 3.73 8.79 2.44 12.882a1.75 1.75 0 000 1.238c.192.58.427 1.13.702 1.654l-1.518 1.518A11.454 11.454 0 011.323 12.553z" /></svg>);

const CategoryMenuItem: React.FC<{ node: CategoryNode; onSelect: (path: string) => void }> = ({ node, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <a 
        href="#" 
        onClick={(e) => { e.preventDefault(); onSelect(node.path); }}
        className="flex justify-between items-center px-4 py-2 text-sm text-gray-200 hover:bg-brand-gray"
      >
        <span>{node.name}</span>
        {hasChildren && <ChevronRightIcon className="w-4 h-4" />}
      </a>
      {hasChildren && isOpen && (
        <div className="absolute top-0 left-full mt-0 w-56 bg-brand-light-gray rounded-md shadow-lg py-1">
          {node.children.map(child => (
            <CategoryMenuItem key={child.path} node={child} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ 
  onSearch, 
  onDirectorySelected, 
  categoryTree, 
  onSelectCategory, 
  allTags,
  onSelectTag,
  onGoHome,
  libraries,
  activeLibrary,
  onSwitchLibrary,
  onManageLibraries,
  isPickerSupported,
  onToggleTheme,
  showUnsupported,
  onToggleUnsupported,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const libraryMenuRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const handleDirectoryPick = async () => {
    if (!isPickerSupported) {
      alert("The folder picker is not supported in this context (e.g., a sandboxed iframe). Please try adding a library from the main screen using drag and drop, or open this app in a new tab.");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      onDirectorySelected(handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error("Error picking directory:", err);
    }
  };
  
  const processHandle = useCallback(async (handle: FileSystemHandle | null) => {
    if (handle && handle.kind === 'directory') {
      onDirectorySelected(handle as FileSystemDirectoryHandle);
    }
  }, [onDirectorySelected]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      const item = event.dataTransfer.items[0];
      if (item.getAsFileSystemHandle) {
        const handle = await item.getAsFileSystemHandle();
        await processHandle(handle);
      }
    }
  }, [processHandle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) setIsCategoryOpen(false);
      if (libraryMenuRef.current && !libraryMenuRef.current.contains(event.target as Node)) setIsLibraryOpen(false);
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) setIsTagOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchActive) {
        searchInputRef.current?.focus();
    }
  }, [isSearchActive]);

  return (
    <header 
      className={`sticky top-0 z-40 bg-brand-black/50 backdrop-blur-lg border-b border-white/10 transition-colors duration-300 ${isDragging ? 'bg-brand-gray/50' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
    >
      <div className="p-4 flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <h1 onClick={onGoHome} className="text-xl md:text-3xl font-black text-brand-red cursor-pointer select-none tracking-tighter">Vault</h1>
          <nav className="hidden md:flex items-center space-x-6">
              <div className="relative" ref={libraryMenuRef}>
                 <button onClick={() => setIsLibraryOpen(prev => !prev)} className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors">
                   <span className="font-medium">{activeLibrary.name}</span>
                   <ChevronDownIcon className="w-5 h-5"/>
                 </button>
                 {isLibraryOpen && (
                   <div className="absolute top-full mt-2 w-64 bg-brand-light-gray rounded-md shadow-lg py-1 text-white">
                      {libraries.map(lib => (
                        <a href="#" key={lib.id} onClick={(e) => { e.preventDefault(); onSwitchLibrary(lib.id); setIsLibraryOpen(false); }} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-brand-gray">
                          {lib.name}
                          {lib.id === activeLibrary.id && <CheckIcon className="w-5 h-5 text-brand-red" />}
                        </a>
                      ))}
                      <div className="border-t border-brand-gray my-1"></div>
                      <a href="#" onClick={(e) => { e.preventDefault(); handleDirectoryPick(); setIsLibraryOpen(false); }} className="block px-4 py-2 text-sm hover:bg-brand-gray">Add New Library...</a>
                      <a href="#" onClick={(e) => { e.preventDefault(); onManageLibraries(); setIsLibraryOpen(false); }} className="block px-4 py-2 text-sm hover:bg-brand-gray">Manage Libraries...</a>
                   </div>
                 )}
              </div>
               <div className="relative" ref={categoryMenuRef}>
                 <button onClick={() => setIsCategoryOpen(prev => !prev)} className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors">
                   <span className="font-medium">Categories</span>
                   <ChevronDownIcon className="w-5 h-5"/>
                 </button>
                 {isCategoryOpen && categoryTree.length > 0 && (
                   <div className="absolute top-full mt-2 w-56 bg-brand-light-gray rounded-md shadow-lg py-1">
                     {categoryTree.map(node => (
                       <CategoryMenuItem key={node.path} node={node} onSelect={(path) => {
                         onSelectCategory(path);
                         setIsCategoryOpen(false);
                       }} />
                     ))}
                   </div>
                 )}
              </div>
              <div className="relative" ref={tagMenuRef}>
                 <button onClick={() => setIsTagOpen(prev => !prev)} className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors">
                   <span className="font-medium">Tags</span>
                   <ChevronDownIcon className="w-5 h-5"/>
                 </button>
                 {isTagOpen && (
                   <div className="absolute top-full mt-2 w-56 bg-brand-light-gray rounded-md shadow-lg py-1 max-h-96 overflow-y-auto">
                      {allTags.length > 0 ? allTags.map(tag => (
                        <a href="#" key={tag} onClick={(e) => { e.preventDefault(); onSelectTag(tag); setIsTagOpen(false); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-brand-gray">
                          {tag}
                        </a>
                      )) : (
                        <span className="block px-4 py-2 text-sm text-gray-400">No tags found</span>
                      )}
                   </div>
                 )}
              </div>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
            <button onClick={onToggleUnsupported} className="text-gray-300 hover:text-white transition-colors" title={showUnsupported ? "Hide unsupported files" : "Show unsupported files"}>
                {showUnsupported ? <EyeIcon className="w-6 h-6" /> : <EyeSlashIcon className="w-6 h-6" />}
            </button>
            <div className="flex items-center">
                {isSearchActive ? (
                    <input
                        ref={searchInputRef}
                        type="search"
                        placeholder="Search..."
                        onChange={e => onSearch(e.target.value)}
                        onBlur={() => setIsSearchActive(false)}
                        className="bg-transparent text-white placeholder-gray-500 rounded-md py-1 px-2 border-b border-brand-light-gray focus:outline-none w-32 md:w-48"
                    />
                ) : (
                    <button onClick={() => setIsSearchActive(true)} className="text-gray-300 hover:text-white transition-colors">
                        <SearchIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
            <button onClick={onToggleTheme} className="text-gray-300 hover:text-white transition-colors" title="Toggle Theme">
                <PaletteIcon className="w-6 h-6"/>
            </button>
        </div>
      </div>
    </header>
  );
};

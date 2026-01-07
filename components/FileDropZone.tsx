
import React, { useCallback, useState, useRef } from 'react';

interface FileDropZoneProps {
  onDirectorySelected: (handle: FileSystemDirectoryHandle | File[]) => void;
  isPickerSupported: boolean;
}

const FolderIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>);

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onDirectorySelected, isPickerSupported }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDirectoryPick = async () => {
    setError(null);
    if (!isPickerSupported) {
      // Fallback for Firefox/Safari
      fileInputRef.current?.click();
      return;
    }
    
    if (!window.showDirectoryPicker) {
      setError("Your browser doesn't support the modern Folder Picker. Please use the fallback selector.");
      fileInputRef.current?.click();
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      onDirectorySelected(handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error picking directory:", err);
        setError("Could not open directory. Please check permissions and try again.");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onDirectorySelected(Array.from(files));
    }
  };

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setError(null);

    const items = event.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      
      // 1. Try modern File System Access API
      if (item.getAsFileSystemHandle) {
        try {
          const handle = await item.getAsFileSystemHandle();
          if (handle && handle.kind === 'directory') {
            onDirectorySelected(handle as FileSystemDirectoryHandle);
            return;
          }
        } catch (err) {
          console.warn('Modern handle access failed, trying fallback...', err);
        }
      }

      // 2. Try webkitGetAsEntry (Firefox fallback)
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          // Since we can't easily convert a webkitEntry to a FileSystemDirectoryHandle 
          // in a cross-browser way that works in workers, we use the DataTransfer's files.
          const files = event.dataTransfer.files;
          if (files.length > 0) {
             onDirectorySelected(Array.from(files));
             return;
          }
        }
      }

      setError('Please drop a single folder, not individual files.');
    }
  }, [onDirectorySelected]);
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-brand-red mb-4 font-black tracking-tighter">Vault</h1>
        <p className="text-xl text-gray-300 mb-8">Your personal media vault. <br/> Secure. Private. Offline.</p>
        
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`border-4 border-dashed ${isDragging ? 'border-brand-red' : 'border-brand-light-gray'} rounded-2xl p-10 md:p-20 transition-all duration-300 bg-brand-gray/30 ${isDragging ? 'shadow-2xl shadow-brand-red-glow' : ''}`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <FolderIcon className="w-24 h-24 text-gray-400" />
            <p className="text-lg text-gray-300">Drag & Drop a folder to create your first library</p>
            <p className="text-gray-500">or</p>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInputChange} 
              className="hidden" 
              // @ts-ignore
              webkitdirectory="" 
              directory=""
            />
            
            <button
              onClick={handleDirectoryPick}
              className="bg-brand-red text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-red-700 transition-colors"
            >
              Select Media Folder
            </button>
            {!isPickerSupported && (
              <p className="text-xs text-yellow-500/80 px-4 max-w-xs">
                Note: In Firefox, libraries may not persist after a page refresh. For the full "Vault" experience, we recommend Chrome or Edge.
              </p>
            )}
          </div>
        </div>
        
        {error && (
          <p className="text-red-500 mt-4 bg-red-900/50 p-3 rounded-lg">{error}</p>
        )}
      </div>
    </div>
  );
};

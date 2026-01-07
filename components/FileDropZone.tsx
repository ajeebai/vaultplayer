
import React, { useCallback, useState, useRef } from 'react';

interface FileWithRelativePath extends File {
  webkitRelativePath: string;
}

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
      fileInputRef.current?.click();
      return;
    }
    
    if (!window.showDirectoryPicker) {
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

  // Helper to recurse through FileSystemEntry (Firefox/Legacy Drop)
  const traverseEntry = async (entry: any, path: string = ''): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          // We "mock" webkitRelativePath for the worker to parse
          Object.defineProperty(file, 'webkitRelativePath', {
            value: path ? `${path}/${file.name}` : file.name,
            writable: false
          });
          resolve([file]);
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        const allEntries: any[] = [];
        const readBatch = () => {
          reader.readEntries((results: any[]) => {
            if (results.length) {
              allEntries.push(...results);
              readBatch();
            } else {
              resolve(allEntries);
            }
          });
        };
        readBatch();
      });
      
      const newPath = path ? `${path}/${entry.name}` : entry.name;
      const files = await Promise.all(entries.map(e => traverseEntry(e, newPath)));
      return files.flat();
    }
    return [];
  };

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setError(null);

    const items = event.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      
      // 1. Try modern File System Access API (Chrome/Edge)
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

      // 2. Try webkitGetAsEntry (Firefox/Safari fallback)
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          const files = await traverseEntry(entry);
          if (files.length > 0) {
            onDirectorySelected(files);
            return;
          }
        }
      }

      // 3. Last resort fallback to standard file list (no subfolders)
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        onDirectorySelected(files);
        return;
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
              <p className="text-xs text-yellow-500/80 px-4 max-w-xs mt-4">
                Tip: In Firefox, dropped folders are fully supported. Note that libraries won't persist after a page refresh due to browser security restrictions.
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

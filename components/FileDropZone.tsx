
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
    if (isPickerSupported && window.showDirectoryPicker) {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'read' });
            onDirectorySelected(handle);
        } catch (err: any) {
            if (err.name !== 'AbortError') setError("Could not open directory.");
        }
    } else {
        // Fallback for Firefox
        fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          onDirectorySelected(Array.from(files));
      }
  };

  const traverseEntry = async (entry: any): Promise<File[]> => {
      const files: File[] = [];
      if (entry.isFile) {
          const file = await new Promise<File>((resolve) => entry.file(resolve));
          files.push(file);
      } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const entries = await new Promise<any[]>((resolve) => reader.readEntries(resolve));
          for (const child of entries) {
              const nestedFiles = await traverseEntry(child);
              files.push(...nestedFiles);
          }
      }
      return files;
  };

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setError(null);

    const items = event.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      if (item.getAsFileSystemHandle) {
        try {
          const handle = await item.getAsFileSystemHandle();
          if (handle?.kind === 'directory') onDirectorySelected(handle as FileSystemDirectoryHandle);
          else setError('Please drop a folder.');
        } catch (err) { setError('Access denied.'); }
      } else if (item.webkitGetAsEntry) {
          // Firefox Fallback for Drag and Drop
          const entry = item.webkitGetAsEntry();
          if (entry?.isDirectory) {
              const files = await traverseEntry(entry);
              onDirectorySelected(files);
          } else {
              setError('Please drop a folder.');
          }
      } else {
          setError("Your browser doesn't support folder selection.");
      }
    }
  }, [onDirectorySelected]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-brand-red mb-4 font-black tracking-tighter">Vault</h1>
        <p className="text-xl text-gray-300 mb-8">Secure. Private. Offline. <br/> Works in Firefox too.</p>
        
        <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileInputChange}
            // @ts-ignore - webkitdirectory is non-standard but required for Firefox/Safari folder selection
            webkitdirectory="true"
        />

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          className={`border-4 border-dashed ${isDragging ? 'border-brand-red shadow-2xl shadow-brand-red-glow' : 'border-brand-light-gray'} rounded-2xl p-10 md:p-20 transition-all duration-300 bg-brand-gray/30`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <FolderIcon className="w-24 h-24 text-gray-400" />
            <p className="text-lg text-gray-300">Drag & Drop a folder</p>
            <p className="text-gray-500">or</p>
            <button
              onClick={handleDirectoryPick}
              className="bg-brand-red text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-red-700 transition-colors"
            >
              Select Media Folder
            </button>
          </div>
        </div>

        {!isPickerSupported && (
          <p className="text-blue-400 mt-4 text-sm max-w-sm mx-auto">
            Vault is running in <strong>Compatibility Mode</strong>. Your library will be saved, but re-scanning requires re-selecting the folder.
          </p>
        )}
        
        {error && <p className="text-red-500 mt-4 bg-red-900/50 p-3 rounded-lg">{error}</p>}
      </div>
    </div>
  );
};

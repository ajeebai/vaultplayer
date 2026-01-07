
import React, { useCallback, useState } from 'react';

interface FileDropZoneProps {
  onDirectorySelected: (handle: FileSystemDirectoryHandle) => void;
  isPickerSupported: boolean;
}

const FolderIcon: React.FC<{className?: string}> = ({className}) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"></path></svg>);

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onDirectorySelected, isPickerSupported }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDirectoryPick = async () => {
    setError(null);
    if (!isPickerSupported) {
      setError("The folder picker is not supported in this browser or context (e.g., a sandboxed iframe). Please try dragging and dropping the folder instead.");
      return;
    }
    if (!window.showDirectoryPicker) {
      setError("Your browser doesn't support this feature. Please try a modern browser like Chrome or Edge.");
      return;
    }

    try {
      // Request read-only permissions.
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      onDirectorySelected(handle);
    } catch (err: any) {
      // AbortError is thrown when the user cancels the picker, so we can ignore it.
      if (err.name !== 'AbortError') {
        console.error("Error picking directory:", err);
        setError("Could not open directory. Please check permissions and try again.");
      }
    }
  };

  const processHandle = useCallback(async (handle: FileSystemHandle | null) => {
    if (handle && handle.kind === 'directory') {
      onDirectorySelected(handle as FileSystemDirectoryHandle);
    } else {
      setError('Please drop a single folder, not a file.');
    }
  }, [onDirectorySelected]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setError(null);

    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      const item = event.dataTransfer.items[0];
      // Use getAsFileSystemHandle if available for modern browsers
      if (item.getAsFileSystemHandle) {
        try {
          const handle = await item.getAsFileSystemHandle();
          await processHandle(handle);
        } catch (err) {
            console.error('Error getting file system handle:', err);
            setError('Could not access the dropped folder. This can happen with system-protected folders.');
        }
      } else {
        setError("Your browser doesn't fully support folder drag-and-drop. Please use the 'Select Folder' button if available.");
      }
    } else {
        setError('Could not read the dropped item. Please try again.');
    }
  }, [processHandle]);
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };
  
  const borderStyle = isDragging ? 'border-brand-red' : 'border-brand-light-gray';

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
          className={`border-4 border-dashed ${borderStyle} rounded-2xl p-10 md:p-20 transition-all duration-300 bg-brand-gray/30 ${isDragging ? 'shadow-2xl shadow-brand-red-glow' : ''}`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <FolderIcon className="w-24 h-24 text-gray-400" />
            <p className="text-lg text-gray-300">Drag & Drop a folder to create your first library</p>
            <p className="text-gray-500">or</p>
            <button
              onClick={handleDirectoryPick}
              disabled={!isPickerSupported}
              className="bg-brand-red text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Select Media Folder
            </button>
             <p className="text-xs text-gray-500 pt-2">Selecting a folder grants read permission to your media.</p>
          </div>
        </div>

        {!isPickerSupported && (
          <p className="text-yellow-400 mt-4 text-sm">
            The folder picker is disabled in this view. Please use drag & drop, or open Vault in its own browser tab.
          </p>
        )}
        
        {error && (
          <p className="text-red-500 mt-4 bg-red-900/50 p-3 rounded-lg">{error}</p>
        )}
      </div>
    </div>
  );
};

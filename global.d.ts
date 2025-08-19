// This file provides declarations for non-standard browser APIs
// to satisfy the TypeScript compiler.

/**
 * Augments the global Window interface to include `showDirectoryPicker`,
 * allowing for the selection of local directories.
 */
interface Window {
  showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
}

/**
 * Augments the DataTransferItem interface to include `getAsFileSystemHandle`,
 * enabling access to file system handles during drag-and-drop operations.
 */
interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
}

// Additions for File System Access API permissions
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}


// NOTE: It is assumed that base types like FileSystemHandle and FileSystemDirectoryHandle
// are already available in the project's TypeScript configuration (e.g., via "lib" in tsconfig.json).
// This is implied because they are used in other files without causing errors.

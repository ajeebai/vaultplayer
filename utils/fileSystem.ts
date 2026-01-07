
/**
 * Verifies and, if necessary, requests permission to read a file handle.
 * Safe for Firefox where FileSystemHandle is undefined.
 * @param handle The FileSystemHandle to check.
 * @param request A boolean indicating if the function is allowed to prompt the user for permission.
 * @returns {boolean} True if permission is granted, false otherwise.
 */
export async function verifyPermission(handle: any, request: boolean, mode: 'read' | 'readwrite' = 'read'): Promise<boolean> {
  // If it's a raw File or File array (legacy mode), we assume permission from the user selection
  // Note: In Firefox, File objects lose their backing data after a page refresh.
  if (handle instanceof File || Array.isArray(handle)) {
    // Basic check: if it's a File, try to check its size. If it's 0 and shouldn't be, it's likely "dead"
    if (handle instanceof File && handle.size === 0 && handle.name !== "") {
        return false; 
    }
    return true;
  }

  // Guard against browsers where FileSystemHandle is not globally available
  if (typeof FileSystemHandle === 'undefined') {
    return handle instanceof File || Array.isArray(handle); 
  }

  const options = { mode };
  
  try {
    // Check if it's actually a FileSystemHandle
    if (!(handle instanceof FileSystemHandle)) {
      return true;
    }

    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    
    if (request) {
      if ((await handle.requestPermission(options)) === 'granted') {
        return true;
      }
    }
  } catch (e) {
    console.error(`Error during permission check:`, e);
  }

  return false;
}


/**
 * Safely gets a File object from a FileSystemFileHandle, handling permissions.
 * @param fileHandle The FileSystemFileHandle for the desired file.
 * @returns {Promise<File>} A promise that resolves with the File object.
 */
export async function getFileWithPermission(fileHandle: any): Promise<File> {
    // If it's already a File object (Firefox fallback), just return it
    if (fileHandle instanceof File) {
      // In Firefox, persisted File objects might be "dead" after refresh.
      if (fileHandle.size === 0 && fileHandle.name !== "") {
          throw new Error('Local file access expired. Please re-select your folder.');
      }
      return fileHandle;
    }

    const hasPermission = await verifyPermission(fileHandle, false, 'read');
    if (!hasPermission) {
        throw new Error('Permission to read the file was denied.');
    }
    try {
        const file = await fileHandle.getFile();
        return file;
    } catch (err: any) {
        console.error("Error in getFile():", err);
        throw new Error(`Failed to access file. It might have been moved or deleted.`);
    }
}

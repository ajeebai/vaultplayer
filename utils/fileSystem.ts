
/**
 * Verifies and, if necessary, requests permission to read a file handle.
 * @param handle The FileSystemHandle to check.
 * @param request A boolean indicating if the function is allowed to prompt the user for permission.
 * @returns {boolean} True if permission is granted, false otherwise.
 */
export async function verifyPermission(handle: FileSystemHandle, request: boolean, mode: 'read' | 'readwrite' = 'read'): Promise<boolean> {
  const options = { mode };
  
  try {
    // Check if permission has already been granted
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    
    // If we can, request permission
    if (request) {
      if ((await handle.requestPermission(options)) === 'granted') {
        return true;
      }
    }
  } catch (e) {
    console.error(`Error during permission check (request=${request}, mode=${mode}):`, e);
    // This can happen in contexts like iframes where permission requests are not allowed.
    // In such cases, we assume permission is not available.
  }

  // Permission not granted or could not be checked/requested
  return false;
}


/**
 * Safely gets a File object from a FileSystemFileHandle, handling permissions.
 * @param fileHandle The FileSystemFileHandle for the desired file.
 * @returns {Promise<File>} A promise that resolves with the File object.
 * @throws Will throw an error if permission is denied or the file cannot be accessed.
 */
export async function getFileWithPermission(fileHandle: FileSystemFileHandle): Promise<File> {
    const hasPermission = await verifyPermission(fileHandle, false, 'read');
    if (!hasPermission) {
        throw new Error('Permission to read the file was denied or is not available in this context. Try re-granting access in the library manager.');
    }
    try {
        const file = await fileHandle.getFile();
        return file;
    } catch (err: any) {
        console.error("Error in getFile():", err);
        throw new Error(`Failed to get file: ${err.message}`);
    }
}

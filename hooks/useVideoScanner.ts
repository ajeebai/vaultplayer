
import { useRef, useCallback, useEffect } from 'react';
import { MediaDB, VideoFile } from '../services/db';

const workerCode = `
  const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'm4v', 'ts', 'm2ts', 'mpg'];
  const SUBTITLE_EXTENSIONS = ['srt', 'vtt'];

  async function* getFileHandlesRecursively(directoryHandle) {
    for await (const handle of directoryHandle.values()) {
        if (handle.kind === 'file') {
            yield { handle, path: [handle.name] };
        } else if (handle.kind === 'directory') {
            if (handle.name.startsWith('.')) continue; // Ignore hidden folders
            for await (const { handle: nestedHandle, path: nestedPath } of getFileHandlesRecursively(handle)) {
                yield { handle: nestedHandle, path: [handle.name, ...nestedPath] };
            }
        }
    }
  }

  self.onmessage = async (event) => {
    const { dirHandle, files, libraryId, existingPaths } = event.data;
    const isRefresh = Array.isArray(existingPaths);
    const existingPathsSet = new Set(existingPaths);
    const mediaFilesMap = new Map();

    postMessage({ type: 'progress', payload: { progress: 0, message: 'Discovering files...' } });
    
    try {
        if (dirHandle) {
            // Modern File System Access API path
            for await (const { handle, path } of getFileHandlesRecursively(dirHandle)) {
                const fileName = handle.name;
                if (fileName.startsWith('.')) continue;

                const extension = fileName.split('.').pop().toLowerCase();
                const fullPath = path.join('/');
                const fileKey = fullPath.substring(0, fullPath.lastIndexOf('.'));

                if (VIDEO_EXTENSIONS.includes(extension)) {
                    const entry = mediaFilesMap.get(fileKey) || { subtitles: [] };
                    entry.mediaHandle = handle;
                    entry.path = path;
                    mediaFilesMap.set(fileKey, entry);
                } else if (SUBTITLE_EXTENSIONS.includes(extension)) {
                    const entry = mediaFilesMap.get(fileKey) || { subtitles: [] };
                    entry.subtitles.push(handle);
                    mediaFilesMap.set(fileKey, entry);
                }
            }
        } else if (files) {
            // Legacy / Firefox path (FileList converted to Array of objects)
            for (const fileData of files) {
                const fullPath = fileData.webkitRelativePath || fileData.name;
                const pathParts = fullPath.split('/');
                const fileName = pathParts[pathParts.length - 1];
                
                if (fileName.startsWith('.')) continue;

                const extension = fileName.split('.').pop().toLowerCase();
                // Strip the root folder name from the webkitRelativePath for consistency
                const pathSegments = pathParts.slice(1);
                const relativePath = pathSegments.join('/'); 
                const fileKey = relativePath.substring(0, relativePath.lastIndexOf('.'));

                if (VIDEO_EXTENSIONS.includes(extension)) {
                    const entry = mediaFilesMap.get(fileKey) || { subtitles: [] };
                    entry.mediaHandle = fileData; // This is the actual File object
                    entry.path = pathSegments;
                    mediaFilesMap.set(fileKey, entry);
                } else if (SUBTITLE_EXTENSIONS.includes(extension)) {
                    const entry = mediaFilesMap.get(fileKey) || { subtitles: [] };
                    entry.subtitles.push(fileData);
                    mediaFilesMap.set(fileKey, entry);
                }
            }
        }
    } catch (e) {
        console.error('Error scanning directory:', e);
        postMessage({ type: 'error', payload: 'Failed to read directory contents.' });
        return;
    }
    
    const discoveredEntries = Array.from(mediaFilesMap.values()).filter(v => v.mediaHandle);

    if (isRefresh) {
        const discoveredPaths = new Set(discoveredEntries.map(entry => entry.path.join('/')));
        const deletedPaths = existingPaths.filter(path => !discoveredPaths.has(path));

        if (deletedPaths.length > 0) {
            postMessage({ type: 'deleted_paths', payload: deletedPaths, libraryId });
        }
    }
    
    const newEntries = isRefresh 
        ? discoveredEntries.filter(entry => !existingPathsSet.has(entry.path.join('/')))
        : discoveredEntries;

    if (newEntries.length > 0) {
        postMessage({ type: 'discovered', payload: newEntries, libraryId });
    } else if (discoveredEntries.length === 0) {
        postMessage({ type: 'progress', payload: { progress: 100, message: 'No new video files found.' } });
        postMessage({ type: 'complete', payload: null });
    } else if (isRefresh) {
        postMessage({ type: 'progress', payload: { progress: 100, message: 'Library is up to date.' } });
        postMessage({ type: 'complete', payload: null });
    }
  };
`;

export const useVideoScanner = (onUpdate: (update: { type: string; payload: any }) => void) => {
  const workerRef = useRef<Worker | null>(null);
  const libraryIdRef = useRef<string | null>(null);
  const priorityQueueRef = useRef<VideoFile[]>([]);
  const queuedPriorityPathsRef = useRef<Set<string>>(new Set());
  const updatesAccumulatorRef = useRef<VideoFile[]>([]);
  
  const prioritizeMedia = useCallback((media: VideoFile) => {
    if (media.isPlayable === undefined && !queuedPriorityPathsRef.current.has(media.fullPath)) {
        priorityQueueRef.current.push(media);
        queuedPriorityPathsRef.current.add(media.fullPath);
    }
  }, []);

  const processMediaQueue = useCallback(async (mediaToProcess: VideoFile[]) => {
    if (mediaToProcess.length === 0) {
        onUpdate({ type: 'complete', payload: null });
        return;
    }
    
    const db = new MediaDB();
    const regularQueue = [...mediaToProcess];
    const totalCount = regularQueue.length;
    let processedCount = 0;

    onUpdate({ type: 'progress', payload: { progress: 0, message: `Processing ${totalCount} files...` } });

    const MAX_CONCURRENT_PROCESSORS = Math.max(2, (navigator.hardwareConcurrency || 4) - 1);
    const BATCH_SIZE = 50;

    const processVideo = async (videoFile: VideoFile): Promise<VideoFile | null> => {
        const video = document.createElement('video');
        video.muted = true;
        video.crossOrigin = "anonymous";
        video.preload = 'metadata';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        try {
            // SAFE HANDLE CHECK FOR FIREFOX:
            // Check if it's a handle (Chrome) or a raw File (Firefox)
            let file: File;
            if (typeof FileSystemHandle !== 'undefined' && videoFile.fileHandle instanceof FileSystemHandle) {
              file = await (videoFile.fileHandle as FileSystemFileHandle).getFile();
            } else {
              file = videoFile.fileHandle as unknown as File;
            }
            
            const result = await new Promise<{
                metadata: { duration: number; width: number; height: number } | null;
                poster: Blob | null;
                isError?: boolean;
                errorDetails?: { code?: number; message?: string };
            }>((resolve) => {
                const objectUrl = URL.createObjectURL(file);
                video.src = objectUrl;
                const cleanup = () => { URL.revokeObjectURL(objectUrl); video.removeAttribute('src'); video.load(); };
                const timeoutId = setTimeout(() => { cleanup(); resolve({ metadata: null, poster: null, isError: true, errorDetails: { message: 'Processing timed out.' } }); }, 15000);
                let metadataResult: { duration: number; width: number; height: number } | null = null;
                video.onloadedmetadata = () => { metadataResult = { duration: video.duration, width: video.videoWidth, height: video.videoHeight }; };
                video.onseeked = () => {
                    if (!ctx || video.videoWidth === 0) { clearTimeout(timeoutId); cleanup(); resolve({ metadata: metadataResult, poster: null }); return; }
                    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                    canvas.toBlob((blob) => { clearTimeout(timeoutId); cleanup(); resolve({ metadata: metadataResult, poster: blob }); }, 'image/jpeg', 0.8);
                };
                video.onloadeddata = () => {
                    if (!isFinite(video.duration) || video.duration <= 0) { clearTimeout(timeoutId); cleanup(); resolve({ metadata: metadataResult, poster: null }); return; }
                    video.currentTime = Math.min(video.duration * 0.1, 10);
                };
                video.onerror = () => {
                    const errorDetails = { code: video.error?.code, message: video.error?.message };
                    clearTimeout(timeoutId); cleanup(); resolve({ metadata: metadataResult, poster: null, isError: true, errorDetails }); 
                };
            });

            return { 
                ...videoFile, 
                poster: result.poster ?? undefined, 
                duration: result.metadata?.duration, 
                width: result.metadata?.width, 
                height: result.metadata?.height, 
                size: file.size, 
                lastModified: file.lastModified, 
                isPlayable: !result.isError,
                unsupportedReason: result.errorDetails,
             };
        } catch (e) {
            console.error("Process error:", e);
            return { ...videoFile, isPlayable: false };
        } finally {
            video.remove();
            canvas.remove();
        }
    };

    const workerTask = async () => {
        while (priorityQueueRef.current.length > 0 || regularQueue.length > 0) {
            const media = priorityQueueRef.current.shift() || regularQueue.shift();
            if (media) {
                if(queuedPriorityPathsRef.current.has(media.fullPath)) {
                    queuedPriorityPathsRef.current.delete(media.fullPath);
                }
                const processedMedia = await processVideo(media);
                if (processedMedia) {
                  await db.addMedia(processedMedia);
                  updatesAccumulatorRef.current.push(processedMedia);
                }
                
                processedCount++;
                
                if (updatesAccumulatorRef.current.length >= BATCH_SIZE) {
                  onUpdate({ type: 'update_files', payload: [...updatesAccumulatorRef.current] });
                  updatesAccumulatorRef.current = [];
                }
                onUpdate({ type: 'progress', payload: { progress: (processedCount / totalCount) * 100, message: `Processing... (${processedCount}/${totalCount})` } });
            }
        }
    };

    await Promise.all(Array.from({ length: MAX_CONCURRENT_PROCESSORS }, () => workerTask()));

    if (updatesAccumulatorRef.current.length > 0) {
      onUpdate({ type: 'update_files', payload: [...updatesAccumulatorRef.current] });
      updatesAccumulatorRef.current = [];
    }

    onUpdate({ type: 'complete', payload: null });
  }, [onUpdate]);

  const handleWorkerMessage = useCallback(async (event: MessageEvent) => {
    const { type, payload, libraryId: msgLibraryId } = event.data;
    const libraryId = msgLibraryId || libraryIdRef.current;
    if (!libraryId) return;
    const db = new MediaDB();

    switch (type) {
      case 'progress':
        onUpdate({ type, payload });
        break;
      case 'deleted_paths':
        await db.deleteMediaByPath(libraryId, payload);
        onUpdate({ type: 'deleted_files', payload });
        break;
      case 'discovered':
        const now = Date.now();
        const initialMedia = payload.map((item: any): VideoFile => {
            const { mediaHandle, subtitles: subtitleHandles, path } = item;
            const fullPath = path.join('/');
            
            return {
              libraryId,
              fullPath,
              name: mediaHandle.name,
              parentPath: path.slice(0, -1).join('/'),
              fileHandle: mediaHandle,
              isFavorite: false,
              tags: [],
              subtitles: (subtitleHandles || []).map((subHandle: any) => {
                  const sName = subHandle.name || '';
                  const langMatch = sName.match(/\.([a-zA-Z]{2,3})\.(srt|vtt)$/i);
                  const lang = langMatch ? langMatch[1].toLowerCase() : 'en';
                  return { name: sName, lang, fileHandle: subHandle };
              }),
              size: mediaHandle.size || 0,
              lastModified: mediaHandle.lastModified || 0,
              dateAdded: now,
            };
        });
        
        await db.addManyMedia(initialMedia);
        processMediaQueue(initialMedia);
        break;
      case 'error':
        onUpdate({ type, payload });
        break;
    }
  }, [onUpdate, processMediaQueue]);

  useEffect(() => {
    try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = handleWorkerMessage;
        workerRef.current = worker;
        return () => { worker.terminate(); }
    } catch(e) { console.error("Worker error:", e); }
  }, [handleWorkerMessage]);

  const startScan = useCallback((dirHandle: FileSystemDirectoryHandle | File[] | null, libraryId: string, existingMedia: VideoFile[] = []) => {
    if (workerRef.current) {
      libraryIdRef.current = libraryId;
      const existingPaths = existingMedia.map(v => v.fullPath);
      
      if (Array.isArray(dirHandle)) {
        workerRef.current.postMessage({ files: dirHandle, libraryId, existingPaths });
      } else if (dirHandle) {
        workerRef.current.postMessage({ dirHandle, libraryId, existingPaths });
      }
    }
  }, []);

  const startProcessingUnprocessed = useCallback(async (libraryId: string) => {
    const db = new MediaDB();
    const allMedia = await db.getAllMedia(libraryId);
    const unprocessed = allMedia.filter(v => v.isPlayable === undefined);
    if (unprocessed.length > 0) {
        processMediaQueue(unprocessed);
    }
  }, [processMediaQueue]);

  return { startScan, startProcessingUnprocessed, prioritizeMedia };
};

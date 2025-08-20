
import { useRef, useCallback, useEffect } from 'react';
import { MediaDB, VideoFile } from '../services/db';

const workerCode = `
  const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'm4v', 'avi', 'ts', 'm2ts', 'mpg'];
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
    const { dirHandle, libraryId, existingPaths } = event.data;
    const isRefresh = Array.isArray(existingPaths);
    const existingPathsSet = new Set(existingPaths);
    const mediaFilesMap = new Map();

    postMessage({ type: 'progress', payload: { progress: 0, message: 'Discovering files...' } });
    
    try {
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
    } catch (e) {
        console.error('Error scanning directory:', e);
        postMessage({ type: 'error', payload: 'Failed to read directory contents. Check permissions.' });
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

  const prioritizeMedia = useCallback((media: VideoFile) => {
    // Only prioritize if it's unprocessed and not already in the priority queue
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

    const MAX_CONCURRENT_PROCESSORS = Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2));
    const updatesBatch: VideoFile[] = [];

    const processVideo = async (videoFile: VideoFile): Promise<VideoFile | null> => {
        const video = document.createElement('video');
        video.muted = true;
        video.crossOrigin = "anonymous";
        video.preload = 'metadata';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        try {
            const file = await videoFile.fileHandle.getFile();
            const result = await new Promise<{
                metadata: { duration: number; width: number; height: number } | null;
                poster: Blob | null;
                isError?: boolean;
            }>((resolve) => {
                const objectUrl = URL.createObjectURL(file);
                video.src = objectUrl;
                const cleanup = () => { URL.revokeObjectURL(objectUrl); video.removeAttribute('src'); video.load(); };
                const timeoutId = setTimeout(() => { cleanup(); resolve({ metadata: null, poster: null, isError: true }); }, 10000);
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
                    video.currentTime = isFinite(video.duration * 0.1) ? video.duration * 0.1 : 0;
                };
                video.onerror = () => { clearTimeout(timeoutId); cleanup(); resolve({ metadata: metadataResult, poster: null, isError: true }); };
            });

            return { ...videoFile, poster: result.poster ?? undefined, duration: result.metadata?.duration, width: result.metadata?.width, height: result.metadata?.height, size: file.size, lastModified: file.lastModified, isPlayable: !result.isError };
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
                  updatesBatch.push(processedMedia);
                }
                
                processedCount++;
                if (updatesBatch.length >= 20 || ((priorityQueueRef.current.length === 0 && regularQueue.length === 0) && updatesBatch.length > 0)) {
                    onUpdate({ type: 'update_files', payload: [...updatesBatch] });
                    updatesBatch.length = 0;
                }
                onUpdate({ type: 'progress', payload: { progress: (processedCount / totalCount) * 100, message: `Processing... (${processedCount}/${totalCount})` } });
            }
        }
    };

    await Promise.all(Array.from({ length: MAX_CONCURRENT_PROCESSORS }, () => workerTask()));

    onUpdate({ type: 'complete', payload: null });
  }, [onUpdate]);

  const handleWorkerMessage = useCallback(async (event: MessageEvent) => {
    const { type, payload, libraryId: msgLibraryId } = event.data;
    const libraryId = msgLibraryId || libraryIdRef.current;
    if (!libraryId) {
        console.error("Scanner message received without libraryId.");
        return;
    }
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
              subtitles: (subtitleHandles || []).map((subHandle: FileSystemFileHandle) => {
                  const langMatch = subHandle.name.match(/\.([a-zA-Z]{2,3})\.(srt|vtt)$/i);
                  const lang = langMatch ? langMatch[1].toLowerCase() : 'en';
                  return { name: subHandle.name, lang, fileHandle: subHandle };
              }),
              size: 0,
              lastModified: 0,
            };
        });
        
        await db.addManyMedia(initialMedia);
        onUpdate({ type: 'initial_files', payload: initialMedia });
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
        return () => {
            worker.terminate();
        }
    } catch(e) {
        console.error("Failed to create worker", e);
    }
  }, [handleWorkerMessage]);

  const startScan = useCallback((dirHandle: FileSystemDirectoryHandle, libraryId: string, existingMedia: VideoFile[] = []) => {
    if (workerRef.current) {
      libraryIdRef.current = libraryId;
      const existingPaths = existingMedia.map(v => v.fullPath);
      workerRef.current.postMessage({ dirHandle, libraryId, existingPaths });
    }
  }, []);

  const startProcessingUnprocessed = useCallback(async (libraryId: string) => {
    const db = new MediaDB();
    const allMedia = await db.getAllMedia(libraryId);
    const unprocessed = allMedia.filter(v => v.isPlayable === undefined);
    if (unprocessed.length > 0) {
        console.log(`Resuming processing for ${unprocessed.length} files.`);
        processMediaQueue(unprocessed);
    }
  }, [processMediaQueue]);

  return { startScan, startProcessingUnprocessed, prioritizeMedia };
};
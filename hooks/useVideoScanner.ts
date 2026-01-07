
import { useRef, useCallback, useEffect } from 'react';
import { MediaDB, VideoFile } from '../services/db';

// This worker is used for heavy-duty recursion only when showDirectoryPicker is available (Chrome/Edge).
// For Firefox, we use the main-thread discovery to avoid "dead" File reference issues.
const workerCode = `
  const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'm4v', 'ts', 'm2ts', 'mpg'];
  const SUBTITLE_EXTENSIONS = ['srt', 'vtt'];

  async function* getFileHandlesRecursively(directoryHandle) {
    for await (const handle of directoryHandle.values()) {
        if (handle.kind === 'file') {
            yield { handle, path: [handle.name] };
        } else if (handle.kind === 'directory') {
            if (handle.name.startsWith('.')) continue;
            for await (const { handle: nestedHandle, path: nestedPath } of getFileHandlesRecursively(handle)) {
                yield { handle: nestedHandle, path: [handle.name, ...nestedPath] };
            }
        }
    }
  }

  self.onmessage = async (event) => {
    const { dirHandle, libraryId, existingPaths } = event.data;
    const existingPathsSet = new Set(existingPaths || []);
    const mediaFilesMap = new Map();

    try {
        for await (const { handle, path } of getFileHandlesRecursively(dirHandle)) {
            const fileName = handle.name;
            const parts = fileName.split('.');
            const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';
            const fullPath = path.join('/');
            const fileKey = fullPath.includes('.') ? fullPath.substring(0, fullPath.lastIndexOf('.')) : fullPath;

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
        
        const discovered = Array.from(mediaFilesMap.values()).filter(v => v.mediaHandle);
        const newEntries = discovered.filter(entry => !existingPathsSet.has(entry.path.join('/')));
        
        postMessage({ type: 'discovered', payload: newEntries, libraryId });
    } catch (e) {
        postMessage({ type: 'error', payload: e.message });
    }
  };
`;

export const useVideoScanner = (onUpdate: (update: { type: string; payload: any }) => void) => {
  const workerRef = useRef<Worker | null>(null);
  const isScanningRef = useRef(false);
  const updatesAccumulatorRef = useRef<VideoFile[]>([]);
  const db = new MediaDB();

  const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'webm', 'm4v', 'ts', 'm2ts', 'mpg'];
  const SUBTITLE_EXTENSIONS = ['srt', 'vtt'];

  const processVideo = async (videoFile: VideoFile): Promise<VideoFile | null> => {
    const video = document.createElement('video');
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.preload = 'metadata';
    
    try {
        let file: File;
        if (typeof FileSystemHandle !== 'undefined' && videoFile.fileHandle instanceof FileSystemHandle) {
          file = await (videoFile.fileHandle as FileSystemFileHandle).getFile();
        } else {
          file = videoFile.fileHandle as unknown as File;
        }

        if (file.size === 0 && file.name !== "") return { ...videoFile, isPlayable: false };

        return await new Promise<VideoFile>((resolve) => {
            const objectUrl = URL.createObjectURL(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const cleanup = () => { URL.revokeObjectURL(objectUrl); video.removeAttribute('src'); video.load(); video.remove(); canvas.remove(); };
            const timeout = setTimeout(() => { cleanup(); resolve({ ...videoFile, isPlayable: false }); }, 5000);

            video.onloadedmetadata = () => {
                video.currentTime = Math.min(video.duration * 0.1, 5);
            };

            video.onseeked = () => {
                clearTimeout(timeout);
                if (ctx && video.videoWidth > 0) {
                    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    canvas.toBlob((blob) => {
                        const result = {
                            ...videoFile,
                            duration: video.duration,
                            width: video.videoWidth,
                            height: video.videoHeight,
                            poster: blob || undefined,
                            isPlayable: true
                        };
                        cleanup();
                        resolve(result);
                    }, 'image/jpeg', 0.7);
                } else {
                    cleanup(); resolve({ ...videoFile, isPlayable: true });
                }
            };

            video.onerror = () => { clearTimeout(timeout); cleanup(); resolve({ ...videoFile, isPlayable: false }); };
            video.src = objectUrl;
        });
    } catch (e) {
        return { ...videoFile, isPlayable: false };
    }
  };

  const processMediaQueue = async (mediaFiles: VideoFile[]) => {
    isScanningRef.current = true;
    const total = mediaFiles.length;
    let count = 0;

    for (const item of mediaFiles) {
      if (!isScanningRef.current) break;
      const processed = await processVideo(item);
      if (processed) {
        await db.addMedia(processed);
        updatesAccumulatorRef.current.push(processed);
        if (updatesAccumulatorRef.current.length >= 10) {
          onUpdate({ type: 'update_files', payload: [...updatesAccumulatorRef.current] });
          updatesAccumulatorRef.current = [];
        }
      }
      count++;
      onUpdate({ type: 'progress', payload: { progress: (count / total) * 100, message: `Processing ${count}/${total}...` } });
    }

    if (updatesAccumulatorRef.current.length > 0) {
      onUpdate({ type: 'update_files', payload: [...updatesAccumulatorRef.current] });
      updatesAccumulatorRef.current = [];
    }
    onUpdate({ type: 'complete', payload: null });
    isScanningRef.current = false;
  };

  const scanMainThread = async (files: File[], libraryId: string, existingPaths: string[]) => {
    onUpdate({ type: 'progress', payload: { progress: 0, message: 'Analyzing local files...' } });
    const existingPathsSet = new Set(existingPaths);
    const mediaFilesMap = new Map();

    for (const file of files) {
        const fullPath = file.webkitRelativePath || file.name;
        const parts = fullPath.split('/').filter(p => p !== '');
        const pathSegments = parts.length > 1 ? parts.slice(1) : parts;
        const fileName = pathSegments[pathSegments.length - 1];
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const fileKey = pathSegments.join('/').replace(/\.[^/.]+$/, "");

        if (VIDEO_EXTENSIONS.includes(ext)) {
            const entry = mediaFilesMap.get(fileKey) || { subtitles: [] };
            entry.mediaHandle = file;
            entry.path = pathSegments;
            mediaFilesMap.set(fileKey, entry);
        } else if (SUBTITLE_EXTENSIONS.includes(ext)) {
            const entry = mediaFilesMap.get(fileKey) || { subtitles: [] };
            entry.subtitles.push(file);
            mediaFilesMap.set(fileKey, entry);
        }
    }

    const discovered = Array.from(mediaFilesMap.values()).filter((v: any) => v.mediaHandle);
    const newItems = discovered.filter((entry: any) => !existingPathsSet.has(entry.path.join('/')));
    
    if (newItems.length > 0) {
        const now = Date.now();
        const initial = newItems.map((item: any): VideoFile => ({
            libraryId,
            fullPath: item.path.join('/'),
            name: item.mediaHandle.name,
            parentPath: item.path.slice(0, -1).join('/'),
            fileHandle: item.mediaHandle,
            isFavorite: false,
            tags: [],
            subtitles: item.subtitles.map((s: File) => ({ name: s.name, lang: 'en', fileHandle: s })),
            size: item.mediaHandle.size,
            lastModified: item.mediaHandle.lastModified,
            dateAdded: now
        }));
        await db.addManyManyMedia(initial);
        processMediaQueue(initial);
    } else {
        onUpdate({ type: 'complete', payload: null });
    }
  };

  const handleWorkerMessage = useCallback(async (event: MessageEvent) => {
    const { type, payload, libraryId } = event.data;
    if (type === 'discovered') {
      const now = Date.now();
      const initial = payload.map((item: any): VideoFile => ({
        libraryId,
        fullPath: item.path.join('/'),
        name: item.mediaHandle.name,
        parentPath: item.path.slice(0, -1).join('/'),
        fileHandle: item.mediaHandle,
        isFavorite: false,
        tags: [],
        subtitles: item.subtitles.map((s: any) => ({ name: s.name, lang: 'en', fileHandle: s })),
        size: item.mediaHandle.size || 0,
        lastModified: item.mediaHandle.lastModified || 0,
        dateAdded: now
      }));
      await db.addManyManyMedia(initial);
      processMediaQueue(initial);
    } else if (type === 'error') {
      onUpdate({ type: 'error', payload });
    }
  }, [onUpdate]);

  useEffect(() => {
    if (typeof Worker !== 'undefined') {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        worker.onmessage = handleWorkerMessage;
        workerRef.current = worker;
        return () => worker.terminate();
    }
  }, [handleWorkerMessage]);

  const startScan = useCallback((dirHandle: FileSystemDirectoryHandle | File[] | null, libraryId: string, existingMedia: VideoFile[] = []) => {
    const existingPaths = existingMedia.map(v => v.fullPath);
    if (Array.isArray(dirHandle)) {
        scanMainThread(dirHandle, libraryId, existingPaths);
    } else if (dirHandle && workerRef.current) {
        workerRef.current.postMessage({ dirHandle, libraryId, existingPaths });
    } else {
        onUpdate({ type: 'complete', payload: null });
    }
  }, [onUpdate]);

  const startProcessingUnprocessed = useCallback(async (libraryId: string) => {
    const all = await db.getAllMedia(libraryId);
    const unprocessed = all.filter(v => v.isPlayable === undefined);
    if (unprocessed.length > 0) processMediaQueue(unprocessed);
    else onUpdate({ type: 'complete', payload: null });
  }, [onUpdate]);

  return { startScan, startProcessingUnprocessed, prioritizeMedia: () => {} };
};


import { openDB, IDBPDatabase } from 'idb';

export interface MediaFile {
  libraryId: string;
  fullPath: string;
  name: string;
  parentPath: string;
  fileHandle: FileSystemFileHandle;
  size: number;
  lastModified: number;
  isFavorite?: boolean;
  isHidden?: boolean;
  tags?: string[];
}

export interface VideoFile extends MediaFile {
  poster?: Blob;
  duration?: number;
  width?: number;
  height?: number;
  playbackPosition?: number;
  lastWatched?: Date;
  subtitles: { name: string; lang: string; fileHandle: FileSystemFileHandle }[];
  isPlayable?: boolean;
  unsupportedReason?: {
    code?: number;
    message?: string;
  };
}

// Internal types for DB stores
interface LibraryVideo {
  libraryId: string;
  fullPath: string;
  name: string;
  parentPath: string;
  fileHandle: FileSystemFileHandle;
  size: number;
  lastModified: number;
  playbackPosition?: number;
  lastWatched?: Date;
  subtitles: { name: string; lang: string; fileHandle: FileSystemFileHandle }[];
  isPlayable?: boolean;
  unsupportedReason?: {
    code?: number;
    message?: string;
  };
  mediaKey: string;
}

interface MediaMetadata {
  mediaKey: string;
  poster?: Blob;
  duration?: number;
  width?: number;
  height?: number;
  tags?: string[];
  isFavorite?: boolean;
  isHidden?: boolean;
}


const DB_NAME = 'LocalFlixDB';
const DB_VERSION = 4; // Version remains the same, as we're adding a field, not changing schema structure
const VIDEO_STORE_NAME = 'library_videos';
const METADATA_STORE_NAME = 'media_metadata';
const STATE_STORE_NAME = 'app_state';

const generateMediaKey = (media: { name: string, size: number, lastModified: number }): string => {
  // Use file name, size, and last modified date to create a unique enough key for content identification.
  return `${media.name}|${media.size}|${media.lastModified}`;
};

export class MediaDB {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        const v3StoreName = 'videos';

        // From v1 to v2: create 'videos' store
        if (oldVersion < 2 && !db.objectStoreNames.contains(v3StoreName)) {
            db.createObjectStore(v3StoreName, { keyPath: 'fullPath' });
        }
        // Always ensure app_state store exists
        if (!db.objectStoreNames.contains(STATE_STORE_NAME)) {
            db.createObjectStore(STATE_STORE_NAME);
        }
        // From v2 to v3: change 'videos' store keypath, which is destructive
        if (oldVersion < 3) {
            if(db.objectStoreNames.contains(v3StoreName)) {
                db.deleteObjectStore(v3StoreName);
            }
            db.createObjectStore(v3StoreName, { keyPath: ['libraryId', 'fullPath'] });
        }
        // From v3 to v4: split 'videos' into 'library_videos' and 'media_metadata', also destructive
        if (oldVersion < 4) {
            if(db.objectStoreNames.contains(v3StoreName)) {
                db.deleteObjectStore(v3StoreName);
            }
            if(!db.objectStoreNames.contains(VIDEO_STORE_NAME)){
                const store = db.createObjectStore(VIDEO_STORE_NAME, { keyPath: ['libraryId', 'fullPath'] });
                // Add an index on mediaKey if it doesn't exist. This is for v4 migration.
                if (!store.indexNames.contains('mediaKey')) {
                    store.createIndex('mediaKey', 'mediaKey', { unique: false });
                }
            }
            if(!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
                db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'mediaKey' });
            }
        }
      },
    });
  }
  
  async getAppState<T>(key: string): Promise<T | undefined> {
    const db = await this.dbPromise;
    return db.get(STATE_STORE_NAME, key);
  }

  async setAppState(key: string, value: any): Promise<void> {
    const db = await this.dbPromise;
    if (value === null || value === undefined) {
        await db.delete(STATE_STORE_NAME, key);
    } else {
        await db.put(STATE_STORE_NAME, value, key);
    }
  }

  async addMedia(media: VideoFile): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction([VIDEO_STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE_NAME);
    const metadataStore = tx.objectStore(METADATA_STORE_NAME);
    
    const mediaKey = generateMediaKey(media);
    const { poster, duration, width, height, tags, isFavorite, isHidden, ...libraryData } = media;

    const libraryMedia: Omit<LibraryVideo, 'mediaKey'> & { mediaKey?: string } = libraryData;
    libraryMedia.mediaKey = mediaKey;

    const existingMetadata = await metadataStore.get(mediaKey) as MediaMetadata | undefined;
    
    const newMetadata: MediaMetadata = {
        mediaKey,
        poster: poster ?? existingMetadata?.poster,
        duration: duration ?? existingMetadata?.duration,
        width: width ?? existingMetadata?.width,
        height: height ?? existingMetadata?.height,
        // Prioritize incoming tags, but fall back to existing to preserve user edits.
        tags: tags ?? existingMetadata?.tags ?? [],
        // Preserve existing favorite status unless a new one is provided.
        isFavorite: isFavorite ?? existingMetadata?.isFavorite ?? false,
        isHidden: isHidden ?? existingMetadata?.isHidden ?? false,
    };
    
    await metadataStore.put(newMetadata);
    await videoStore.put(libraryMedia);
    
    await tx.done;
  }

  async addManyMedia(mediaFiles: VideoFile[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction([VIDEO_STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE_NAME);
    const metadataStore = tx.objectStore(METADATA_STORE_NAME);
    
    for (const media of mediaFiles) {
        const mediaKey = generateMediaKey(media);
        const { poster, duration, width, height, tags, isFavorite, isHidden, ...libraryData } = media;
        
        const libraryMedia: Omit<LibraryVideo, 'mediaKey'> & { mediaKey?: string } = libraryData;
        libraryMedia.mediaKey = mediaKey;

        await videoStore.put(libraryMedia);

        // Add a skeleton metadata object to ensure data consistency from the start.
        // This prevents a race condition where a video exists in one store but not the other.
        const existingMeta = await metadataStore.get(mediaKey);
        if (!existingMeta) {
            const skeletonMetadata: MediaMetadata = { mediaKey };
            await metadataStore.put(skeletonMetadata);
        }
    }
    
    await tx.done;
  }

  async getMedia(libraryId: string, fullPath: string): Promise<VideoFile | undefined> {
    const db = await this.dbPromise;
    const tx = db.transaction([VIDEO_STORE_NAME, METADATA_STORE_NAME], 'readonly');
    const videoStore = tx.objectStore(VIDEO_STORE_NAME);
    const metadataStore = tx.objectStore(METADATA_STORE_NAME);

    const libraryMedia = await videoStore.get([libraryId, fullPath]) as LibraryVideo | undefined;
    if (!libraryMedia) return undefined;
    
    const metadata = await metadataStore.get(libraryMedia.mediaKey) as MediaMetadata | undefined;
    
    return {
        ...libraryMedia,
        ...metadata,
    };
  }

  async getAllMedia(libraryId: string): Promise<VideoFile[]> {
    const db = await this.dbPromise;
    const videoTx = db.transaction(VIDEO_STORE_NAME, 'readonly');
    const videoStore = videoTx.objectStore(VIDEO_STORE_NAME);
    const range = IDBKeyRange.bound([libraryId, ''], [libraryId, '\uffff']);
    const libraryMedia = await videoStore.getAll(range) as LibraryVideo[];
    
    if (libraryMedia.length === 0) return [];

    const uniqueMediaKeys = [...new Set(libraryMedia.map(m => m.mediaKey))];
    const metadataTx = db.transaction(METADATA_STORE_NAME, 'readonly');
    const metadataStore = metadataTx.objectStore(METADATA_STORE_NAME);
    const metadataPromises = uniqueMediaKeys.map(key => metadataStore.get(key));
    const metadataResults = (await Promise.all(metadataPromises)).filter(Boolean) as MediaMetadata[];
    const metadataMap = new Map(metadataResults.map(m => [m.mediaKey, m]));

    const mediaFiles: VideoFile[] = libraryMedia.map(libMed => {
        const metadata = metadataMap.get(libMed.mediaKey) || {};
        return {
            ...libMed,
            ...metadata,
        } as VideoFile;
    });
    
    return mediaFiles;
  }
  
  async updatePlaybackPosition(libraryId: string, fullPath: string, position: number): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    const media = await tx.store.get([libraryId, fullPath]) as LibraryVideo | undefined;
    if (media) {
        media.playbackPosition = position;
        media.lastWatched = new Date();
        await tx.store.put(media);
    }
    await tx.done;
  }

  async toggleFavorite(libraryId: string, fullPath: string): Promise<VideoFile | undefined> {
    const db = await this.dbPromise;
    const tx = db.transaction([VIDEO_STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE_NAME);
    const metadataStore = tx.objectStore(METADATA_STORE_NAME);

    // Use `any` to access potentially stale `isFavorite` property for migration
    const media = await videoStore.get([libraryId, fullPath]) as any;
    
    if (media) {
      const metadata = (await metadataStore.get(media.mediaKey) || { mediaKey: media.mediaKey }) as MediaMetadata;
      
      // For backward compatibility, check old location if new one is not set
      const currentIsFavorite = metadata.isFavorite ?? media.isFavorite ?? false;
      metadata.isFavorite = !currentIsFavorite;
      
      await metadataStore.put(metadata);

      // If the old property exists, remove it to complete migration for this item
      if (media.isFavorite !== undefined) {
        delete media.isFavorite;
        await videoStore.put(media);
      }
      
      await tx.done;
      return {...media, ...metadata } as VideoFile;
    }
    
    await tx.done;
    return undefined;
  }

  async toggleHidden(libraryId: string, fullPath: string): Promise<VideoFile | undefined> {
    const db = await this.dbPromise;
    const tx = db.transaction([VIDEO_STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE_NAME);
    const metadataStore = tx.objectStore(METADATA_STORE_NAME);

    const media = await videoStore.get([libraryId, fullPath]) as LibraryVideo | undefined;
    
    if (media) {
      const metadata = (await metadataStore.get(media.mediaKey) || { mediaKey: media.mediaKey }) as MediaMetadata;
      
      metadata.isHidden = !metadata.isHidden;
      
      await metadataStore.put(metadata);
      
      await tx.done;
      return {...media, ...metadata } as VideoFile;
    }
    
    await tx.done;
    return undefined;
  }

  async updateTags(libraryId: string, fullPath: string, tags: string[]): Promise<VideoFile | undefined> {
    const db = await this.dbPromise;
    const tx = db.transaction([VIDEO_STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE_NAME);
    const metadataStore = tx.objectStore(METADATA_STORE_NAME);

    const media = await videoStore.get([libraryId, fullPath]) as LibraryVideo | undefined;
    if (media) {
        const metadata = (await metadataStore.get(media.mediaKey) || { mediaKey: media.mediaKey }) as MediaMetadata;
        metadata.tags = tags;
        await metadataStore.put(metadata);

        await tx.done;
        return { ...media, ...metadata } as VideoFile;
    }
    await tx.done;
    return undefined;
  }
  
  async deleteMediaByPath(libraryId: string, fullPaths: string[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    await Promise.all(fullPaths.map(path => tx.store.delete([libraryId, path])));
    await tx.done;
  }

  async clearMedia(libraryId?: string): Promise<void> {
    const db = await this.dbPromise;
    if (libraryId) {
        const range = IDBKeyRange.bound([libraryId, ''], [libraryId, '\uffff']);
        const tx = db.transaction(VIDEO_STORE_NAME, 'readwrite');
        let cursor = await tx.store.openCursor(range);
        while(cursor) {
            cursor.delete();
            cursor = await cursor.continue();
        }
        await tx.done;
    } else {
        await db.clear(VIDEO_STORE_NAME);
        await db.clear(METADATA_STORE_NAME);
    }
  }

  async clearContinueWatching(libraryId: string): Promise<string[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(VIDEO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VIDEO_STORE_NAME);
    const range = IDBKeyRange.bound([libraryId, ''], [libraryId, '\uffff']);
    
    let cursor = await store.openCursor(range);
    const updatedPaths: string[] = [];

    while (cursor) {
        const media = cursor.value;
        if (media.playbackPosition) {
            const updatedMedia = { ...media };
            // Using delete is cleaner than setting to undefined for IDB Object stores
            delete updatedMedia.playbackPosition;
            delete updatedMedia.lastWatched;
            cursor.update(updatedMedia);
            updatedPaths.push(media.fullPath);
        }
        cursor = await cursor.continue();
    }

    await tx.done;
    return updatedPaths;
  }
}
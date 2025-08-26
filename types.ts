import { VideoFile } from './services/db';

export enum View {
  Loading,
  Welcome,
  Library,
  Player,
  Settings,
}

export interface AppState {
  view: View;
  media: VideoFile[];
  currentlyViewing: VideoFile | null;
  searchQuery: string;
  isLoading: boolean;
  progress: number;
  progressMessage: string;
}

export interface LibraryInfo {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}

export interface CategoryNode {
  name: string;
  path: string;
  children: CategoryNode[];
  media: VideoFile[];
}

// Fix: Add missing Collection type to resolve a compilation error in components/AddToCollectionModal.tsx.
export interface Collection {
  id: string;
  name: string;
  mediaFullPaths: string[];
}

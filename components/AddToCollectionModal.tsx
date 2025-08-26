
import React, { useState, useEffect } from 'react';
import { VideoFile } from '../services/db';
import { Collection } from '../types';

interface AddToCollectionModalProps {
  video: VideoFile;
  collections: Collection[];
  onSave: (collection: Collection) => void;
  onClose: () => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({ video, collections, onSave, onClose }) => {
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    const initialSelected = new Set<string>();
    collections.forEach(c => {
      if (c.mediaFullPaths.includes(video.fullPath)) {
        initialSelected.add(c.id);
      }
    });
    setSelectedCollectionIds(initialSelected);
  }, [collections, video]);

  const handleToggleCollection = (collection: Collection) => {
    const updatedPaths = new Set(collection.mediaFullPaths);
    if (updatedPaths.has(video.fullPath)) {
      updatedPaths.delete(video.fullPath);
    } else {
      updatedPaths.add(video.fullPath);
    }
    onSave({ ...collection, mediaFullPaths: Array.from(updatedPaths) });
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      const newCollection: Collection = {
        id: crypto.randomUUID(),
        name: newCollectionName.trim(),
        mediaFullPaths: [video.fullPath],
      };
      onSave(newCollection);
      setNewCollectionName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-brand-gray rounded-lg shadow-xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">Add to Collection</h2>
        <p className="text-sm text-gray-400 mb-6 truncate"><strong>File:</strong> {video.name}</p>
        
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-6">
          {collections.length > 0 ? (
            collections.map(collection => (
              <label key={collection.id} className="flex items-center space-x-3 p-3 bg-brand-light-gray rounded-md cursor-pointer hover:bg-brand-gray/50">
                <input
                  type="checkbox"
                  checked={selectedCollectionIds.has(collection.id)}
                  onChange={() => handleToggleCollection(collection)}
                  className="h-5 w-5 rounded bg-brand-gray border-gray-500 text-brand-red focus:ring-brand-red"
                />
                <span className="text-white font-medium">{collection.name}</span>
              </label>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No collections yet. Create one below!</p>
          )}
        </div>
        
        <form onSubmit={handleCreateCollection} className="flex space-x-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={e => setNewCollectionName(e.target.value)}
            placeholder="Create a new collection..."
            className="flex-grow bg-brand-gray text-white p-2 rounded-md border border-brand-light-gray focus:ring-brand-red focus:border-brand-red"
          />
          <button type="submit" className="py-2 px-4 rounded-md bg-brand-red text-white font-bold hover:bg-red-700 transition-colors">Create</button>
        </form>
        
        <div className="flex justify-end mt-8">
          <button onClick={onClose} className="py-2 px-6 rounded-md bg-brand-light-gray text-white font-bold hover:bg-gray-600 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
};

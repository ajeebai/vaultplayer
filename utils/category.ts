import { VideoFile } from '../services/db';
import { CategoryNode } from '../types';

export const buildCategoryTree = (media: VideoFile[]): CategoryNode[] => {
  const root: CategoryNode = { name: 'Home', path: '', children: [], media: [] };
  const nodeMap: Map<string, CategoryNode> = new Map([['', root]]);

  // Sort media by path to ensure parent folders are created before children
  const sortedMedia = [...media].sort((a, b) => a.fullPath.localeCompare(b.fullPath));

  for (const mediaFile of sortedMedia) {
    const parts = mediaFile.parentPath.split('/').filter(p => p);
    let parentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const currentPath = parts.slice(0, i + 1).join('/');
      
      let childNode = nodeMap.get(currentPath);

      if (!childNode) {
        childNode = { name: part, path: currentPath, children: [], media: [] };
        parentNode.children.push(childNode);
        nodeMap.set(currentPath, childNode);
      }
      parentNode = childNode;
    }
    parentNode.media.push(mediaFile);
  }
  return root.children;
};


export const findNodeByPath = (nodes: CategoryNode[], path: string): CategoryNode | null => {
    for (const node of nodes) {
        if (node.path === path) {
            return node;
        }
        const found = findNodeByPath(node.children, path);
        if (found) {
            return found;
        }
    }
    return null;
}

export const getAllMediaFromNode = (node: CategoryNode): VideoFile[] => {
  let media = [...node.media];
  for (const child of node.children) {
    media = media.concat(getAllMediaFromNode(child));
  }
  // Using a map to ensure uniqueness based on fullPath.
  const uniqueMedia = Array.from(new Map(media.map(v => [v.fullPath, v])).values());
  return uniqueMedia;
};
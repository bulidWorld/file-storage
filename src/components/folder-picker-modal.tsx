'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, ChevronRight, ChevronDown, Plus, X } from 'lucide-react';
import { Folder } from '@/lib/api';

interface FolderPickerModalProps {
  folders: Folder[];
  currentFolderPath: string | null;
  onSelect: (folderPath: string) => void;
  onClose: () => void;
  onCreateFolder?: (name: string, parentPath: string | null) => Promise<void>;
}

interface FolderNode {
  id: number;
  name: string;
  path: string;
  children: FolderNode[];
}

function buildFolderTree(folders: Folder[]): FolderNode[] {
  const map = new Map<number, FolderNode>();
  const roots: FolderNode[] = [];

  for (const f of folders) {
    map.set(f.id, { id: f.id, name: f.name, path: f.path, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.id)!;
    if (f.parentId != null && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function FolderPickerModal({
  folders,
  currentFolderPath,
  onSelect,
  onClose,
  onCreateFolder,
}: FolderPickerModalProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [creating, setCreating] = useState(false);

  const folderTree = buildFolderTree(folders);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (nodes: FolderNode[], depth: number = 0) => {
    return nodes.map(node => {
      const isExpanded = expanded.has(node.id);
      const hasChildren = node.children.length > 0;
      const isSelected = selectedPath === node.path;
      const isCurrent = node.path === currentFolderPath;

      return (
        <div key={node.id}>
          <button
            onClick={() => {
              if (hasChildren) toggleExpand(node.id);
              setSelectedPath(node.path);
            }}
            className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded text-sm transition-colors ${
              isSelected
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            } ${isCurrent ? 'font-medium' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className="p-0.5 hover:bg-gray-200 rounded cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                )}
              </span>
            ) : (
              <span className="w-5" />
            )}
            <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
            <span className="truncate flex-1 text-left">{node.name}</span>
            {isCurrent && (
              <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                当前位置
              </span>
            )}
          </button>
          {isExpanded && hasChildren && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !onCreateFolder) return;
    setCreating(true);
    try {
      await onCreateFolder(newFolderName.trim(), selectedPath);
      setNewFolderName('');
      setShowNewFolder(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">选择文件夹</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {folderTree.length === 0 ? (
            <p className="text-center text-gray-400 py-8">暂无文件夹</p>
          ) : (
            <div className="space-y-0.5">
              {/* Root option */}
              <button
                onClick={() => setSelectedPath(null)}
                className={`w-full flex items-center gap-2 py-2 px-2 rounded text-sm transition-colors ${
                  selectedPath === null
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FolderOpen className={`w-4 h-4 ${selectedPath === null ? 'text-blue-500' : 'text-gray-400'}`} />
                <span>根目录</span>
              </button>
              {renderTree(folderTree)}
            </div>
          )}
        </div>

        {/* Create new folder */}
        {onCreateFolder && (
          <div className="px-4 pb-3">
            {showNewFolder ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="新文件夹名称"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={creating || !newFolderName.trim()}
                  className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {creating ? '创建中...' : '创建'}
                </button>
                <button
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName('');
                  }}
                  className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                新建文件夹
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <div className="text-sm text-gray-500 truncate max-w-[200px]">
            {selectedPath ? `目标: ${selectedPath}` : '未选择'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onSelect(selectedPath || '/')}
              disabled={!selectedPath && selectedPath !== null}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

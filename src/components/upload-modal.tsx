'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, FolderPlus, ChevronRight, Search, Home } from 'lucide-react';
import { getAllFolders, createFolder, Folder } from '@/lib/api';
import { logger } from '@/utils/logger';

interface UploadModalProps {
  onUpload: (file: File, changeLog: string, summary: string, folderPath?: string) => Promise<void>;
  onClose: () => void;
  currentFolderPath?: string | null;
}

interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  expanded?: boolean;
}

// Build folder tree from flat list using path
function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const folderMap = new Map<number, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // First pass: create all nodes
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // Second pass: build tree using parentId
  folders.forEach(folder => {
    const node = folderMap.get(folder.id)!;
    if (folder.parentId !== null && folder.parentId !== undefined && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function UploadModal({ onUpload, onClose, currentFolderPath }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [changeLog, setChangeLog] = useState('');
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | undefined>(currentFolderPath || undefined);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set([1, 2, 3]));
  const [newFolderParentPath, setNewFolderParentPath] = useState<string | undefined>(undefined);
  const [showFolderSelectForNewFolder, setShowFolderSelectForNewFolder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const folderTree = buildFolderTree(folders);

  // Load folders when opening folder selector
  useEffect(() => {
    if (showFolderSelect || showNewFolder) {
      loadFolders();
    }
  }, [showFolderSelect, showNewFolder]);

  const loadFolders = async () => {
    try {
      const allFolders = await getAllFolders();
      logger.debug('[UploadModal] Loaded folders:', allFolders);
      setFolders(allFolders);
    } catch (error) {
      logger.error('Failed to load folders:', error);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('文件大小不能超过 10MB');
        return;
      }
      setSelectedFile(file);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('文件大小不能超过 10MB');
        return;
      }
      setSelectedFile(file);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      await onUpload(selectedFile, changeLog, summary, selectedFolderPath);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      clearInterval(progressInterval);
      logger.error('Upload failed:', error);
      alert('上传失败：' + (error as Error).message);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFolderLabel = (path?: string) => {
    if (!path) return '根目录';
    const parts = path.split('/').filter(p => p);
    return parts[parts.length - 1] || '根目录';
  };

  const getFolderPath = (path?: string) => {
    if (!path) return [];
    return path.split('/').filter(p => p);
  };

  // Toggle folder expansion
  const toggleExpand = (folderId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Get depth of a folder node in the tree
  const getParentDepth = (node: FolderTreeNode, tree: FolderTreeNode[], depth: number = 0): number => {
    for (const root of tree) {
      if (root.id === node.id) return depth;
      const found = getParentDepth(node, root.children, depth + 1);
      if (found !== -1) return found;
    }
    return -1;
  };

  // Render folder tree node
  const renderFolderNode = (node: FolderTreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedFolderPath === node.path;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            setSelectedFolderPath(node.path);
            setShowFolderSelect(false);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-lg ${
            isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(node.id);
            }}
            className={`p-0.5 rounded hover:bg-gray-200 transition-colors cursor-pointer ${
              hasChildren ? 'text-gray-500' : 'text-transparent'
            }`}
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </span>
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="flex-1 text-left truncate">{node.name}</span>
          {isSelected && (
            <span className="text-xs text-blue-500 font-medium">✓</span>
          )}
        </button>
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), newFolderParentPath);
      setNewFolderName('');
      setShowNewFolder(false);
      setNewFolderParentPath(undefined);
      await loadFolders();
    } catch (error) {
      logger.error('Failed to create folder:', error);
      alert('创建文件夹失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-slideUp"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">上传文件</h2>
              <p className="text-xs text-gray-500">支持拖拽上传，最大 10MB</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Folder Path Breadcrumb */}
          {selectedFolderPath && (
            <div className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <Home className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">当前路径:</span>
              <div className="flex items-center gap-1">
                {getFolderPath(selectedFolderPath).map((part, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                    <span className="text-gray-700 font-medium">{part}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
              dragActive
                ? 'border-blue-400 bg-blue-50/60 scale-[1.02]'
                : selectedFile
                  ? 'border-green-300 bg-green-50/50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleChange}
              accept="*/*"
              disabled={uploading}
            />

            {uploading ? (
              <div className="space-y-3">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-600 font-medium">上传中...</p>
                <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{uploadProgress}%</p>
              </div>
            ) : selectedFile ? (
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600">点击选择</span> 或拖拽文件到此处
                  </p>
                  <p className="text-xs text-gray-400 mt-1">支持任意格式，最大 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Folder Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">存储位置</label>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(!showNewFolder);
                  if (!showNewFolder) {
                    setNewFolderParentPath(selectedFolderPath);
                    loadFolders();
                  }
                }}
                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                新建文件夹
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFolderSelect(!showFolderSelect)}
                className={`flex-1 flex items-center justify-between px-4 py-2.5 border rounded-xl text-sm transition-all ${
                  selectedFolderPath
                    ? 'border-blue-300 bg-blue-50/50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-gray-400" />
                  {getFolderLabel(selectedFolderPath)}
                </span>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showFolderSelect ? 'rotate-90' : ''}`} />
              </button>

              {selectedFolderPath && (
                <button
                  type="button"
                  onClick={() => setSelectedFolderPath(undefined)}
                  className="p-2.5 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="清除选择"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Folder Selector Dropdown */}
            {showFolderSelect && (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white animate-slideDown">
                {/* Search */}
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                      placeholder="搜索文件夹..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Folder Tree */}
                <div className="max-h-60 overflow-y-auto p-2">
                  {/* Root Directory */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderPath(undefined);
                      setShowFolderSelect(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-lg ${
                      !selectedFolderPath ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <Home className="w-4 h-4 text-gray-400" />
                    <span>根目录</span>
                    {selectedFolderPath === undefined && (
                      <span className="ml-auto text-xs text-blue-500 font-medium">✓</span>
                    )}
                  </button>

                  {/* Folder Tree Nodes */}
                  {folderTree.length > 0 ? (
                    folderTree.map(node => renderFolderNode(node))
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-gray-500">
                      暂无文件夹
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* New Folder Form */}
            {showNewFolder && (
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/80 animate-slideDown space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">文件夹名称</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="输入文件夹名称"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') setShowNewFolder(false);
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">父文件夹</label>
                  <button
                    type="button"
                    onClick={() => setShowFolderSelectForNewFolder(!showFolderSelectForNewFolder)}
                    className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-white transition-all bg-white"
                  >
                    <span className="flex items-center gap-2 text-gray-700">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      {newFolderParentPath ? getFolderLabel(newFolderParentPath) : '根目录'}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showFolderSelectForNewFolder ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Folder Tree for Parent Selection */}
                  {showFolderSelectForNewFolder && (
                    <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-white animate-slideDown max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setNewFolderParentPath(undefined);
                          setShowFolderSelectForNewFolder(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          newFolderParentPath === undefined ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <Home className="w-4 h-4 text-gray-400" />
                        <span>根目录</span>
                        {newFolderParentPath === undefined && (
                          <span className="ml-auto text-xs text-blue-500 font-medium">✓</span>
                        )}
                      </button>
                      {folderTree.length > 0 && (
                        <div className="p-1">
                          {folderTree.map(node => (
                            <div key={node.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setNewFolderParentPath(node.path);
                                  setShowFolderSelectForNewFolder(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-lg ${
                                  newFolderParentPath === node.path ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                                style={{ paddingLeft: `${getParentDepth(node, folderTree) * 16 + 12}px` }}
                              >
                                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                                <span className="flex-1 text-left truncate">{node.name}</span>
                                {newFolderParentPath === node.path && (
                                  <span className="text-xs text-blue-500 font-medium">✓</span>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    创建
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewFolder(false);
                      setNewFolderName('');
                      setNewFolderParentPath(undefined);
                      setShowFolderSelectForNewFolder(false);
                    }}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Change Log */}
          <div className="space-y-2">
            <label htmlFor="changeLog" className="text-sm font-medium text-gray-700">
              变更说明 <span className="text-gray-400 font-normal">(可选)</span>
            </label>
            <textarea
              id="changeLog"
              value={changeLog}
              onChange={(e) => setChangeLog(e.target.value)}
              placeholder="描述文件内容或变更说明..."
              disabled={uploading}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all bg-gray-50/50 focus:bg-white"
              rows={3}
            />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <label htmlFor="summary" className="text-sm font-medium text-gray-700">
              文件说明 <span className="text-gray-400 font-normal">(可选)</span>
            </label>
            <textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="描述文件的内容或用途..."
              disabled={uploading}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all bg-gray-50/50 focus:bg-white"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!selectedFile || uploading}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm disabled:shadow-none"
          >
            {uploading ? '上传中...' : '上传文件'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

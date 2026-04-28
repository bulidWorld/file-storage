'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, FolderPlus, ChevronRight } from 'lucide-react';
import { getAllFolders, createFolder, Folder } from '../lib/api';
import { logger } from '@/utils/logger';

interface FileUploadProps {
  onUpload: (file: File, changeLog: string, folderPath?: string) => Promise<void>;
  mode?: 'upload' | 'update';
  currentFolderPath?: string;
  onClose?: () => void;
}

export function FileUpload({ onUpload, mode = 'upload', currentFolderPath, onClose }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [changeLog, setChangeLog] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | undefined>(currentFolderPath);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showFolderSelect && mode === 'upload') {
      loadFolders();
    }
  }, [showFolderSelect, mode]);

  useEffect(() => {
    if (mode === 'upload') {
      setSelectedFolderPath(currentFolderPath);
    }
  }, [currentFolderPath, mode]);

  const loadFolders = async () => {
    try {
      const allFolders = await getAllFolders();
      setFolders(allFolders);
    } catch (error) {
      logger.error('Failed to load folders:', error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), selectedFolderPath);
      setNewFolderName('');
      setShowNewFolder(false);
      await loadFolders();
    } catch (error) {
      logger.error('Failed to create folder:', error);
      alert('创建文件夹失败');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onUpload(selectedFile, changeLog, selectedFolderPath);
      setSelectedFile(null);
      setChangeLog('');
      if (mode === 'upload') {
        setSelectedFolderPath(undefined);
      }
    } catch (error) {
      logger.error('Upload failed:', error);
      alert('Upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const getFolderLabel = (path?: string) => {
    if (!path) return '根目录';
    const parts = path.split('/').filter(p => p);
    return parts[parts.length - 1] || '根目录';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          accept="*/*"
        />

        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-gray-500">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div>
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              拖拽文件到此处，或者{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-blue-500 hover:text-blue-600 font-medium"
              >
                选择文件
              </button>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              最大文件大小：10MB
            </p>
          </div>
        )}
      </div>

      {mode === 'upload' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              选择文件夹
            </label>
            <button
              type="button"
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <FolderPlus className="w-3 h-3" />
              新建文件夹
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFolderSelect(!showFolderSelect)}
              className={`flex-1 flex items-center justify-between px-3 py-2 border rounded-md text-sm hover:bg-gray-50 ${
                selectedFolderPath ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <span className="truncate">
                <span className="text-gray-500">当前:</span> {getFolderLabel(selectedFolderPath)}
              </span>
              <ChevronRight className={`w-4 h-4 transform ${showFolderSelect ? 'rotate-90' : ''}`} />
            </button>

            {selectedFolderPath && (
              <button
                type="button"
                onClick={() => setSelectedFolderPath(undefined)}
                className="px-2 py-2 text-gray-500 hover:text-red-500 border border-gray-300 rounded-md"
                title="清除选择"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showFolderSelect && (
            <div className="mt-2 border border-gray-300 rounded-md max-h-48 overflow-y-auto bg-white">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderPath(undefined);
                  setShowFolderSelect(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                  !selectedFolderPath ? 'bg-blue-50 text-blue-600' : ''
                }`}
              >
                📁 根目录
              </button>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setSelectedFolderPath(folder.path);
                    setShowFolderSelect(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                    selectedFolderPath === folder.path ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                >
                  📁 {folder.path}
                </button>
              ))}
            </div>
          )}

          {showNewFolder && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="文件夹名称"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowNewFolder(false);
                }}
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolder(false)}
                className="px-3 py-2 bg-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="changeLog" className="block text-sm font-medium text-gray-700 mb-1">
          变更日志 {mode === 'upload' && '(可选)'}
        </label>
        <textarea
          id="changeLog"
          value={changeLog}
          onChange={(e) => setChangeLog(e.target.value)}
          placeholder={mode === 'upload' ? '描述此次上传...' : '描述变更内容...'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      <button
        type="submit"
        disabled={!selectedFile || uploading}
        className="w-full py-2 px-4 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? '上传中...' : mode === 'upload' ? '上传文件' : '更新文件'}
      </button>
    </form>
  );
}

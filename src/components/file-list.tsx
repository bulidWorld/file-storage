'use client';

import { FileRecord } from '@/lib/api';
import { File as FileIcon, Trash2, Eye, Download, Clock, Star, Grid3x3, List } from 'lucide-react';
import { formatCNDate } from '@/utils/format';

interface FileListProps {
  files: FileRecord[];
  viewMode?: 'grid' | 'list';
  onSelect: (file: FileRecord) => void;
  onDelete: (fileId: string) => Promise<void>;
  onDownload: (fileId: string) => void;
  onToggleFavorite?: (fileId: string) => void;
  favorites?: Set<string>;
  isFavorite?: boolean;
  showFolder?: boolean;
}

export function FileList({
  files,
  viewMode = 'list',
  onSelect,
  onDelete,
  onDownload,
  onToggleFavorite,
  favorites = new Set(),
  isFavorite = false,
  showFolder = false,
}: FileListProps) {
  const formatSize = (size: string | number) => {
    if (!size) return 'Unknown';
    const bytes = typeof size === 'number' ? size : Number(BigInt(size));
    if (bytes <= 0) return '0 B';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const colors: Record<string, string> = {
      pdf: 'text-red-500',
      doc: 'text-blue-600',
      docx: 'text-blue-600',
      xls: 'text-green-600',
      xlsx: 'text-green-600',
      ppt: 'text-orange-500',
      pptx: 'text-orange-500',
      jpg: 'text-purple-500',
      jpeg: 'text-purple-500',
      png: 'text-purple-500',
      gif: 'text-purple-500',
      mp4: 'text-pink-500',
      mp3: 'text-yellow-500',
      zip: 'text-amber-500',
      rar: 'text-amber-500',
      txt: 'text-gray-500',
      md: 'text-gray-500',
      json: 'text-yellow-600',
      xml: 'text-blue-500',
      html: 'text-orange-600',
      css: 'text-blue-400',
      js: 'text-yellow-500',
      ts: 'text-blue-600',
      py: 'text-green-500',
      java: 'text-red-600',
      cpp: 'text-blue-700',
      c: 'text-gray-600',
    };
    return colors[ext || ''] || 'text-gray-400';
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <FileIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">暂无文件</p>
        <p className="text-gray-400 text-sm mt-2">上传您的第一个文件开始使用</p>
      </div>
    );
  }

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
              onClick={() => onSelect(file)}
            >
              <div className="aspect-square flex items-center justify-center mb-2">
                <FileIcon className={`w-12 h-12 ${getFileIcon(file.name)}`} />
              </div>
              <div className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                {file.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatSize(file.currentVersion?.fileSize || '0')}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {formatCNDate(file.updatedAt)}
              </div>

              {/* Quick Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white rounded shadow-sm p-1">
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(file.publicId);
                    }}
                    className={`p-1 rounded hover:bg-gray-100 ${favorites.has(file.publicId) || isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}
                    title={favorites.has(file.publicId) ? '从收藏中移除' : '添加到收藏'}
                  >
                    <Star className={`w-3.5 h-3.5 ${favorites.has(file.publicId) || isFavorite ? 'fill-yellow-500' : ''}`} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(file.publicId);
                  }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file.publicId);
                  }}
                  className="p-1 rounded hover:bg-gray-100 text-red-500"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
              {onToggleFavorite && !isFavorite && <Star className="w-4 h-4" />}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              文件名
            </th>
            {showFolder && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                文件夹
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              大小
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              版本
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              上传人
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              修改时间
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {files.map((file) => (
            <tr
              key={file.id}
              className="group hover:bg-blue-50 cursor-pointer transition-colors"
              onClick={() => onSelect(file)}
            >
              <td className="px-4 py-3">
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(file.publicId);
                    }}
                    className={`p-1 rounded hover:bg-gray-200 ${favorites.has(file.publicId) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
                    title={favorites.has(file.publicId) ? '从收藏中移除' : '添加到收藏'}
                  >
                    <Star className={`w-4 h-4 ${favorites.has(file.publicId) ? 'fill-yellow-500' : ''}`} />
                  </button>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <FileIcon className={`w-5 h-5 mr-3 ${getFileIcon(file.name)}`} />
                  <span className="text-sm font-medium text-gray-900">{file.name}</span>
                </div>
              </td>
              {showFolder && (
                <td className="px-4 py-3">
                  {file.folder ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                      📁 {file.folder.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <span className="text-sm text-gray-500 font-mono">
                  {formatSize(file.currentVersion?.fileSize || '0')}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  v{file.currentVersion?.versionNumber || 0}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-500">
                  {file.creator?.name || file.creator?.username || '未知'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  {formatCNDate(file.updatedAt)}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onDownload(file.publicId)}
                    className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onSelect(file)}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                    title="查看详情"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(file.publicId)}
                    className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

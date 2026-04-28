'use client';

import { useState, useEffect } from 'react';
import { FileRecord, Version, getVersions } from '@/lib/api';
import { X, Upload, Star, Download, Trash2, Clock, File, HardDrive, Calendar, ChevronRight } from 'lucide-react';
import { FileUpload } from './file-upload';
import { VersionHistory } from './version-history';
import { formatCNDate } from '@/utils/format';
import { logger } from '@/utils/logger';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface FileDetailModalProps {
  file: FileRecord;
  onClose: () => void;
  onUpdate: (fileId: string, newFile: globalThis.File, changeLog: string) => Promise<void>;
  onRollback: (fileId: string, versionId: string) => Promise<void>;
  onDownloadVersion: (version: Version) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function FileDetailModal({
  file,
  onClose,
  onUpdate,
  onRollback,
  onDownloadVersion,
  isFavorite = false,
  onToggleFavorite,
}: FileDetailModalProps) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);

  // Fetch versions when modal opens
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const fetchedVersions = await getVersions(file.publicId);
        setVersions(fetchedVersions);
      } catch (error) {
        logger.error('Failed to fetch versions:', error);
      }
    };
    fetchVersions();
  }, [file.publicId]);

  const handleUpdate = async (newFile: globalThis.File, changeLog: string) => {
    await onUpdate(file.publicId, newFile, changeLog);
    setShowUpdateForm(false);
    const updatedFile = await fetch(`/api/v1/files/${file.publicId}`, { headers: getAuthHeaders() }).then(r => r.json());
    setVersions(updatedFile.data.versions || []);
  };

  const handleRollback = async (versionId: string) => {
    if (!confirm('确定要回滚到此版本吗？')) return;
    await onRollback(file.publicId, versionId);
    const updatedFile = await fetch(`/api/v1/files/${file.publicId}`, { headers: getAuthHeaders() }).then(r => r.json());
    setVersions(updatedFile.data.versions || []);
  };

  const handleDownloadVersion = async (version: Version) => {
    try {
      const res = await fetch(`/api/v1/files/${file.publicId}/download`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      logger.error('Download failed:', error);
      alert('下载失败');
    }
  };

  const formatSize = (size: string | number) => {
    if (!size) return 'Unknown';
    const bytes = typeof size === 'number' ? size : Number(BigInt(size));
    if (bytes <= 0) return '0 B';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    if (kb >= 1) return `${kb.toFixed(2)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <File className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{file.name}</h2>
              <p className="text-sm text-gray-500">文件详情</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className={`p-2 rounded-lg transition-colors ${isFavorite ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500 hover:bg-yellow-50 hover:text-yellow-500'}`}
                title={isFavorite ? '从收藏中移除' : '添加到收藏'}
              >
                <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-500' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - File Info */}
          <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">文件信息</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <File className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">文件名</p>
                  <p className="text-sm font-medium text-gray-900 break-all">{file.name}</p>
                </div>
              </div>

              {file.summary && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <File className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">文件说明</p>
                    <p className="text-sm text-gray-700 mt-1">{file.summary}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HardDrive className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">文件大小</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatSize(file.currentVersion?.fileSize || '0')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">当前版本</p>
                  <p className="text-sm font-medium text-gray-900">
                    v{file.currentVersion?.versionNumber || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">创建时间</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCNDate(file.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">最后修改</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCNDate(file.updatedAt)}
                  </p>
                </div>
              </div>

              {file.creator && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">创建人</p>
                    <p className="text-sm font-medium text-gray-900">
                      {file.creator.name} ({file.creator.username})
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 my-6" />

            {/* Actions */}
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">操作</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowUpdateForm(!showUpdateForm)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <Upload className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">更新文件</span>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
              </button>
            </div>
          </div>

          {/* Right Panel - Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {showUpdateForm ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">更新文件</h3>
                  <button
                    onClick={() => setShowUpdateForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <FileUpload onUpload={handleUpdate} mode="update" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">版本历史</h3>
                  <span className="text-sm text-gray-500">{versions.length} 个版本</span>
                </div>
                <VersionHistory
                  versions={versions}
                  onRollback={handleRollback}
                  onDownload={handleDownloadVersion}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

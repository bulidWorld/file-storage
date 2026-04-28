'use client';

import { Version } from '@/lib/api';
import { History, RotateCcw, Download } from 'lucide-react';
import { formatCNDate } from '@/utils/format';

interface VersionHistoryProps {
  versions: Version[];
  onRollback: (versionId: string) => Promise<void>;
  onDownload: (version: Version) => void;
}

export function VersionHistory({ versions, onRollback, onDownload }: VersionHistoryProps) {
  const formatSize = (size: string | number) => {
    const bytes = typeof size === 'number' ? size : Number(BigInt(size || 0));
    if (bytes <= 0) return '0 B';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    if (kb >= 1) return `${kb.toFixed(2)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <History className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-800">版本历史</h3>
      </div>

      <div className="space-y-2">
        {versions.map((version) => (
          <div
            key={version.id}
            className={`p-4 rounded-lg border transition-colors ${
              version.isCurrent
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-gray-900">
                    版本 {version.versionNumber}
                  </span>
                  {version.isCurrent && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      当前版本
                    </span>
                  )}
                </div>

                {version.changeLog && (
                  <p className="text-sm text-gray-600 mb-2">{version.changeLog}</p>
                )}

                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{formatSize(version.fileSize)}</span>
                  <span>{formatCNDate(version.createdAt)}</span>
                  <span className="font-mono">
                    {version.checksum.substring(0, 12)}...
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onDownload(version)}
                  className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                  title="下载此版本"
                >
                  <Download className="w-4 h-4" />
                </button>

                {!version.isCurrent && (
                  <button
                    onClick={() => onRollback(version.publicId)}
                    className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                    title="回滚到此版本"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

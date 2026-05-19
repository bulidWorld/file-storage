'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Building2 } from 'lucide-react';
import { Workspace, getWorkspaces, getItemWorkspaces, addFolderToWorkspace, removeFolderFromWorkspace, addFileToWorkspace, removeFileFromWorkspace } from '@/lib/api';
import { logger } from '@/utils/client-logger';

interface WorkspaceAssignModalProps {
  type: 'file' | 'folder';
  publicId: string;
  onClose: () => void;
  onChange: () => void;
}

export function WorkspaceAssignModal({ type, publicId, onClose, onChange }: WorkspaceAssignModalProps) {
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceIds, setCurrentWorkspaceIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    try {
      const [allWs, itemWs] = await Promise.all([
        getWorkspaces(),
        getItemWorkspaces(publicId, type),
      ]);
      setAllWorkspaces(allWs);
      setCurrentWorkspaceIds(new Set(itemWs.map((w: Workspace) => w.id)));
    } catch (error) {
      logger.error('Failed to load workspace assignments:', error);
    } finally {
      setLoading(false);
    }
  }, [publicId, type]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const toggleWorkspace = async (ws: Workspace) => {
    if (saving) return;
    setSaving(true);
    try {
      const isChecked = currentWorkspaceIds.has(ws.id);
      if (type === 'folder') {
        if (isChecked) await removeFolderFromWorkspace(ws.id, Number(publicId));
        else await addFolderToWorkspace(ws.id, Number(publicId));
      } else {
        if (isChecked) await removeFileFromWorkspace(ws.id, publicId);
        else await addFileToWorkspace(ws.id, publicId);
      }
      setCurrentWorkspaceIds(prev => {
        const next = new Set(prev);
        if (isChecked) next.delete(ws.id);
        else next.add(ws.id);
        return next;
      });
      onChange();
    } catch (error) {
      logger.error('Failed to toggle workspace:', error);
      alert('操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-800">管理所属工作空间</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace List */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">加载中...</p>
          ) : (
            <div className="space-y-2">
              {allWorkspaces.map(ws => {
                const isChecked = currentWorkspaceIds.has(ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => toggleWorkspace(ws)}
                    disabled={saving}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                      isChecked
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ws.color }} />
                    <span className="flex-1 text-left text-gray-700">{ws.name}</span>
                    {isChecked && (
                      <Check className="w-4 h-4 text-blue-500" />
                    )}
                  </button>
                );
              })}
              {allWorkspaces.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">暂无工作空间</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

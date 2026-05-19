'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Palette } from 'lucide-react';
import { createWorkspace, deleteWorkspace, Workspace } from '@/lib/api';
import { logger } from '@/utils/client-logger';

const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#6366F1', '#84CC16', '#F97316',
  '#6B7280', '#1F2937',
];

interface WorkspaceManagerModalProps {
  workspaces: Workspace[];
  onClose: () => void;
  onChange: () => void;
}

export function WorkspaceManagerModal({ workspaces, onClose, onChange }: WorkspaceManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    try {
      setCreating(true);
      await createWorkspace(newName.trim(), newColor);
      setNewName('');
      onChange();
    } catch (error) {
      logger.error('Failed to create workspace:', error);
      alert('创建工作空间失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    if (ws.publicId === 'workspace-default') {
      alert('不能删除默认工作空间');
      return;
    }
    if (!confirm(`确定要删除工作空间「${ws.name}」吗？文件和文件夹不会被删除。`)) return;
    try {
      setDeletingId(ws.id);
      await deleteWorkspace(ws.id);
      onChange();
    } catch (error) {
      logger.error('Failed to delete workspace:', error);
      alert('删除工作空间失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">管理工作空间</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace List */}
        <div className="px-6 py-4 max-h-60 overflow-y-auto">
          {workspaces.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">暂无工作空间</p>
          )}
          <div className="space-y-2">
            {workspaces.map(ws => (
              <div key={ws.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg group">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ws.color }} />
                <span className="flex-1 text-sm text-gray-700 truncate">{ws.name}</span>
                {ws.publicId !== 'workspace-default' && (
                  <button
                    onClick={() => handleDelete(ws)}
                    disabled={deletingId === ws.id}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    title="删除工作空间"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create New */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">新建工作空间</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="工作空间名称"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">颜色标记</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              {creating ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

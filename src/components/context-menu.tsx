'use client';

import { useEffect, useRef } from 'react';
import { FileText, FolderOpen, Trash2, Copy, Move, Pencil } from 'lucide-react';

type ContextMenuItem =
  | { type: 'file'; id: string; name: string; folderPath?: string | null }
  | { type: 'folder'; id: number; name: string; path: string };

interface ContextMenuProps {
  x: number;
  y: number;
  item: ContextMenuItem | null;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, item, onRename, onDelete, onMove, onCopy, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!item) return null;

  const isFolder = item.type === 'folder';

  const menuItems = [
    ...(isFolder ? [{ label: '重命名', icon: Pencil, action: onRename }] : []),
    { label: '删除', icon: Trash2, action: onDelete, danger: true },
    { label: '移动', icon: Move, action: onMove },
    { label: '复制', icon: Copy, action: onCopy },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40"
      style={{ left: x, top: y }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        {isFolder ? (
          <FolderOpen className="w-4 h-4 text-blue-500" />
        ) : (
          <FileText className="w-4 h-4 text-blue-500" />
        )}
        <span className="text-xs text-gray-500 truncate max-w-[120px]">
          {item.name}
        </span>
      </div>

      {/* Menu items */}
      {menuItems.map((menuItem, index) => (
        <button
          key={index}
          onClick={() => {
            menuItem.action();
            onClose();
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
            menuItem.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
          }`}
        >
          <menuItem.icon className="w-4 h-4" />
          {menuItem.label}
        </button>
      ))}
    </div>
  );
}

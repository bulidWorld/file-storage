'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileRecord, getFiles, uploadFile, updateFile, deleteFile, downloadFile, rollback, Version, getFilesByFolder, Folder, renameFile, moveFile, copyFile, renameFolder, moveFolder, createFolder, deleteFolder } from '@/lib/api';
import { FileList } from '@/components/file-list';
import { FileDetailModal } from '@/components/file-detail-modal';
import { UploadModal } from '@/components/upload-modal';
import { ContextMenu } from '@/components/context-menu';
import { FolderPickerModal } from '@/components/folder-picker-modal';
import { OnlyOfficeEditor } from '@/components/onlyoffice-editor';
import { getDocType } from '@/lib/onlyoffice';
import { logger } from '@/utils/client-logger';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
import {
  FolderOpen,
  Upload,
  Star,
  Clock,
  Search,
  Grid3x3,
  List,
  RefreshCw,
  Home as HomeIcon,
  HardDrive,
  ChevronRight,
  ChevronDown,
  LogOut,
  User as UserIcon,
  FileText,
  FileType,
  Presentation,
  FileChartLine,
  Image,
  Video,
  Music,
  Archive,
  Code,
  File,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'recent' | 'favorites' | 'uploads';

interface BreadcrumbItem {
  label: string;
  filter: FilterType;
  folderPath?: string;
}

export default function Home() {
  const router = useRouter();
  const initialFolder = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('folder') : null;
  const initialEditId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('edit') : null;
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<{ username: string; name: string; email: string } | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(initialFolder);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [folders, setFolders] = useState<Folder[]>([]);
  const [onlyofficeFile, setOnlyofficeFile] = useState<{ publicId: string; fileName: string } | null>(null);

  // Navigation: sync state with browser URL
  const navigateToFolder = useCallback((path: string | null) => {
    const url = path ? `?folder=${encodeURIComponent(path)}` : '/';
    window.history.pushState({ path }, '', url);
    setCurrentFolderPath(path);
    setOnlyofficeFile(null);
  }, []);

  const openOnlyOffice = useCallback((publicId: string, fileName: string) => {
    const folder = currentFolderPath;
    const url = folder
      ? `?folder=${encodeURIComponent(folder)}&edit=${encodeURIComponent(publicId)}`
      : `?edit=${encodeURIComponent(publicId)}`;
    window.history.pushState({ edit: publicId }, '', url);
    setOnlyofficeFile({ publicId, fileName });
  }, [currentFolderPath]);

  const closeOnlyOffice = useCallback(() => {
    setOnlyofficeFile(null);
    const url = currentFolderPath ? `?folder=${encodeURIComponent(currentFolderPath)}` : '/';
    window.history.replaceState(null, '', url);
  }, [currentFolderPath]);

  // Browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const folder = params.get('folder');
      setCurrentFolderPath(folder);
      const edit = params.get('edit');
      if (edit) {
        const targetFile = files.find(f => f.publicId === edit);
        if (targetFile) setOnlyofficeFile({ publicId: edit, fileName: targetFile.name });
        else setOnlyofficeFile(null);
      } else {
        setOnlyofficeFile(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [files]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: { type: 'file'; id: string; name: string; folderPath?: string | null } | { type: 'folder'; id: number; name: string; path: string } } | null>(null);
  const [renameState, setRenameState] = useState<{ type: 'file' | 'folder'; id: string | number; currentName: string } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState<{ type: 'move' | 'copy'; item: { type: 'file'; id: string; name: string } | { type: 'folder'; id: number; name: string; path: string } } | null>(null);

  // Build sidebar folder tree
  const sidebarTree = useMemo(() => {
    const map = new Map<number, Folder & { children: (Folder & { children: any[] })[] }>();
    const roots: (Folder & { children: (Folder & { children: any[] })[] })[] = [];
    for (const f of folders) {
      map.set(f.id, { ...f, children: [] });
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
  }, [folders]);

  const [expandedSidebar, setExpandedSidebar] = useState<Set<number>>(() => {
    const s = new Set<number>();
    folders.forEach(f => s.add(f.id));
    return s;
  });

  // Load client-only state after mount (avoids hydration mismatch)
  useEffect(() => {
    const info = localStorage.getItem('user_info');
    if (info) setUser(JSON.parse(info));

    const saved = localStorage.getItem('file-favorites');
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = currentFolderPath
        ? await getFilesByFolder(currentFolderPath)
        : await getFiles();
      setFiles(data);
      if (!onlyofficeFile && initialEditId) {
        const targetFile = data.find(f => f.publicId === initialEditId);
        if (targetFile) setOnlyofficeFile({ publicId: initialEditId, fileName: targetFile.name });
      }
    } catch (error) {
      logger.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  }, [currentFolderPath, onlyofficeFile, initialEditId]);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }
  }, [router]);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const { getAllFolders } = await import('@/lib/api');
      const data = await getAllFolders();
      setFolders(data);
    } catch (error) {
      logger.error('Failed to load folders:', error);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    router.push('/login');
  };

  // Reload files only when folder path changes
  useEffect(() => {
    loadFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderPath]);

  useEffect(() => {
    localStorage.setItem('file-favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = useCallback((fileId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const handleUpload = async (file: globalThis.File, changeLog: string, summary: string, folderPath?: string) => {
    await uploadFile(file, changeLog, folderPath, summary);
    setShowUploadForm(false);
    await loadFiles();
    await loadFolders();
    navigateToFolder(folderPath || null);
  };

  const handleUpdate = async (fileId: string, newFile: globalThis.File, changeLog: string) => {
    await updateFile(fileId, newFile, changeLog);
    await loadFiles();
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('确定要删除此文件吗？')) return;
    await deleteFile(fileId);
    toggleFavorite(fileId);
    await loadFiles();
    if (selectedFile?.publicId === fileId) {
      setSelectedFile(null);
    }
  };

  // Context menu handlers
  const handleContextMenuFile = (e: React.MouseEvent, file: FileRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: { type: 'file', id: file.publicId, name: file.name, folderPath: file.folder?.path },
    });
  };

  const handleContextMenuFolder = (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: { type: 'folder', id: folder.id, name: folder.name, path: folder.path },
    });
  };

  const handleRename = async (name: string) => {
    if (!renameState || !name.trim()) return;
    const trimmed = name.trim();
    if (renameState.type === 'file') {
      await renameFile(renameState.id as string, trimmed);
    } else {
      await renameFolder(renameState.id as number, trimmed);
    }
    setRenameState(null);
    await loadFiles();
    await loadFolders();
  };

  const handleDeleteFromContextMenu = async (item: { type: 'file'; id: string; name?: string; folderPath?: string | null } | { type: 'folder'; id: number; name: string; path: string }) => {
    if (item.type === 'file') {
      await handleDelete(item.id);
    } else {
      if (!confirm(`确定要删除文件夹「${item.name}」吗？文件夹中的文件将被软删除。`)) return;
      await deleteFolder(item.id);
      await loadFolders();
      if (currentFolderPath && currentFolderPath.startsWith(item.path)) {
        navigateToFolder(null);
      } else {
        await loadFiles();
      }
    }
  };

  const handleMoveFile = async (folderPath: string) => {
    if (!showFolderPicker || showFolderPicker.item.type !== 'file') return;
    await moveFile(showFolderPicker.item.id, folderPath);
    setShowFolderPicker(null);
    await loadFiles();
  };

  const handleCopyFile = async (folderPath: string) => {
    if (!showFolderPicker || showFolderPicker.item.type !== 'file') return;
    await copyFile(showFolderPicker.item.id, folderPath);
    setShowFolderPicker(null);
    await loadFiles();
    await loadFolders();
  };

  const handleCreateFolderFromPicker = async (name: string, parentPath: string | null) => {
    await createFolder(name, parentPath || undefined);
    await loadFolders();
  };

  const handleDownload = async (fileId: string) => {
    try {
      const blob = await downloadFile(fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileId;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      logger.error('Download failed:', error);
      alert('下载失败');
    }
  };

  const handleRollback = async (fileId: string, versionId: string) => {
    await rollback(fileId, versionId);
    await loadFiles();
    if (selectedFile?.publicId === fileId) {
      const updated = await fetch(`/api/v1/files/${fileId}`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(d => d.data);
      setSelectedFile(updated);
    }
  };

  const handleDownloadVersion = async (version: Version) => {
    alert('正在下载版本 ' + version.versionNumber);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const extMap: Record<string, { icon: React.ElementType; color: string }> = {
      // Word documents
      doc: { icon: FileType, color: 'text-blue-400 bg-blue-400/20' },
      docx: { icon: FileType, color: 'text-blue-400 bg-blue-400/20' },
      odt: { icon: FileType, color: 'text-blue-400 bg-blue-400/20' },
      txt: { icon: FileText, color: 'text-amber-300/70 bg-amber-300/10' },
      rtf: { icon: FileType, color: 'text-amber-300/70 bg-amber-300/10' },
      // Spreadsheets
      xls: { icon: FileChartLine, color: 'text-emerald-400 bg-emerald-400/20' },
      xlsx: { icon: FileChartLine, color: 'text-emerald-400 bg-emerald-400/20' },
      ods: { icon: FileChartLine, color: 'text-emerald-400 bg-emerald-400/20' },
      csv: { icon: FileChartLine, color: 'text-emerald-400 bg-emerald-400/20' },
      // Presentations
      ppt: { icon: Presentation, color: 'text-orange-400 bg-orange-400/20' },
      pptx: { icon: Presentation, color: 'text-orange-400 bg-orange-400/20' },
      odp: { icon: Presentation, color: 'text-orange-400 bg-orange-400/20' },
      // PDF and others
      pdf: { icon: FileText, color: 'text-red-500 bg-red-500/20' },
      md: { icon: FileText, color: 'text-amber-300/70 bg-amber-300/10' },
      // Images
      jpg: { icon: Image, color: 'text-purple-400 bg-purple-400/20' },
      jpeg: { icon: Image, color: 'text-purple-400 bg-purple-400/20' },
      png: { icon: Image, color: 'text-purple-400 bg-purple-400/20' },
      gif: { icon: Image, color: 'text-purple-400 bg-purple-400/20' },
      svg: { icon: Image, color: 'text-purple-400 bg-purple-400/20' },
      webp: { icon: Image, color: 'text-purple-400 bg-purple-400/20' },
      // Video
      mp4: { icon: Video, color: 'text-pink-400 bg-pink-400/20' },
      avi: { icon: Video, color: 'text-pink-400 bg-pink-400/20' },
      mov: { icon: Video, color: 'text-pink-400 bg-pink-400/20' },
      mkv: { icon: Video, color: 'text-pink-400 bg-pink-400/20' },
      // Audio
      mp3: { icon: Music, color: 'text-yellow-400 bg-yellow-400/20' },
      wav: { icon: Music, color: 'text-yellow-400 bg-yellow-400/20' },
      flac: { icon: Music, color: 'text-yellow-400 bg-yellow-400/20' },
      // Archives
      zip: { icon: Archive, color: 'text-gray-400 bg-gray-400/20' },
      rar: { icon: Archive, color: 'text-gray-400 bg-gray-400/20' },
      '7z': { icon: Archive, color: 'text-gray-400 bg-gray-400/20' },
      tar: { icon: Archive, color: 'text-gray-400 bg-gray-400/20' },
      gz: { icon: Archive, color: 'text-gray-400 bg-gray-400/20' },
      // Code
      json: { icon: Code, color: 'text-amber-400 bg-amber-400/20' },
      xml: { icon: Code, color: 'text-amber-400 bg-amber-400/20' },
      html: { icon: Code, color: 'text-orange-400 bg-orange-400/20' },
      css: { icon: Code, color: 'text-blue-400 bg-blue-400/20' },
      js: { icon: Code, color: 'text-yellow-400 bg-yellow-400/20' },
      ts: { icon: Code, color: 'text-blue-400 bg-blue-400/20' },
      py: { icon: Code, color: 'text-green-400 bg-green-400/20' },
      java: { icon: Code, color: 'text-red-400 bg-red-400/20' },
      cpp: { icon: Code, color: 'text-blue-400 bg-blue-400/20' },
      c: { icon: Code, color: 'text-blue-400 bg-blue-400/20' },
    };
    return extMap[ext || ''] || { icon: File, color: 'text-amber-500/60 bg-amber-500/10' };
  };

  const formatSize = (size: string | number) => {
    if (!size) return '0 B';
    const bytes = typeof size === 'number' ? size : Number(BigInt(size));
    if (bytes <= 0) return '0 B';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Apply search
    if (searchQuery) {
      result = result.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Apply filter
    switch (currentFilter) {
      case 'recent':
        result = result.slice(0, 10);
        break;
      case 'favorites':
        result = result.filter(f => favorites.has(f.publicId));
        break;
      case 'uploads':
        result = result.slice(0, 15);
        break;
    }

    return result;
  }, [files, searchQuery, currentFilter, favorites]);

  const recentFiles = useMemo(() => files.slice(0, 5), [files]);
  const favoriteFiles = useMemo(() => files.filter(f => favorites.has(f.publicId)), [files, favorites]);

  const renderSidebarFolder = (nodes: typeof sidebarTree, depth: number) => {
    return nodes.map(node => {
      const isExpanded = expandedSidebar.has(node.id);
      const hasChildren = node.children.length > 0;
      return (
        <div key={node.id}>
          <div className="flex items-center">
            <button
              onClick={() => navigateToFolder(node.path)}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100 truncate ${
                currentFolderPath === node.path ? 'bg-blue-50 text-blue-600' : ''
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              title={node.path}
            >
              {hasChildren ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedSidebar(prev => {
                      const next = new Set(prev);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    });
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded cursor-pointer"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                </span>
              ) : (
                <span className="w-5" />
              )}
              <FolderOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{node.name}</span>
            </button>
          </div>
          {isExpanded && hasChildren && renderSidebarFolder(node.children, depth + 1)}
        </div>
      );
    });
  };

  const breadcrumbs: BreadcrumbItem[] = [
    { label: '全部文件', filter: 'all', folderPath: undefined },
  ];

  if (currentFolderPath) {
    const parts = currentFolderPath.split('/').filter(p => p);
    let path = '';
    parts.forEach((part) => {
      path += '/' + part;
      breadcrumbs.push({
        label: part,
        filter: 'all',
        folderPath: path,
      });
    });
  }

  return (
    <div className="h-screen flex flex-col bg-[#f3f3f3]">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-300 px-4 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-800">文件存储</span>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
            />
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            title="网格视图"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            title="列表视图"
          >
            <List className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={loadFiles}
            disabled={loading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">上传</span>
          </button>
        </div>
        {user && (
          <div className="flex items-center gap-3 ml-auto pl-3 border-l border-gray-300">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <div className="text-sm hidden sm:block">
                <p className="font-medium text-gray-700">{user.name}</p>
                <p className="text-xs text-gray-500">{user.username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 py-2 flex items-center gap-4">
        <div className="flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.filter + (crumb.folderPath || '')} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
              <button
                onClick={() => {
                  setCurrentFilter(crumb.filter);
                  navigateToFolder(crumb.folderPath || null);
                }}
                className={`px-2 py-1 rounded hover:bg-gray-100 ${
                  (currentFolderPath === (crumb.folderPath || null)) ? 'bg-blue-100 text-blue-600 font-medium' : 'text-gray-600'
                }`}
              >
                {crumb.label}
              </button>
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{filteredFiles.length} items</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-300 overflow-y-auto">
          <nav className="p-3 space-y-1">
            <button
              onClick={() => { setCurrentFilter('all'); navigateToFolder(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm ${currentFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <HomeIcon className="w-4 h-4" />
              <span>全部文件</span>
            </button>
            <button
              onClick={() => setCurrentFilter('recent')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm ${currentFilter === 'recent' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Clock className="w-4 h-4" />
              <span>最近</span>
            </button>
            <button
              onClick={() => setCurrentFilter('favorites')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm ${currentFilter === 'favorites' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Star className="w-4 h-4" />
              <span>收藏</span>
              {favoriteFiles.length > 0 && (
                <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {favoriteFiles.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentFilter('uploads')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm ${currentFilter === 'uploads' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Upload className="w-4 h-4" />
              <span>最近上传</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4">
          {/* Section: Favorites */}
          {currentFilter === 'all' && favoriteFiles.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <h2 className="text-lg font-semibold text-gray-800">收藏</h2>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <FileList
                  files={favoriteFiles.slice(0, 5)}
                  viewMode={viewMode}
                  onSelect={setSelectedFile}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onToggleFavorite={toggleFavorite}
                  isFavorite
                />
              </div>
            </section>
          )}

          {/* Filtered Files */}
          {currentFilter !== 'all' && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-800 capitalize">{currentFilter.replace('-', ' ')}</h2>
              </div>
              {filteredFiles.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                  <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">未找到文件</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <FileList
                    files={filteredFiles}
                    viewMode={viewMode}
                    onSelect={setSelectedFile}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    onToggleFavorite={toggleFavorite}
                    favorites={favorites}
                  />
                </div>
              )}
            </section>
          )}

          {/* All Files - Windows Explorer Style Grid View */}
          {currentFilter === 'all' && (
            <section className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  <p className="text-gray-500 ml-3">正在加载...</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {/* Folders */}
                    {folders
                      .filter(f => {
                        if (currentFolderPath == null) return f.parentId == null;
                        return f.path.substring(0, f.path.lastIndexOf('/')) === currentFolderPath;
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(folder => {
                        return (
                          <div
                            key={folder.id}
                            className="group flex flex-col items-center w-28 p-4 rounded-lg border border-blue-400 hover:border-blue-500 bg-transparent cursor-pointer transition-all"
                            onClick={() => navigateToFolder(folder.path)}
                            onContextMenu={(e) => handleContextMenuFolder(e, folder)}
                            title={folder.path}
                          >
                            <div className="w-14 h-14 flex items-center justify-center mb-2">
                              <FolderOpen className="w-12 h-12 text-blue-500 drop-shadow-lg" />
                            </div>
                            <span className="text-xs text-gray-900 text-center truncate w-full leading-tight" title={folder.name}>
                              {folder.name}
                            </span>
                          </div>
                        );
                      })}

                    {/* Files */}
                    {files
                      .filter(f => {
                        if (currentFolderPath == null) return f.folder?.path == null;
                        return f.folder?.path === currentFolderPath;
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(file => {
                        const { icon: FileIcon } = getFileIcon(file.name);
                        const isOfficeFile = getDocType(file.name) !== null;
                        return (
                          <div
                            key={file.id}
                            className="group flex flex-col items-center w-28 p-4 rounded-lg border border-blue-400 hover:border-blue-500 bg-transparent cursor-pointer transition-all"
                            onClick={() => setSelectedFile(file)}
                            onDoubleClick={() => {
                              if (isOfficeFile) {
                                openOnlyOffice(file.publicId, file.name);
                              } else {
                                setSelectedFile(file);
                              }
                            }}
                            onContextMenu={(e) => handleContextMenuFile(e, file)}
                            title={file.name}
                          >
                          <div className="w-14 h-14 flex items-center justify-center mb-2">
                              <FileIcon className="w-9 h-9 text-blue-500" />
                            </div>
                            <span className="text-xs text-gray-900 text-center truncate w-full leading-tight" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1">
                              {formatSize(file.currentVersion?.fileSize || 0)}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Empty state */}
                  {files.filter(f => {
                    if (currentFolderPath == null) return f.folder?.path == null;
                    return f.folder?.path === currentFolderPath;
                  }).length === 0 && folders.filter(f => {
                    if (currentFolderPath == null) return f.parentId == null;
                    return f.path.substring(0, f.path.lastIndexOf('/')) === currentFolderPath;
                  }).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24">
                      <FolderOpen className="w-20 h-20 mb-4 text-blue-300" />
                      <p className="text-sm text-gray-400">暂无内容</p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadForm && (
        <UploadModal
          onUpload={handleUpload}
          onClose={() => setShowUploadForm(false)}
          currentFolderPath={currentFolderPath}
        />
      )}

      {/* File Detail Modal */}
      {selectedFile && (
        <FileDetailModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onUpdate={handleUpdate}
          onRollback={handleRollback}
          onDownloadVersion={handleDownloadVersion}
          isFavorite={favorites.has(selectedFile.publicId)}
          onToggleFavorite={() => toggleFavorite(selectedFile.publicId)}
        />
      )}

      {/* OnlyOffice Editor */}
      {onlyofficeFile && (
        <OnlyOfficeEditor
          publicId={onlyofficeFile.publicId}
          fileName={onlyofficeFile.fileName}
          onClose={() => closeOnlyOffice()}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            if (contextMenu.item.type === 'file') {
              setRenameState({ type: 'file', id: contextMenu.item.id, currentName: contextMenu.item.name });
            } else {
              setRenameState({ type: 'folder', id: contextMenu.item.id, currentName: contextMenu.item.name });
            }
            setRenameInput(contextMenu.item.name);
          }}
          onDelete={() => handleDeleteFromContextMenu(contextMenu.item)}
          onMove={() => setShowFolderPicker({ type: 'move', item: contextMenu.item })}
          onCopy={() => setShowFolderPicker({ type: 'copy', item: contextMenu.item })}
          onEdit={contextMenu.item.type === 'file' && getDocType(contextMenu.item.name) ? () => {
            openOnlyOffice(contextMenu.item.id, contextMenu.item.name);
          } : undefined}
        />
      )}

      {/* Rename Modal */}
      {renameState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="font-semibold text-gray-800 mb-4">
              {renameState.type === 'folder' ? '重命名文件夹' : '重命名文件'}
            </h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(renameInput);
                if (e.key === 'Escape') setRenameState(null);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenameState(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleRename(renameInput)}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Picker Modal (Move/Copy) */}
      {showFolderPicker && (
        <FolderPickerModal
          folders={folders}
          currentFolderPath={currentFolderPath}
          onSelect={(folderPath) => {
            if (showFolderPicker.type === 'move') {
              if (showFolderPicker.item.type === 'file') handleMoveFile(folderPath);
            } else {
              if (showFolderPicker.item.type === 'file') handleCopyFile(folderPath);
            }
          }}
          onClose={() => setShowFolderPicker(null)}
          onCreateFolder={handleCreateFolderFromPicker}
        />
      )}
    </div>
  );
}

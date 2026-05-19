// Use environment variable for API URL, fallback to empty string for same-host deployment
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
import { logger } from '@/utils/client-logger';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
  logger.info('[API] getAuthHeaders:', { hasToken: !!token, headers });
  return headers;
}

export interface FileRecord {
  id: number;
  publicId: string;
  name: string;
  mimeType: string | null;
  summary: string | null;
  currentVersionId: number | null;
  currentVersion: Version | null;
  versions?: Version[];
  createdAt: string;
  updatedAt: string;
  folder?: {
    id: number;
    name: string;
    path: string;
  } | null;
  creator?: {
    id: number;
    username: string;
    name: string;
  };
}

export interface Version {
  id: number;
  publicId: string;
  versionNumber: number;
  fileSize: string | number;
  checksum: string;
  changeLog: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export async function getFiles(workspaceId?: number): Promise<FileRecord[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set('workspaceId', String(workspaceId));
  const url = `${API_URL}/api/v1/files${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      window.location.href = '/login';
    }
    throw new Error('Failed to fetch files');
  }
  const data = await res.json();
  return data.data;
}

export async function getFile(id: string): Promise<FileRecord> {
  const res = await fetch(`${API_URL}/api/v1/files/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch file');
  const data = await res.json();
  return data.data;
}

export async function uploadFile(file: globalThis.File, changeLog?: string, folderPath?: string, summary?: string, workspaceId?: number): Promise<FileRecord> {
  const formData = new FormData();
  formData.append('file', file);
  if (changeLog) formData.append('changeLog', changeLog);
  if (folderPath) formData.append('folderPath', folderPath);
  if (summary) formData.append('summary', summary);
  if (workspaceId) formData.append('workspaceId', String(workspaceId));

  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  logger.debug('[API] uploadFile:', { fileName: file.name, fileSize: file.size, changeLog, folderPath, hasToken: !!token });

  const res = await fetch(`${API_URL}/api/v1/files`, {
    method: 'POST',
    headers,
    body: formData,
  });
  logger.debug('[API] uploadFile response:', { status: res.status, ok: res.ok });
  if (!res.ok) throw new Error('Failed to upload file');
  const data = await res.json();
  return data.data;
}

export async function updateFile(id: string, file: globalThis.File, changeLog?: string): Promise<FileRecord> {
  const formData = new FormData();
  formData.append('file', file);
  if (changeLog) formData.append('changeLog', changeLog);

  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

  logger.debug('[API] updateFile:', { id, fileName: file.name, fileSize: file.size, changeLog, method: 'PUT', hasToken: !!token });

  const res = await fetch(`${API_URL}/api/v1/files/${id}`, {
    method: 'PUT',
    headers,
    body: formData,
  });
  logger.debug('[API] updateFile response:', { status: res.status, ok: res.ok });
  if (!res.ok) throw new Error('Failed to update file');
  const data = await res.json();
  return data.data;
}

export async function getVersions(fileId: string): Promise<Version[]> {
  const res = await fetch(`${API_URL}/api/v1/files/${fileId}/versions`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch versions');
  const data = await res.json();
  return data.data;
}

export async function rollback(fileId: string, versionId: string): Promise<FileRecord> {
  const res = await fetch(`${API_URL}/api/v1/files/${fileId}/rollback/${versionId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to rollback');
  const data = await res.json();
  return data.data;
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/files/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

export async function downloadFile(id: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/v1/files/${id}/download`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to download file');
  return res.blob();
}

export interface Folder {
  id: number;
  publicId: string;
  name: string;
  path: string;
  parentId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: number;
  publicId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export async function getFolders(parentPath?: string): Promise<Folder[]> {
  const res = await fetch(`${API_URL}/api/v1/folders?${parentPath ? `parentPath=${encodeURIComponent(parentPath)}` : ''}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch folders');
  const data = await res.json();
  return data.data;
}

export async function getAllFolders(workspaceId?: number): Promise<Folder[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set('workspaceId', String(workspaceId));
  const url = `${API_URL}/api/v1/folders/all${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch all folders');
  const data = await res.json();
  return data.data;
}

export async function createFolder(name: string, parentPath?: string, workspaceId?: number): Promise<Folder> {
  const res = await fetch(`${API_URL}/api/v1/folders`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, parentPath, workspaceId: workspaceId || undefined }),
  });
  if (!res.ok) throw new Error('Failed to create folder');
  const data = await res.json();
  return data.data;
}

export async function getFilesByFolder(folderPath?: string, workspaceId?: number): Promise<FileRecord[]> {
  const params = new URLSearchParams();
  if (folderPath) params.set('folderPath', folderPath);
  if (workspaceId) params.set('workspaceId', String(workspaceId));
  const url = `${API_URL}/api/v1/files?${params}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch files');
  const data = await res.json();
  return data.data;
}

export async function renameFile(id: string, name: string): Promise<FileRecord> {
  const res = await fetch(`${API_URL}/api/v1/files/${id}/rename`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename file');
  const data = await res.json();
  return data.data;
}

export async function moveFile(id: string, targetFolderPath: string): Promise<FileRecord> {
  const res = await fetch(`${API_URL}/api/v1/files/${id}/move`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetFolderPath }),
  });
  if (!res.ok) throw new Error('Failed to move file');
  const data = await res.json();
  return data.data;
}

export async function copyFile(id: string, targetFolderPath: string, newName?: string): Promise<FileRecord> {
  const res = await fetch(`${API_URL}/api/v1/files/${id}/copy`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetFolderPath, newName }),
  });
  if (!res.ok) throw new Error('Failed to copy file');
  const data = await res.json();
  return data.data;
}

export async function renameFolder(id: number, name: string): Promise<Folder> {
  const res = await fetch(`${API_URL}/api/v1/folders/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename folder');
  const data = await res.json();
  return data.data;
}

export async function deleteFolder(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/folders/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete folder');
}

export async function moveFolder(id: number, targetParentPath: string): Promise<Folder> {
  const res = await fetch(`${API_URL}/api/v1/folders/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetParentPath }),
  });
  if (!res.ok) throw new Error('Failed to move folder');
  const data = await res.json();
  return data.data;
}

// === Workspace API ===

export async function getWorkspaces(): Promise<Workspace[]> {
  const res = await fetch(`${API_URL}/api/v1/workspaces`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  const data = await res.json();
  return data.data;
}

export async function createWorkspace(name: string, color?: string): Promise<Workspace> {
  const res = await fetch(`${API_URL}/api/v1/workspaces`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error('Failed to create workspace');
  const data = await res.json();
  return data.data;
}

export async function updateWorkspace(id: number, data: { name?: string; color?: string }): Promise<Workspace> {
  const res = await fetch(`${API_URL}/api/v1/workspaces/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update workspace');
  const data2 = await res.json();
  return data2.data;
}

export async function deleteWorkspace(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/workspaces/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete workspace');
}

export async function addFolderToWorkspace(workspaceId: number, folderId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/folders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ folderId }),
  });
  if (!res.ok) throw new Error('Failed to add folder to workspace');
}

export async function removeFolderFromWorkspace(workspaceId: number, folderId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/folders?folderId=${folderId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to remove folder from workspace');
}

export async function addFileToWorkspace(workspaceId: number, filePublicId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/files`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ filePublicId }),
  });
  if (!res.ok) throw new Error('Failed to add file to workspace');
}

export async function removeFileFromWorkspace(workspaceId: number, filePublicId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/files?filePublicId=${filePublicId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to remove file from workspace');
}

export async function getItemWorkspaces(itemId: string, type: 'folder' | 'file'): Promise<Workspace[]> {
  const res = await fetch(
    `${API_URL}/api/v1/workspaces/items/${itemId}?type=${type}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error('Failed to fetch item workspaces');
  const data = await res.json();
  return data.data;
}

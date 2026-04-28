import { POST } from './route';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/store', () => ({
  store: {
    users: {
      findUnique: jest.fn(),
    },
    files: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    versions: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    folders: {
      findUnique: jest.fn(),
    },
  },
  sanitize: jest.fn((obj) => obj),
}));

function mockParams<T extends Record<string, string>>(value: T): Promise<T> {
  return Promise.resolve(value);
}

const mockUser = { sub: 1, username: 'testuser', name: 'Test', email: 'test@test.com' };
const mockDbUser = { id: 1, username: 'testuser' };
const mockFile = {
  id: 1, publicId: 'file-123', userId: 1, folderId: null,
  name: 'test.pdf', currentVersionId: 1,
};

const mockVersions = [
  { id: 1, publicId: 'ver-1', fileId: 1, versionNumber: 1, storagePath: '/path/v1', originalName: 'test.pdf', fileSize: 512, checksum: 'abc', mimeType: 'application/pdf' },
  { id: 2, publicId: 'ver-2', fileId: 1, versionNumber: 2, storagePath: '/path/v2', originalName: 'test.pdf', fileSize: 1024, checksum: 'def', mimeType: 'application/pdf' },
];

describe('Rollback API - POST /api/v1/files/:id/rollback/:versionId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.users.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(mockFile);
    (store.versions.findMany as jest.Mock).mockResolvedValue(mockVersions);
    (store.versions.create as jest.Mock).mockResolvedValue({
      id: 3, fileId: 1, versionNumber: 3, storagePath: '/path/v1',
      isCurrent: true, createdAt: new Date(),
    });
    (store.files.update as jest.Mock).mockResolvedValue(mockFile);
    (store.versions.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (store.folders.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123/rollback/ver-1', { method: 'POST' });
    const response = await POST(request, { params: mockParams({ id: 'file-123', versionId: 'ver-1' }) });
    expect(response.status).toBe(401);
  });

  it('should return 404 when user not found', async () => {
    (store.users.findUnique as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123/rollback/ver-1', { method: 'POST' });
    const response = await POST(request, { params: mockParams({ id: 'file-123', versionId: 'ver-1' }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('User not found');
  });

  it('should return 404 when file not found', async () => {
    (store.files.findUnique as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123/rollback/ver-1', { method: 'POST' });
    const response = await POST(request, { params: mockParams({ id: 'file-123', versionId: 'ver-1' }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('File not found');
  });

  it('should return 403 when file belongs to another user', async () => {
    (store.files.findUnique as jest.Mock).mockResolvedValue({ ...mockFile, userId: 2 });
    const request = new NextRequest('http://localhost/api/v1/files/file-123/rollback/ver-1', { method: 'POST' });
    const response = await POST(request, { params: mockParams({ id: 'file-123', versionId: 'ver-1' }) });
    expect(response.status).toBe(403);
  });

  it('should return 404 when version not found', async () => {
    (store.versions.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 1, publicId: 'ver-1', versionNumber: 1 },
    ]);
    const request = new NextRequest('http://localhost/api/v1/files/file-123/rollback/ver-999', { method: 'POST' });
    const response = await POST(request, { params: mockParams({ id: 'file-123', versionId: 'ver-999' }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Version not found');
  });

  it('should create a new version as rollback to v1', async () => {
    const request = new NextRequest('http://localhost/api/v1/files/file-123/rollback/ver-1', { method: 'POST' });
    const response = await POST(request, { params: mockParams({ id: 'file-123', versionId: 'ver-1' }) });

    expect(response.status).toBe(200);
    expect(store.versions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: mockFile.id,
        versionNumber: 3,
        storagePath: '/path/v1',
        changeLog: 'Rollback to version 1',
        isCurrent: true,
      })
    );
    expect(store.files.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentVersionId: expect.any(Number) } })
    );
    expect(store.versions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: mockFile.id, excludeId: expect.any(Number), data: { isCurrent: false } })
    );
  });
});

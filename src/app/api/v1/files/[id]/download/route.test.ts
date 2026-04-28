import { GET } from './route';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { readFileSync } from 'fs';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/store', () => ({
  store: {
    files: {
      findUnique: jest.fn(),
    },
    versions: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('file content')),
}));

function mockParams<T extends Record<string, string>>(value: T): Promise<T> {
  return Promise.resolve(value);
}

const mockUser = { sub: 1, username: 'testuser', name: 'Test', email: 'test@test.com' };

describe('Download API - GET /api/v1/files/:id/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123/download');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(401);
  });

  it('should return 404 when file not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/v1/files/file-123/download');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('File not found');
  });

  it('should return 404 when file has no current version', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1, currentVersionId: null,
    });

    const request = new NextRequest('http://localhost/api/v1/files/file-123/download');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(404);
  });

  it('should return 403 when file belongs to another user', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ ...mockUser, sub: 2 });
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1, currentVersionId: 1,
    });

    const request = new NextRequest('http://localhost/api/v1/files/file-123/download');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(403);
  });

  it('should return 404 when version not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1, currentVersionId: 1,
    });
    (store.versions.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/v1/files/file-123/download');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Version not found');
  });

  it('should return file content with correct headers', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1, currentVersionId: 1,
      mimeType: 'application/pdf', name: 'report.pdf',
    });
    const mockVersion = {
      id: 1, fileId: 1, storagePath: '/uploads/1/file-123',
      versionNumber: 1, checksum: 'abc', createdAt: new Date(),
      fileSize: 1024, originalName: 'report.pdf', isCurrent: true, createdBy: 1,
    };
    (store.versions.findMany as jest.Mock).mockResolvedValue([mockVersion]);

    const request = new NextRequest('http://localhost/api/v1/files/file-123/download');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('report.pdf');
    expect(readFileSync).toHaveBeenCalledWith('/uploads/1/file-123');
  });
});

import { GET } from './route';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
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
  sanitize: jest.fn((obj) => obj),
}));

function mockParams<T extends Record<string, string>>(value: T): Promise<T> {
  return Promise.resolve(value);
}

const mockUser = { sub: 1, username: 'testuser', name: 'Test', email: 'test@test.com' };

describe('Versions API - GET /api/v1/files/:id/versions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123/versions');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(401);
  });

  it('should return 404 when file not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/v1/files/file-123/versions');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('File not found');
  });

  it('should return 403 when file belongs to another user', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ ...mockUser, sub: 2 });
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1,
    });

    const request = new NextRequest('http://localhost/api/v1/files/file-123/versions');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Forbidden');
  });

  it('should return empty array when file has no versions', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1,
    });
    (store.versions.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/v1/files/file-123/versions');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual([]);
  });

  it('should return versions ordered by versionNumber desc', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'file-123', userId: 1,
    });
    const mockVersions = [
      { id: 2, fileId: 1, versionNumber: 2, isCurrent: true },
      { id: 1, fileId: 1, versionNumber: 1, isCurrent: false },
    ];
    (store.versions.findMany as jest.Mock).mockResolvedValue(mockVersions);

    const request = new NextRequest('http://localhost/api/v1/files/file-123/versions');
    const response = await GET(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual(mockVersions);
    expect(store.versions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 1, orderBy: { versionNumber: 'desc' } })
    );
  });
});

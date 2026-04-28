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
    users: {
      findUnique: jest.fn(),
    },
    groups: {
      findOrCreateDefault: jest.fn(),
    },
    folders: {
      findMany: jest.fn(),
    },
  },
}));

describe('All Folders API - GET /api/v1/folders/all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/folders/all');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 404 when user not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/v1/folders/all');
    const response = await GET(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('User not found');
  });

  it('should return all folders ordered by path', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });

    const mockFolders = [
      { id: 1, name: 'Root', path: '/root' },
      { id: 2, name: 'Sub', path: '/root/sub' },
      { id: 3, name: 'Another', path: '/another' },
    ];
    (store.folders.findMany as jest.Mock).mockResolvedValue(mockFolders);

    const request = new NextRequest('http://localhost/api/v1/folders/all');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    console.log(data)
    expect(data.data).toEqual(mockFolders);
    expect(store.folders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 1,
        orderBy: { path: 'asc' },
      })
    );
  });

  it('should return empty array when no folders exist', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
    (store.folders.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/v1/folders/all');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual([]);
  });
});

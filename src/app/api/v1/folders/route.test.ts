import { GET, POST } from './route';
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
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Folders API - GET /api/v1/folders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/folders');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 404 when user not found', async () => {
    (store.users.findUnique as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/v1/folders');
    const response = await GET(request);
    expect(response.status).toBe(404);
  });

  it('should return root folders when no parentPath', async () => {
    const mockFolders = [
      { id: 1, name: 'Folder 1', path: '/folder-1' },
      { id: 2, name: 'Folder 2', path: '/folder-2' },
    ];
    (store.folders.findMany as jest.Mock).mockResolvedValue(mockFolders);

    const request = new NextRequest('http://localhost/api/v1/folders');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual(mockFolders);
    expect(store.folders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 1, parentId: null })
    );
  });

  it('should return sub-folders when parentPath is provided', async () => {
    const parentFolder = { id: 5 };
    (store.folders.findUnique as jest.Mock).mockResolvedValue(parentFolder);
    const mockSubFolders = [{ id: 6, name: 'Sub', path: '/parent/sub' }];
    (store.folders.findMany as jest.Mock).mockResolvedValue(mockSubFolders);

    const request = new NextRequest('http://localhost/api/v1/folders?parentPath=/parent');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(store.folders.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ groupId_path: expect.objectContaining({ path: '/parent' }) })
    );
    expect(store.folders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 1, parentId: 5 })
    );
  });

  it('should return empty array when parent folder not found', async () => {
    (store.folders.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/v1/folders?parentPath=/non-existent');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual([]);
  });
});

describe('Folders API - POST /api/v1/folders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
    (store.folders.findUnique as jest.Mock).mockResolvedValue(null);
    (store.folders.create as jest.Mock).mockResolvedValue({
      id: 1, publicId: 'folder-new', name: 'New Folder', path: '/new-folder',
    });
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Folder' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 404 when user not found', async () => {
    (store.users.findUnique as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Folder' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('should return 400 when name is missing', async () => {
    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Folder name is required');
  });

  it('should create a root folder', async () => {
    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Folder' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(store.folders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Folder',
        path: '/New Folder',
        parentId: null,
      })
    );
  });

  it('should create a sub-folder when parentPath is provided', async () => {
    const parentFolder = { id: 5, path: '/parent' };
    // First call: findUnique for parentPath returns parent; second call: findUnique for existing check returns null
    (store.folders.findUnique as jest.Mock)
      .mockResolvedValueOnce(parentFolder)
      .mockResolvedValueOnce(null);
    (store.folders.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Child', parentPath: '/parent' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(store.folders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Child',
        path: '/parent/Child',
        parentId: 5,
      })
    );
  });

  it('should return 404 when parent folder not found', async () => {
    (store.folders.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Child', parentPath: '/non-existent' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Parent folder not found');
  });

  it('should return 409 when folder already exists', async () => {
    (store.folders.findUnique as jest.Mock).mockResolvedValue({
      id: 1, name: 'Existing', path: '/Existing',
    });

    const request = new NextRequest('http://localhost/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Existing' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('Folder already exists');
  });
});

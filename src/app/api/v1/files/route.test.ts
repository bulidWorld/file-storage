import { POST, GET } from './route';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
  signToken: jest.fn(() => 'mock-jwt-token'),
}));

jest.mock('@/lib/store', () => ({
  store: {
    groups: {
      findOrCreateDefault: jest.fn(() => Promise.resolve({ id: 1, name: 'default' })),
    },
    users: {
      findUnique: jest.fn(),
    },
    files: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    folders: {
      findUnique: jest.fn(),
    },
  },
  sanitize: jest.fn((obj) => obj),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({ digest: jest.fn(() => 'mock-checksum') })),
  })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

describe('Files API - GET /api/v1/files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1, username: 'testuser' });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1, name: 'default' });
    (store.files.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('should return 401 when no auth token', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/files');
    const response = await GET(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when user not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 999 });
    (store.users.findUnique as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/v1/files');
    const response = await GET(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('User not found');
  });

  it('should return file list with valid auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
    const mockFiles = [{ id: 1, name: 'test.pdf' }];
    (store.files.findMany as jest.Mock).mockResolvedValue(mockFiles);

    const request = new NextRequest('http://localhost/api/v1/files');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual(mockFiles);
  });

  it('should return empty array for non-existent folderPath', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
    (store.folders.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/v1/files?folderPath=/non-existent');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toEqual([]);
  });

  it('should filter by folderPath when folder exists', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
    (store.folders.findUnique as jest.Mock).mockResolvedValue({ id: 5 });
    const mockFiles = [{ id: 1, name: 'file-in-folder.pdf' }];
    (store.files.findMany as jest.Mock).mockResolvedValue(mockFiles);

    const request = new NextRequest('http://localhost/api/v1/files?folderPath=/test-folder');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(store.files.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 5 })
    );
  });
});

describe('Files API - POST /api/v1/files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockReturnValue({ sub: 1 });
    (store.users.findUnique as jest.Mock).mockResolvedValue({ id: 1, username: 'testuser' });
    (store.groups.findOrCreateDefault as jest.Mock).mockResolvedValue({ id: 1 });
    (store.files.create as jest.Mock).mockResolvedValue({
      id: 1,
      publicId: 'mock-uuid',
      name: 'test.pdf',
    });
    (store.folders.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'application/pdf' });
    formData.append('file', file, 'test.pdf');

    const request = new NextRequest('http://localhost/api/v1/files', {
      method: 'POST',
      body: formData,
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 when no file provided', async () => {
    const formData = new FormData();

    const request = new NextRequest('http://localhost/api/v1/files', {
      method: 'POST',
      body: formData,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No file provided');
  });

  it('should upload a file successfully', async () => {
    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'application/pdf' });
    formData.append('file', file, 'test.pdf');
    formData.append('changeLog', 'Initial upload');

    const request = new NextRequest('http://localhost/api/v1/files', {
      method: 'POST',
      body: formData,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.name).toBe('test.pdf');
    expect(store.files.create).toHaveBeenCalled();
  });

  it('should associate file with folder when folderPath is provided', async () => {
    const folder = { id: 5, name: 'Test', path: '/test-folder' };
    (store.folders.findUnique as jest.Mock).mockResolvedValue(folder);

    const formData = new FormData();
    const file = new Blob(['test'], { type: 'text/plain' });
    formData.append('file', file, 'readme.txt');
    formData.append('folderPath', '/test-folder');

    const request = new NextRequest('http://localhost/api/v1/files', {
      method: 'POST',
      body: formData,
    });
    await POST(request);

    expect(store.folders.findUnique).toHaveBeenCalled();
    expect(store.files.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 5 })
    );
  });
});

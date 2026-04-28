import { GET, PUT, DELETE } from './route';
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
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({ digest: jest.fn(() => 'mock-checksum') })),
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// Helper to create mock params
function mockParams<T extends Record<string, string>>(value: T): Promise<T> {
  return Promise.resolve(value);
}

const mockUser = { sub: 1, username: 'testuser', name: 'Test', email: 'test@test.com' };
const mockDbUser = { id: 1, username: 'testuser' };
const mockFile = {
  id: 1, publicId: 'file-123', userId: 1, folderId: null,
  name: 'test.pdf', currentVersionId: 1, versions: [],
};

describe('File Detail API - GET /api/v1/files/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const response = await GET(
      new NextRequest('http://localhost/api/v1/files/file-123'),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(401);
  });

  it('should return 404 when file not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/v1/files/file-123'),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('File not found');
  });

  it('should return 403 when file belongs to another user', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ ...mockUser, sub: 2 });
    (store.files.findUnique as jest.Mock).mockResolvedValue({ ...mockFile, userId: 1 });

    const response = await GET(
      new NextRequest('http://localhost/api/v1/files/file-123'),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Forbidden');
  });

  it('should return file details with versions', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(mockFile);
    (store.versions.findMany as jest.Mock).mockResolvedValue([{ id: 1, versionNumber: 1 }]);
    (store.users.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

    const response = await GET(
      new NextRequest('http://localhost/api/v1/files/file-123'),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
  });
});

describe('File Update API - PUT /api/v1/files/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.users.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(mockFile);
    (store.versions.findFirst as jest.Mock).mockResolvedValue({ versionNumber: 1 });
    (store.versions.create as jest.Mock).mockResolvedValue({ id: 2, versionNumber: 2 });
    (store.files.update as jest.Mock).mockResolvedValue(mockFile);
    (store.versions.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (store.versions.findMany as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const formData = new FormData();
    const file = new Blob(['test'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');

    const response = await PUT(
      new NextRequest('http://localhost/api/v1/files/file-123', { method: 'PUT', body: formData }),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(401);
  });

  it('should return 400 when no file in form data', async () => {
    const formData = new FormData();

    const response = await PUT(
      new NextRequest('http://localhost/api/v1/files/file-123', { method: 'PUT', body: formData }),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No file provided');
  });

  it('should return 404 when file not found', async () => {
    (store.files.findUnique as jest.Mock).mockResolvedValue(null);
    const formData = new FormData();
    const file = new Blob(['test'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');

    const response = await PUT(
      new NextRequest('http://localhost/api/v1/files/file-123', { method: 'PUT', body: formData }),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(404);
  });

  it('should return 403 when file belongs to another user', async () => {
    (store.files.findUnique as jest.Mock).mockResolvedValue({ ...mockFile, userId: 2 });
    const formData = new FormData();
    const file = new Blob(['test'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');

    const response = await PUT(
      new NextRequest('http://localhost/api/v1/files/file-123', { method: 'PUT', body: formData }),
      { params: mockParams({ id: 'file-123' }) }
    );
    expect(response.status).toBe(403);
  });

  it('should create new version when updating file', async () => {
    const formData = new FormData();
    const file = new Blob(['updated content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');
    formData.append('changeLog', 'Updated content');

    (store.versions.create as jest.Mock).mockResolvedValue({
      id: 2, fileId: 1, versionNumber: 2, storagePath: '/uploads/1/mock-uuid-v4',
    });

    const response = await PUT(
      new NextRequest('http://localhost/api/v1/files/file-123', { method: 'PUT', body: formData }),
      { params: mockParams({ id: 'file-123' }) }
    );

    expect(response.status).toBe(200);
    expect(store.versions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: mockFile.id,
        versionNumber: 2,
        changeLog: 'Updated content',
      })
    );
    expect(store.files.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentVersionId: 2 }) })
    );
  });
});

describe('File Delete API - DELETE /api/v1/files/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (store.files.findUnique as jest.Mock).mockResolvedValue(mockFile);
    (store.files.update as jest.Mock).mockResolvedValue({ ...mockFile, deletedAt: new Date() });
  });

  it('should return 401 when no auth', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123', { method: 'DELETE' });
    const response = await DELETE(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(401);
  });

  it('should return 404 when file not found', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    (store.files.findUnique as jest.Mock).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/v1/files/file-123', { method: 'DELETE' });
    const response = await DELETE(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(404);
  });

  it('should return 403 when file belongs to another user', async () => {
    (getAuthUser as jest.Mock).mockReturnValue({ ...mockUser, sub: 2 });
    (store.files.findUnique as jest.Mock).mockResolvedValue({ ...mockFile, userId: 1 });
    const request = new NextRequest('http://localhost/api/v1/files/file-123', { method: 'DELETE' });
    const response = await DELETE(request, { params: mockParams({ id: 'file-123' }) });
    expect(response.status).toBe(403);
  });

  it('should soft delete a file', async () => {
    (getAuthUser as jest.Mock).mockReturnValue(mockUser);
    const request = new NextRequest('http://localhost/api/v1/files/file-123', { method: 'DELETE' });
    const response = await DELETE(request, { params: mockParams({ id: 'file-123' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('File deleted successfully');
    expect(store.files.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockFile.id,
        data: expect.objectContaining({ deletedAt: expect.any(String), deletedBy: mockUser.sub }),
      })
    );
  });
});

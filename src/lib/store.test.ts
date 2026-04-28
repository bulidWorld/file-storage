import { prisma, store } from './store';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    version: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    folder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('Store Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('users', () => {
    describe('findUnique', () => {
      it('should find user by id', async () => {
        const mockUser = { id: 1, username: 'testuser', email: 'test@test.com' };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        const result = await store.users.findUnique({ id: 1 });

        expect(result).toEqual(mockUser);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 1 },
        });
      });

      it('should find user by username', async () => {
        const mockUser = { id: 1, username: 'testuser', email: 'test@test.com' };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        const result = await store.users.findUnique({ username: 'testuser' });

        expect(result).toEqual(mockUser);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { username: 'testuser' },
        });
      });

      it('should find user by email using findFirst', async () => {
        const mockUser = { id: 1, username: 'testuser', email: 'test@test.com' };
        (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

        const result = await store.users.findUnique({ email: 'test@test.com' });

        expect(result).toEqual(mockUser);
      });

      it('should return null when no where clause matches', async () => {
        const result = await store.users.findUnique({});
        expect(result).toBeNull();
      });
    });

    describe('create', () => {
      it('should create a new user with auto-generated publicId', async () => {
        const mockUser = {
          id: 1,
          publicId: 'user-123',
          username: 'newuser',
          email: 'new@test.com',
          name: 'New User',
        };
        (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

        const result = await store.users.create({
          username: 'newuser',
          email: 'new@test.com',
          name: 'New User',
        });

        expect(result).toEqual(mockUser);
        expect(prisma.user.create).toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update user by id', async () => {
        const mockUser = { id: 1, username: 'updated', email: 'updated@test.com' };
        (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

        const result = await store.users.update({
          id: 1,
          data: { username: 'updated' },
        });

        expect(result).toEqual(mockUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { username: 'updated' },
        });
      });
    });
  });

  describe('files', () => {
    describe('findMany', () => {
      it('should find files by groupId', async () => {
        const mockFiles = [
          { id: 1, publicId: 'file-1', userId: 1, name: 'test.txt' },
        ];
        (prisma.file.findMany as jest.Mock).mockResolvedValue(mockFiles);

        const result = await store.files.findMany({
          groupId: 1,
          userId: 1,
        });

        expect(result).toEqual(mockFiles);
      });

      it('should filter out deleted files', async () => {
        (prisma.file.findMany as jest.Mock).mockResolvedValue([]);

        await store.files.findMany({
          groupId: 1,
          deletedAt: null,
        });

        expect(prisma.file.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ deletedAt: null }),
          })
        );
      });

      it('should include related data', async () => {
        (prisma.file.findMany as jest.Mock).mockResolvedValue([]);

        await store.files.findMany({
          groupId: 1,
          include: { currentVersion: true, folder: true, creator: true },
        });

        expect(prisma.file.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              currentVersion: true,
              folder: true,
              creator: { select: { id: true, username: true, name: true } },
            },
          })
        );
      });
    });

    describe('findUnique', () => {
      it('should find file by publicId', async () => {
        const mockFile = { id: 1, publicId: 'file-123', name: 'test.txt' };
        (prisma.file.findUnique as jest.Mock).mockResolvedValue(mockFile);

        const result = await store.files.findUnique({ publicId: 'file-123' });

        expect(result).toEqual(mockFile);
      });

      it('should include versions ordered by versionNumber desc', async () => {
        (prisma.file.findUnique as jest.Mock).mockResolvedValue({});

        await store.files.findUnique({ publicId: 'file-123' });

        expect(prisma.file.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            include: expect.objectContaining({
              versions: { orderBy: { versionNumber: 'desc' } },
            }),
          })
        );
      });
    });
  });

  describe('versions', () => {
    describe('findMany', () => {
      it('should find versions by fileId', async () => {
        const mockVersions = [
          { id: 1, versionNumber: 1, fileId: 1 },
          { id: 2, versionNumber: 2, fileId: 1 },
        ];
        (prisma.version.findMany as jest.Mock).mockResolvedValue(mockVersions);

        const result = await store.versions.findMany({
          fileId: 1,
        });

        expect(result).toEqual(mockVersions);
      });

      it('should order by versionNumber desc', async () => {
        (prisma.version.findMany as jest.Mock).mockResolvedValue([]);

        await store.versions.findMany({
          fileId: 1,
          orderBy: { versionNumber: 'desc' },
        });

        expect(prisma.version.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { versionNumber: 'desc' },
          })
        );
      });
    });

    describe('findFirst', () => {
      it('should find first version by fileId', async () => {
        const mockVersion = { id: 1, versionNumber: 1, fileId: 1 };
        (prisma.version.findFirst as jest.Mock).mockResolvedValue(mockVersion);

        const result = await store.versions.findFirst({
          fileId: 1,
        });

        expect(result).toEqual(mockVersion);
      });

      it('should select only versionNumber when specified', async () => {
        (prisma.version.findFirst as jest.Mock).mockResolvedValue({ versionNumber: 5 });

        const result = await store.versions.findFirst({
          fileId: 1,
          select: { versionNumber: true },
        });

        expect(result?.versionNumber).toBe(5);
      });
    });

    describe('create', () => {
      it('should create a new version with auto-generated publicId', async () => {
        const mockVersion = {
          id: 1,
          publicId: 'ver-123',
          fileId: 1,
          versionNumber: 1,
          storagePath: '/path/to/file',
          fileSize: BigInt(1024),
          checksum: 'abc123',
        };
        (prisma.version.create as jest.Mock).mockResolvedValue(mockVersion);

        const result = await store.versions.create({
          fileId: 1,
          versionNumber: 1,
          storagePath: '/path/to/file',
          fileSize: 1024,
          checksum: 'abc123',
          isCurrent: true,
          createdBy: 1,
        });

        expect(result).toEqual(mockVersion);
      });
    });

    describe('updateMany', () => {
      it('should update versions by id', async () => {
        (prisma.version.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

        await store.versions.updateMany({
          id: 1,
          data: { isCurrent: false },
        });

        expect(prisma.version.updateMany).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { isCurrent: false },
        });
      });

      it('should update versions by fileId', async () => {
        (prisma.version.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

        await store.versions.updateMany({
          fileId: 1,
          data: { isCurrent: true },
        });

        expect(prisma.version.updateMany).toHaveBeenCalledWith({
          where: { fileId: 1 },
          data: { isCurrent: true },
        });
      });
    });
  });

  describe('folders', () => {
    describe('findMany', () => {
      it('should find folders by groupId', async () => {
        const mockFolders = [
          { id: 1, name: 'Folder 1', path: '/folder1' },
        ];
        (prisma.folder.findMany as jest.Mock).mockResolvedValue(mockFolders);

        const result = await store.folders.findMany({
          groupId: 1,
          userId: 1,
        });

        expect(result).toEqual(mockFolders);
      });

      it('should order by name asc', async () => {
        (prisma.folder.findMany as jest.Mock).mockResolvedValue([]);

        await store.folders.findMany({
          groupId: 1,
          orderBy: { name: 'asc' },
        });

        expect(prisma.folder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { name: 'asc' },
          })
        );
      });
    });

    describe('findUnique', () => {
      it('should find folder by id', async () => {
        const mockFolder = { id: 1, name: 'Folder 1', path: '/folder1' };
        (prisma.folder.findUnique as jest.Mock).mockResolvedValue(mockFolder);

        const result = await store.folders.findUnique({ id: 1 });

        expect(result).toEqual(mockFolder);
      });

      it('should find folder by groupId and path', async () => {
        const mockFolder = { id: 1, name: 'Folder 1', path: '/folder1', groupId: 1 };
        (prisma.folder.findUnique as jest.Mock).mockResolvedValue(mockFolder);

        const result = await store.folders.findUnique({
          groupId_path: { groupId: 1, path: '/folder1' },
        });

        expect(result).toEqual(mockFolder);
        expect(prisma.folder.findUnique).toHaveBeenCalledWith({
          where: {
            groupId_path: {
              groupId: 1,
              path: '/folder1',
            },
          },
        });
      });
    });

    describe('create', () => {
      it('should create a new folder with auto-generated publicId', async () => {
        const mockFolder = {
          id: 1,
          publicId: 'folder-123',
          name: 'New Folder',
          path: '/new-folder',
          userId: 1,
          groupId: 1,
        };
        (prisma.folder.create as jest.Mock).mockResolvedValue(mockFolder);

        const result = await store.folders.create({
          userId: 1,
          groupId: 1,
          name: 'New Folder',
          path: '/new-folder',
        });

        expect(result).toEqual(mockFolder);
      });
    });
  });
});

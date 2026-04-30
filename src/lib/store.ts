import { PrismaClient, Version } from '@prisma/client';

export const prisma = new PrismaClient();

export function sanitize<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj) as unknown as T;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj as object)) {
    result[key] = sanitize((obj as any)[key]);
  }
  return result;
}

export const store = {
  groups: {
    findOrCreateDefault: async () => {
      let group = await prisma.group.findFirst({
        where: { name: 'default' },
      });

      if (!group) {
        group = await prisma.group.create({
          data: {
            name: 'default',
            publicId: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        });
      }

      return group;
    },
    getMember: async (groupId: number, userId: number) => {
      return prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });
    },
    addMember: async (groupId: number, userId: number, role: string = 'member') => {
      return prisma.groupMember.create({
        data: {
          groupId,
          userId,
          role,
        },
      });
    },
  },
  users: {
    findUnique: ({ id, username, email }: { id?: number; username?: string; email?: string }) => {
      if (id) return prisma.user.findUnique({ where: { id } });
      if (username) return prisma.user.findUnique({ where: { username } });
      if (email) return prisma.user.findFirst({ where: { email } });
      return Promise.resolve(null);
    },
    create: (data: { username: string; email: string; name: string; dn?: string }) => {
      return prisma.user.create({
        data: {
          ...data,
          publicId: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      });
    },
    update: ({ id, data }: { id: number; data: Partial<{ username: string; email: string; name: string; dn: string }> }) => {
      return prisma.user.update({
        where: { id },
        data,
      });
    },
  },
  files: {
    findMany: async ({ groupId, userId, folderId, deletedAt, include, orderBy }: {
      groupId?: number;
      userId?: number;
      folderId?: number | null;
      deletedAt?: null | any;
      include?: { currentVersion?: boolean; folder?: boolean; creator?: boolean; versions?: boolean };
      orderBy?: { updatedAt?: 'asc' | 'desc' };
    }) => {
      const prismaWhere: any = {};
      if (groupId) prismaWhere.groupId = groupId;
      if (userId) prismaWhere.userId = userId;
      if (folderId !== undefined) prismaWhere.folderId = folderId;
      if (deletedAt === null) prismaWhere.deletedAt = null;

      return prisma.file.findMany({
        where: prismaWhere,
        include: {
          ...(include?.currentVersion && { currentVersion: true }),
          ...(include?.folder && { folder: true }),
          ...(include?.creator && { creator: { select: { id: true, username: true, name: true } } }),
          ...(include?.versions && { versions: { orderBy: { versionNumber: 'desc' } } }),
        },
        orderBy: orderBy?.updatedAt ? { updatedAt: orderBy.updatedAt } : undefined,
      });
    },
    findUnique: ({ id, publicId }: { id?: number; publicId?: string }) => {
      return prisma.file.findUnique({
        where: id ? { id } : { publicId: publicId! },
        include: { currentVersion: true, folder: true, creator: true, versions: { orderBy: { versionNumber: 'desc' } } },
      });
    },
    create: async (data: {
      userId: number;
      groupId: number;
      folderId?: number | null;
      name: string;
      mimeType?: string | null;
      path: string;
      summary?: string | null;
      currentVersionId?: number | null;
      versions?: {
        create: {
          versionNumber: number;
          storagePath: string;
          originalName: string;
          fileSize: number | bigint;
          checksum: string;
          mimeType?: string | null;
          changeLog?: string | null;
          isCurrent: boolean;
          createdBy: number;
        };
      };
    }) => {
      const publicId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { versions, ...fileData } = data;
      return prisma.file.create({
        data: {
          ...fileData,
          publicId,
          currentVersionId: undefined,
          versions: versions ? {
            create: {
              ...versions.create,
              publicId: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              fileSize: BigInt(versions.create.fileSize),
            },
          } : undefined,
        },
        include: { versions: true },
      }).then(async (file) => {
        if (versions?.create) {
          const version = await prisma.version.findFirst({
            where: { fileId: file.id },
            orderBy: { versionNumber: 'desc' },
          });
          if (version) {
            return prisma.file.update({
              where: { id: file.id },
              data: { currentVersionId: version.id },
              include: { versions: true },
            });
          }
        }
        return file;
      });
    },
    update: ({ id, data }: { id: number; data: Partial<{ name: string; summary: string; currentVersionId: number | null; deletedAt: string | null; deletedBy: number | null; folderId: number | null }> }) => {
      return prisma.file.update({
        where: { id },
        data,
      });
    },
    updateMany: ({ fileId, data }: { fileId?: number; data: Partial<{ isCurrent: boolean }> }) => {
      return prisma.version.updateMany({
        where: fileId ? { fileId } : {},
        data,
      });
    },
  },
  versions: {
    findMany: ({ fileId, orderBy }: {
      fileId?: number;
      orderBy?: { versionNumber?: 'asc' | 'desc' };
    }) => {
      return prisma.version.findMany({
        where: fileId ? { fileId } : {},
        orderBy: orderBy?.versionNumber ? { versionNumber: orderBy.versionNumber } : undefined,
      });
    },
    findFirst: ({ fileId, orderBy, select }: {
      fileId?: number;
      orderBy?: { versionNumber?: 'asc' | 'desc' };
      select?: { versionNumber: boolean };
    }) => {
      return prisma.version.findFirst({
        where: fileId ? { fileId } : {},
        orderBy: orderBy?.versionNumber ? { versionNumber: orderBy.versionNumber } : undefined,
        select,
      });
    },
    create: async (data: {
      fileId: number;
      versionNumber: number;
      storagePath: string;
      originalName?: string | null;
      fileSize: number | bigint;
      checksum: string;
      mimeType?: string | null;
      changeLog?: string | null;
      isCurrent: boolean;
      createdBy: number;
    }) => {
      const publicId = `ver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return prisma.version.create({
        data: {
          ...data,
          publicId,
          fileSize: BigInt(data.fileSize),
        },
      });
    },
    updateMany: ({ id, fileId, excludeId, data }: { id?: number; fileId?: number; excludeId?: number; data: Partial<{ isCurrent: boolean }> }) => {
      const where: any = {};
      if (id) where.id = id;
      if (fileId) where.fileId = fileId;
      if (excludeId) where.NOT = { id: excludeId };
      return prisma.version.updateMany({
        where: Object.keys(where).length > 0 ? where : {},
        data,
      });
    },
  },
  folders: {
    findMany: ({ groupId, userId, parentId, orderBy }: {
      groupId?: number;
      userId?: number;
      parentId?: number | null;
      orderBy?: { name?: 'asc' | 'desc'; path?: 'asc' | 'desc' };
    }) => {
      const prismaWhere: any = {};
      if (groupId) prismaWhere.groupId = groupId;
      if (userId) prismaWhere.userId = userId;
      if (parentId !== undefined) prismaWhere.parentId = parentId;

      return prisma.folder.findMany({
        where: prismaWhere,
        orderBy: orderBy ? {
          ...(orderBy.name && { name: orderBy.name }),
          ...(orderBy.path && { path: orderBy.path }),
        } : undefined,
      });
    },
    findUnique: ({ id, groupId_path }: { id?: number; groupId_path?: { groupId: number; path: string } }) => {
      if (id) {
        return prisma.folder.findUnique({
          where: { id },
        });
      }
      if (groupId_path) {
        return prisma.folder.findUnique({
          where: {
            groupId_path: {
              groupId: groupId_path.groupId,
              path: groupId_path.path,
            },
          },
        });
      }
      return Promise.resolve(null);
    },
    create: async (data: {
      userId: number;
      groupId: number;
      parentId?: number | null;
      name: string;
      path: string;
    }) => {
      const publicId = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return prisma.folder.create({
        data: {
          ...data,
          publicId,
        },
      });
    },
    update: ({ id, data }: { id: number; data: { name?: string; path?: string; parentId?: number | null } }) => {
      return prisma.folder.update({
        where: { id },
        data,
      });
    },
  },
};

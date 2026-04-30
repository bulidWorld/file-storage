import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, prisma } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// DELETE /api/v1/folders/[id] - Delete folder and its children
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folder = await store.folders.findUnique({ id: Number(id) });
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const defaultGroup = await store.groups.findOrCreateDefault();

    // Get all folders in the hierarchy (folder + all descendants)
    const allFolders = await store.folders.findMany({
      groupId: defaultGroup.id,
      parentId: undefined,
      orderBy: { path: 'asc' },
    });

    const hierarchy = allFolders.filter(f =>
      f.path === folder.path || f.path.startsWith(folder.path + '/')
    );

    // Sort by path depth descending (deepest first) for bottom-up deletion
    hierarchy.sort((a, b) => {
      const aDepth = a.path.split('/').filter(Boolean).length;
      const bDepth = b.path.split('/').filter(Boolean).length;
      return bDepth - aDepth;
    });

    // Soft-delete files and remove each folder (deepest first)
    for (const f of hierarchy) {
      const folderFiles = await prisma.file.findMany({
        where: { folderId: f.id, groupId: defaultGroup.id },
      });
      const now = new Date();
      for (const file of folderFiles) {
        await prisma.file.update({
          where: { id: file.id },
          data: { deletedAt: now, deletedBy: user.id },
        });
      }
      await prisma.folder.delete({ where: { id: f.id } });
    }

    return NextResponse.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    logger.error('Folder delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/folders/[id] - Rename or move folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, targetParentPath } = body;

    const folder = await store.folders.findUnique({ id: Number(id) });
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const defaultGroup = await store.groups.findOrCreateDefault();

    let newName = folder.name;
    let newParentId = folder.parentId;
    let newPath = folder.path;

    // Handle rename
    if (name && name !== folder.name) {
      const oldPath = folder.path;
      newName = name;

      // Update all child folders' paths
      const childFolders = await store.folders.findMany({
        groupId: defaultGroup.id,
        parentId: undefined,
        orderBy: { path: 'asc' },
      });

      const children = childFolders.filter(f => f.path.startsWith(oldPath + '/'));

      // Update current folder
      if (newParentId === null) {
        newPath = '/' + newName;
      } else {
        const parent = await store.folders.findUnique({ id: newParentId });
        newPath = parent ? parent.path + '/' + newName : '/' + newName;
      }

      await store.folders.update({
        id: folder.id,
        data: { name: newName, path: newPath, parentId: newParentId },
      });

      // Update children paths
      for (const child of children) {
        const childNewPath = child.path.replace(oldPath, newPath);
        await store.folders.update({
          id: child.id,
          data: { path: childNewPath },
        });
      }
    }

    // Handle move to different parent
    if (targetParentPath !== undefined) {
      let targetParentId: number | null = null;
      if (targetParentPath && targetParentPath !== '/') {
        const targetParent = await store.folders.findUnique({
          groupId_path: { groupId: defaultGroup.id, path: targetParentPath },
        });
        if (!targetParent) {
          return NextResponse.json({ error: 'Target parent folder not found' }, { status: 404 });
        }
        targetParentId = targetParent.id;
      }

      if (targetParentId !== folder.parentId) {
        newParentId = targetParentId;
        if (targetParentId === null) {
          newPath = '/' + newName;
        } else {
          const parent = await store.folders.findUnique({ id: targetParentId });
          newPath = parent ? parent.path + '/' + newName : '/' + newName;
        }

        // Update all child folders' paths
        const childFolders = await store.folders.findMany({
          groupId: defaultGroup.id,
          parentId: undefined,
          orderBy: { path: 'asc' },
        });

        const children = childFolders.filter(f => f.path.startsWith(folder.path + '/'));

        await store.folders.update({
          id: folder.id,
          data: { parentId: newParentId, path: newPath },
        });

        for (const child of children) {
          const childNewPath = child.path.replace(folder.path, newPath);
          await store.folders.update({
            id: child.id,
            data: { path: childNewPath },
          });
        }
      }
    }

    const updatedFolder = await store.folders.findUnique({ id: folder.id });

    return NextResponse.json({ data: updatedFolder });
  } catch (error) {
    logger.error('Folder rename/move error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

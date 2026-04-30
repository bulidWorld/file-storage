import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// POST /api/v1/files/[id]/move - Move file to folder
export async function POST(
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
    const { targetFolderPath } = body;

    if (!targetFolderPath && targetFolderPath !== '/') {
      return NextResponse.json({ error: 'Target folder path is required' }, { status: 400 });
    }

    const file = await store.files.findUnique({ publicId: id });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const defaultGroup = await store.groups.findOrCreateDefault();

    let targetFolderId: number | null = null;
    if (targetFolderPath && targetFolderPath !== '/') {
      const targetFolder = await store.folders.findUnique({
        groupId_path: { groupId: defaultGroup.id, path: targetFolderPath },
      });
      if (!targetFolder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
      }
      targetFolderId = targetFolder.id;
    }

    const updatedFile = await store.files.update({
      id: file.id,
      data: { folderId: targetFolderId },
    });

    const versions = await store.versions.findMany({
      fileId: file.id,
      orderBy: { versionNumber: 'desc' },
    });

    const folder = updatedFile.folderId
      ? await store.folders.findUnique({ id: updatedFile.folderId })
      : null;
    const creator = await store.users.findUnique({ id: file.userId });

    return NextResponse.json({
      data: sanitize({
        ...updatedFile,
        currentVersion: file.currentVersionId
          ? await store.versions.findMany({ fileId: file.id }).then(vs => vs.find(v => v.id === file.currentVersionId))
          : null,
        folder,
        creator,
        versions,
      }),
    });
  } catch (error) {
    logger.error('Move file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

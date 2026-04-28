import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { logger } from '@/utils/logger';

// PATCH /api/v1/files/[id] - Rename file
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
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const file = await store.files.findUnique({ publicId: id });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedFile = await store.files.update({
      id: file.id,
      data: { name },
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
    logger.error('Rename file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

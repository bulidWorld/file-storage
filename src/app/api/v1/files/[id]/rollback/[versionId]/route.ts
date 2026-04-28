import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { logger } from '@/utils/logger';

// POST /api/v1/files/:id/rollback/:versionId - Rollback to specific version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUser = await store.users.findUnique({ id: user.sub });
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const file = await store.files.findUnique({ publicId: id });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (file.userId !== user.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const versions = await store.versions.findMany({ fileId: file.id });
    const targetVersion = versions.find(v => v.publicId === versionId);

    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const maxVersionNumber = Math.max(...versions.map(v => v.versionNumber));
    const newVersionNumber = maxVersionNumber + 1;

    const newVersion = await store.versions.create({
      fileId: file.id,
      versionNumber: newVersionNumber,
      storagePath: targetVersion.storagePath,
      originalName: targetVersion.originalName,
      fileSize: targetVersion.fileSize,
      checksum: targetVersion.checksum,
      mimeType: targetVersion.mimeType,
      changeLog: `Rollback to version ${targetVersion.versionNumber}`,
      isCurrent: true,
      createdBy: dbUser.id,
    });

    await store.files.update({
      id: file.id,
      data: { currentVersionId: newVersion.id },
    });

    await store.versions.updateMany({
      fileId: file.id,
      excludeId: newVersion.id,
      data: { isCurrent: false },
    });

    await store.versions.updateMany({
      id: newVersion.id,
      data: { isCurrent: true },
    });

    const allVersions = await store.versions.findMany({
      fileId: file.id,
      orderBy: { versionNumber: 'desc' },
    });

    const updatedFile = await store.files.findUnique({ id: file.id });
    const folder = updatedFile?.folderId ? await store.folders.findUnique({ id: updatedFile.folderId }) : null;
    const creator = await store.users.findUnique({ id: file.userId });

    return NextResponse.json({ data: sanitize({
      ...updatedFile,
      currentVersion: newVersion,
      folder,
      creator,
      versions: allVersions,
    }) });
  } catch (error) {
    logger.error('Rollback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

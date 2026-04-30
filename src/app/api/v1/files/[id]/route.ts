import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '@/utils/server-logger';

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// GET /api/v1/files/:id - Get single file details
export async function GET(
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

    const file = await store.files.findUnique({ publicId: id });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const versions = await store.versions.findMany({
      fileId: file.id,
      orderBy: { versionNumber: 'desc' },
    });

    const currentVersion = file.currentVersionId ? await store.versions.findMany({ fileId: file.id }).then(vs => vs.find(v => v.id === file.currentVersionId)) : null;
    const folder = file.folderId ? await store.folders.findUnique({ id: file.folderId }) : null;
    const creator = await store.users.findUnique({ id: file.userId });

    return NextResponse.json({ data: sanitize({
      ...file,
      currentVersion,
      folder,
      creator,
      versions,
    }) });
  } catch (error) {
    logger.error('Get file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/v1/files/:id - Update file (new version)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const changeLog = formData.get('changeLog') as string | undefined;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const dbUser = await store.users.findUnique({ id: user.sub });
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existingFile = await store.files.findUnique({ publicId: id });
    if (!existingFile) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (existingFile.userId !== user.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const checksum = computeChecksum(fileBuffer);
    const publicId = uuidv4();
    const userDir = join(process.cwd(), 'uploads', dbUser.id.toString());
    const storagePath = join(userDir, publicId);

    ensureDir(userDir);
    writeFileSync(storagePath, fileBuffer);

    const maxVersion = await store.versions.findFirst({
      fileId: existingFile.id,
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const newVersionNumber = (maxVersion?.versionNumber || 0) + 1;

    const newVersion = await store.versions.create({
      fileId: existingFile.id,
      versionNumber: newVersionNumber,
      storagePath,
      originalName: file.name,
      fileSize: fileBuffer.length,
      checksum,
      mimeType: file.type,
      changeLog: changeLog || null,
      isCurrent: true,
      createdBy: dbUser.id,
    });

    await store.files.update({
      id: existingFile.id,
      data: { currentVersionId: newVersion.id },
    });

    await store.versions.updateMany({
      fileId: existingFile.id,
      excludeId: newVersion.id,
      data: { isCurrent: false },
    });
    await store.versions.updateMany({ id: newVersion.id, data: { isCurrent: true } });

    const versions = await store.versions.findMany({
      fileId: existingFile.id,
      orderBy: { versionNumber: 'desc' },
    });

    const updatedFile = await store.files.findUnique({ id: existingFile.id });
    const folder = updatedFile?.folderId ? await store.folders.findUnique({ id: updatedFile.folderId }) : null;
    const creator = await store.users.findUnique({ id: existingFile.userId });

    return NextResponse.json({ data: sanitize({
        ...updatedFile,
        currentVersion: newVersion,
        folder,
        creator,
        versions,
      }) });
  } catch (error) {
    logger.error('Update file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/files/:id - Delete file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const file = await store.files.findUnique({ publicId: id });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    if (file.userId !== user.sub) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await store.files.update({
      id: file.id,
      data: { deletedAt: new Date().toISOString(), deletedBy: user.sub },
    });

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    logger.error('Delete file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

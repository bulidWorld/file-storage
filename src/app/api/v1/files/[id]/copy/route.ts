import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '@/utils/logger';

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// POST /api/v1/files/[id]/copy - Copy file to folder
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
    const { targetFolderPath, newName } = body;

    if (!targetFolderPath) {
      return NextResponse.json({ error: 'Target folder path is required' }, { status: 400 });
    }

    const file = await store.files.findUnique({ publicId: id });
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dbUser = await store.users.findUnique({ id: user.sub });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const defaultGroup = await store.groups.findOrCreateDefault();

    let targetFolderId: number | null = null;
    if (targetFolderPath !== '/') {
      const targetFolder = await store.folders.findUnique({
        groupId_path: { groupId: defaultGroup.id, path: targetFolderPath },
      });
      if (!targetFolder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
      }
      targetFolderId = targetFolder.id;
    }

    // Get current version to read file content
    const currentVersion = file.currentVersionId
      ? await store.versions.findMany({ fileId: file.id }).then(vs => vs.find(v => v.id === file.currentVersionId))
      : null;

    if (!currentVersion) {
      return NextResponse.json({ error: 'Current version not found' }, { status: 404 });
    }

    const fileName = newName || file.name;
    const fileBuffer = readFileSync(currentVersion.storagePath);
    const checksum = computeChecksum(fileBuffer);
    const publicId = uuidv4();
    const groupDir = join(UPLOAD_DIR, defaultGroup.id.toString());
    const storagePath = join(groupDir, publicId);

    if (!existsSync(groupDir)) {
      mkdirSync(groupDir, { recursive: true });
    }
    writeFileSync(storagePath, fileBuffer);

    const newFile = await store.files.create({
      userId: dbUser.id,
      groupId: defaultGroup.id,
      folderId: targetFolderId,
      name: fileName,
      mimeType: file.mimeType,
      path: storagePath,
      currentVersionId: null,
      versions: {
        create: {
          versionNumber: 1,
          storagePath,
          originalName: fileName,
          fileSize: fileBuffer.length,
          checksum,
          mimeType: file.mimeType,
          changeLog: `Copied from ${file.name}`,
          isCurrent: true,
          createdBy: dbUser.id,
        },
      },
    });

    return NextResponse.json({ data: sanitize(newFile) });
  } catch (error) {
    logger.error('Copy file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

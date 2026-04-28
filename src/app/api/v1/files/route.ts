import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '@/utils/logger';

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// GET /api/v1/files - List all files
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await store.users.findUnique({ id: user.sub });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const defaultGroup = await store.groups.findOrCreateDefault();

    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('folderPath');

    let folderId: number | null = null;
    if (folderPath && folderPath !== '/') {
      const folder = await store.folders.findUnique({
        groupId_path: { groupId: defaultGroup.id, path: folderPath },
      });
      if (folder) {
        folderId = folder.id;
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const files = await store.files.findMany({
      groupId: defaultGroup.id,
      folderId,
      deletedAt: null,
      include: { currentVersion: true, folder: true, creator: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: sanitize(files) });
  } catch (error) {
    logger.error('Get files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/files - Upload a new file
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const changeLog = formData.get('changeLog') as string | undefined;
    const summary = formData.get('summary') as string | undefined;
    const folderPath = formData.get('folderPath') as string | undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const dbUser = await store.users.findUnique({ id: user.sub });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const defaultGroup = await store.groups.findOrCreateDefault();

    let folderId: number | null = null;
    if (folderPath && folderPath !== '/') {
      const folder = await store.folders.findUnique({
        groupId_path: { groupId: defaultGroup.id, path: folderPath },
      });
      if (folder) folderId = folder.id;
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const checksum = computeChecksum(fileBuffer);
    const publicId = uuidv4();
    const groupDir = join(UPLOAD_DIR, defaultGroup.id.toString());
    const storagePath = join(groupDir, publicId);

    ensureDir(groupDir);
    writeFileSync(storagePath, fileBuffer);

    const newFile = await store.files.create({
      userId: dbUser.id,
      groupId: defaultGroup.id,
      folderId,
      name: file.name,
      mimeType: file.type,
      summary: summary || null,
      path: storagePath,
      currentVersionId: null,
      versions: {
        create: {
          versionNumber: 1,
          storagePath,
          originalName: file.name,
          fileSize: fileBuffer.length,
          checksum,
          mimeType: file.type,
          changeLog: changeLog || null,
          isCurrent: true,
          createdBy: dbUser.id,
        },
      },
    });

    return NextResponse.json({ data: sanitize(newFile) });
  } catch (error) {
    logger.error('Upload file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

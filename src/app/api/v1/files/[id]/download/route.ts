import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { readFileSync } from 'fs';
import { logger } from '@/utils/logger';

// GET /api/v1/files/:id/download - Download file
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
    if (!file || !file.currentVersionId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.userId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentVersion = await store.versions.findMany({
      fileId: file.id,
    }).then(vs => vs.find(v => v.id === file.currentVersionId));

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const content = readFileSync(currentVersion.storagePath);

    return new NextResponse(content, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
    });
  } catch (error) {
    logger.error('Download file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

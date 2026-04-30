import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// GET /api/v1/files/:id/versions - Get file versions
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

    return NextResponse.json({ data: sanitize(versions) });
  } catch (error) {
    logger.error('Get versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// GET /api/v1/folders/all - Get all folders as flat list
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
    const workspaceId = searchParams.get('workspaceId');

    let folders;
    if (workspaceId) {
      folders = await store.folders.findMany({
        groupId: defaultGroup.id,
        workspaceId: Number(workspaceId),
        orderBy: { path: 'asc' },
      });
    } else {
      folders = await store.folders.findMany({
        groupId: defaultGroup.id,
        orderBy: { path: 'asc' },
      });
    }

    return NextResponse.json({ data: folders });
  } catch (error) {
    logger.error('Get all folders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

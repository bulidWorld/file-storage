import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// GET /api/v1/folders - List folders
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
    const parentPath = searchParams.get('parentPath');

    let folders;
    if (parentPath && parentPath !== '/') {
      const parent = await store.folders.findUnique({
        groupId_path: { groupId: defaultGroup.id, path: parentPath },
      });
      if (!parent) {
        return NextResponse.json({ data: [] });
      }
      folders = await store.folders.findMany({
        groupId: defaultGroup.id,
        parentId: parent.id,
        orderBy: { name: 'asc' },
      });
    } else {
      folders = await store.folders.findMany({
        groupId: defaultGroup.id,
        parentId: null,
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ data: folders });
  } catch (error) {
    logger.error('Get folders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/folders - Create folder
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, parentPath } = body;

    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    let fullPath = '/' + name;
    let parentId: number | null = null;

    if (parentPath && parentPath !== '/') {
      const parent = await store.folders.findUnique({
        groupId_path: { groupId: defaultGroup.id, path: parentPath },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }
      fullPath = parentPath + '/' + name;
      parentId = parent.id;
    }

    const existing = await store.folders.findUnique({
      groupId_path: { groupId: defaultGroup.id, path: fullPath },
    });

    if (existing) {
      return NextResponse.json({ error: 'Folder already exists' }, { status: 409 });
    }

    const folder = await store.folders.create({
      userId: dbUser.id,
      groupId: defaultGroup.id,
      name,
      path: fullPath,
      parentId,
    });

    return NextResponse.json({ data: folder });
  } catch (error) {
    logger.error('Create folder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

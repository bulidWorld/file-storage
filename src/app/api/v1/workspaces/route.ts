import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// GET /api/v1/workspaces - List all workspaces
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaces = await store.workspaces.findMany();
    return NextResponse.json({ data: workspaces });
  } catch (error) {
    logger.error('Get workspaces error:', error);
    logger.error('Get workspaces detail:', { message: (error as Error).message, stack: (error as Error).stack });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/workspaces - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, color } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const workspace = await store.workspaces.create({
      name: name.trim(),
      color: color || undefined,
    });
    return NextResponse.json({ data: workspace });
  } catch (error) {
    logger.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

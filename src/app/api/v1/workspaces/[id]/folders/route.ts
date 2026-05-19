import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// POST /api/v1/workspaces/[id]/folders - Add folder to workspace
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspace = await store.workspaces.findUnique({ id: Number(id) });
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const body = await request.json();
    const { folderId } = body;
    if (!folderId) return NextResponse.json({ error: 'folderId is required' }, { status: 400 });

    await store.workspaceFolders.addToWorkspace(Number(id), Number(folderId));
    return NextResponse.json({ message: 'Folder added to workspace' });
  } catch (error) {
    logger.error('Add folder to workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/workspaces/[id]/folders - Remove folder from workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspace = await store.workspaces.findUnique({ id: Number(id) });
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    if (!folderId) return NextResponse.json({ error: 'folderId query param is required' }, { status: 400 });

    await store.workspaceFolders.removeFromWorkspace(Number(id), Number(folderId));
    return NextResponse.json({ message: 'Folder removed from workspace' });
  } catch (error) {
    logger.error('Remove folder from workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

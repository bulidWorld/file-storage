import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// PATCH /api/v1/workspaces/[id] - Update workspace
export async function PATCH(
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
    const { name, color } = body;

    const updated = await store.workspaces.update({
      id: Number(id),
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
      },
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('Update workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/workspaces/[id] - Delete workspace
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

    if (workspace.publicId === 'workspace-default') {
      return NextResponse.json({ error: 'Cannot delete default workspace' }, { status: 400 });
    }

    await store.workspaces.delete(Number(id));
    return NextResponse.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    logger.error('Delete workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

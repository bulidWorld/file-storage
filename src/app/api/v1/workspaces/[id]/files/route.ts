import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// POST /api/v1/workspaces/[id]/files - Add file to workspace
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
    const { filePublicId } = body;
    if (!filePublicId) return NextResponse.json({ error: 'filePublicId is required' }, { status: 400 });

    const file = await store.files.findUnique({ publicId: filePublicId });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    await store.workspaceFiles.addToWorkspace(Number(id), file.id);
    return NextResponse.json({ message: 'File added to workspace' });
  } catch (error) {
    logger.error('Add file to workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/workspaces/[id]/files - Remove file from workspace
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
    const filePublicId = searchParams.get('filePublicId');
    if (!filePublicId) return NextResponse.json({ error: 'filePublicId query param is required' }, { status: 400 });

    const file = await store.files.findUnique({ publicId: filePublicId });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    await store.workspaceFiles.removeFromWorkspace(Number(id), file.id);
    return NextResponse.json({ message: 'File removed from workspace' });
  } catch (error) {
    logger.error('Remove file from workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

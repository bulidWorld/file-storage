import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { store, sanitize } from '@/lib/store';
import { logger } from '@/utils/server-logger';

// GET /api/v1/workspaces/items/[itemId] - Get all workspaces for a folder or file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const authHeader = request.headers.get('authorization');
    const user = getAuthUser(authHeader);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'folder' | 'file'

    if (type === 'folder') {
      const folder = await store.folders.findUnique({ publicId: itemId });
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      const wfEntries = await store.workspaceFolders.findByFolder(folder.id);
      const workspaces = wfEntries.map(e => e.workspace);
      return NextResponse.json({ data: workspaces });
    } else if (type === 'file') {
      const file = await store.files.findUnique({ publicId: itemId });
      if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
      const wfEntries = await store.workspaceFiles.findByFile(file.id);
      const workspaces = wfEntries.map(e => e.workspace);
      return NextResponse.json({ data: workspaces });
    } else {
      return NextResponse.json({ error: 'type query param (folder|file) is required' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Get item workspaces error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

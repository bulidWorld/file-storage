import { NextRequest, NextResponse } from 'next/server'
import { verifyDownloadToken } from '@/lib/onlyoffice'
import { store } from '@/lib/store'
import { readFileSync } from 'fs'
import { logger } from '@/utils/server-logger'

// GET /onlyoffice/download/[publicId]?token=xxx - Short-lived token-based file serving for OnlyOffice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params
    const token = new URL(request.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing download token' }, { status: 401 })
    }

    const verifiedPublicId = verifyDownloadToken(token)
    if (!verifiedPublicId || verifiedPublicId !== publicId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const file = await store.files.findUnique({ publicId: verifiedPublicId })
    if (!file || !file.currentVersionId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const currentVersion = await store.versions.findMany({
      fileId: file.id,
    }).then(vs => vs.find(v => v.id === file.currentVersionId))

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const content = readFileSync(currentVersion.storagePath)

    return new NextResponse(content, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
    })
  } catch (error) {
    logger.error('OnlyOffice download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also handle GET /documents/[publicId] - OnlyOffice needs to fetch the original file
// This route uses the same token-based auth
export async function GET_DOCUMENTS(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  return GET(request, { params })
}

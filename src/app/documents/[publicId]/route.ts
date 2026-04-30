import { NextRequest, NextResponse } from 'next/server'
import { generateDownloadToken } from '@/lib/onlyoffice'
import { store } from '@/lib/store'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { logger } from '@/utils/server-logger'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

// GET /documents/[publicId] - Serve file for OnlyOffice (token-based, no auth header needed)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params
    const token = new URL(request.url).searchParams.get('token')

    if (token) {
      const { verifyDownloadToken } = await import('@/lib/onlyoffice')
      const verifiedPublicId = verifyDownloadToken(token)
      if (verifiedPublicId && verifiedPublicId === publicId) {
        // Token valid, serve the file
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
          },
        })
      }
    }

    // Fallback: try serving directly from storage path by publicId filename
    const directPath = join(UPLOAD_DIR, publicId)
    if (existsSync(directPath)) {
      const content = readFileSync(directPath)
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      })
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch (error) {
    logger.error('Documents serve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

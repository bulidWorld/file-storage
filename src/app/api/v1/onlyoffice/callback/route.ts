import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { store } from '@/lib/store'
import { v4 as uuidv4 } from 'uuid'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { logger } from '@/utils/server-logger'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// POST /api/v1/onlyoffice/callback - OnlyOffice save callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actions, key, status, url, users } = body

    logger.info('OnlyOffice callback:', { url, status, key, userCount: users?.length, actionCount: actions?.length })

    // status 2 = editing finished, 5 = editing by user, 6 = editing closed without changes
    if (status === 2 || status === 5 || status === 6) {
      if (url) {
        const publicId = key.split('_')[0]
        const file = await store.files.findUnique({ publicId })

        if (file) {
          // Replace external IP with internal OnlyOffice container address
          const internalUrl = url.replace(/https?:\/\/[\d.]+:\d+/, 'http://onlyoffice:80')
          logger.info('[onlyoffice-callback] original url:', url)
          logger.info('[onlyoffice-callback] internal url:', internalUrl)

          // Download the modified file from OnlyOffice
          const response = await axios.get(internalUrl, { responseType: 'arraybuffer' })
          logger.info('[onlyoffice-callback] download response:', { status: response.status, headers: JSON.stringify(response.headers), dataLength: response.data.length })
          
          const fileBuffer = Buffer.from(response.data)
          const checksum = computeChecksum(fileBuffer)

          // Check if file content actually changed
          if (file.currentVersionId) {
            const currentVersion = await store.versions.findMany({
              fileId: file.id,
            }).then(vs => vs.find(v => v.id === file.currentVersionId))

            if (currentVersion && currentVersion.checksum === checksum) {
              logger.info('File not changed, skipping save:', publicId)
              return NextResponse.json({ error: 0 })
            }
          }

          // Save new version
          const newPublicId = uuidv4()
          const groupDir = join(UPLOAD_DIR, file.groupId.toString())
          const storagePath = join(groupDir, newPublicId)

          ensureDir(groupDir)
          writeFileSync(storagePath, fileBuffer)

          const maxVersion = await store.versions.findFirst({
            fileId: file.id,
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true },
          })

          const newVersionNumber = (maxVersion?.versionNumber || 0) + 1

          const newVersion = await store.versions.create({
            fileId: file.id,
            versionNumber: newVersionNumber,
            storagePath,
            originalName: file.name,
            fileSize: fileBuffer.length,
            checksum,
            mimeType: file.mimeType,
            changeLog: 'Auto-saved from OnlyOffice',
            isCurrent: true,
            createdBy: file.userId,
          })

          await store.files.update({
            id: file.id,
            data: { currentVersionId: newVersion.id },
          })

          await store.versions.updateMany({
            fileId: file.id,
            excludeId: newVersion.id,
            data: { isCurrent: false },
          })

          logger.info('OnlyOffice file saved:', { publicId, version: newVersionNumber })
        }
      }
    }

    return NextResponse.json({ error: 0 })
  } catch (error) {
    logger.error('OnlyOffice callback error:', error)
    return NextResponse.json({ error: 1, message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

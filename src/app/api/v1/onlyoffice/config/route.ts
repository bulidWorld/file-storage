import { NextRequest, NextResponse } from 'next/server'
import { config, generateToken, getDocType, generateDownloadToken } from '@/lib/onlyoffice'
import { store } from '@/lib/store'
import { logger } from '@/utils/server-logger'

export async function POST(request: NextRequest) {
  try {
    const { publicId, fileName, user } = await request.json()

    if (!publicId || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const file = await store.files.findUnique({ publicId })
    if (!file || !file.currentVersionId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const docType = getDocType(fileName)
    if (!docType) {
      return NextResponse.json({ error: 'Unsupported document format' }, { status: 400 })
    }

    const ext = fileName.split('.').pop() || ''
    const downloadToken = generateDownloadToken(publicId)
    const documentUrl = `${config.SERVER_OUTER_URL}/onlyoffice/download/${publicId}?token=${downloadToken}`
    const callbackUrl = `${config.CALLBACK_URL || config.SERVER_OUTER_URL}/api/v1/onlyoffice/callback`

    const documentKey = `${publicId}_${Date.now()}`

    const token = generateToken({
      document: {
        fileType: ext,
        key: documentKey,
        title: fileName,
        url: documentUrl,
        permissions: {
          comment: true,
          copy: true,
          download: true,
          edit: true,
          fillForms: true,
          modifyContentControl: true,
          modifyFilter: true,
          print: true,
          review: true,
        },
      },
      editorConfig: {
        mode: 'edit',
        lang: 'zh-CN',
        location: 'CN',
        callbackUrl,
        user: {
          id: user?.id || 'user-' + Date.now(),
          name: user?.name || 'Anonymous',
        },
        actionLink: null,
      },
    })

    const onlyOfficeConfig = {
      document: {
        fileType: ext,
        key: documentKey,
        title: fileName,
        url: documentUrl,
        permissions: {
          comment: true,
          copy: true,
          download: true,
          edit: true,
          fillForms: true,
          modifyContentControl: true,
          modifyFilter: true,
          print: true,
          review: true,
        },
      },
      editorConfig: {
        mode: 'edit',
        lang: 'zh-CN',
        location: 'CN',
        callbackUrl,
        user: {
          id: user?.id || 'user-' + Date.now(),
          name: user?.name || 'Anonymous',
        },
        customization: {
          autosave: true,
          chat: true,
          comments: true,
          feedback: false,
          forcesave: true,
          reviewDisplay: 'original',
          showReviewChanges: true,
          spellcheck: true,
          toolbarHideFileName: false,
          toolbarNoTabs: false,
          unit: 'cm',
          zoom: 100,
        },
      },
      height: '100%',
      width: '100%',
      token,
    }

    return NextResponse.json(onlyOfficeConfig)
  } catch (error) {
    logger.error('OnlyOffice config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

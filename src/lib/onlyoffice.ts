import jwt from 'jsonwebtoken'
import path from 'path'

export const config = {
  PORT: parseInt(process.env.PORT || '10530', 10),
  ONLYOFFICE_URL: process.env.ONLYOFFICE_URL || 'http://localhost:8080',
  JWT_SECRET: process.env.JWT_SECRET || 'office-face-secret-key-2024',
  SERVER_OUTER_URL: process.env.SERVER_OUTER_URL || 'http://localhost:10530',
  CALLBACK_URL: process.env.CALLBACK_URL || null,
}

console.log('[onlyoffice] config loaded:', {
  ONLYOFFICE_URL: config.ONLYOFFICE_URL,
  SERVER_OUTER_URL: config.SERVER_OUTER_URL,
  CALLBACK_URL: config.CALLBACK_URL,
  PORT: config.PORT,
  JWT_SECRET:config.JWT_SECRET
})

export const supportedFormats = {
  word: ['.docx', '.doc', '.odt', '.txt', '.rtf'],
  cell: ['.xlsx', '.xls', '.ods', '.csv'],
  presentation: ['.pptx', '.ppt', '.odp'],
}

export type DocType = 'word' | 'cell' | 'presentation' | null

export function getDocType(filename: string): DocType {
  const ext = path.extname(filename).toLowerCase()
  const type = supportedFormats.word.includes(ext) ? 'word'
    : supportedFormats.cell.includes(ext) ? 'cell'
    : supportedFormats.presentation.includes(ext) ? 'presentation'
    : null
  console.log(`[onlyoffice] getDocType: filename=${filename}, ext=${ext}, type=${type}`)
  return type
}

export function generateToken(payload: object): string {
  const now = Math.floor(Date.now() / 1000)
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + 3600,
  }

  console.log('[DEBUG] token editorConfig =', JSON.stringify((payload as any).editorConfig, null, 2))
  console.log('[onlyoffice] generateToken: payload keys=', Object.keys(payload))
  const token = jwt.sign(tokenPayload, config.JWT_SECRET, { algorithm: 'HS256' })
  console.log('[onlyoffice] generateToken: token length=', token.length)
  return token
}

export function generateDownloadToken(publicId: string): string {
  const now = Math.floor(Date.now() / 1000)
  console.log(`[onlyoffice] generateDownloadToken: publicId=${publicId}`)
  const token = jwt.sign(
    { publicId, iat: now, exp: now + 300 },
    config.JWT_SECRET,
    { algorithm: 'HS256' }
  )
  console.log('[onlyoffice] generateDownloadToken: token length=', token.length)
  return token
}

export function verifyDownloadToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { publicId: string }
    console.log(`[onlyoffice] verifyDownloadToken: success, publicId=${decoded.publicId}`)
    return decoded.publicId
  } catch (err) {
    console.error('[onlyoffice] verifyDownloadToken: failed,', err)
    return null
  }
}

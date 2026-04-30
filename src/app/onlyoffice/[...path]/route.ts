import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { config } from '@/lib/onlyoffice'

interface Params {
  params: Promise<{ path: string[] }>
}

export async function GET(request: NextRequest, ctx: Params) {
  try {
    const { path: pathParts } = await ctx.params
    const pathStr = pathParts.join('/')
    const targetUrl = `${config.ONLYOFFICE_URL}/${pathStr}`

    // Forward request headers to upstream, stripping undefined/null values
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (key !== 'host' && value) {
        headers[key] = value
      }
    })

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers,
    })

    const contentType = response.headers['content-type']
    const responseHeaders: Record<string, string> = {}
    if (contentType) {
      responseHeaders['Content-Type'] = contentType as string
    }

    return new NextResponse(response.data, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch {
    return NextResponse.json({ error: 'Unable to connect to OnlyOffice service' }, { status: 502 })
  }
}

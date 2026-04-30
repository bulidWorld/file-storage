'use client'

import { useEffect, useRef, useCallback } from 'react'

interface OnlyOfficeEditorProps {
  publicId: string
  fileName: string
  onClose: () => void
}

declare global {
  interface Window {
    DocsAPI: {
      DocEditor: new (containerId: string, config: Record<string, unknown>) => {
        destroyEditor: () => void
      }
    }
  }
}

export function OnlyOfficeEditor({ publicId, fileName, onClose }: OnlyOfficeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null)

  const loadEditor = useCallback(async () => {
    if (!containerRef.current) return

    const userName = localStorage.getItem('office-face-username') || '匿名用户'
    let userId = localStorage.getItem('office-face-userid')
    if (!userId) {
      userId = 'user-' + Date.now()
      localStorage.setItem('office-face-userid', userId)
    }

    try {
      const response = await fetch('/api/v1/onlyoffice/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId,
          fileName,
          user: { id: userId, name: userName },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get editor config')
      }

      const config = await response.json()
      const token = config.token
      delete config.token

      containerRef.current.innerHTML = '<div id="onlyoffice-editor" style="width:100%;height:100%;"></div>'

      if (editorRef.current) {
        editorRef.current.destroyEditor()
      }

      editorRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor', {
        width: '100%',
        height: '100%',
        token,
        document: config.document,
        editorConfig: config.editorConfig,
        events: {
          onAppReady: () => console.log('Editor ready'),
          onDocumentStateChange: (event: unknown) => console.log('Document state changed:', event),
          onDownloadAs: (event: unknown) => console.log('Download as:', event),
          onError: (event: unknown) => console.error('Editor error:', event),
        },
      })
    } catch (error) {
      console.error('Failed to open document:', error)
      alert('Failed to open document: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [publicId, fileName])

  useEffect(() => {
    loadEditor()
    return () => {
      if (editorRef.current) {
        editorRef.current.destroyEditor()
        editorRef.current = null
      }
    }
  }, [loadEditor])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700 truncate">{fileName}</h2>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
        <div ref={containerRef} className="flex-1 overflow-hidden" />
      </div>
    </div>
  )
}

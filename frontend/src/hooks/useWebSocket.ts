import { useEffect, useRef, useCallback, useState } from 'react'

export type WSMessage = {
  type: string
  agent?: string
  message: string
  data?: Record<string, unknown>
  session_id?: string
}

export function useWebSocket(sessionId: string | null, onMessage: (msg: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback((sid: string) => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const wsUrl = apiBase.replace(/^http/, 'ws') + `/ws/${sid}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WSMessage
        onMessageRef.current(data)
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  useEffect(() => {
    if (sessionId) connect(sessionId)
    return () => {
      wsRef.current?.close()
    }
  }, [sessionId, connect])

  return { connected }
}

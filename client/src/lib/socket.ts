import { io, type Socket } from 'socket.io-client'

// One shared WebSocket connection for the whole app.
let socket: Socket | null = null
let socketToken: string | null = null

/**
 * Connect (or reuse the existing connection) for this token.
 * Idempotent on purpose: React StrictMode runs effects twice in development,
 * and a second connection would orphan listeners attached to the first.
 */
export function connectSocket(token: string): Socket {
  if (socket && socketToken === token) return socket
  socket?.disconnect()
  socketToken = token
  socket = io(import.meta.env.VITE_API_URL ?? '', {
    auth: { token },
    transports: ['websocket'],
  })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
  socketToken = null
}

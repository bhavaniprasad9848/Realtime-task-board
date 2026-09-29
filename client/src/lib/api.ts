import type { Activity, Board, Card, User } from '../types'
import { getSocket } from './socket'

const BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'taskboard_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  // Tell the server which socket made this change so it doesn't echo it back to us.
  const socketId = getSocket()?.id
  if (socketId) headers['x-socket-id'] = socketId

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`)
  return data as T
}

type AuthResponse = { token: string; user: User }
type BoardResponse = { board: Board }
type CardResponse = { card: Card }

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/register', { name, email, password }),
  login: (email: string, password: string) => request<AuthResponse>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  listBoards: () => request<{ boards: Board[] }>('GET', '/boards'),
  createBoard: (title: string) => request<BoardResponse>('POST', '/boards', { title }),
  getBoard: (id: string) => request<{ board: Board; cards: Card[] }>('GET', `/boards/${id}`),
  renameBoard: (id: string, title: string) => request<BoardResponse>('PATCH', `/boards/${id}`, { title }),
  deleteBoard: (id: string) => request<void>('DELETE', `/boards/${id}`),
  addMember: (id: string, email: string) => request<BoardResponse>('POST', `/boards/${id}/members`, { email }),
  activity: (id: string) => request<{ activity: Activity[] }>('GET', `/boards/${id}/activity`),

  addColumn: (boardId: string, title: string) => request<BoardResponse>('POST', `/boards/${boardId}/columns`, { title }),
  renameColumn: (boardId: string, columnId: string, title: string) =>
    request<BoardResponse>('PATCH', `/boards/${boardId}/columns/${columnId}`, { title }),
  deleteColumn: (boardId: string, columnId: string) =>
    request<BoardResponse>('DELETE', `/boards/${boardId}/columns/${columnId}`),

  createCard: (boardId: string, columnId: string, title: string) =>
    request<CardResponse>('POST', `/boards/${boardId}/cards`, { columnId, title }),
  updateCard: (id: string, changes: Partial<Pick<Card, 'title' | 'description' | 'dueDate' | 'assignee'>>) =>
    request<CardResponse>('PATCH', `/cards/${id}`, changes),
  moveCard: (id: string, columnId: string, beforeId: string | null, afterId: string | null) =>
    request<CardResponse>('POST', `/cards/${id}/move`, { columnId, beforeId, afterId }),
  deleteCard: (id: string) => request<void>('DELETE', `/cards/${id}`),
}

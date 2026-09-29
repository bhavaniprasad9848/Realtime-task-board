export interface User {
  id: string
  name: string
  email: string
}

export interface Member {
  id: string
  name?: string
  email?: string
}

export interface Column {
  id: string
  title: string
  position: number
}

export interface Board {
  id: string
  title: string
  owner: string
  members: Member[]
  columns: Column[]
  updatedAt: string
}

export interface Card {
  id: string
  boardId: string
  columnId: string
  title: string
  description: string
  position: number
  assignee: string | null
  dueDate: string | null
  updatedAt: string
}

export interface Activity {
  id: string
  userName: string
  message: string
  createdAt: string
}

export interface PresenceUser {
  id: string
  name: string
}

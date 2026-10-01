export type User = {
  id: string
  name: string
  email: string
}

export type Card = {
  id: string
  title: string
  description: string
  position: number
  dueDate: string | null
  columnId: string
  assigneeId: string | null
  assignee: { id: string; name: string } | null
}

export type Column = {
  id: string
  title: string
  position: number
  boardId: string
  cards: Card[]
}

export type Role = 'OWNER' | 'MEMBER'

export type Member = {
  boardId: string
  userId: string
  role: Role
  user: User
}

export type BoardSummary = {
  id: string
  title: string
  createdAt: string
  _count: { members: number }
}

export type Board = {
  id: string
  title: string
  createdAt: string
  members: Member[]
  columns: Column[]
}

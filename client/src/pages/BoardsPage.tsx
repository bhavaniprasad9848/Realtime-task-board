import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Board } from '../types'

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.listBoards().then((r) => setBoards(r.boards)).catch((e) => setError(e.message))
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const { board } = await api.createBoard(title.trim())
      navigate(`/boards/${board.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create board')
    }
  }

  return (
    <main className="page">
      <h2>Your boards</h2>
      <form className="inline-form" onSubmit={onCreate}>
        <input placeholder="New board name, e.g. Website Redesign" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn primary">Create board</button>
      </form>
      {error && <p className="error">{error}</p>}

      {boards === null ? (
        <p className="muted">Loading…</p>
      ) : boards.length === 0 ? (
        <p className="muted">No boards yet. Create your first one above.</p>
      ) : (
        <div className="board-grid">
          {boards.map((b) => (
            <Link key={b.id} to={`/boards/${b.id}`} className="board-tile">
              <strong>{b.title}</strong>
              <span className="muted">
                {b.columns.length} columns · {b.members.length} member{b.members.length === 1 ? '' : 's'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

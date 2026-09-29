import { useState, type FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Card, Column as ColumnT, Member } from '../types'
import CardItem from './CardItem'

interface Props {
  column: ColumnT
  cardIds: string[]
  cards: Record<string, Card>
  members: Member[]
  onAddCard: (columnId: string, title: string) => void
  onRename: (columnId: string, title: string) => void
  onDelete: (columnId: string) => void
  onOpenCard: (card: Card) => void
}

export default function Column({ column, cardIds, cards, members, onAddCard, onRename, onDelete, onOpenCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}`, data: { type: 'column' } })
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(column.title)

  function submitCard(e: FormEvent) {
    e.preventDefault()
    if (newTitle.trim()) onAddCard(column.id, newTitle.trim())
    setNewTitle('')
  }

  function submitRename(e?: FormEvent) {
    e?.preventDefault()
    setEditing(false)
    if (title.trim() && title.trim() !== column.title) onRename(column.id, title.trim())
    else setTitle(column.title)
  }

  return (
    <section className={`column ${isOver ? 'column-over' : ''}`}>
      <header className="column-header">
        {editing ? (
          <form onSubmit={submitRename} className="grow">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => submitRename()} autoFocus />
          </form>
        ) : (
          <h3 onDoubleClick={() => { setTitle(column.title); setEditing(true) }} title="Double-click to rename">
            {column.title} <span className="count">{cardIds.length}</span>
          </h3>
        )}
        <button
          className="icon-btn"
          title="Delete column"
          onClick={() => {
            if (confirm(`Delete "${column.title}" and its ${cardIds.length} card(s)?`)) onDelete(column.id)
          }}
        >
          ×
        </button>
      </header>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="card-list">
          {cardIds.map((id) =>
            cards[id] ? <CardItem key={id} card={cards[id]} members={members} onOpen={onOpenCard} /> : null,
          )}
        </div>
      </SortableContext>

      {adding ? (
        <form onSubmit={submitCard} className="add-card-form">
          <textarea
            placeholder="What needs to be done?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submitCard(e)
              if (e.key === 'Escape') setAdding(false)
            }}
            autoFocus
          />
          <div className="row">
            <button className="btn primary small">Add card</button>
            <button type="button" className="btn ghost small" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="add-card-btn" onClick={() => setAdding(true)}>+ Add a card</button>
      )}
    </section>
  )
}

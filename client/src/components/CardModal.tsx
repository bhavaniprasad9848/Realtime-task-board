import { useEffect, useState } from 'react'
import type { Card, Member } from '../types'

interface Props {
  card: Card
  members: Member[]
  columnTitle: string
  onClose: () => void
  onSave: (changes: Partial<Pick<Card, 'title' | 'description' | 'dueDate' | 'assignee'>>) => void
  onDelete: () => void
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

export default function CardModal({ card, members, columnTitle, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [dueDate, setDueDate] = useState(toDateInput(card.dueDate))
  const [assignee, setAssignee] = useState(card.assignee ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function save() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`).toISOString() : null,
      assignee: assignee || null,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p className="muted small">in {columnTitle}</p>
        <input className="modal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>
          Description
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add more detail…" />
        </label>
        <div className="row">
          <label className="grow">
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="grow">
            Assignee
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row modal-actions">
          <button className="btn danger" onClick={() => { if (confirm('Delete this card?')) { onDelete(); onClose() } }}>
            Delete
          </button>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

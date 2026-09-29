import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card, Member } from '../types'
import Avatar from './Avatar'

const isOverdue = (due: Date) => due.getTime() < Date.now()

interface Props {
  card: Card
  members: Member[]
  onOpen?: (card: Card) => void
  overlay?: boolean
}

export function CardView({ card, members, overlay }: Omit<Props, 'onOpen'>) {
  const assignee = members.find((m) => m.id === card.assignee)
  const due = card.dueDate ? new Date(card.dueDate) : null
  const overdue = due ? isOverdue(due) : false
  return (
    <div className={`card ${overlay ? 'card-overlay' : ''}`}>
      <div className="card-title">{card.title}</div>
      {(card.description || due || assignee) && (
        <div className="card-meta">
          {card.description && <span title="Has description">≡</span>}
          {due && <span className={`badge ${overdue ? 'badge-danger' : ''}`}>{due.toLocaleDateString()}</span>}
          <span className="spacer" />
          {assignee && <Avatar id={assignee.id} name={assignee.name} size={22} />}
        </div>
      )}
    </div>
  )
}

export default function CardItem({ card, members, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onOpen?.(card)}>
      <CardView card={card} members={members} />
    </div>
  )
}

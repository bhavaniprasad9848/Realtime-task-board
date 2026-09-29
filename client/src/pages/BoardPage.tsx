import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getSocket } from '../lib/socket'
import { groupByColumn, positionBetween } from '../lib/ordering'
import type { Activity, Board, Card, PresenceUser } from '../types'
import Column from '../components/Column'
import { CardView } from '../components/CardItem'
import CardModal from '../components/CardModal'
import SidePanel from '../components/SidePanel'
import Avatar from '../components/Avatar'

type Groups = Record<string, string[]>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => void

const keyById = (cards: Card[]) => Object.fromEntries(cards.map((c) => [c.id, c]))

export default function BoardPage() {
  const { boardId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [board, setBoard] = useState<Board | null>(null)
  const [cards, setCards] = useState<Record<string, Card>>({})
  const [activity, setActivity] = useState<Activity[]>([])
  const [online, setOnline] = useState<PresenceUser[]>([])
  const [connected, setConnected] = useState(true)
  const [error, setError] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(true)
  const [newColumn, setNewColumn] = useState('')

  // While dragging we keep a temporary copy of the column order so cards can
  // hop between columns smoothly; it is cleared when the drag ends.
  const [dragGroups, setDragGroups] = useState<Groups | null>(null)
  const dragGroupsRef = useRef<Groups | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const columnIds = useMemo(() => board?.columns.map((c) => c.id) ?? [], [board])
  const grouped = useMemo(() => groupByColumn(cards, columnIds), [cards, columnIds])
  const groups = dragGroups ?? grouped

  const updateDragGroups = (g: Groups | null) => {
    dragGroupsRef.current = g
    setDragGroups(g)
  }

  const flashError = (msg: string) => {
    setError(msg)
    window.setTimeout(() => setError(''), 4000)
  }

  // ---------- Loading ----------

  const load = useCallback(async () => {
    try {
      const [{ board: b, cards: c }, { activity: a }] = await Promise.all([api.getBoard(boardId), api.activity(boardId)])
      setBoard(b)
      setCards(keyById(c))
      setActivity(a)
    } catch {
      navigate('/', { replace: true })
    }
  }, [boardId, navigate])

  useEffect(() => {
    load()
  }, [load])

  // ---------- Real-time ----------

  /** Last-write-wins: ignore an update older than what we already have. */
  const upsertCard = useCallback((incoming: Card) => {
    setCards((prev) => {
      const existing = prev[incoming.id]
      if (existing && new Date(existing.updatedAt) > new Date(incoming.updatedAt)) return prev
      return { ...prev, [incoming.id]: incoming }
    })
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const join = () => socket.emit('board:join', boardId)
    // After a reconnect we may have missed events, so re-join and re-fetch.
    const onConnect = () => {
      setConnected(true)
      join()
      load()
    }
    const onDisconnect = () => setConnected(false)

    const handlers: Record<string, Handler> = {
      'card:upserted': (c: Card) => upsertCard(c),
      'card:deleted': ({ id }: { id: string }) =>
        setCards((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        }),
      'cards:rebalanced': (list: Card[]) => setCards((prev) => ({ ...prev, ...keyById(list) })),
      'column:deleted': ({ columnId }: { columnId: string }) =>
        setCards((prev) => Object.fromEntries(Object.entries(prev).filter(([, c]) => c.columnId !== columnId))),
      'board:updated': (b: Board) => setBoard(b),
      'board:deleted': () => navigate('/', { replace: true }),
      'activity:new': (a: Activity) => setActivity((prev) => [a, ...prev].slice(0, 30)),
      presence: (users: PresenceUser[]) => setOnline(users),
    }

    if (socket.connected) join()
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn)

    return () => {
      socket.emit('board:leave', boardId)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn)
    }
  }, [boardId, load, navigate, upsertCard])

  // ---------- Drag and drop ----------

  const sensors = useSensors(
    // 5px threshold so a normal click still opens the card
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findColumn = (id: string, g: Groups): string | undefined => {
    if (id.startsWith('col:')) return id.slice(4)
    return Object.keys(g).find((col) => g[col].includes(id))
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
    updateDragGroups(grouped)
  }

  // Fires continuously while dragging: move the card into whichever column it's over.
  function onDragOver({ active, over }: DragOverEvent) {
    const g = dragGroupsRef.current
    if (!over || !g) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = findColumn(activeKey, g)
    const to = findColumn(overKey, g)
    if (!from || !to || from === to) return

    const toList = [...g[to]]
    const overIndex = toList.indexOf(overKey)
    toList.splice(overIndex >= 0 ? overIndex : toList.length, 0, activeKey)
    updateDragGroups({ ...g, [from]: g[from].filter((id) => id !== activeKey), [to]: toList })
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const g = dragGroupsRef.current
    setActiveId(null)
    updateDragGroups(null)
    if (!over || !g) return

    const cardId = String(active.id)
    const columnId = findColumn(cardId, g)
    if (!columnId) return

    // Final re-order within the destination column
    let list = g[columnId]
    const overKey = String(over.id)
    if (!overKey.startsWith('col:') && overKey !== cardId && list.includes(overKey)) {
      list = arrayMove(list, list.indexOf(cardId), list.indexOf(overKey))
    }

    const index = list.indexOf(cardId)
    const beforeId = list[index - 1] ?? null
    const afterId = list[index + 1] ?? null

    const card = cards[cardId]
    const original = grouped[card.columnId] ?? []
    const originalIndex = original.indexOf(cardId)
    const unchanged =
      card.columnId === columnId &&
      (original[originalIndex - 1] ?? null) === beforeId &&
      (original[originalIndex + 1] ?? null) === afterId
    if (unchanged) return

    // 1) Optimistic update: move it on our screen immediately
    const position = positionBetween(
      beforeId ? cards[beforeId].position : null,
      afterId ? cards[afterId].position : null,
    )
    setCards((prev) => ({ ...prev, [cardId]: { ...card, columnId, position } }))

    // 2) Tell the server; it saves and broadcasts to teammates
    try {
      const { card: saved } = await api.moveCard(cardId, columnId, beforeId, afterId)
      upsertCard(saved)
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Move failed')
      load() // roll back to the server's truth
    }
  }

  // ---------- Actions ----------

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      flashError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const addCard = (columnId: string, title: string) =>
    run(async () => upsertCard((await api.createCard(boardId, columnId, title)).card))

  const saveCard = (id: string, changes: Parameters<typeof api.updateCard>[1]) =>
    run(async () => upsertCard((await api.updateCard(id, changes)).card))

  const deleteCard = (id: string) =>
    run(async () => {
      await api.deleteCard(id)
      setCards((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    })

  const addColumn = (e: FormEvent) => {
    e.preventDefault()
    if (!newColumn.trim()) return
    run(async () => {
      setBoard((await api.addColumn(boardId, newColumn.trim())).board)
      setNewColumn('')
    })
  }

  const renameColumn = (columnId: string, title: string) =>
    run(async () => setBoard((await api.renameColumn(boardId, columnId, title)).board))

  const deleteColumn = (columnId: string) =>
    run(async () => {
      setBoard((await api.deleteColumn(boardId, columnId)).board)
      setCards((prev) => Object.fromEntries(Object.entries(prev).filter(([, c]) => c.columnId !== columnId)))
    })

  const renameBoard = () => {
    const title = prompt('Board name', board?.title)
    if (title?.trim()) run(async () => setBoard((await api.renameBoard(boardId, title.trim())).board))
  }

  const deleteBoard = () => {
    if (confirm('Delete this board and all its cards? This cannot be undone.'))
      run(async () => {
        await api.deleteBoard(boardId)
        navigate('/')
      })
  }

  const invite = async (email: string) => setBoard((await api.addMember(boardId, email)).board)

  // ---------- Render ----------

  if (!board) return <div className="center muted">Loading board…</div>

  const openCard = openCardId ? cards[openCardId] : null
  const activeCard = activeId ? cards[activeId] : null
  const isOwner = board.owner === user?.id

  return (
    <div className="board-page">
      <div className="board-toolbar">
        <h2 onClick={renameBoard} title="Click to rename" className="clickable">{board.title}</h2>
        <div className="presence" title="Viewing now">
          {online.map((u) => (
            <span key={u.id} className="presence-dot-wrap">
              <Avatar id={u.id} name={u.name} size={28} />
              <span className="presence-dot" />
            </span>
          ))}
        </div>
        {!connected && <span className="badge badge-danger">Reconnecting…</span>}
        <span className="spacer" />
        <button className="btn ghost" onClick={() => setShowPanel((s) => !s)}>
          {showPanel ? 'Hide' : 'Show'} panel
        </button>
        {isOwner && <button className="btn ghost danger-text" onClick={deleteBoard}>Delete board</button>}
      </div>

      {error && <div className="toast">{error}</div>}

      <div className="board-body">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null)
            updateDragGroups(null)
          }}
        >
          <div className="columns">
            {board.columns.map((col) => (
              <Column
                key={col.id}
                column={col}
                cardIds={groups[col.id] ?? []}
                cards={cards}
                members={board.members}
                onAddCard={addCard}
                onRename={renameColumn}
                onDelete={deleteColumn}
                onOpenCard={(c) => setOpenCardId(c.id)}
              />
            ))}
            <form className="add-column" onSubmit={addColumn}>
              <input placeholder="+ Add another column" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
            </form>
          </div>
          <DragOverlay>{activeCard ? <CardView card={activeCard} members={board.members} overlay /> : null}</DragOverlay>
        </DndContext>

        {showPanel && <SidePanel members={board.members} activity={activity} onInvite={invite} />}
      </div>

      {openCard && (
        <CardModal
          key={`${openCard.id}:${openCard.updatedAt}`}
          card={openCard}
          members={board.members}
          columnTitle={board.columns.find((c) => c.id === openCard.columnId)?.title ?? ''}
          onClose={() => setOpenCardId(null)}
          onSave={(changes) => saveCard(openCard.id, changes)}
          onDelete={() => deleteCard(openCard.id)}
        />
      )}
    </div>
  )
}

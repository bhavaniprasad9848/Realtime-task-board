import { useState, type FormEvent } from 'react'
import type { Activity, Member } from '../types'
import Avatar from './Avatar'

interface Props {
  members: Member[]
  activity: Activity[]
  onInvite: (email: string) => Promise<void>
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function SidePanel({ members, activity, onInvite }: Props) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  async function invite(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      await onInvite(email.trim())
      setEmail('')
      setMsg('Added!')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not invite')
    }
  }

  return (
    <aside className="side-panel">
      <h4>Members</h4>
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.id}>
            <Avatar id={m.id} name={m.name} size={24} /> {m.name}
          </li>
        ))}
      </ul>
      <form onSubmit={invite} className="invite-form">
        <input type="email" placeholder="Teammate's email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn small">Invite</button>
      </form>
      {msg && <p className="muted small">{msg}</p>}

      <h4>Activity</h4>
      <ul className="activity-list">
        {activity.length === 0 && <li className="muted small">Nothing yet.</li>}
        {activity.map((a) => (
          <li key={a.id}>
            <strong>{a.userName}</strong> {a.message}
            <div className="muted small">{timeAgo(a.createdAt)}</div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

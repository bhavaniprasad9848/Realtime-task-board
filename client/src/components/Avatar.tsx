const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function colorFor(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

export default function Avatar({ id, name, size = 28 }: { id: string; name?: string; size?: number }) {
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className="avatar" title={name} style={{ background: colorFor(id), width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </span>
  )
}

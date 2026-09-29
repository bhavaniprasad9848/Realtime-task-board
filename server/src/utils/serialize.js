// Convert Mongoose docs into plain JSON the client can use directly.
const serializeCard = (c) => ({
  id: c._id.toString(),
  boardId: c.board.toString(),
  columnId: c.columnId.toString(),
  title: c.title,
  description: c.description,
  position: c.position,
  assignee: c.assignee ? c.assignee.toString() : null,
  dueDate: c.dueDate,
  updatedAt: c.updatedAt,
});

const serializeBoard = (b) => ({
  id: b._id.toString(),
  title: b.title,
  owner: (b.owner._id || b.owner).toString(),
  members: b.members.map((m) =>
    m.name ? { id: m._id.toString(), name: m.name, email: m.email } : { id: m.toString() }
  ),
  columns: [...b.columns]
    .sort((a, z) => a.position - z.position)
    .map((col) => ({ id: col._id.toString(), title: col.title, position: col.position })),
  updatedAt: b.updatedAt,
});

const serializeActivity = (a) => ({
  id: a._id.toString(),
  userName: a.userName,
  message: a.message,
  createdAt: a.createdAt,
});

module.exports = { serializeCard, serializeBoard, serializeActivity };

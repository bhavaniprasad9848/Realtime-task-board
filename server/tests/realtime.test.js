const request = require('supertest');
const { io: connect } = require('socket.io-client');
const { connectDb, disconnectDb, clearDb, startServer, registerUser } = require('./helpers');

let server;
const sockets = [];

beforeAll(async () => {
  await connectDb();
  server = await startServer();
});
afterAll(async () => {
  await server.stop();
  await disconnectDb();
});
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await clearDb();
});

function openSocket(token) {
  return new Promise((resolve, reject) => {
    const s = connect(server.url, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const join = (socket, boardId) => new Promise((resolve) => socket.emit('board:join', boardId, resolve));
const nextEvent = (socket, name, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for ${name}`)), ms);
    socket.once(name, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });

async function sharedBoard() {
  const alice = await registerUser(server.app, 'Alice');
  const bob = await registerUser(server.app, 'Bob');
  const board = (await request(server.app).post('/api/boards').set('Authorization', alice.auth).send({ title: 'Live' })).body.board;
  await request(server.app).post(`/api/boards/${board.id}/members`).set('Authorization', alice.auth).send({ email: bob.user.email });
  return { alice, bob, board };
}

describe('real-time sync', () => {
  test('rejects sockets without a valid token', async () => {
    await expect(openSocket('bad-token')).rejects.toThrow('unauthorized');
  });

  test('non-members cannot join a board room', async () => {
    const { board } = await sharedBoard();
    const eve = await registerUser(server.app, 'Eve');
    const s = await openSocket(eve.token);
    expect(await join(s, board.id)).toEqual({ ok: false, error: 'not found' });
  });

  test('when Alice moves a card, Bob sees it and Alice is not echoed', async () => {
    const { alice, bob, board } = await sharedBoard();
    const aliceSocket = await openSocket(alice.token);
    const bobSocket = await openSocket(bob.token);
    await join(aliceSocket, board.id);
    await join(bobSocket, board.id);

    const card = (
      await request(server.app)
        .post(`/api/boards/${board.id}/cards`)
        .set('Authorization', alice.auth)
        .send({ columnId: board.columns[0].id, title: 'Design login page' })
    ).body.card;

    let aliceEchoed = false;
    aliceSocket.on('card:upserted', () => {
      aliceEchoed = true;
    });

    const bobSees = nextEvent(bobSocket, 'card:upserted');
    const bobActivity = nextEvent(bobSocket, 'activity:new');
    await request(server.app)
      .post(`/api/cards/${card.id}/move`)
      .set('Authorization', alice.auth)
      .set('x-socket-id', aliceSocket.id)
      .send({ columnId: board.columns[2].id });

    expect(await bobSees).toMatchObject({ id: card.id, columnId: board.columns[2].id });
    expect(await bobActivity).toMatchObject({ userName: 'Alice', message: 'moved "Design login page" to Done' });
    await new Promise((r) => setTimeout(r, 100));
    expect(aliceEchoed).toBe(false);
  });

  test('presence shows who is viewing the board', async () => {
    const { alice, bob, board } = await sharedBoard();
    const aliceSocket = await openSocket(alice.token);
    await join(aliceSocket, board.id);

    const bobSocket = await openSocket(bob.token);
    const seenByAlice = nextEvent(aliceSocket, 'presence');
    await join(bobSocket, board.id);
    expect((await seenByAlice).map((u) => u.name).sort()).toEqual(['Alice', 'Bob']);

    const afterLeave = nextEvent(aliceSocket, 'presence');
    bobSocket.disconnect();
    expect((await afterLeave).map((u) => u.name)).toEqual(['Alice']);
  });
});

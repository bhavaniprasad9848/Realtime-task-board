const request = require('supertest');
const { createApp } = require('../src/app');
const { connectDb, disconnectDb, clearDb, registerUser } = require('./helpers');

const app = createApp();

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

async function createBoard(auth, title = 'Website Redesign') {
  const res = await request(app).post('/api/boards').set('Authorization', auth).send({ title });
  expect(res.status).toBe(201);
  return res.body.board;
}

describe('boards', () => {
  test('new boards get To Do / In Progress / Done columns', async () => {
    const alice = await registerUser(app, 'Alice');
    const board = await createBoard(alice.auth);
    expect(board.columns.map((c) => c.title)).toEqual(['To Do', 'In Progress', 'Done']);
    expect(board.members).toHaveLength(1);
  });

  test('users only see their own boards', async () => {
    const alice = await registerUser(app, 'Alice');
    const bob = await registerUser(app, 'Bob');
    const board = await createBoard(alice.auth);

    const list = await request(app).get('/api/boards').set('Authorization', bob.auth);
    expect(list.body.boards).toHaveLength(0);

    const direct = await request(app).get(`/api/boards/${board.id}`).set('Authorization', bob.auth);
    expect(direct.status).toBe(404);
  });

  test('inviting a teammate gives them access', async () => {
    const alice = await registerUser(app, 'Alice');
    const bob = await registerUser(app, 'Bob');
    const board = await createBoard(alice.auth);

    const invite = await request(app)
      .post(`/api/boards/${board.id}/members`)
      .set('Authorization', alice.auth)
      .send({ email: bob.user.email });
    expect(invite.status).toBe(201);
    expect(invite.body.board.members.map((m) => m.name).sort()).toEqual(['Alice', 'Bob']);

    const direct = await request(app).get(`/api/boards/${board.id}`).set('Authorization', bob.auth);
    expect(direct.status).toBe(200);

    const again = await request(app)
      .post(`/api/boards/${board.id}/members`)
      .set('Authorization', alice.auth)
      .send({ email: bob.user.email });
    expect(again.status).toBe(409);
  });

  test('only the owner can delete a board', async () => {
    const alice = await registerUser(app, 'Alice');
    const bob = await registerUser(app, 'Bob');
    const board = await createBoard(alice.auth);
    await request(app).post(`/api/boards/${board.id}/members`).set('Authorization', alice.auth).send({ email: bob.user.email });

    const byBob = await request(app).delete(`/api/boards/${board.id}`).set('Authorization', bob.auth);
    expect(byBob.status).toBe(403);
    const byAlice = await request(app).delete(`/api/boards/${board.id}`).set('Authorization', alice.auth);
    expect(byAlice.status).toBe(204);
  });

  test('columns can be added, renamed and deleted (with their cards)', async () => {
    const alice = await registerUser(app, 'Alice');
    const board = await createBoard(alice.auth);

    const added = await request(app).post(`/api/boards/${board.id}/columns`).set('Authorization', alice.auth).send({ title: 'Review' });
    const review = added.body.board.columns.at(-1);
    expect(review.title).toBe('Review');

    const renamed = await request(app)
      .patch(`/api/boards/${board.id}/columns/${review.id}`)
      .set('Authorization', alice.auth)
      .send({ title: 'QA' });
    expect(renamed.body.board.columns.at(-1).title).toBe('QA');

    await request(app).post(`/api/boards/${board.id}/cards`).set('Authorization', alice.auth).send({ columnId: review.id, title: 'Test login' });
    await request(app).delete(`/api/boards/${board.id}/columns/${review.id}`).set('Authorization', alice.auth);
    const after = await request(app).get(`/api/boards/${board.id}`).set('Authorization', alice.auth);
    expect(after.body.board.columns).toHaveLength(3);
    expect(after.body.cards).toHaveLength(0);
  });

  test('actions are recorded in the activity log', async () => {
    const alice = await registerUser(app, 'Alice');
    const board = await createBoard(alice.auth);
    await request(app).post(`/api/boards/${board.id}/cards`).set('Authorization', alice.auth).send({ columnId: board.columns[0].id, title: 'Design login page' });

    const res = await request(app).get(`/api/boards/${board.id}/activity`).set('Authorization', alice.auth);
    expect(res.body.activity[0]).toMatchObject({ userName: 'Alice', message: 'created "Design login page" in To Do' });
  });
});

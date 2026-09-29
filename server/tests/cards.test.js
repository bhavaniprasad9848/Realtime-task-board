const request = require('supertest');
const { createApp } = require('../src/app');
const { connectDb, disconnectDb, clearDb, registerUser } = require('./helpers');

const app = createApp();

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

async function setup() {
  const alice = await registerUser(app, 'Alice');
  const res = await request(app).post('/api/boards').set('Authorization', alice.auth).send({ title: 'Sprint' });
  const board = res.body.board;
  const [todo, doing, done] = board.columns;
  const add = async (title, columnId = todo.id) =>
    (await request(app).post(`/api/boards/${board.id}/cards`).set('Authorization', alice.auth).send({ columnId, title })).body.card;
  const load = async () => (await request(app).get(`/api/boards/${board.id}`).set('Authorization', alice.auth)).body;
  const titlesIn = (cards, columnId) =>
    cards.filter((c) => c.columnId === columnId).sort((a, b) => a.position - b.position).map((c) => c.title);
  return { alice, board, todo, doing, done, add, load, titlesIn };
}

describe('cards', () => {
  test('new cards are appended to the bottom of a column', async () => {
    const { add, load, titlesIn, todo } = await setup();
    await add('A');
    await add('B');
    await add('C');
    const { cards } = await load();
    expect(titlesIn(cards, todo.id)).toEqual(['A', 'B', 'C']);
  });

  test('moving a card between two others places it in the middle', async () => {
    const { alice, add, load, titlesIn, todo } = await setup();
    const a = await add('A');
    const b = await add('B');
    const c = await add('C');

    // Drag C between A and B
    const res = await request(app)
      .post(`/api/cards/${c.id}/move`)
      .set('Authorization', alice.auth)
      .send({ columnId: todo.id, beforeId: a.id, afterId: b.id });
    expect(res.status).toBe(200);

    const { cards } = await load();
    expect(titlesIn(cards, todo.id)).toEqual(['A', 'C', 'B']);
  });

  test('moving a card to another column', async () => {
    const { alice, add, load, titlesIn, todo, done } = await setup();
    const a = await add('A');
    await add('B');
    const x = await add('X', done.id);

    // Drag A to the top of Done (above X)
    await request(app)
      .post(`/api/cards/${a.id}/move`)
      .set('Authorization', alice.auth)
      .send({ columnId: done.id, beforeId: null, afterId: x.id });

    const { cards } = await load();
    expect(titlesIn(cards, todo.id)).toEqual(['B']);
    expect(titlesIn(cards, done.id)).toEqual(['A', 'X']);
  });

  test('many moves into the same gap trigger a rebalance and keep order correct', async () => {
    const { alice, add, load, titlesIn, todo } = await setup();
    const first = await add('first');
    const last = await add('last');

    // Repeatedly drop a new card directly under "first"; each drop halves the gap.
    const expected = ['first'];
    for (let i = 0; i < 45; i += 1) {
      const card = await add(`n${i}`);
      await request(app)
        .post(`/api/cards/${card.id}/move`)
        .set('Authorization', alice.auth)
        .send({ columnId: todo.id, beforeId: first.id, afterId: (await load()).cards
          .filter((c) => c.columnId === todo.id && c.id !== card.id)
          .sort((a, b) => a.position - b.position)[1].id });
      expected.splice(1, 0, `n${i}`);
    }
    expected.push('last');

    const { cards } = await load();
    expect(titlesIn(cards, todo.id)).toEqual(expected);
    const positions = cards.filter((c) => c.columnId === todo.id).map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length); // no ties
    expect(last).toBeDefined();
  });

  test('edit and delete a card', async () => {
    const { alice, add, load } = await setup();
    const a = await add('A');

    const edit = await request(app)
      .patch(`/api/cards/${a.id}`)
      .set('Authorization', alice.auth)
      .send({ title: 'A (edited)', description: 'details', dueDate: '2026-12-01T00:00:00.000Z' });
    expect(edit.status).toBe(200);
    expect(edit.body.card).toMatchObject({ title: 'A (edited)', description: 'details' });

    const del = await request(app).delete(`/api/cards/${a.id}`).set('Authorization', alice.auth);
    expect(del.status).toBe(204);
    expect((await load()).cards).toHaveLength(0);
  });

  test('non-members cannot touch cards', async () => {
    const { add } = await setup();
    const a = await add('A');
    const mallory = await registerUser(app, 'Mallory');
    const res = await request(app).patch(`/api/cards/${a.id}`).set('Authorization', mallory.auth).send({ title: 'hacked' });
    expect(res.status).toBe(404);
  });

  test('rejects a column that belongs to another board', async () => {
    const { alice, board } = await setup();
    const other = (await request(app).post('/api/boards').set('Authorization', alice.auth).send({ title: 'Other' })).body.board;
    const res = await request(app)
      .post(`/api/boards/${board.id}/cards`)
      .set('Authorization', alice.auth)
      .send({ columnId: other.columns[0].id, title: 'wrong' });
    expect(res.status).toBe(400);
  });
});

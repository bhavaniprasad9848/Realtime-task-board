const request = require('supertest');
const { createApp } = require('../src/app');
const { connectDb, disconnectDb, clearDb } = require('./helpers');

const app = createApp();

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

describe('auth', () => {
  const creds = { name: 'Priya', email: 'priya@test.dev', password: 'password123' };

  test('register returns a token and never the password', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(String), name: 'Priya', email: 'priya@test.dev' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  test('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });

  test('rejects short passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/);
  });

  test('login works with the right password and fails with the wrong one', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const ok = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect(ok.status).toBe(200);

    const bad = await request(app).post('/api/auth/login').send({ email: creds.email, password: 'wrongpass1' });
    expect(bad.status).toBe(401);
  });

  test('/me requires a valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(creds.email);

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);
    const badToken = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope');
    expect(badToken.status).toBe(401);
  });
});

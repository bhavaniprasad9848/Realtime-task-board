const http = require('http');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createSocketServer } = require('../src/socket');

let mongoServer;

/**
 * Uses an in-memory MongoDB by default.
 * Set TEST_MONGO_URI to use a real database instead (e.g. the one from docker compose).
 */
async function connectDb() {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }
  const dbName = `taskboard_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(uri, { dbName });
}

async function disconnectDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Starts a real HTTP + Socket.IO server on a random port. */
async function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server, { corsOrigin: '*' });
  app.set('io', io);
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const stop = async () => {
    io.close();
    await new Promise((resolve) => server.close(resolve));
  };
  return { app, url, stop };
}

let counter = 0;
async function registerUser(app, name = 'User') {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email: `user${counter}_${Date.now()}@test.dev`, password: 'password123' });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, auth: `Bearer ${res.body.token}` };
}

module.exports = { connectDb, disconnectDb, clearDb, startServer, registerUser };

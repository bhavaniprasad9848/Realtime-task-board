const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { createSocketServer } = require('./socket');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server, { corsOrigin: config.clientOrigin });
  app.set('io', io); // routes use this to broadcast changes

  server.listen(config.port, () => console.log(`API + WebSocket server on http://localhost:${config.port}`));

  const shutdown = async () => {
    io.close();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

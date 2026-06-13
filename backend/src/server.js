const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const env = require('./config/env');
const { logger } = require('./config/db');
const { Server: SocketServer } = require('socket.io');

const server = http.createServer(app);

// ── Socket.io ───────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: {
    origin: env.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Make io available to routes via app.locals
app.locals.io = io;

// ── Start server ────────────────────────────────────────────
const PORT = env.port;
server.listen(PORT, () => {
  logger.info(`ForgeOps backend on :${PORT}`);
});

module.exports = server;

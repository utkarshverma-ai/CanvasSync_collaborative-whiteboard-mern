import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { getRoomCount } from './rooms/roomStore.js';
import { registerWhiteboardHandlers } from './socket/registerWhiteboardHandlers.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    activeRooms: getRoomCount(),
    totalConnections: io.engine.clientsCount
  });
});

io.on('connection', socket => {
  registerWhiteboardHandlers(io, socket);
});

const PORT = Number(process.env.PORT) || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

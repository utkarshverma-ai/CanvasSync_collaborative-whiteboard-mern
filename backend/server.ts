import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { parseDrawStrokePayload, parseJoinRoomPayload, parseStrokeCommandPayload, type Stroke } from './socketValidation.js';

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    activeRooms: rooms.size,
    totalConnections: io.engine.clientsCount
  });
});

interface Room {
  strokes: Stroke[];
  users: Map<string, { name: string; color: string }>;
  redoStacks: Map<string, Stroke[]>;
}

const rooms = new Map<string, Room>();

io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User joins a room
  socket.on('join-room', (data: unknown) => {
    const joinData = parseJoinRoomPayload(data);
    if (!joinData) return;

    const { roomId, userName, userColor } = joinData;
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        strokes: [],
        users: new Map(),
        redoStacks: new Map()
      });
    }

    const room = rooms.get(roomId)!;
    room.users.set(socket.id, { name: userName, color: userColor });

    console.log(`${userName} joined room ${roomId}`);

    // Send existing strokes to the new user
    socket.emit('load-room', {
      strokes: room.strokes,
      users: Array.from(room.users.entries()).map(([id, user]) => ({
        id,
        name: user.name,
        color: user.color,
        isMe: id === socket.id
      }))
    });

    // Notify others that a new user joined
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName,
      userColor
    });
  });

  // Handle new strokes
  socket.on('draw-stroke', (data: unknown) => {
    const drawData = parseDrawStrokePayload(data, socket.id);
    if (!drawData || !socket.rooms.has(drawData.roomId)) return;

    const { roomId, stroke } = drawData;
    const room = rooms.get(roomId);

    if (room) {
      room.strokes.push(stroke);
      room.redoStacks.delete(socket.id);

      // Broadcast stroke to all OTHER clients in the room (not the sender)
      socket.to(roomId).emit('remote-stroke', stroke);
      console.log(`Stroke added to room ${roomId} by ${socket.id}`);
    }
  });

  // Handle undo
  socket.on('undo-stroke', (data: unknown) => {
    const command = parseStrokeCommandPayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const { roomId, strokeId } = command;
    const room = rooms.get(roomId);

    if (room) {
      // Only allow users to undo their own strokes
      const strokeIndex = room.strokes.findIndex(
        s => s.id === strokeId && s.userId === socket.id
      );

      if (strokeIndex !== -1) {
        const [stroke] = room.strokes.splice(strokeIndex, 1);
        const redoStack = room.redoStacks.get(socket.id) || [];
        redoStack.push(stroke);
        room.redoStacks.set(socket.id, redoStack);
        io.to(roomId).emit('undo-stroke-remote', strokeId);
        console.log(`Stroke ${strokeId} undone in room ${roomId}`);
      }
    }
  });

  // Handle redo
  socket.on('redo-stroke', (data: unknown) => {
    const command = parseStrokeCommandPayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const { roomId, strokeId } = command;
    const room = rooms.get(roomId);
    const redoStack = room?.redoStacks.get(socket.id);
    const stroke = redoStack?.[redoStack.length - 1];

    if (!room || !stroke || stroke.id !== strokeId || stroke.userId !== socket.id) {
      return;
    }

    if (room.strokes.some(activeStroke => activeStroke.id === stroke.id)) {
      return;
    }

    redoStack.pop();
    if (redoStack.length === 0) {
      room.redoStacks.delete(socket.id);
    }
    room.strokes.push(stroke);
    io.to(roomId).emit('redo-stroke-remote', stroke);
    console.log(`Stroke ${strokeId} redone in room ${roomId}`);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const userName = room.users.get(socket.id)?.name;
        room.users.delete(socket.id);
        room.redoStacks.delete(socket.id);

        io.to(roomId).emit('user-left', {
          userId: socket.id,
          userName
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} cleared (empty)`);
        }
      }
    });
  });
});

const PORT = Number(process.env.PORT) || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

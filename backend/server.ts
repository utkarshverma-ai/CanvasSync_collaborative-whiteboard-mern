import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Store active rooms and their data
interface Stroke {
  id: string;
  userId: string;
  tool: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface Room {
  strokes: Stroke[];
  users: Map<string, { name: string; color: string }>;
}

const rooms = new Map<string, Room>();

io.on('connection', (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User joins a room
  socket.on('join-room', (data: { roomId: string; userName: string; userColor: string }) => {
    const { roomId, userName, userColor } = data;
    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        strokes: [],
        users: new Map()
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
  socket.on('draw-stroke', (data: { roomId: string; stroke: Stroke }) => {
    const { roomId, stroke } = data;
    const room = rooms.get(roomId);

    if (room) {
      // Update userId to match the connected socket
      stroke.userId = socket.id;
      room.strokes.push(stroke);

      // Broadcast stroke to all OTHER clients in the room (not the sender)
      socket.to(roomId).emit('remote-stroke', stroke);
      console.log(`Stroke added to room ${roomId} by ${socket.id}`);
    }
  });

  // Handle undo
  socket.on('undo-stroke', (data: { roomId: string; strokeId: string }) => {
    const { roomId, strokeId } = data;
    const room = rooms.get(roomId);

    if (room) {
      // Only allow users to undo their own strokes
      const strokeIndex = room.strokes.findIndex(
        s => s.id === strokeId && s.userId === socket.id
      );

      if (strokeIndex !== -1) {
        room.strokes.splice(strokeIndex, 1);
        io.to(roomId).emit('undo-stroke-remote', strokeId);
        console.log(`Stroke ${strokeId} undone in room ${roomId}`);
      }
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const userName = room.users.get(socket.id)?.name;
        room.users.delete(socket.id);

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

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

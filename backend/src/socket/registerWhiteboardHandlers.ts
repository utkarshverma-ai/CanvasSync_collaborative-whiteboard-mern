import { Server, Socket } from 'socket.io';
import { deleteRoom, forEachRoom, getOrCreateRoom, getRoom } from '../rooms/roomStore.js';
import { parseDrawStrokePayload, parseJoinRoomPayload, parseStrokeCommandPayload } from '../validation/socketValidation.js';

export function registerWhiteboardHandlers(io: Server, socket: Socket) {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-room', (data: unknown) => {
    const joinData = parseJoinRoomPayload(data);
    if (!joinData) return;

    const { roomId, userName, userColor } = joinData;
    socket.join(roomId);

    const room = getOrCreateRoom(roomId);
    room.users.set(socket.id, { name: userName, color: userColor });

    console.log(`${userName} joined room ${roomId}`);

    socket.emit('load-room', {
      strokes: room.strokes,
      users: Array.from(room.users.entries()).map(([id, user]) => ({
        id,
        name: user.name,
        color: user.color,
        isMe: id === socket.id
      }))
    });

    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName,
      userColor
    });
  });

  socket.on('draw-stroke', (data: unknown) => {
    const drawData = parseDrawStrokePayload(data, socket.id);
    if (!drawData || !socket.rooms.has(drawData.roomId)) return;

    const { roomId, stroke } = drawData;
    const room = getRoom(roomId);
    if (!room) return;

    room.strokes.push(stroke);
    room.redoStacks.delete(socket.id);
    socket.to(roomId).emit('remote-stroke', stroke);
    console.log(`Stroke added to room ${roomId} by ${socket.id}`);
  });

  socket.on('undo-stroke', (data: unknown) => {
    const command = parseStrokeCommandPayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const { roomId, strokeId } = command;
    const room = getRoom(roomId);
    if (!room) return;

    const strokeIndex = room.strokes.findIndex(
      stroke => stroke.id === strokeId && stroke.userId === socket.id
    );
    if (strokeIndex === -1) return;

    const [stroke] = room.strokes.splice(strokeIndex, 1);
    const redoStack = room.redoStacks.get(socket.id) || [];
    redoStack.push(stroke);
    room.redoStacks.set(socket.id, redoStack);
    io.to(roomId).emit('undo-stroke-remote', strokeId);
    console.log(`Stroke ${strokeId} undone in room ${roomId}`);
  });

  socket.on('redo-stroke', (data: unknown) => {
    const command = parseStrokeCommandPayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const { roomId, strokeId } = command;
    const room = getRoom(roomId);
    const redoStack = room?.redoStacks.get(socket.id);
    const stroke = redoStack?.[redoStack.length - 1];

    if (!room || !stroke || stroke.id !== strokeId || stroke.userId !== socket.id) return;
    if (room.strokes.some(activeStroke => activeStroke.id === stroke.id)) return;

    redoStack.pop();
    if (redoStack.length === 0) {
      room.redoStacks.delete(socket.id);
    }
    room.strokes.push(stroke);
    io.to(roomId).emit('redo-stroke-remote', stroke);
    console.log(`Stroke ${strokeId} redone in room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    forEachRoom((room, roomId) => {
      if (!room.users.has(socket.id)) return;

      const userName = room.users.get(socket.id)?.name;
      room.users.delete(socket.id);
      room.redoStacks.delete(socket.id);

      io.to(roomId).emit('user-left', {
        userId: socket.id,
        userName
      });

      if (room.users.size === 0) {
        deleteRoom(roomId);
        console.log(`Room ${roomId} cleared (empty)`);
      }
    });
  });
}

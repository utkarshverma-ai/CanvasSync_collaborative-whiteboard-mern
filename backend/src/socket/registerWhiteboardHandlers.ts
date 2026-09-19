import { Server, Socket } from 'socket.io';
import { clearRedoStack, createBoardPage, deleteRoom, forEachRoom, getOrCreateRedoStack, getOrCreateRoom, getPageById, getRedoStack, getRoom, MAX_PAGES_PER_ROOM } from '../rooms/roomStore.js';
import { parseCreatePagePayload, parseDrawStrokePayload, parseJoinRoomPayload, parseStrokeCommandPayload } from '../validation/socketValidation.js';

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
      pages: room.pages,
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

  socket.on('create-page', (data: unknown) => {
    const command = parseCreatePagePayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const room = getRoom(command.roomId);
    if (!room) return;

    if (room.pages.length >= MAX_PAGES_PER_ROOM) {
      socket.emit('page-create-rejected', { requestId: command.requestId, reason: 'limit-reached' });
      return;
    }

    const page = createBoardPage();
    room.pages.push(page);
    io.to(command.roomId).emit('page-created', { page, requestId: command.requestId, createdBy: socket.id });
  });

  socket.on('draw-stroke', (data: unknown) => {
    const drawData = parseDrawStrokePayload(data, socket.id);
    if (!drawData || !socket.rooms.has(drawData.roomId)) return;

    const { roomId, pageId, stroke } = drawData;
    const room = getRoom(roomId);
    if (!room) return;

    const page = getPageById(room, pageId);
    if (!page) return;

    page.strokes.push(stroke);
    clearRedoStack(room, socket.id, pageId);
    socket.to(roomId).emit('remote-stroke', { pageId, stroke });
    console.log(`Stroke added to room ${roomId} by ${socket.id}`);
  });

  socket.on('undo-stroke', (data: unknown) => {
    const command = parseStrokeCommandPayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const { roomId, pageId, strokeId } = command;
    const room = getRoom(roomId);
    if (!room) return;

    const page = getPageById(room, pageId);
    if (!page) return;

    const strokeIndex = page.strokes.findIndex(
      stroke => stroke.id === strokeId && stroke.userId === socket.id
    );
    if (strokeIndex === -1) return;

    const [stroke] = page.strokes.splice(strokeIndex, 1);
    const redoStack = getOrCreateRedoStack(room, socket.id, pageId);
    redoStack.push(stroke);
    io.to(roomId).emit('undo-stroke-remote', { pageId, strokeId });
    console.log(`Stroke ${strokeId} undone in room ${roomId}`);
  });

  socket.on('redo-stroke', (data: unknown) => {
    const command = parseStrokeCommandPayload(data);
    if (!command || !socket.rooms.has(command.roomId)) return;

    const { roomId, pageId, strokeId } = command;
    const room = getRoom(roomId);
    if (!room) return;

    const page = getPageById(room, pageId);
    if (!page) return;

    const redoStack = getRedoStack(room, socket.id, pageId);
    const stroke = redoStack?.[redoStack.length - 1];

    if (!stroke || stroke.id !== strokeId || stroke.userId !== socket.id) return;
    if (page.strokes.some(activeStroke => activeStroke.id === stroke.id)) return;

    redoStack.pop();
    if (redoStack.length === 0) {
      clearRedoStack(room, socket.id, pageId);
    }
    page.strokes.push(stroke);
    io.to(roomId).emit('redo-stroke-remote', { pageId, stroke });
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

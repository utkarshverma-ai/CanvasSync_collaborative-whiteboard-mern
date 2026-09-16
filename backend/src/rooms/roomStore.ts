import { randomUUID } from 'node:crypto';
import { BoardPage, Room, Stroke } from './types.js';

const rooms = new Map<string, Room>();

export function createBoardPage(): BoardPage {
  return {
    id: randomUUID(),
    strokes: []
  };
}

export function getPageById(room: Room, pageId: string): BoardPage | undefined {
  return room.pages.find(page => page.id === pageId);
}

export function getRedoStack(room: Room, socketId: string, pageId: string): Stroke[] | undefined {
  return room.redoStacks.get(socketId)?.get(pageId);
}

export function getOrCreateRedoStack(room: Room, socketId: string, pageId: string): Stroke[] {
  let userRedoStacks = room.redoStacks.get(socketId);
  if (!userRedoStacks) {
    userRedoStacks = new Map();
    room.redoStacks.set(socketId, userRedoStacks);
  }

  let redoStack = userRedoStacks.get(pageId);
  if (!redoStack) {
    redoStack = [];
    userRedoStacks.set(pageId, redoStack);
  }

  return redoStack;
}

export function clearRedoStack(room: Room, socketId: string, pageId: string) {
  const userRedoStacks = room.redoStacks.get(socketId);
  if (!userRedoStacks) return;

  userRedoStacks.delete(pageId);
  if (userRedoStacks.size === 0) {
    room.redoStacks.delete(socketId);
  }
}

export function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      pages: [createBoardPage()],
      users: new Map(),
      redoStacks: new Map()
    };
    rooms.set(roomId, room);
  }

  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function deleteRoom(roomId: string) {
  rooms.delete(roomId);
}

export function getRoomCount() {
  return rooms.size;
}

export function forEachRoom(callback: (room: Room, roomId: string) => void) {
  rooms.forEach(callback);
}

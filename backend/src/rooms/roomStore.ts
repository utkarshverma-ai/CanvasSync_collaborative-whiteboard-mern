import { randomUUID } from 'node:crypto';
import { BoardPage, Room } from './types.js';

const rooms = new Map<string, Room>();

export function createBoardPage(): BoardPage {
  return {
    id: randomUUID(),
    strokes: []
  };
}

export function getInitialPage(room: Room): BoardPage {
  const initialPage = room.pages[0];
  if (!initialPage) {
    throw new Error('Room invariant violated: a room must contain an initial page.');
  }

  return initialPage;
}

export function getPageById(room: Room, pageId: string): BoardPage | undefined {
  return room.pages.find(page => page.id === pageId);
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

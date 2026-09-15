import { Room } from './types.js';

const rooms = new Map<string, Room>();

export function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      strokes: [],
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

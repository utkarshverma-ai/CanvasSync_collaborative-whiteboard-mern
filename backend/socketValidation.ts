export const MAX_ROOM_ID_LENGTH = 100;
export const MAX_USERNAME_LENGTH = 80;
export const MAX_STROKE_ID_LENGTH = 100;
export const MAX_STROKE_POINTS = 10_000;
export const MIN_BRUSH_WIDTH = 1;
export const MAX_BRUSH_WIDTH = 50;

const supportedTools = new Set(['pen', 'eraser', 'rect', 'circle', 'line']);
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export interface Stroke {
  id: string;
  userId: string;
  tool: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface JoinRoomPayload {
  roomId: string;
  userName: string;
  userColor: string;
}

interface StrokeCommandPayload {
  roomId: string;
  strokeId: string;
}

interface DrawStrokePayload {
  roomId: string;
  stroke: Stroke;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isValidRoomId(value: unknown): value is string {
  return isBoundedNonEmptyString(value, MAX_ROOM_ID_LENGTH);
}

export function parseJoinRoomPayload(value: unknown): JoinRoomPayload | null {
  if (!isRecord(value)) return null;

  const { roomId, userName, userColor } = value;
  if (!isValidRoomId(roomId) || !isBoundedNonEmptyString(userName, MAX_USERNAME_LENGTH)) {
    return null;
  }
  if (typeof userColor !== 'string' || !hexColorPattern.test(userColor)) {
    return null;
  }

  return { roomId, userName, userColor };
}

export function parseStrokeCommandPayload(value: unknown): StrokeCommandPayload | null {
  if (!isRecord(value)) return null;

  const { roomId, strokeId } = value;
  if (!isValidRoomId(roomId) || !isBoundedNonEmptyString(strokeId, MAX_STROKE_ID_LENGTH)) {
    return null;
  }

  return { roomId, strokeId };
}

export function parseDrawStrokePayload(value: unknown, userId: string): DrawStrokePayload | null {
  if (!isRecord(value) || !isValidRoomId(value.roomId) || !isRecord(value.stroke)) {
    return null;
  }

  const { id, tool, color, width, points } = value.stroke;
  if (!isBoundedNonEmptyString(id, MAX_STROKE_ID_LENGTH)) return null;
  if (typeof tool !== 'string' || !supportedTools.has(tool)) return null;
  if (typeof color !== 'string' || !hexColorPattern.test(color)) return null;
  if (typeof width !== 'number' || !Number.isFinite(width) || width < MIN_BRUSH_WIDTH || width > MAX_BRUSH_WIDTH) return null;
  if (!Array.isArray(points) || points.length === 0 || points.length > MAX_STROKE_POINTS) return null;
  if (!points.every(point => isRecord(point) && typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y))) {
    return null;
  }

  return {
    roomId: value.roomId,
    stroke: {
      id,
      userId,
      tool,
      color,
      width,
      points: points.map(point => ({ x: point.x as number, y: point.y as number }))
    }
  };
}

export type Tool = 'pen' | 'eraser' | 'rect' | 'circle' | 'line';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: string;
  tool: Tool;
  color: string;
  width: number;
  points: Point[];
}

export interface BoardPage {
  id: string;
  strokes: Stroke[];
}

export interface PageStrokePayload {
  pageId: string;
  stroke: Stroke;
}

export interface PageStrokeCommandPayload {
  pageId: string;
  strokeId: string;
}

export interface PageCreatedPayload {
  page: BoardPage;
  requestId: string;
  createdBy: string;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  isMe: boolean;
  participantId?: string;
}

export interface UserJoinedPayload {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  participantId?: string;
}

export interface RoomNotice {
  id: string;
  kind: 'message' | 'join';
  title: string;
  preview?: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  clientMessageId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: string;
}

export type ChatResult = { ok: true; message: ChatMessage } | {
  ok: false;
  error: { code: string; message: string; retryAfterMs?: number };
};

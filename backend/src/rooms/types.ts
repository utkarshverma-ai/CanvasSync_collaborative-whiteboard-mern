export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: string;
  tool: string;
  color: string;
  width: number;
  points: Point[];
}

export interface BoardPage {
  id: string;
  strokes: Stroke[];
}

export interface RoomUser {
  name: string;
  color: string;
  participantId: string;
}

export interface Room {
  messages: ChatMessage[];
  chatRequests: Map<string, ChatMessage>;
  pages: BoardPage[];
  users: Map<string, RoomUser>;
  redoStacks: Map<string, Map<string, Stroke[]>>;
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

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

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  isMe: boolean;
}

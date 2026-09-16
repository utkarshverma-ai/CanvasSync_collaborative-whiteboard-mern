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
}

export interface Room {
  pages: BoardPage[];
  users: Map<string, RoomUser>;
  redoStacks: Map<string, Stroke[]>;
}

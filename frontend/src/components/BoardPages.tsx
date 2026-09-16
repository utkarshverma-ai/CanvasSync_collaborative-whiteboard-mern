import React from 'react';
import CanvasPage from './CanvasPage';
import { CanvasBoardHandle } from './CanvasBoard';
import { BoardPage, Stroke, Tool } from '../types';

interface BoardPagesProps {
  pages: BoardPage[];
  activePageId: string | null;
  tool: Tool;
  color: string;
  width: number;
  getUserId: () => string;
  onActivatePage: (pageId: string) => void;
  onCompletedStroke: (pageId: string, stroke: Stroke) => void;
  onCanvasHandle: (pageId: string, handle: CanvasBoardHandle | null) => void;
}

const BoardPages: React.FC<BoardPagesProps> = ({
  pages,
  activePageId,
  tool,
  color,
  width,
  getUserId,
  onActivatePage,
  onCompletedStroke,
  onCanvasHandle
}) => (
  <main className="board-pages" aria-label="Whiteboard pages">
    {pages.map((page, index) => (
      <CanvasPage
        key={page.id}
        ref={(handle) => onCanvasHandle(page.id, handle)}
        page={page}
        pageNumber={index + 1}
        isActive={page.id === activePageId}
        tool={tool}
        color={color}
        width={width}
        getUserId={getUserId}
        onActivate={onActivatePage}
        onCompletedStroke={onCompletedStroke}
      />
    ))}
  </main>
);

export default BoardPages;

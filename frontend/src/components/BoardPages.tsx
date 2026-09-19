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
  onPageElement: (pageId: string, element: HTMLElement | null) => void;
  onCreatePage: () => void;
  canCreatePage: boolean;
  isCreatingPage: boolean;
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
  onCanvasHandle,
  onPageElement,
  onCreatePage,
  canCreatePage,
  isCreatingPage
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
        onPageElement={onPageElement}
      />
    ))}
    <div className="add-page-control">
      <span aria-hidden="true"></span>
      <button type="button" onClick={onCreatePage} disabled={!canCreatePage}>
        <i className={`fa-solid ${isCreatingPage ? 'fa-spinner fa-spin' : 'fa-plus'}`} aria-hidden="true"></i>
        <span>{isCreatingPage ? 'Adding page…' : 'Add page'}</span>
      </button>
      <span aria-hidden="true"></span>
    </div>
  </main>
);

export default BoardPages;

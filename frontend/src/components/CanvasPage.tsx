import React, { forwardRef } from 'react';
import CanvasBoard, { CanvasBoardHandle } from './CanvasBoard';
import { BoardPage, Stroke, Tool } from '../types';

interface CanvasPageProps {
  page: BoardPage;
  pageNumber: number;
  isActive: boolean;
  tool: Tool;
  color: string;
  width: number;
  getUserId: () => string;
  onActivate: (pageId: string) => void;
  onCompletedStroke: (pageId: string, stroke: Stroke) => void;
  onPageElement: (pageId: string, element: HTMLElement | null) => void;
}

const CanvasPage = forwardRef<CanvasBoardHandle, CanvasPageProps>(({
  page,
  pageNumber,
  isActive,
  tool,
  color,
  width,
  getUserId,
  onActivate,
  onCompletedStroke,
  onPageElement
}, ref) => (
  <section
    className={`canvas-page ${isActive ? 'is-active' : ''}`}
    role="group"
    aria-label={`Page ${pageNumber}${isActive ? ', active page' : ''}`}
    ref={(element) => onPageElement(page.id, element)}
    tabIndex={0}
    onPointerDown={() => onActivate(page.id)}
    onFocus={() => onActivate(page.id)}
  >
    <header className="canvas-page-label">
      <span>Page {pageNumber}</span>
      {isActive && <span className="canvas-page-active-indicator">Active</span>}
    </header>
    <div className="canvas-page-board">
      <CanvasBoard
        ref={ref}
        strokes={page.strokes}
        tool={tool}
        color={color}
        width={width}
        getUserId={getUserId}
        onInteractionStart={() => onActivate(page.id)}
        onCompletedStroke={(stroke) => onCompletedStroke(page.id, stroke)}
      />
      {page.strokes.length === 0 && (
        <div className="canvas-page-empty-state" aria-hidden="true">
          <i className="fa-solid fa-pen" aria-hidden="true"></i>
          <span>{pageNumber === 1 ? 'Start drawing together' : 'Blank page'}</span>
        </div>
      )}
    </div>
  </section>
));

CanvasPage.displayName = 'CanvasPage';

export default CanvasPage;

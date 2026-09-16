import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Stroke, Tool } from '../types';
import { renderCanvas } from '../utils/canvasRenderer';

export interface CanvasBoardHandle {
  exportPng: (fileName: string) => void;
}

interface CanvasBoardProps {
  strokes: Stroke[];
  tool: Tool;
  color: string;
  width: number;
  getUserId: () => string;
  onInteractionStart: () => void;
  onCompletedStroke: (stroke: Stroke) => void;
}

function getPointerPosition(event: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const point = 'touches' in event ? event.touches[0] : event;

  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top
  };
}

const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(({
  strokes,
  tool,
  color,
  width,
  getUserId,
  onInteractionStart,
  onCompletedStroke
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    requestAnimationFrame(() => {
      renderCanvas(context, canvas, strokesRef.current, currentStrokeRef.current);
    });
  }, []);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = canvas?.parentElement;
      if (!canvas || !container) return;

      const nextWidth = Math.round(container.clientWidth);
      const nextHeight = Math.round(container.clientHeight);
      if (nextWidth === 0 || nextHeight === 0) return;
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;

      canvas.width = nextWidth;
      canvas.height = nextHeight;
      redraw();
    };

    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!container) return;

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    resizeCanvas();

    return () => resizeObserver.disconnect();
  }, [redraw]);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes, redraw]);

  useImperativeHandle(ref, () => ({
    exportPng: (fileName: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }), []);

  const handleMouseDown = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    onInteractionStart();
    const { x, y } = getPointerPosition(event, canvas);
    currentStrokeRef.current = {
      id: Math.random().toString(36).substring(2, 9),
      userId: getUserId(),
      tool,
      color,
      width,
      points: [{ x, y }]
    };
    isDrawingRef.current = true;
  };

  const handleMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
    const currentStroke = currentStrokeRef.current;
    const canvas = canvasRef.current;
    if (!isDrawingRef.current || !currentStroke || !canvas) return;

    const { x, y } = getPointerPosition(event, canvas);
    if (tool === 'pen' || tool === 'eraser') {
      currentStroke.points.push({ x, y });
    } else {
      currentStroke.points = [currentStroke.points[0], { x, y }];
    }

    redraw();
  };

  const handleMouseUp = () => {
    const finishedStroke = currentStrokeRef.current;
    if (!isDrawingRef.current || !finishedStroke) return;

    if (finishedStroke.points.length > 0) {
      onCompletedStroke(finishedStroke);
    }

    currentStrokeRef.current = null;
    isDrawingRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
      className="canvas-page-canvas"
    />
  );
});

CanvasBoard.displayName = 'CanvasBoard';

export default CanvasBoard;

import { Stroke } from '../types';

// Canvas pixels cannot read CSS custom properties directly. Keep these aligned with
// --canvas-bg and --grid in styles.css so the eraser always paints the board surface.
const CANVAS_BACKGROUND = '#fcfdfd';
const GRID_COLOR = '#e8ecf1';
const GRID_SIZE = 40;

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke | null) {
  if (!stroke || stroke.points.length === 0) return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? CANVAS_BACKGROUND : stroke.color;
  ctx.lineWidth = stroke.width;

  if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length; index += 1) {
      ctx.lineTo(stroke.points[index].x, stroke.points[index].y);
    }
    ctx.stroke();
    return;
  }

  const start = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];

  if (stroke.tool === 'rect') {
    ctx.strokeRect(start.x, start.y, last.x - start.x, last.y - start.y);
  } else if (stroke.tool === 'circle') {
    const radius = Math.sqrt((last.x - start.x) ** 2 + (last.y - start.y) ** 2);
    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (stroke.tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  currentStroke: Stroke | null
) {
  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  for (let position = 0; position < canvas.width; position += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.stroke();
  }
  for (let position = 0; position < canvas.height; position += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
    ctx.stroke();
  }

  strokes.forEach(stroke => renderStroke(ctx, stroke));
  renderStroke(ctx, currentStroke);
}

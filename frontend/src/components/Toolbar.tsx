import React from 'react';
import { Tool } from '../types';

interface ToolbarProps {
  activeTool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  exportPng: () => void;
}


const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setTool,
  color,
  setColor,
  width,
  setWidth,
  canUndo,
  canRedo,
  undo,
  redo,
  exportPng
}) => {
  return (
    <div className="toolbar-dock" role="toolbar" aria-label="Whiteboard tools">
      <div className="toolbar-group toolbar-drawing" aria-label="Drawing tools">
        <button
          type="button"
          onClick={() => setTool('pen')}
          className={`toolbar-icon-button ${activeTool === 'pen' ? 'is-selected' : ''}`}
          aria-label="Pen"
          aria-pressed={activeTool === 'pen'}
          title="Pen"
        >
          <i className="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          onClick={() => setTool('eraser')}
          className={`toolbar-icon-button ${activeTool === 'eraser' ? 'is-selected' : ''}`}
          aria-label="Eraser"
          aria-pressed={activeTool === 'eraser'}
          title="Eraser"
        >
          <i className="fa-solid fa-eraser" aria-hidden="true"></i>
        </button>
      </div>

      <div className="toolbar-separator" aria-hidden="true"></div>

      <div className="toolbar-group toolbar-style" aria-label="Stroke style">
        <label className="toolbar-color-control" title="Stroke color">
          <span className="sr-only">Stroke color</span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Stroke color"
          />
        </label>
        <label className="toolbar-width-control" title={`Stroke width: ${width}`}>
          <i className="fa-solid fa-sliders" aria-hidden="true"></i>
          <span className="sr-only">Stroke width</span>
          <input
            type="range"
            min={1}
            max={50}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            aria-label="Stroke width"
          />
          <output aria-hidden="true">{width}</output>
        </label>
      </div>

      <div className="toolbar-separator" aria-hidden="true"></div>

      <div className="toolbar-group toolbar-history" aria-label="History">
        <button
          type="button"
          onClick={undo}
          className="toolbar-icon-button"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
        >
          <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          onClick={redo}
          className="toolbar-icon-button"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
        >
          <i className="fa-solid fa-arrow-rotate-right" aria-hidden="true"></i>
        </button>
      </div>

      <div className="toolbar-separator toolbar-export-separator" aria-hidden="true"></div>

      <div className="toolbar-group toolbar-export">
        <button type="button" onClick={exportPng} className="toolbar-export-button" title="Export PNG">
          <i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
          <span>Export</span>
        </button>
      </div>

      <div className="toolbar-mobile-secondary">
        <label className="toolbar-width-control" title={`Stroke width: ${width}`}>
          <i className="fa-solid fa-sliders" aria-hidden="true"></i>
          <span className="sr-only">Stroke width</span>
          <input
            type="range"
            min={1}
            max={50}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            aria-label="Stroke width"
          />
          <output aria-hidden="true">{width}</output>
        </label>
        <button type="button" onClick={exportPng} className="toolbar-export-button" title="Export PNG">
          <i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;

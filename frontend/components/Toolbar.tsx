import React from 'react';
import { Tool } from '../types';

interface ToolbarProps {
  activeTool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  undo: () => void;
  redo: () => void;
  exportPng: () => void;
}


const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setTool, color, setColor, width, setWidth, undo, redo, exportPng }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      <button onClick={() => setTool('pen')} className={`p-3 rounded-lg ${activeTool === 'pen' ? 'bg-white shadow' : ''}`}>Pen</button>
      <button onClick={() => setTool('eraser')} className={`p-3 rounded-lg ${activeTool === 'eraser' ? 'bg-white shadow' : ''}`}>Eraser</button>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      <input type="range" min={1} max={50} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
      <button onClick={exportPng}>Export</button>
    </div>
  );
};

export default Toolbar;

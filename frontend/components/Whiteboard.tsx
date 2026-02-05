import React, { useRef, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Toolbar from './Toolbar';
import Collaborators from './Collaborators';
import { Tool, Point, Stroke, UserPresence } from '../types';

interface WhiteboardProps {
  roomId: string;
  userName: string;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, userName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [collaborators, setCollaborators] = useState<UserPresence[]>([
    { id: 'me', name: userName, color: '#3b82f6', isMe: true }
  ]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const userIdRef = useRef<string>('me');
  const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Generate random user color for this session
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const userColor = useRef<string>(colors[Math.floor(Math.random() * colors.length)]);

  // Initialize Canvas
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderAll();
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3002', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`Connected with ID: ${socket.id}`);
      userIdRef.current = socket.id;

      // Join the room with user info
      socket.emit('join-room', {
        roomId,
        userName,
        userColor: userColor.current
      });
    });

    // Handle reconnection - rejoin the room
    socket.on('reconnect', () => {
      console.log('Reconnected, rejoining room...');
      socket.emit('join-room', {
        roomId,
        userName,
        userColor: userColor.current
      });
    });

    // Load existing room data
    socket.on('load-room', (data: { strokes: Stroke[]; users: UserPresence[] }) => {
      console.log('Loaded room data:', data);
      setStrokes(data.strokes);
      setCollaborators(data.users);
    });

    // Receive remote strokes
    socket.on('remote-stroke', (stroke: Stroke) => {
      console.log('Received remote stroke:', stroke);
      setStrokes(prev => [...prev, stroke]);
    });

    // Handle user joined
    socket.on('user-joined', (data: { userId: string; userName: string; userColor: string }) => {
      console.log(`${data.userName} joined the room`);
      setCollaborators(prev => [
        ...prev,
        {
          id: data.userId,
          name: data.userName,
          color: data.userColor,
          isMe: false
        }
      ]);
    });

    // Handle user left
    socket.on('user-left', (data: { userId: string; userName: string }) => {
      console.log(`${data.userName} left the room`);
      setCollaborators(prev => prev.filter(u => u.id !== data.userId));
    });

    // Handle remote undo
    socket.on('undo-stroke-remote', (strokeId: string) => {
      console.log('Remote undo for stroke:', strokeId);
      setStrokes(prev => prev.filter(s => s.id !== strokeId));
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, []); // ✅ CRITICAL FIX: Empty dependency array - socket only created once

  const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke | null) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#f8fafc' : stroke.color;
    ctx.lineWidth = stroke.width;

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    } else if (stroke.tool === 'rect') {
      const start = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1];
      ctx.strokeRect(start.x, start.y, last.x - start.x, last.y - start.y);
    } else if (stroke.tool === 'circle') {
      const start = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1];
      const radius = Math.sqrt(Math.pow(last.x - start.x, 2) + Math.pow(last.y - start.y, 2));
      ctx.beginPath();
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (stroke.tool === 'line') {
      const start = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  };

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Use requestAnimationFrame for smoother performance and to avoid flickering
    requestAnimationFrame(() => {
      ctx.fillStyle = '#f8fafc'; // Match the background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid background
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let i = 0; i < canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Render historical strokes
      strokes.forEach(s => {
        if (s) renderStroke(ctx, s);
      });

      // Render active stroke
      if (currentStrokeRef.current) {
        renderStroke(ctx, currentStrokeRef.current);
      }
    });
  }, [strokes]);

  useEffect(() => {
    renderAll();
  }, [renderAll]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;

    const newStroke: Stroke = {
      id: Math.random().toString(36).substring(2, 9),
      userId: userIdRef.current, // Use actual socket ID
      tool,
      color,
      width,
      points: [{ x, y }]
    };

    currentStrokeRef.current = newStroke;
    setIsDrawing(true);
    setRedoStack([]);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStrokeRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;

    const currentStroke = currentStrokeRef.current;
    if (tool === 'pen' || tool === 'eraser') {
      currentStroke.points.push({ x, y });
    } else {
      currentStroke.points = [currentStroke.points[0], { x, y }];
    }

    renderAll();
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentStrokeRef.current) return;

    const finishedStroke = currentStrokeRef.current;
    // Only add if it has enough points to be visible
    if (finishedStroke.points.length > 0) {
      setStrokes(prev => [...prev, finishedStroke]);

      // Emit stroke to server for real-time sync
      if (socketRef.current) {
        socketRef.current.emit('draw-stroke', {
          roomId,
          stroke: finishedStroke
        });
      }
    }

    currentStrokeRef.current = null;
    setIsDrawing(false);
  };

  const undo = () => {
    setStrokes(prev => {
      if (prev.length === 0) return prev;
      const newStrokes = [...prev];
      const last = newStrokes.pop();
      if (last) {
        setRedoStack(r => [...r, last]);

        // Emit undo to server
        if (socketRef.current) {
          socketRef.current.emit('undo-stroke', {
            roomId,
            strokeId: last.id
          });
        }
      }
      return newStrokes;
    });
  };

  const redo = () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const newRedo = [...prev];
      const last = newRedo.pop();
      if (last) {
        setStrokes(s => [...s, last]);
      }
      return newRedo;
    });
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const inviteCollaborator = async () => {
    const url = window.location.href;
    console.log('Attempting to copy URL:', url);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        console.log('Clipboard API success');
        setNotification({ msg: 'Link copied to clipboard!', type: 'success' });
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch (err: any) {
      console.warn('Clipboard API failed, trying fallback:', err);
      try {
        const textArea = document.createElement("textarea");
        textArea.value = url;

        // Ensure textarea is technically visible but not disruptive
        textArea.style.position = 'fixed';
        textArea.style.left = '0';
        textArea.style.top = '0';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.setAttribute('readonly', ''); // Prevent keyboard on mobile

        document.body.appendChild(textArea);

        textArea.focus({ preventScroll: true });
        textArea.select();
        textArea.setSelectionRange(0, 99999);

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          console.log('execCommand success');
          setNotification({ msg: 'Link copied to clipboard!', type: 'success' });
        } else {
          throw new Error('execCommand returned false');
        }
      } catch (fallbackErr: any) {
        console.error('All copy methods failed:', fallbackErr);
        setNotification({
          msg: `Copy failed. Please copy manually from the prompt.`,
          type: 'error'
        });
        prompt('Copy this invite link:', url);
      }
    }
  };


  return (
    <div className="canvas-container bg-slate-50 relative">
      {notification && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] px-6 py-3 rounded-full shadow-xl text-white font-medium text-sm transition-all animate-fade-in-down ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
          }`}>
          <i className={`fa-solid mr-2 ${notification.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
          {notification.msg}
        </div>
      )}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <i className="fa-solid fa-signature text-white"></i>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800">CanvasSync</span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Room: {roomId}</span>
        </div>
      </div>

      <Collaborators users={collaborators} onInvite={inviteCollaborator} />

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        className="block"
      />

      <Toolbar
        activeTool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        undo={undo}
        redo={redo}
        exportPng={exportPng}
      />
    </div>
  );
};

export default Whiteboard;

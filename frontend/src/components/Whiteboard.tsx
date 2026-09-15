import React, { useCallback, useEffect, useRef, useState } from 'react';
import CanvasBoard, { CanvasBoardHandle } from './CanvasBoard';
import Collaborators from './Collaborators';
import Toolbar from './Toolbar';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { Stroke, Tool, UserPresence } from '../types';
import { findLatestOwnedStroke } from '../utils/findLatestOwnedStroke';

interface WhiteboardProps {
  roomId: string;
  userName: string;
}

const USER_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, userName }) => {
  const canvasBoardRef = useRef<CanvasBoardHandle>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [collaborators, setCollaborators] = useState<UserPresence[]>([
    { id: 'me', name: userName, color: '#3b82f6', isMe: true }
  ]);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const userColorRef = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const pendingUndoRef = useRef<Stroke | null>(null);
  const pendingRedoRef = useRef<Stroke | null>(null);

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleRoomLoaded = useCallback((data: { strokes: Stroke[]; users: UserPresence[] }) => {
    setStrokes(data.strokes);
    setCollaborators(data.users);
  }, []);

  const handleRemoteStroke = useCallback((stroke: Stroke) => {
    setStrokes(previousStrokes => [...previousStrokes, stroke]);
  }, []);

  const handleUserJoined = useCallback((data: { userId: string; userName: string; userColor: string }) => {
    setCollaborators(previousUsers => [
      ...previousUsers,
      { id: data.userId, name: data.userName, color: data.userColor, isMe: false }
    ]);
  }, []);

  const handleUserLeft = useCallback((data: { userId: string }) => {
    setCollaborators(previousUsers => previousUsers.filter(user => user.id !== data.userId));
  }, []);

  const handleUndoConfirmed = useCallback((strokeId: string) => {
    setStrokes(previousStrokes => previousStrokes.filter(stroke => stroke.id !== strokeId));

    const pendingUndo = pendingUndoRef.current;
    if (pendingUndo?.id === strokeId) {
      setRedoStack(previousStack => [...previousStack, pendingUndo]);
      pendingUndoRef.current = null;
    }
  }, []);

  const handleRedoConfirmed = useCallback((stroke: Stroke) => {
    setStrokes(previousStrokes => (
      previousStrokes.some(activeStroke => activeStroke.id === stroke.id)
        ? previousStrokes
        : [...previousStrokes, stroke]
    ));

    if (pendingRedoRef.current?.id === stroke.id) {
      setRedoStack(previousStack => (
        previousStack[previousStack.length - 1]?.id === stroke.id
          ? previousStack.slice(0, -1)
          : previousStack
      ));
      pendingRedoRef.current = null;
    }
  }, []);

  const { userIdRef, emitCompletedStroke, requestUndo, requestRedo, isSocketAvailable } = useRoomSocket({
    roomId,
    userName,
    userColor: userColorRef.current,
    onRoomLoaded: handleRoomLoaded,
    onRemoteStroke: handleRemoteStroke,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onUndoConfirmed: handleUndoConfirmed,
    onRedoConfirmed: handleRedoConfirmed
  });

  const getUserId = useCallback(() => userIdRef.current, [userIdRef]);

  const handleCompletedStroke = useCallback((stroke: Stroke) => {
    setStrokes(previousStrokes => [...previousStrokes, stroke]);
    setRedoStack([]);
    pendingRedoRef.current = null;
    emitCompletedStroke(stroke);
  }, [emitCompletedStroke]);

  const undo = useCallback(() => {
    const stroke = findLatestOwnedStroke(strokes, userIdRef.current);
    if (!stroke || !isSocketAvailable()) return;

    pendingUndoRef.current = stroke;
    requestUndo(stroke.id);
  }, [isSocketAvailable, requestUndo, strokes, userIdRef]);

  const redo = useCallback(() => {
    const stroke = redoStack[redoStack.length - 1];
    if (!stroke || !isSocketAvailable()) return;

    pendingRedoRef.current = stroke;
    requestRedo(stroke.id);
  }, [isSocketAvailable, redoStack, requestRedo]);

  const exportPng = useCallback(() => {
    canvasBoardRef.current?.exportPng(`whiteboard-${roomId}.png`);
  }, [roomId]);

  const inviteCollaborator = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setNotification({ msg: 'Link copied to clipboard!', type: 'success' });
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch (error: unknown) {
      console.warn('Clipboard API failed, trying fallback:', error);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '0';
        textArea.style.top = '0';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);

        textArea.focus({ preventScroll: true });
        textArea.select();
        textArea.setSelectionRange(0, 99999);

        if (!document.execCommand('copy')) {
          throw new Error('execCommand returned false');
        }
        document.body.removeChild(textArea);
        setNotification({ msg: 'Link copied to clipboard!', type: 'success' });
      } catch (fallbackError: unknown) {
        console.error('All copy methods failed:', fallbackError);
        setNotification({ msg: 'Copy failed. Please copy manually from the prompt.', type: 'error' });
        prompt('Copy this invite link:', url);
      }
    }
  };

  return (
    <div className="canvas-container bg-slate-50 relative">
      {notification && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] px-6 py-3 rounded-full shadow-xl text-white font-medium text-sm transition-all animate-fade-in-down ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
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
      <CanvasBoard
        ref={canvasBoardRef}
        strokes={strokes}
        tool={tool}
        color={color}
        width={width}
        getUserId={getUserId}
        onCompletedStroke={handleCompletedStroke}
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

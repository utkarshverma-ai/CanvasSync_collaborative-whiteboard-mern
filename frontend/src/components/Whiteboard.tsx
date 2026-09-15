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

  const { userIdRef, emitCompletedStroke, requestUndo, requestRedo, isSocketAvailable, connectionStatus } = useRoomSocket({
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

  const canUndo = Boolean(findLatestOwnedStroke(strokes, userIdRef.current));
  const canRedo = redoStack.length > 0;

  const exportPng = useCallback(() => {
    canvasBoardRef.current?.exportPng(`whiteboard-${roomId}.png`);
  }, [roomId]);

  const inviteCollaborator = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setNotification({ msg: 'Invite link copied.', type: 'success' });
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
        setNotification({ msg: 'Invite link copied.', type: 'success' });
      } catch (fallbackError: unknown) {
        console.error('All copy methods failed:', fallbackError);
        setNotification({ msg: 'Could not copy the invite link.', type: 'error' });
        prompt('Copy this invite link:', url);
      }
    }
  };

  return (
    <div className="canvas-container workspace-shell">
      {notification && (
        <div className={`workspace-toast ${notification.type === 'success' ? 'is-success' : 'is-error'}`} role="status">
          <i className={`fa-solid ${notification.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`} aria-hidden="true"></i>
          {notification.msg}
        </div>
      )}
      <header className="workspace-header">
        <div className="workspace-brand">
          <div className="workspace-mark" aria-hidden="true">
            <i className="fa-solid fa-signature"></i>
          </div>
          <div className="workspace-title">
            <span className="workspace-product-name">CanvasSync</span>
            <span className="workspace-room-name">Board · {roomId}</span>
          </div>
          <span className={`connection-status is-${connectionStatus}`} role="status">
            <span className="connection-status-dot" aria-hidden="true"></span>
            <span className="connection-status-label">
              {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
          </span>
        </div>
        <Collaborators users={collaborators} onInvite={inviteCollaborator} />
      </header>

      <CanvasBoard
        ref={canvasBoardRef}
        strokes={strokes}
        tool={tool}
        color={color}
        width={width}
        getUserId={getUserId}
        onCompletedStroke={handleCompletedStroke}
      />
      {strokes.length === 0 && (
        <div className="workspace-empty-state" aria-hidden="true">
          <strong>Start drawing</strong>
          <span>Choose a tool below and sketch something together.</span>
        </div>
      )}
      <Toolbar
        activeTool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        exportPng={exportPng}
      />
    </div>
  );
};

export default Whiteboard;

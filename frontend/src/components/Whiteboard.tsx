import React, { useCallback, useEffect, useRef, useState } from 'react';
import CanvasBoard, { CanvasBoardHandle } from './CanvasBoard';
import CanvasSyncLogo from './CanvasSyncLogo';
import Collaborators from './Collaborators';
import Toolbar from './Toolbar';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { BoardPage, PageStrokePayload, Stroke, Tool, UserPresence } from '../types';
import { appendStrokeToPage } from '../utils/appendStrokeToPage';
import { findLatestOwnedStroke } from '../utils/findLatestOwnedStroke';

interface WhiteboardProps {
  roomId: string;
  userName: string;
}

const USER_COLORS = ['#357a72', '#c56f45', '#7b8c77', '#b78a4a', '#8d6a7d', '#a95c72'];

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, userName }) => {
  const canvasBoardRef = useRef<CanvasBoardHandle>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const [pages, setPages] = useState<BoardPage[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const userColorRef = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const [collaborators, setCollaborators] = useState<UserPresence[]>(() => [
    { id: 'me', name: userName, color: userColorRef.current, isMe: true }
  ]);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const pendingUndoRef = useRef<Stroke | null>(null);
  const pendingRedoRef = useRef<Stroke | null>(null);

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleRoomLoaded = useCallback((data: { pages: BoardPage[]; users: UserPresence[] }) => {
    setPages(data.pages);
    setCollaborators(data.users);
  }, []);

  const handlePageCreated = useCallback(({ page }: { page: BoardPage }) => {
    setPages(previousPages => (
      previousPages.some(existingPage => existingPage.id === page.id)
        ? previousPages
        : [...previousPages, page]
    ));
  }, []);

  const handleRemoteStroke = useCallback(({ pageId, stroke }: PageStrokePayload) => {
    setPages(previousPages => appendStrokeToPage(previousPages, pageId, stroke));
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
    // Phase 2 bridge: the undo protocol has no page ID until Phase 3, so confirmations target Page 1 only.
    setPages(previousPages => {
      const initialPage = previousPages[0];
      if (!initialPage) return previousPages;

      return [{ ...initialPage, strokes: initialPage.strokes.filter(stroke => stroke.id !== strokeId) }, ...previousPages.slice(1)];
    });

    const pendingUndo = pendingUndoRef.current;
    if (pendingUndo?.id === strokeId) {
      setRedoStack(previousStack => [...previousStack, pendingUndo]);
      pendingUndoRef.current = null;
    }
  }, []);

  const handleRedoConfirmed = useCallback((stroke: Stroke) => {
    // Phase 2 bridge: redo remains scoped to the initial page until the page-aware history contract lands.
    setPages(previousPages => {
      const initialPage = previousPages[0];
      if (!initialPage || initialPage.strokes.some(activeStroke => activeStroke.id === stroke.id)) return previousPages;

      return [{ ...initialPage, strokes: [...initialPage.strokes, stroke] }, ...previousPages.slice(1)];
    });

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
    onPageCreated: handlePageCreated,
    onRemoteStroke: handleRemoteStroke,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onUndoConfirmed: handleUndoConfirmed,
    onRedoConfirmed: handleRedoConfirmed
  });

  const getUserId = useCallback(() => userIdRef.current, [userIdRef]);

  const initialPage = pages[0];
  const strokes = initialPage?.strokes ?? [];

  const handleCompletedStroke = useCallback((stroke: Stroke) => {
    const pageId = pages[0]?.id;
    if (!pageId) return;

    setPages(previousPages => appendStrokeToPage(previousPages, pageId, stroke));
    setRedoStack([]);
    pendingRedoRef.current = null;
    emitCompletedStroke(pageId, stroke);
  }, [emitCompletedStroke, pages]);

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
          <CanvasSyncLogo className="workspace-brand-logo" size={40} showWordmark />
          <span className="workspace-divider" aria-hidden="true"></span>
          <span className={`connection-status is-${connectionStatus}`} role="status">
            <span className="connection-status-dot" aria-hidden="true"></span>
            <span className="connection-status-label">
              {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
          </span>
          <span className="workspace-divider workspace-divider--room" aria-hidden="true"></span>
          <span className="workspace-room-name" title={`Board ID: ${roomId}`}>Board · {roomId}</span>
        </div>
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
          <svg viewBox="0 0 180 88" fill="none">
            <path className="workspace-empty-sketch" d="M13 61c16-24 27-27 37-10 8 14 17 15 28 1 11-15 21-13 32 2" />
            <path className="workspace-empty-pen" d="m111 50 35-35 10 10-35 35-15 5 5-15Z" />
            <path className="workspace-empty-pen" d="m140 21 10 10" />
            <path className="workspace-empty-spark" d="m157 12 3-7m5 18 8 2m-16 8 4 6" />
          </svg>
          <strong>Start drawing together</strong>
          <span>Choose a tool, invite others, and bring your ideas to life in real time.</span>
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
      <Collaborators users={collaborators} onInvite={inviteCollaborator} />
    </div>
  );
};

export default Whiteboard;

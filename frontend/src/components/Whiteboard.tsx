import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasBoardHandle } from './CanvasBoard';
import BoardPages from './BoardPages';
import CanvasSyncLogo from './CanvasSyncLogo';
import Collaborators from './Collaborators';
import Toolbar from './Toolbar';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { BoardPage, PageCreatedPayload, PageStrokeCommandPayload, PageStrokePayload, Stroke, Tool, UserPresence } from '../types';
import { appendStrokeToPage } from '../utils/appendStrokeToPage';
import { appendPage } from '../utils/appendPage';
import { findLatestOwnedStroke } from '../utils/findLatestOwnedStroke';
import { removeStrokeFromPage, restoreStrokeToPage } from '../utils/pageHistory';
import { isLocalPageCreation } from '../utils/pageCreation';

interface WhiteboardProps {
  roomId: string;
  userName: string;
}

const USER_COLORS = ['#357a72', '#c56f45', '#7b8c77', '#b78a4a', '#8d6a7d', '#a95c72'];

interface PageHistoryEntry {
  pageId: string;
  stroke: Stroke;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, userName }) => {
  const canvasBoardRefs = useRef(new Map<string, CanvasBoardHandle>());
  const pageElementRefs = useRef(new Map<string, HTMLElement>());
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(5);
  const [pages, setPages] = useState<BoardPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [pendingPageRequestId, setPendingPageRequestId] = useState<string | null>(null);
  const [pageIdToScroll, setPageIdToScroll] = useState<string | null>(null);
  const [redoStack, setRedoStack] = useState<PageHistoryEntry[]>([]);
  const userColorRef = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const [collaborators, setCollaborators] = useState<UserPresence[]>(() => [
    { id: 'me', name: userName, color: userColorRef.current, isMe: true }
  ]);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const pendingUndoRef = useRef<PageHistoryEntry | null>(null);
  const pendingRedoRef = useRef<PageHistoryEntry | null>(null);
  const pendingPageRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleRoomLoaded = useCallback((data: { pages: BoardPage[]; users: UserPresence[] }) => {
    setPages(data.pages);
    setActivePageId(data.pages[0]?.id ?? null);
    setCollaborators(data.users);
  }, []);

  const handlePageCreated = useCallback((payload: PageCreatedPayload) => {
    const { page } = payload;
    setPages(previousPages => appendPage(previousPages, page));

    if (isLocalPageCreation(pendingPageRequestIdRef.current, payload, userIdRef.current)) {
      pendingPageRequestIdRef.current = null;
      setPendingPageRequestId(null);
      setActivePageId(page.id);
      setPageIdToScroll(page.id);
    }
  }, []);

  const handlePageCreateRejected = useCallback(({ requestId }: { requestId: string; reason: 'limit-reached' }) => {
    if (pendingPageRequestIdRef.current !== requestId) return;

    pendingPageRequestIdRef.current = null;
    setPendingPageRequestId(null);
    setNotification({ msg: 'This board has reached its page limit.', type: 'error' });
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

  const handleUndoConfirmed = useCallback(({ pageId, strokeId }: PageStrokeCommandPayload) => {
    setPages(previousPages => removeStrokeFromPage(previousPages, pageId, strokeId));

    const pendingUndo = pendingUndoRef.current;
    if (pendingUndo?.pageId === pageId && pendingUndo.stroke.id === strokeId) {
      setRedoStack(previousStack => [...previousStack, pendingUndo]);
      pendingUndoRef.current = null;
    }
  }, []);

  const handleRedoConfirmed = useCallback(({ pageId, stroke }: PageStrokePayload) => {
    setPages(previousPages => restoreStrokeToPage(previousPages, pageId, stroke));

    if (pendingRedoRef.current?.pageId === pageId && pendingRedoRef.current.stroke.id === stroke.id) {
      setRedoStack(previousStack => previousStack.filter(entry => (
        entry.pageId !== pageId || entry.stroke.id !== stroke.id
      )));
      pendingRedoRef.current = null;
    }
  }, []);

  const { userIdRef, requestPageCreation, emitCompletedStroke, requestUndo, requestRedo, isSocketAvailable, connectionStatus } = useRoomSocket({
    roomId,
    userName,
    userColor: userColorRef.current,
    onRoomLoaded: handleRoomLoaded,
    onPageCreated: handlePageCreated,
    onPageCreateRejected: handlePageCreateRejected,
    onRemoteStroke: handleRemoteStroke,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onUndoConfirmed: handleUndoConfirmed,
    onRedoConfirmed: handleRedoConfirmed
  });

  const getUserId = useCallback(() => userIdRef.current, [userIdRef]);

  useEffect(() => {
    if (connectionStatus === 'connected') return;

    pendingPageRequestIdRef.current = null;
    setPendingPageRequestId(null);
  }, [connectionStatus]);

  useEffect(() => {
    if (!pageIdToScroll) return;

    const frame = requestAnimationFrame(() => {
      const pageElement = pageElementRefs.current.get(pageIdToScroll);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      pageElement?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      setPageIdToScroll(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [pageIdToScroll, pages]);

  const activePage = pages.find(page => page.id === activePageId) ?? null;
  const activeStrokes = activePage?.strokes ?? [];

  const handleCanvasHandle = useCallback((pageId: string, handle: CanvasBoardHandle | null) => {
    if (handle) {
      canvasBoardRefs.current.set(pageId, handle);
    } else {
      canvasBoardRefs.current.delete(pageId);
    }
  }, []);

  const handlePageElement = useCallback((pageId: string, element: HTMLElement | null) => {
    if (element) {
      pageElementRefs.current.set(pageId, element);
    } else {
      pageElementRefs.current.delete(pageId);
    }
  }, []);

  const createPage = useCallback(() => {
    if (connectionStatus !== 'connected' || pendingPageRequestIdRef.current) return;

    const requestId = crypto.randomUUID();
    pendingPageRequestIdRef.current = requestId;
    setPendingPageRequestId(requestId);
    requestPageCreation(requestId);
  }, [connectionStatus, requestPageCreation]);

  const handleCompletedStroke = useCallback((pageId: string, stroke: Stroke) => {
    setPages(previousPages => appendStrokeToPage(previousPages, pageId, stroke));
    setRedoStack(previousStack => previousStack.filter(entry => entry.pageId !== pageId));
    if (pendingRedoRef.current?.pageId === pageId) {
      pendingRedoRef.current = null;
    }
    emitCompletedStroke(pageId, stroke);
  }, [emitCompletedStroke]);

  const undo = useCallback(() => {
    const pageId = activePage?.id;
    const stroke = findLatestOwnedStroke(activeStrokes, userIdRef.current);
    if (!pageId || !stroke || !isSocketAvailable()) return;

    pendingUndoRef.current = { pageId, stroke };
    requestUndo(pageId, stroke.id);
  }, [activePage?.id, activeStrokes, isSocketAvailable, requestUndo, userIdRef]);

  const redo = useCallback(() => {
    const pageId = activePage?.id;
    const entry = pageId ? [...redoStack].reverse().find(candidate => candidate.pageId === pageId) : undefined;
    if (!entry || !isSocketAvailable()) return;

    pendingRedoRef.current = entry;
    requestRedo(entry.pageId, entry.stroke.id);
  }, [activePage?.id, isSocketAvailable, redoStack, requestRedo]);

  const canUndo = Boolean(findLatestOwnedStroke(activeStrokes, userIdRef.current));
  const canRedo = Boolean(activePage && redoStack.some(entry => entry.pageId === activePage.id));

  const exportPng = useCallback(() => {
    if (!activePage) return;

    const pageNumber = pages.findIndex(page => page.id === activePage.id) + 1;
    canvasBoardRefs.current.get(activePage.id)?.exportPng(`whiteboard-${roomId}-page-${pageNumber}.png`);
  }, [activePage, pages, roomId]);

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

      <BoardPages
        pages={pages}
        activePageId={activePageId}
        tool={tool}
        color={color}
        width={width}
        getUserId={getUserId}
        onActivatePage={setActivePageId}
        onCompletedStroke={handleCompletedStroke}
        onCanvasHandle={handleCanvasHandle}
        onPageElement={handlePageElement}
        onCreatePage={createPage}
        canCreatePage={connectionStatus === 'connected' && pendingPageRequestId === null}
        isCreatingPage={pendingPageRequestId !== null}
      />
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

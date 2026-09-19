import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BoardPage, PageCreatedPayload, PageStrokeCommandPayload, PageStrokePayload, Stroke, UserPresence } from '../types';

interface RoomSocketHandlers {
  onRoomLoaded: (data: { pages: BoardPage[]; users: UserPresence[] }) => void;
  onPageCreated: (payload: PageCreatedPayload) => void;
  onPageCreateRejected: (payload: { requestId: string; reason: 'limit-reached' }) => void;
  onRemoteStroke: (payload: PageStrokePayload) => void;
  onUserJoined: (user: { userId: string; userName: string; userColor: string }) => void;
  onUserLeft: (user: { userId: string; userName: string }) => void;
  onUndoConfirmed: (payload: PageStrokeCommandPayload) => void;
  onRedoConfirmed: (payload: PageStrokePayload) => void;
}

interface UseRoomSocketOptions extends RoomSocketHandlers {
  roomId: string;
  userName: string;
  userColor: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useRoomSocket({
  roomId,
  userName,
  userColor,
  onRoomLoaded,
  onPageCreated,
  onPageCreateRejected,
  onRemoteStroke,
  onUserJoined,
  onUserLeft,
  onUndoConfirmed,
  onRedoConfirmed
}: UseRoomSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef('me');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;
    setConnectionStatus('connecting');

    const joinRoom = () => {
      socket.emit('join-room', { roomId, userName, userColor });
    };

    const onConnect = () => {
      userIdRef.current = socket.id;
      setConnectionStatus('connected');
      joinRoom();
    };

    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect', joinRoom);
    socket.on('load-room', onRoomLoaded);
    socket.on('page-created', onPageCreated);
    socket.on('page-create-rejected', onPageCreateRejected);
    socket.on('remote-stroke', onRemoteStroke);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('undo-stroke-remote', onUndoConfirmed);
    socket.on('redo-stroke-remote', onRedoConfirmed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect', joinRoom);
      socket.off('load-room', onRoomLoaded);
      socket.off('page-created', onPageCreated);
      socket.off('page-create-rejected', onPageCreateRejected);
      socket.off('remote-stroke', onRemoteStroke);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('undo-stroke-remote', onUndoConfirmed);
      socket.off('redo-stroke-remote', onRedoConfirmed);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [roomId, userName, userColor, onRoomLoaded, onPageCreated, onPageCreateRejected, onRemoteStroke, onUserJoined, onUserLeft, onUndoConfirmed, onRedoConfirmed]);

  const requestPageCreation = useCallback((requestId: string) => {
    socketRef.current?.emit('create-page', { roomId, requestId });
  }, [roomId]);

  const emitCompletedStroke = useCallback((pageId: string, stroke: Stroke) => {
    socketRef.current?.emit('draw-stroke', { roomId, pageId, stroke });
  }, [roomId]);

  const requestUndo = useCallback((pageId: string, strokeId: string) => {
    socketRef.current?.emit('undo-stroke', { roomId, pageId, strokeId });
  }, [roomId]);

  const requestRedo = useCallback((pageId: string, strokeId: string) => {
    socketRef.current?.emit('redo-stroke', { roomId, pageId, strokeId });
  }, [roomId]);

  // A disconnected Socket.IO instance may queue emits for a later reconnect. History
  // commands must stay unavailable until the room is connected again so they cannot
  // apply after the user has moved on to a different page or board state.
  const isSocketAvailable = useCallback(() => socketRef.current?.connected === true, []);

  return { userIdRef, requestPageCreation, emitCompletedStroke, requestUndo, requestRedo, isSocketAvailable, connectionStatus };
}

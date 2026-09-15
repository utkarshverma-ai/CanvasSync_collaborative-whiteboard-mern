import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Stroke, UserPresence } from '../types';

interface RoomSocketHandlers {
  onRoomLoaded: (data: { strokes: Stroke[]; users: UserPresence[] }) => void;
  onRemoteStroke: (stroke: Stroke) => void;
  onUserJoined: (user: { userId: string; userName: string; userColor: string }) => void;
  onUserLeft: (user: { userId: string; userName: string }) => void;
  onUndoConfirmed: (strokeId: string) => void;
  onRedoConfirmed: (stroke: Stroke) => void;
}

interface UseRoomSocketOptions extends RoomSocketHandlers {
  roomId: string;
  userName: string;
  userColor: string;
}

export function useRoomSocket({
  roomId,
  userName,
  userColor,
  onRoomLoaded,
  onRemoteStroke,
  onUserJoined,
  onUserLeft,
  onUndoConfirmed,
  onRedoConfirmed
}: UseRoomSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef('me');

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit('join-room', { roomId, userName, userColor });
    };

    const onConnect = () => {
      userIdRef.current = socket.id;
      joinRoom();
    };

    socket.on('connect', onConnect);
    socket.on('reconnect', joinRoom);
    socket.on('load-room', onRoomLoaded);
    socket.on('remote-stroke', onRemoteStroke);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('undo-stroke-remote', onUndoConfirmed);
    socket.on('redo-stroke-remote', onRedoConfirmed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', joinRoom);
      socket.off('load-room', onRoomLoaded);
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
  }, [roomId, userName, userColor, onRoomLoaded, onRemoteStroke, onUserJoined, onUserLeft, onUndoConfirmed, onRedoConfirmed]);

  const emitCompletedStroke = useCallback((stroke: Stroke) => {
    socketRef.current?.emit('draw-stroke', { roomId, stroke });
  }, [roomId]);

  const requestUndo = useCallback((strokeId: string) => {
    socketRef.current?.emit('undo-stroke', { roomId, strokeId });
  }, [roomId]);

  const requestRedo = useCallback((strokeId: string) => {
    socketRef.current?.emit('redo-stroke', { roomId, strokeId });
  }, [roomId]);

  const isSocketAvailable = useCallback(() => socketRef.current !== null, []);

  return { userIdRef, emitCompletedStroke, requestUndo, requestRedo, isSocketAvailable };
}

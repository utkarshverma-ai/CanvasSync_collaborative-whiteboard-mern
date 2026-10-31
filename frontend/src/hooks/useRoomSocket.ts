import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BoardPage, ChatMessage, ChatResult, PageCreatedPayload, PageStrokeCommandPayload, PageStrokePayload, RoomNotice, Stroke, UserJoinedPayload, UserPresence } from '../types';
import { chatReducer, createChatState } from '../utils/chatState';
import { sendChatWithRetry } from '../utils/chatTransport';
import { createRoomNotificationTracker } from '../utils/roomNotifications';

interface RoomSocketHandlers {
  onRoomLoaded: (data: { pages: BoardPage[]; users: UserPresence[] }) => void;
  onPageCreated: (payload: PageCreatedPayload) => void;
  onPageCreateRejected: (payload: { requestId: string; reason: 'limit-reached' }) => void;
  onRemoteStroke: (payload: PageStrokePayload) => void;
  onUserJoined: (user: UserJoinedPayload) => void;
  onUserLeft: (user: { roomId: string; userId: string; userName: string }) => void;
  onRoomNotice: (notice: RoomNotice) => void;
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
  onRoomNotice,
  onUndoConfirmed,
  onRedoConfirmed
}: UseRoomSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef('me');
  const roomReadyRef = useRef(false);
  const chatOpenRef = useRef(false);
  const [participantId] = useState(() => crypto.randomUUID());
  const notificationTracker = useMemo(() => createRoomNotificationTracker(roomId), [roomId]);
  const ownIdsRef = useRef<string[]>([]);
  const [ownSenderIds, setOwnSenderIds] = useState<string[]>([]);
  const [chat, dispatchChat] = useReducer(chatReducer, undefined, createChatState);
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
    ownIdsRef.current = [];
    setOwnSenderIds([]);
    roomReadyRef.current = false;
    setConnectionStatus('connecting');

    const joinRoom = () => {
      socket.emit('join-room', { roomId, userName, userColor, participantId });
    };

    const onConnect = () => {
      userIdRef.current = socket.id;
      ownIdsRef.current = [...ownIdsRef.current, socket.id];
      setOwnSenderIds(ownIdsRef.current);
      setConnectionStatus('connected');
      joinRoom();
    };

    const onDisconnect = () => {
      roomReadyRef.current = false;
      notificationTracker.disconnect();
      setConnectionStatus('disconnected');
    };

    const onLoadRoom = (data: { pages: BoardPage[]; users: UserPresence[]; messages: ChatMessage[] }) => {
      roomReadyRef.current = true;
      notificationTracker.load(data);
      dispatchChat({ type: 'snapshot', messages: data.messages ?? [], ownIds: ownIdsRef.current });
      onRoomLoaded(data);
    };
    const onChatMessage = (message: ChatMessage) => {
      if (message.roomId !== roomId) return;
      dispatchChat({ type: 'message', message, ownIds: ownIdsRef.current });
      const notice = notificationTracker.message(message, ownIdsRef.current,
        chatOpenRef.current && document.visibilityState !== 'hidden');
      if (notice) onRoomNotice(notice);
    };
    const onJoined = (user: UserJoinedPayload) => {
      if (user.roomId !== roomId || !roomReadyRef.current) return;
      onUserJoined(user);
      const notice = notificationTracker.joined(user, ownIdsRef.current, participantId);
      if (notice) onRoomNotice(notice);
    };
    const onLeft = (user: { roomId: string; userId: string; userName: string }) => {
      if (user.roomId === roomId && roomReadyRef.current) onUserLeft(user);
    };
    const onConnectError = () => setConnectionStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('load-room', onLoadRoom);
    socket.on('chat-message', onChatMessage);
    socket.on('page-created', onPageCreated);
    socket.on('page-create-rejected', onPageCreateRejected);
    socket.on('remote-stroke', onRemoteStroke);
    socket.on('user-joined', onJoined);
    socket.on('user-left', onLeft);
    socket.on('undo-stroke-remote', onUndoConfirmed);
    socket.on('redo-stroke-remote', onRedoConfirmed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      roomReadyRef.current = false;
      notificationTracker.disconnect();
      socket.off('connect_error', onConnectError);
      socket.off('load-room', onLoadRoom);
      socket.off('chat-message', onChatMessage);
      socket.off('page-created', onPageCreated);
      socket.off('page-create-rejected', onPageCreateRejected);
      socket.off('remote-stroke', onRemoteStroke);
      socket.off('user-joined', onJoined);
      socket.off('user-left', onLeft);
      socket.off('undo-stroke-remote', onUndoConfirmed);
      socket.off('redo-stroke-remote', onRedoConfirmed);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [roomId, userName, userColor, participantId, notificationTracker, onRoomNotice, onRoomLoaded, onPageCreated, onPageCreateRejected, onRemoteStroke, onUserJoined, onUserLeft, onUndoConfirmed, onRedoConfirmed]);

  const setChatOpen = useCallback((open: boolean) => {
    chatOpenRef.current = open;
    dispatchChat({ type: 'open', open });
  }, []);

  const sendChatMessage = useCallback(async (text: string, clientMessageId: string): Promise<ChatResult> => {
    const socket = socketRef.current;
    const result = await sendChatWithRetry(socket, { roomId, text, clientMessageId },
      () => roomReadyRef.current && socketRef.current === socket);
    if (socketRef.current !== socket) {
      return { ok: false, error: { code: 'DISCONNECTED', message: 'The room connection changed. Check history before resending.' } };
    }
    if (result.ok) dispatchChat({ type: 'message', message: result.message, ownIds: ownIdsRef.current });
    return result;
  }, [roomId]);

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

  return { userIdRef, requestPageCreation, emitCompletedStroke, requestUndo, requestRedo, isSocketAvailable, connectionStatus,
    chat, ownSenderIds, setChatOpen, sendChatMessage };
}

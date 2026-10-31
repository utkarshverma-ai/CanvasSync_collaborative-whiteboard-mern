import { randomUUID } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { getRoom } from '../rooms/roomStore.js';
import { ChatMessage } from '../rooms/types.js';
import { parseChatPayload } from '../validation/socketValidation.js';

type ChatResult = { ok: true; message: ChatMessage } | {
  ok: false;
  error: { code: 'INVALID_PAYLOAD' | 'NOT_JOINED' | 'RATE_LIMITED' | 'ID_CONFLICT'; message: string; retryAfterMs?: number };
};

export function registerChatHandlers(io: Server, socket: Socket) {
  let sentAt: number[] = [];

  socket.on('send-chat-message', (data: unknown, acknowledge?: (result: ChatResult) => void) => {
    const reply = (result: ChatResult) => {
      if (typeof acknowledge === 'function') acknowledge(result);
    };
    const command = parseChatPayload(data);
    if (!command) {
      reply({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Enter a message between 1 and 500 characters with a valid request ID.' } });
      return;
    }
    const room = getRoom(command.roomId);
    const sender = room?.users.get(socket.id);
    if (!room || !sender || !socket.rooms.has(command.roomId)) {
      reply({ ok: false, error: { code: 'NOT_JOINED', message: 'Join this room before sending a message.' } });
      return;
    }

    // Scope retries to the sending connection. Keep a bounded cache separate from
    // visible history so a recent retry cannot reinsert an evicted message.
    const key = JSON.stringify([socket.id, command.clientMessageId]);
    const existing = room.chatRequests.get(key);
    if (existing) {
      reply(existing.text === command.text
        ? { ok: true, message: existing }
        : { ok: false, error: { code: 'ID_CONFLICT', message: 'This request ID was already used for a different message.' } });
      return;
    }
    const now = Date.now();
    sentAt = sentAt.filter(time => now - time < 10_000);
    if (sentAt.length >= 5) {
      reply({ ok: false, error: { code: 'RATE_LIMITED', message: 'You are sending too quickly. Try again shortly.', retryAfterMs: 10_000 - (now - sentAt[0]) } });
      return;
    }
    sentAt.push(now);
    const message: ChatMessage = {
      id: randomUUID(), roomId: command.roomId, clientMessageId: command.clientMessageId,
      senderId: socket.id, senderName: sender.name, senderColor: sender.color,
      text: command.text, timestamp: new Date(now).toISOString()
    };
    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();
    room.chatRequests.set(key, message);
    if (room.chatRequests.size > 500) room.chatRequests.delete(room.chatRequests.keys().next().value!);
    // Socket.IO also creates a personal room named after each socket ID. Check
    // actual membership so choosing such an ID as a board cannot leak chat.
    for (const memberId of room.users.keys()) {
      const member = io.sockets.sockets.get(memberId);
      if (member?.rooms.has(command.roomId)) member.emit('chat-message', message);
    }
    reply({ ok: true, message });
  });
}

/**
 * Retry a missing acknowledgement once, retaining the request ID and connection
 * identity. Availability is checked for each attempt so Socket.IO cannot buffer
 * a chat send for a later connection or a different room lifecycle.
 * @param {import('socket.io-client').Socket | null} socket
 * @param {{ roomId: string, text: string, clientMessageId: string }} payload
 * @param {() => boolean} isRoomReady
 * @returns {Promise<import('../types').ChatResult>}
 */
export async function sendChatWithRetry(socket, payload, isRoomReady) {
  const senderId = socket?.id;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!socket?.connected || socket.id !== senderId || !isRoomReady()) {
      return { ok: false, error: { code: 'DISCONNECTED', message: 'Wait until the room reconnects before sending.' } };
    }
    try {
      return await socket.timeout(4000).emitWithAck('send-chat-message', payload);
    } catch {
      // Reuse this request ID: the server may have accepted the first attempt.
    }
  }
  return { ok: false, error: { code: 'TIMEOUT', message: 'Delivery is unconfirmed. Check the conversation, then try again.' } };
}

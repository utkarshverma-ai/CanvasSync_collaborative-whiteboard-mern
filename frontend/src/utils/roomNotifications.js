const MAX_SEEN_IDS = 1000;

function remember(set, id) {
  set.add(id);
  if (set.size > MAX_SEEN_IDS) set.delete(set.values().next().value);
}

/** @param {import('../types').RoomNotice[]} notices
 * @param {import('../types').RoomNotice} notice
 */
export function appendRoomNotice(notices, notice, focusedId = null) {
  const updated = [...notices.filter(item => item.id !== notice.id), notice];
  const focused = updated.find(item => item.id === focusedId);
  // Bursts must not remove a notification that a keyboard user is interacting with.
  return updated.length > 3 && focused
    ? [focused, ...updated.filter(item => item.id !== focusedId).slice(-2)]
    : updated.slice(-3);
}

/**
 * One tracker per room visit; retain its bounded ID caches across reconnects.
 * Snapshots seed caches silently. Only live events can produce a notice.
 */
export function createRoomNotificationTracker(roomId) {
  const messages = new Set();
  const participants = new Set();
  let ready = false;

  return {
    disconnect() { ready = false; },
    /** @param {{ messages?: import('../types').ChatMessage[], users: import('../types').UserPresence[] }} data */
    load(data) {
      for (const message of data.messages ?? []) {
        if (message.roomId === roomId) remember(messages, message.id);
      }
      for (const user of data.users) remember(participants, user.participantId ?? user.id);
      ready = true;
    },
    /**
     * @param {import('../types').ChatMessage} message
     * @param {string[]} ownIds
     * @param {boolean} chatVisible
     * @returns {import('../types').RoomNotice | null}
     */
    message(message, ownIds, chatVisible) {
      if (!ready || message.roomId !== roomId || messages.has(message.id)) return null;
      remember(messages, message.id);
      if (ownIds.includes(message.senderId) || chatVisible) return null;
      const text = message.text.replace(/\s+/g, ' ').trim();
      const preview = text.length > 96 ? `${text.slice(0, 96)}…` : text;
      return { id: `message:${message.id}`, kind: 'message', title: message.senderName, preview, color: message.senderColor };
    },
    /**
     * @param {import('../types').UserJoinedPayload} user
     * @param {string[]} ownIds
     * @param {string} ownParticipantId
     * @returns {import('../types').RoomNotice | null}
     */
    joined(user, ownIds, ownParticipantId) {
      if (!ready || user.roomId !== roomId) return null;
      const id = user.participantId ?? user.userId;
      if (participants.has(id)) return null;
      remember(participants, id);
      if (ownIds.includes(user.userId) || id === ownParticipantId) return null;
      return { id: `join:${id}`, kind: 'join', title: `${user.userName} joined the room`, color: user.userColor };
    }
  };
}

/** @param {import('../types').UserPresence[]} users
 * @param {import('../types').UserJoinedPayload} user
 * @returns {import('../types').UserPresence[]}
 */
export function upsertCollaborator(users, user) {
  const existing = users.find(member => member.id === user.userId);
  const joined = { id: user.userId, name: user.userName, color: user.userColor, participantId: user.participantId, isMe: existing?.isMe ?? false };
  return existing ? users.map(member => member.id === joined.id ? joined : member) : [...users, joined];
}

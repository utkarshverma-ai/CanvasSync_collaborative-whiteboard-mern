/** @returns {{ messages: import('../types').ChatMessage[], unread: number, open: boolean, loaded: boolean }} */
export function createChatState() {
  return { messages: [], unread: 0, open: false, loaded: false };
}

/**
 * Snapshots replace history, including after an empty room has been recreated.
 * Live broadcasts and acknowledgements use the same ID-based insertion path.
 * @param {ReturnType<typeof createChatState>} state
 * @param {{ type: 'open', open: boolean } | { type: 'snapshot', messages: import('../types').ChatMessage[], ownIds: string[] } | { type: 'message', message: import('../types').ChatMessage, ownIds: string[] }} action
 */
export function chatReducer(state, action) {
  if (action.type === 'open') return { ...state, open: action.open, unread: action.open ? 0 : state.unread };
  if (action.type === 'snapshot') {
    const messages = [...new Map(action.messages.map(message => [message.id, message])).values()].slice(-100);
    const newUnread = state.loaded && !state.open
      ? messages.filter(message => !action.ownIds.includes(message.senderId) && !state.messages.some(old => old.id === message.id)).length
      : 0;
    return { ...state, messages, loaded: true, unread: Math.min(messages.filter(message => !action.ownIds.includes(message.senderId)).length, state.unread + newUnread) };
  }
  if (state.messages.some(message => message.id === action.message.id)) return state;
  return {
    ...state,
    messages: [...state.messages, action.message].slice(-100),
    unread: Math.min(100, state.unread + (!state.open && !action.ownIds.includes(action.message.senderId) ? 1 : 0))
  };
}

export function shouldSendOnEnter(event) {
  return event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing;
}

export function isNearChatBottom(element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 72;
}

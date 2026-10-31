import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatResult } from '../types';
import { ConnectionStatus } from '../hooks/useRoomSocket';
import { isNearChatBottom, shouldSendOnEnter } from '../utils/chatState';

interface Props {
  open: boolean;
  messages: ChatMessage[];
  ownSenderIds: string[];
  connectionStatus: ConnectionStatus;
  loaded: boolean;
  onClose: () => void;
  onSend: (text: string, clientMessageId: string) => Promise<ChatResult>;
}

const ChatPanel: React.FC<Props> = ({ open, messages, ownSenderIds, connectionStatus, loaded, onClose, onSend }) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const sendingRef = useRef(false);
  const requestRef = useRef<{ text: string; id: string; senderId: string } | null>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const latestSenderId = ownSenderIds.at(-1) ?? '';
  const available = connectionStatus === 'connected' && loaded;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    inputRef.current?.focus({ preventScroll: true });
    nearBottomRef.current = true;
    setHasNewMessages(false);
    return () => {
      const target = previousFocus?.isConnected && previousFocus !== document.body
        ? previousFocus : document.getElementById('chat-toggle');
      target?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const last = messages.at(-1);
    const isNew = last?.id !== lastMessageIdRef.current;
    lastMessageIdRef.current = last?.id;
    if (nearBottomRef.current || (isNew && last && ownSenderIds.includes(last.senderId))) {
      const list = listRef.current;
      if (list) list.scrollTop = list.scrollHeight;
      nearBottomRef.current = true;
      setHasNewMessages(false);
    } else if (isNew) {
      setHasNewMessages(true);
    }
  }, [messages, open, ownSenderIds]);

  const send = async () => {
    if (sendingRef.current || !available || !draft.trim() || draft.length > 500) return;
    const text = draft.trim();
    const previous = requestRef.current;
    const request = previous?.text === text && previous.senderId === latestSenderId
      ? previous : { text, id: crypto.randomUUID(), senderId: latestSenderId };
    requestRef.current = request;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const result = await onSend(text, request.id);
      if (result.ok === true) {
        setDraft('');
        requestRef.current = null;
      } else {
        setError(result.error.message);
      }
    } catch {
      setError('Could not send. Your message is still here; try again.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <aside id="room-chat" className="chat-panel" aria-labelledby="chat-title" hidden={!open}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      }} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <header className="chat-header">
        <div><h2 id="chat-title">Room chat</h2><p>A conversation across every page</p></div>
        <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
      </header>
      <div ref={listRef} className="chat-messages" role="log" aria-label="Room messages" aria-live={open ? 'polite' : 'off'} aria-relevant="additions" tabIndex={0}
        onScroll={() => {
          if (!listRef.current) return;
          nearBottomRef.current = isNearChatBottom(listRef.current);
          if (nearBottomRef.current) setHasNewMessages(false);
        }}>
        {!messages.length && <div className="chat-empty"><i className="fa-regular fa-comments" aria-hidden="true" /><strong>Keep the ideas flowing</strong><p>Send a message to everyone in this room.</p></div>}
        {messages.map(message => {
          const isMine = ownSenderIds.includes(message.senderId);
          return <article key={message.id} className={`chat-message${isMine ? ' is-mine' : ''}`}>
            <div className="chat-message-meta">
              <span className="chat-sender-dot" style={{ backgroundColor: message.senderColor }} aria-hidden="true" />
              <strong>{message.senderName}{isMine ? ' (you)' : ''}</strong>
              <time dateTime={message.timestamp} title={new Date(message.timestamp).toLocaleString()}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
            <p>{message.text}</p>
          </article>;
        })}
      </div>
      {hasNewMessages && <button className="chat-jump" type="button" onClick={() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
        nearBottomRef.current = true;
        setHasNewMessages(false);
      }}>New messages ↓</button>}
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor="chat-input">Message the room</label>
        <textarea ref={inputRef} id="chat-input" value={draft} maxLength={500} rows={3} readOnly={sending}
          placeholder="Share a thought…" aria-describedby="chat-help chat-feedback" onChange={event => { setDraft(event.target.value); setError(''); }}
          onKeyDown={event => {
            if (shouldSendOnEnter(event)) { event.preventDefault(); void send(); }
          }} />
        <div className="chat-composer-actions"><span id="chat-help">Shift+Enter for a new line · {draft.length}/500</span>
          <button type="submit" disabled={!available || sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}<i className="fa-solid fa-arrow-up" aria-hidden="true" /></button>
        </div>
        <p id="chat-feedback" className={error ? 'chat-feedback is-error' : 'chat-feedback'} role="status">
          {error || (!available ? 'Chat will be available when the room reconnects.' : 'Messages are temporary and disappear when everyone leaves.')}
        </p>
      </form>
    </aside>
  );
};

export default ChatPanel;

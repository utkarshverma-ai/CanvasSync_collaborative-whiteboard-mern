import React, { useEffect, useState } from 'react';
import { RoomNotice } from '../types';

interface Props {
  notices: RoomNotice[];
  announcement: RoomNotice | null;
  onDismiss: (id: string) => void;
  onOpenChat: () => void;
}

const NoticeToast: React.FC<{ notice: RoomNotice } & Pick<Props, 'onDismiss' | 'onOpenChat'>> = ({ notice, onDismiss, onOpenChat }) => {
  const [exiting, setExiting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hovered || focused || exiting) return;
    const timer = window.setTimeout(() => setExiting(true), 5000);
    return () => window.clearTimeout(timer);
  }, [hovered, focused, exiting]);

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => onDismiss(notice.id), 180);
    return () => window.clearTimeout(timer);
  }, [exiting, notice.id, onDismiss]);

  const content = <>
    <span className="room-notice-icon" aria-hidden="true"><i className={`fa-solid ${notice.kind === 'message' ? 'fa-comment' : 'fa-user-plus'}`} /></span>
    <span className="room-notice-copy">
      <strong><span className="chat-sender-dot" style={{ backgroundColor: notice.color }} aria-hidden="true" />
        {notice.kind === 'message' && <span className="sr-only">New message from </span>}{notice.title}</strong>
      {notice.preview && <span className="room-notice-preview">{notice.preview}</span>}
      {notice.kind === 'message' && <span className="room-notice-action">Open chat <i className="fa-solid fa-arrow-right" aria-hidden="true" /></span>}
    </span>
  </>;

  return <div className={`room-notice${exiting ? ' is-exiting' : ''}`} data-room-notice-id={notice.id}
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
    }}>
    {notice.kind === 'message'
      ? <button type="button" className="room-notice-body" onClick={onOpenChat}>{content}</button>
      : <div className="room-notice-body">{content}</div>}
    <button type="button" className="room-notice-dismiss" aria-label={`Dismiss notification: ${notice.title}`}
      onClick={() => setExiting(true)}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
  </div>;
};

const RoomNotifications: React.FC<Props> = ({ notices, announcement, onDismiss, onOpenChat }) => (
  <>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement && <span key={announcement.id}>
        {announcement.kind === 'message' ? 'New message from ' : ''}{announcement.title}{announcement.preview ? `. ${announcement.preview}` : ''}
      </span>}
    </span>
    <div className="room-notifications" role="region" aria-label="Room notifications">
      {notices.map(notice => <NoticeToast key={notice.id} notice={notice} onDismiss={onDismiss} onOpenChat={onOpenChat} />)}
    </div>
  </>
);

export default RoomNotifications;

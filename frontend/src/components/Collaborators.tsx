import React from 'react';
import { UserPresence } from '../types';

interface Props {
  users: UserPresence[];
  onInvite: () => void;
}

const MAX_VISIBLE_AVATARS = 3;

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('');

  return initials.toUpperCase() || '?';
}

function getAvatarTextColor(color: string) {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return '#ffffff';

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red) + (0.587 * green) + (0.114 * blue);

  return luminance > 168 ? '#182230' : '#ffffff';
}

const Collaborators: React.FC<Props> = ({ users, onInvite }) => {
  const visibleUsers = users.slice(0, MAX_VISIBLE_AVATARS);
  const remainingUsers = users.length - visibleUsers.length;

  return (
    <div className="collaboration-controls">
      <div className="collaborator-avatars" aria-label={`${users.length} collaborator${users.length === 1 ? '' : 's'} in this board`}>
        {visibleUsers.map(user => (
          <span
            key={user.id}
            className="collaborator-avatar"
            style={{ backgroundColor: user.color, color: getAvatarTextColor(user.color) }}
            title={`${user.name}${user.isMe ? ' (you)' : ''}`}
            aria-label={`${user.name}${user.isMe ? ' (you)' : ''}`}
          >
            {getInitials(user.name)}
          </span>
        ))}
        {remainingUsers > 0 && (
          <span className="collaborator-avatar collaborator-overflow" aria-label={`${remainingUsers} more collaborators`}>
            +{remainingUsers}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onInvite}
        className="share-button"
      >
        <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
        <span>Share</span>
      </button>
    </div>
  );
};

export default Collaborators;

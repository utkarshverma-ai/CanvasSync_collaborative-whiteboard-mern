import React from 'react';
import { UserPresence } from '../types';

interface Props {
  users: UserPresence[];
  onInvite: () => void;
}

const Collaborators: React.FC<Props> = ({ users, onInvite }) => {
  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
      {users.map(u => (
        <div key={u.id} className="w-8 h-8 rounded-full" style={{ background: u.color }} title={u.name} />
      ))}
      <button
        type="button"
        onClick={onInvite}
        className="ml-2 bg-white px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm cursor-pointer border border-slate-200"
      >
        Invite
      </button>
    </div>
  );
};

export default Collaborators;

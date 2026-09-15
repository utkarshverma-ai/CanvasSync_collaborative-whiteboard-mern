
import React, { useState, useEffect } from 'react';
import Whiteboard from './components/Whiteboard';

const App: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    // Check for room ID in URL hash for simplicity in this demo environment
    const hash = window.location.hash.substring(1);
    if (hash) {
      setRoomId(hash);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      const id = roomId || Math.random().toString(36).substring(2, 9);
      setRoomId(id);
      window.location.hash = id;
      setIsJoined(true);
    }
  };

  if (!isJoined) {
    return (
      <main className="entry-page">
        <section className="entry-surface" aria-labelledby="entry-heading">
          <div className="entry-brand">
            <div className="entry-mark" aria-hidden="true">
              <i className="fa-solid fa-signature"></i>
            </div>
            <p className="entry-product-name">CanvasSync</p>
            <h1 id="entry-heading">A shared space for quick ideas.</h1>
          </div>

          <form onSubmit={handleJoin} className="entry-form">
            <div className="entry-field">
              <label htmlFor="user-name">Your name</label>
              <input
                id="user-name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Utkarsh"
                className="entry-input"
                autoComplete="name"
                required
              />
            </div>
            <div className="entry-field">
              <label htmlFor="room-id">Room ID</label>
              <input
                id="room-id"
                type="text"
                value={roomId || ''}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter a room ID"
                className="entry-input"
              />
              <p className="entry-field-help">
                {roomId ? 'You’re joining an existing board.' : 'Leave blank to create a new board.'}
              </p>
            </div>
            <button
              type="submit"
              className="entry-submit"
            >
              {roomId ? 'Join board' : 'Create board'}
            </button>
          </form>

          <p className="entry-footer">Share the invite link once you’re inside.</p>
        </section>
      </main>
    );
  }

  return <Whiteboard roomId={roomId!} userName={userName} />;
};

export default App;

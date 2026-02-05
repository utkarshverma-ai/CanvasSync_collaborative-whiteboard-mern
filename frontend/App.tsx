
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-full max-w-md p-8 glass rounded-2xl shadow-xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <i className="fa-solid fa-signature text-3xl text-white"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">CanvasSync</h1>
            <p className="text-slate-500 mt-2">Real-time collaborative whiteboard</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room ID (Optional)</label>
              <input
                type="text"
                value={roomId || ''}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="New or existing room ID"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
            >
              {roomId ? 'Join Workspace' : 'Create Workspace'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Technical Architecture</p>
            <div className="flex justify-center gap-4 mt-4 text-slate-500 text-sm">
              <div className="flex items-center gap-1"><i className="fa-solid fa-bolt text-amber-500"></i> Socket.IO</div>
              <div className="flex items-center gap-1"><i className="fa-solid fa-database text-green-500"></i> MongoDB</div>
              <div className="flex items-center gap-1"><i className="fa-solid fa-code text-blue-500"></i> TypeScript</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Whiteboard roomId={roomId!} userName={userName} />;
};

export default App;

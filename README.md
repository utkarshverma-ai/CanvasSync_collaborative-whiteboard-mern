# 🎨 CanvasSync

### Real-Time Collaborative Whiteboard

CanvasSync is a full-stack real-time collaborative whiteboard that allows multiple users to join shared rooms and draw together instantly.

The application uses **React, TypeScript, Node.js, Express.js, Socket.IO, and HTML5 Canvas** to provide synchronized drawing, collaborator presence, room-based sessions, undo/redo functionality, invite sharing, and PNG export.

> Built as a personal full-stack project to explore real-time communication, event-driven systems, shared application state, and WebSocket-based collaboration.

---

## 🔗 Live Demo

🌐 **Live Application:**  
https://canvasync-livid.vercel.app/

💻 **GitHub Repository:**  
https://github.com/utkarshverma-ai/CanvasSync_collaborative-whiteboard-mern

---

## ✨ Features

### 🤝 Real-Time Collaboration
- Multiple users can join the same whiteboard room
- Drawing updates are synchronized using Socket.IO
- New participants receive the current room state
- Users can see collaborators joining and leaving the room

### 🖌️ Drawing Experience
- Freehand pen drawing
- Eraser tool
- Custom drawing colors
- Adjustable brush width
- Responsive HTML5 Canvas

### ↩️ Undo / Redo
- Server-authoritative undo for a user's own strokes
- Server-authoritative collaborative redo with LIFO history
- Prevents users from undoing another collaborator's strokes

### 🔗 Room-Based Sharing
- Create a new collaborative workspace
- Join an existing room using its Room ID
- Room ID is stored in the URL
- Copy and share the workspace link with collaborators

### 📤 Export
- Export the current whiteboard as a PNG image

### 🔄 Connection Handling
- Automatic Socket.IO reconnection
- Rejoins the active room after reconnecting
- Synchronizes room data when users connect

---

## 🛠️ Tech Stack

| Area | Technologies |
|---|---|
| **Frontend** | React.js, TypeScript, Vite |
| **Canvas** | HTML5 Canvas API |
| **Backend** | Node.js, Express.js, TypeScript |
| **Real-Time Communication** | Socket.IO, WebSockets |
| **State / Collaboration** | React State, Socket.IO Events |
| **Deployment** | Vercel + Node.js backend hosting |

---

## 🏗️ Architecture

```text
┌─────────────────────┐
│   React Frontend    │
│                     │
│  HTML5 Canvas       │
│  Drawing Tools      │
│  Room UI            │
│  Collaborators      │
└─────────┬───────────┘
          │
          │ Socket.IO / WebSockets
          │
          ▼
┌─────────────────────┐
│ Node.js + Express   │
│ Socket.IO Server    │
│                     │
│ Room Management     │
│ Stroke Sync         │
│ User Presence       │
│ Undo Validation     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ In-Memory Room      │
│ State               │
│                     │
│ • Users             │
│ • Strokes           │
└─────────────────────┘
```

The backend maintains active rooms in memory and uses Socket.IO events to synchronize users and drawing operations. A room and its strokes are removed when its final participant disconnects.

---

## ⚡ How Real-Time Synchronization Works

1. A user creates or joins a room.
2. The frontend establishes a Socket.IO connection.
3. The client emits a `join-room` event with the Room ID and user information.
4. The server creates the room if it does not already exist.
5. Existing strokes and collaborators are sent to the newly joined user.
6. When a user completes a drawing stroke, the frontend emits `draw-stroke`.
7. The server stores the stroke in the room state.
8. The stroke is broadcast to the other users in the room.
9. Remote clients render the received stroke on their canvas.

This creates a synchronized collaborative drawing experience without continuously refreshing the page.

---

## 🔌 Main Socket Events

| Event | Purpose |
|---|---|
| `join-room` | Join or create a collaborative room |
| `load-room` | Load the room's current pages, users, and latest 100 chat messages |
| `send-chat-message` | Send room text with a client request ID and acknowledgement |
| `chat-message` | Receive a server-confirmed room message (including the sender) |
| `draw-stroke` | Send a completed drawing stroke |
| `remote-stroke` | Receive another user's stroke |
| `user-joined` | Notify clients when a collaborator joins |
| `user-left` | Notify clients when a collaborator leaves |
| `undo-stroke` | Request removal of a user's own stroke |
| `undo-stroke-remote` | Synchronize an undo across clients |
| `redo-stroke` | Request restoration of the user's latest undone stroke |
| `redo-stroke-remote` | Synchronize a confirmed redo across clients |

---

## 📁 Project Structure

```text
CanvasSync_collaborative-whiteboard-mern/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CanvasBoard.tsx
│   │   │   ├── Collaborators.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── Whiteboard.tsx
│   │   ├── hooks/
│   │   │   └── useRoomSocket.ts
│   │   ├── utils/
│   │   │   ├── canvasRenderer.ts
│   │   │   └── findLatestOwnedStroke.js
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── types.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── rooms/
│   │   │   ├── roomStore.ts
│   │   │   └── types.ts
│   │   ├── socket/
│   │   │   └── registerWhiteboardHandlers.ts
│   │   └── validation/
│   │       └── socketValidation.ts
│   ├── scripts/
│   │   └── collaboration-smoke-test.js
│   ├── test/
│   │   └── collaboration.test.js
│   └── package.json
│
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git

---

## 1. Clone the repository

```bash
git clone https://github.com/utkarshverma-ai/CanvasSync_collaborative-whiteboard-mern.git
```

```bash
cd CanvasSync_collaborative-whiteboard-mern
```

---

## 2. Start the backend

```bash
cd backend
npm ci
npm run dev
```

By default, the backend runs on:

```text
http://localhost:3002
```

You can verify that the server is running using:

```text
http://localhost:3002/health
```

---

## 3. Start the frontend

Open another terminal:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Vite will display the local frontend URL in your terminal.

---

## ⚙️ Environment Configuration

Inside the frontend environment file:

```env
VITE_API_URL=http://localhost:3002
```

For deployment, replace the local URL with your deployed Socket.IO backend URL.

The backend also supports:

```env
FRONTEND_URL=<your-frontend-url>
PORT=<server-port>
```

---

## ✅ Verification

Run the automated checks from each package:

```bash
cd frontend
npm test
npm run build
```

```bash
cd backend
npm run build
npm test
npm run start
```

`npm run start` runs the compiled backend from `dist/`.

---

# 🧪 Collaboration Testing

The backend contains a basic Socket.IO collaboration test script that simulates two users joining the same room and exchanging drawing strokes.

Start the backend first and then run:

```bash
cd backend
node scripts/collaboration-smoke-test.js
```

The script checks whether connected clients can receive one another's drawing events.

---

# 🧠 Key Engineering Concepts Used

CanvasSync helped me work with several important software engineering concepts:

- Real-time bidirectional communication
- WebSockets and Socket.IO
- Event-driven architecture
- Client-server synchronization
- Shared room state
- React state management
- HTML5 Canvas rendering
- Reconnection handling
- User presence
- TypeScript interfaces
- Express.js server development
- Responsive UI interactions
- Multi-user application behaviour

---

# 🔐 Undo Ownership

CanvasSync associates every drawing stroke with the Socket.IO connection that created it.

When an undo request reaches the server, the server verifies that the requested stroke belongs to that connected user before removing it.

This prevents one collaborator from using the synchronized undo operation to remove another user's drawing.

---

# 📦 Current Project Scope

CanvasSync currently keeps active room information in the **Node.js server's memory**.

This includes:

- Connected users
- Drawing strokes
- Active rooms

When a room becomes empty, its server-side state is removed.

Therefore, the current version provides **session-level collaboration rather than permanent database-backed persistence**.

---

# ⚠️ Current Limitations

- Room state is in memory and is removed after the last participant leaves.
- The application runs as a single server process; state is not shared between server instances.
- Identity is scoped to the current Socket.IO connection; there is no authentication, durable user identity, or private room access. Chat has a basic per-connection rate limit; other events do not.

---

# 🔮 Future Improvements

Potential improvements include:

- MongoDB or PostgreSQL persistence
- User authentication
- Permanent saved whiteboards
- Named workspaces
- Text tool
- Image insertion
- Improved shape tools
- Cursor presence
- Zoom and pan
- Version history
- Role-based room permissions
- Redis-based scaling for multiple Socket.IO servers
- Whiteboard sharing dashboard

---

# 🎯 Why I Built CanvasSync

I wanted to build something beyond a traditional CRUD application and understand how multiple clients can interact with the same application state in real time.

CanvasSync allowed me to work directly with:

**React UI → HTML5 Canvas → Socket.IO client → Node/Express server → real-time room events**

and understand challenges such as synchronization, reconnection, user presence, event ownership, and state consistency.

---

# 👨‍💻 Author

**Utkarsh Verma**

B.Tech Computer Science & Engineering  
GLA University

- GitHub: https://github.com/utkarshverma-ai
- LinkedIn: Add your LinkedIn URL here

---

## ⭐ Support

If you find CanvasSync interesting, consider giving the repository a ⭐.

Feedback and suggestions are welcome.


## Room chat (V1)

Use **Chat**, beside Share, to open or collapse the conversation. Messages belong to
an entire room across all whiteboard pages. Each message shows the participant's
name, collaborator color, and local time; your messages have a teal-tinted surface.
The closed Chat button counts unread incoming messages. Enter sends; Shift+Enter
adds a new line; Escape closes chat and restores focus. Older messages stay in view
while you read; use **New messages** to jump to the latest conversation.

Messages are plain text, trimmed, and limited to 500 characters. Sending requires a
connected socket that has loaded its room. Failed sends retain the draft. The server
allows five accepted messages per socket in a rolling ten-second window across
rooms and returns structured acknowledgement errors. A lost acknowledgement is
retried once with the same request ID, only on the same connection. Deduplication
is scoped to the room and socket and retains the latest 500 accepted request IDs;
retries within that window return the original message without rebroadcasting.
A new connection has a new identity: offline sends are not queued or automatically
replayed after reconnecting. Check restored history before resending an uncertain
message after a disconnection.

The latest **100 messages per active room** live only in this server process's
memory. Late joiners and reconnecting clients receive that available history in
`load-room`. All history and deduplication entries disappear when the last
participant leaves or the server restarts. There is no database persistence,
authentication, private messaging, or room access control. Anyone with a room ID
can join; participant names and colors are self-selected and are not verified
identities. The server derives chat sender metadata from that joined membership.
This V1 assumes a single backend process, as does the rest of room state.

To verify manually:

1. Start the backend and frontend using the commands above.
2. Join a room as Alice, use Share, and open that link in two other browser windows
   or profiles as Bob and Carol. Open Chat in each and exchange messages.
3. Close Carol's panel, send from Alice, and check Carol's unread count. Reopen it
   and confirm the count clears. Try Enter, Shift+Enter, Escape, and blank input.
4. Add a whiteboard page: the conversation should stay shared. Draw, undo, redo,
   and use Share while chat is open. Join a different room and verify isolation.
5. Leave Bob connected, refresh Alice, and confirm the available history restores.
   Temporarily disconnect Alice's network: sending should be unavailable and the
   draft should survive. Restore the connection and check history before resending.
6. Check a narrow mobile viewport, scroll older messages while another user sends,
   and use New messages. Close all room windows, rejoin, and confirm history is empty.

Automated chat coverage is included in `backend/test/collaboration.test.js` and
`frontend/src/utils/chatState.test.js` and `frontend/src/utils/chatTransport.test.js`, alongside the existing collaboration,
page, and drawing-history tests. Run `npm test` in each package.


## In-app notifications and sounds

Incoming live chat messages show a sender/preview toast and a quiet two-note chime
when chat is closed or the document is hidden. Click a message notification to open
chat. When chat is already open in a visible document, both the message toast and
chime are suppressed. Existing unread behavior remains unchanged. Initial and
reconnect history loads never trigger notifications.

New collaborators show a join toast and a distinct, subtle ascending tone. Joins
are deduplicated using an anonymous ID that remains stable for that participant's
current room visit across Socket.IO reconnects. Names are not used as identity.
Reloading the page or starting a new room visit creates a new ID; this remains
unauthenticated presence, not a verified or durable user account. Clients without
this metadata fall back to their socket ID.

The sound toggle beside Chat shows **On** or **Off** and saves the mute preference
in localStorage, including synchronizing changes between open tabs. When storage
is blocked, the toggle still works for the current page. Web Audio is initialized
or resumed only after a pointer or keyboard interaction in the workspace. Before
that interaction, or if the browser blocks audio, visual notices continue to work.
Muted audio stops immediately. Sounds share one context, are throttled to at most
one tone sequence per 1.2 seconds, and are cleaned up when leaving the workspace.
No browser notification permissions, audio files, or extra dependencies are used.

The notification stack shows at most three recent notices, below the workspace
controls and any existing success/error toast. Notices dismiss after five seconds,
pause while hovered or focused, and support keyboard dismissal. Announcements do
not move focus, and transitions respect reduced-motion preferences. Notification
deduplication caches keep at most 1,000 message IDs and 1,000 participant IDs per
room visit.

To check notifications, keep Alice in a room with chat closed, click somewhere in
the workspace to enable browser audio, then join as Bob and Carol in separate
windows. Check the join notices, send messages, click a message toast, and verify
that further visible-chat messages do not interrupt you. Toggle sound off, refresh,
and confirm it remains off while visual notices still appear. Test reconnection
without reloading: presence should return without another join alert. Also check
a different room, narrow screens, reduced motion, blocked audio, and copying the
Share link while notices are displayed.

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
- Undo previously created strokes
- Prevents users from remotely undoing another user's strokes
- Local redo support

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

The backend maintains active rooms in memory and uses Socket.IO events to synchronize users and drawing operations.

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
| `load-room` | Load the room's current strokes and users |
| `draw-stroke` | Send a completed drawing stroke |
| `remote-stroke` | Receive another user's stroke |
| `user-joined` | Notify clients when a collaborator joins |
| `user-left` | Notify clients when a collaborator leaves |
| `undo-stroke` | Request removal of a user's own stroke |
| `undo-stroke-remote` | Synchronize an undo across clients |

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
npm install
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
npm install
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
- Synchronized redo
- Redis-based scaling for multiple Socket.IO servers
- Whiteboard sharing dashboard
- Automated frontend and backend tests

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

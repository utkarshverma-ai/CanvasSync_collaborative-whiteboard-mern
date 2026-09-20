<h1 align="center">CanvasSync</h1>

<p align="center">
  <strong>Real-time collaborative multi-page whiteboard built with React, TypeScript, Node.js, Express, Socket.IO, and the HTML5 Canvas API.</strong>
</p>

<p align="center">
  <a href="https://canvasync-livid.vercel.app/"><strong>Live Demo</strong></a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#getting-started">Run Locally</a>
</p>

---

## Overview

CanvasSync is a real-time collaborative whiteboard where multiple users can join the same room, draw together, create additional board pages, see collaborator presence, undo or redo their own work, share the room, and export the active page as PNG.

The project is built around an event-driven client/server model:

```text
React UI
   ↓
HTML5 Canvas
   ↓
Socket.IO client
   ↓
Node.js + Express + Socket.IO server
   ↓
Server-authoritative room, page, stroke, presence, and history state
```

CanvasSync focuses on the engineering problems behind collaborative software: synchronized shared state, ownership-aware history, reconnect behavior, page-scoped updates, and real-time event validation.

## Features

| Area | What CanvasSync supports |
| --- | --- |
| Collaboration | Multiple users in the same room with synchronized drawing |
| Multi-page boards | Collaborative page creation with up to 50 pages per active room |
| Drawing | Pen, eraser, custom colors, adjustable brush width |
| Presence | Join/leave updates and collaborator list |
| Undo / redo | Server-authoritative, user-owned, page-scoped history |
| Sharing | Room ID in the URL and copyable invite link |
| Export | Export the active page as a PNG |
| Connection handling | Reconnect attempts, room rejoin, connection-status UI |
| Validation | Server-side validation of room, page, stroke, and history commands |
| Testing | Frontend utility tests and backend Socket.IO collaboration tests |

## Real-time collaboration

When a user joins a board:

1. The browser opens a Socket.IO connection.
2. The client emits `join-room` with the room ID and user presence data.
3. The server creates the room if it does not already exist.
4. The server returns the room's current pages, strokes, and connected users.
5. New drawing strokes are sent to the server with a page ID.
6. The server validates and stores each stroke in the active room state.
7. Other participants receive the stroke through `remote-stroke` and render it locally.

This keeps collaborators synchronized without refreshing the page.

## Multi-page boards

A room starts with one board page and collaborators can create more pages during the session.

Page creation is **server-authoritative**:

```text
Client
  │
  ├── create-page { roomId, requestId }
  │
  ▼
Socket.IO Server
  │
  ├── validates membership + room
  ├── enforces MAX_PAGES_PER_ROOM
  ├── creates a UUID-backed page
  │
  ▼
page-created
  │
  └── broadcast to every collaborator
```

The current server limit is:

```text
50 pages per active room
```

Each page keeps its own stroke collection, and drawing/history operations include the target page ID.

## Undo / redo ownership

Undo and redo are intentionally not purely local UI operations.

Each stroke is associated with the Socket.IO connection that created it. When an undo request reaches the server, the server verifies:

- the room exists;
- the socket belongs to the room;
- the page exists;
- the requested stroke exists;
- the stroke belongs to the requesting socket.

Only then is the stroke removed and the update broadcast.

Redo history is also maintained per:

```text
user/socket → page → redo stack
```

This prevents one collaborator from undoing another collaborator's drawing and avoids mixing history between board pages.

## Architecture

```text
┌────────────────────────────────────┐
│ React + TypeScript Frontend        │
│                                    │
│ Landing / Room UI                  │
│ Multi-page board                   │
│ HTML5 Canvas renderer              │
│ Toolbar + collaborators            │
│ Local interaction state            │
└─────────────────┬──────────────────┘
                  │
                  │ Socket.IO
                  │
                  ▼
┌────────────────────────────────────┐
│ Node.js + Express + TypeScript     │
│ Socket.IO Server                   │
│                                    │
│ Room membership                    │
│ Page creation                      │
│ Stroke validation + sync           │
│ Presence                           │
│ Undo / redo ownership              │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│ In-memory active room state        │
│                                    │
│ rooms                              │
│ ├── pages                          │
│ │   └── strokes                    │
│ ├── users                          │
│ └── per-user/page redo stacks      │
└────────────────────────────────────┘
```

### Source layout

```text
CanvasSync_collaborative-whiteboard-mern/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BoardPages.tsx
│   │   │   ├── CanvasBoard.tsx
│   │   │   ├── CanvasPage.tsx
│   │   │   ├── CanvasSyncLogo.tsx
│   │   │   ├── Collaborators.tsx
│   │   │   ├── LandingSections.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── Whiteboard.tsx
│   │   ├── hooks/
│   │   │   └── useRoomSocket.ts
│   │   ├── utils/
│   │   │   ├── canvasRenderer.ts
│   │   │   ├── appendPage.js
│   │   │   ├── appendStrokeToPage.js
│   │   │   ├── findLatestOwnedStroke.js
│   │   │   ├── pageCreation.js
│   │   │   └── pageHistory.js
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── types.ts
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

## Tech stack

### Frontend

- React 19
- TypeScript
- Vite
- HTML5 Canvas API
- Socket.IO Client
- Tailwind CSS 4

### Backend

- Node.js
- Express
- TypeScript
- Socket.IO
- CORS

### State model

CanvasSync currently uses **in-memory server state** for active collaboration sessions.

Despite the repository's historical `mern` name, the current implementation does **not** use MongoDB or another persistent database.

## Main Socket.IO events

| Event | Direction | Purpose |
| --- | --- | --- |
| `join-room` | Client → Server | Join or create a room |
| `load-room` | Server → Client | Send current pages, strokes, and users |
| `create-page` | Client → Server | Request a new board page |
| `page-created` | Server → Room | Synchronize a created page |
| `page-create-rejected` | Server → Client | Reject page creation, e.g. page limit reached |
| `draw-stroke` | Client → Server | Submit a completed page stroke |
| `remote-stroke` | Server → Peers | Broadcast another user's stroke |
| `user-joined` | Server → Room | Announce a collaborator joining |
| `user-left` | Server → Room | Announce a collaborator leaving |
| `undo-stroke` | Client → Server | Request ownership-validated undo |
| `undo-stroke-remote` | Server → Room | Synchronize confirmed undo |
| `redo-stroke` | Client → Server | Request restoration from redo history |
| `redo-stroke-remote` | Server → Room | Synchronize confirmed redo |

## Connection behavior

The Socket.IO client is configured to reconnect automatically.

When the connection returns:

- CanvasSync updates the connection-status UI;
- the client rejoins the current room;
- the server sends the current room state again;
- stale disconnected history commands remain unavailable until the socket is connected.

This helps avoid applying undo/redo operations after a temporary disconnect against outdated local assumptions.

## Getting started

### Prerequisites

Install:

- Node.js
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/utkarshverma-ai/CanvasSync_collaborative-whiteboard-mern.git
cd CanvasSync_collaborative-whiteboard-mern
```

### 2. Start the backend

```bash
cd backend
npm ci
npm run dev
```

Default development server:

```text
http://localhost:3002
```

Health endpoint:

```text
http://localhost:3002/health
```

### 3. Configure and start the frontend

Open another terminal:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Set:

```env
VITE_API_URL=http://localhost:3002
```

For a deployed frontend, point `VITE_API_URL` to the deployed Socket.IO backend.

### Backend environment

The backend supports:

```env
FRONTEND_URL=<your-frontend-url>
PORT=<server-port>
```

## Scripts and verification

### Frontend

Run from `frontend/`:

```bash
npm test
npm run build
npm run dev
npm run preview
```

The current frontend test command covers ownership/history/page utility behavior, including:

- latest owned stroke selection;
- page-scoped stroke updates;
- page history helpers;
- page appending;
- collaborative page-creation helpers.

### Backend

Run from `backend/`:

```bash
npm run build
npm test
npm run start
```

The backend test suite exercises Socket.IO collaboration behavior.

There is also a collaboration smoke-test script:

```bash
cd backend
node scripts/collaboration-smoke-test.js
```

Start the backend before running the smoke test.

## Deployment

Live frontend:

**https://canvasync-livid.vercel.app/**

The frontend can be deployed to Vercel. The Socket.IO backend must run on a Node-compatible host that supports long-lived real-time connections.

Set the deployed frontend's:

```env
VITE_API_URL=<deployed-backend-url>
```

and configure the backend's:

```env
FRONTEND_URL=<deployed-frontend-url>
```

so CORS allows the production client.

## Current scope and limitations

CanvasSync currently provides **session-level collaboration**, not durable whiteboard persistence.

Important limitations:

- active room state is held in one Node.js process;
- when the final participant leaves a room, that room is deleted from server memory;
- restarting the backend clears active rooms;
- state is not shared between multiple backend instances;
- there is no database-backed saved-board history;
- there is no authentication or durable user identity;
- identity/ownership is scoped to the active Socket.IO connection;
- there is no rate limiting or room-level authorization;
- page count is currently limited to 50 per active room.

These constraints keep the current architecture focused on real-time collaboration and make the scaling boundaries explicit.

## Engineering concepts demonstrated

CanvasSync exercises:

- real-time bidirectional communication;
- WebSockets and Socket.IO;
- event-driven architecture;
- client/server state synchronization;
- multi-user presence;
- page-scoped collaborative state;
- server-authoritative commands;
- ownership-aware undo/redo;
- reconnection and rejoin behavior;
- HTML5 Canvas rendering;
- TypeScript domain modeling;
- validation of socket payloads;
- responsive collaborative UI;
- automated utility and Socket.IO integration testing.

## Roadmap

Possible next steps:

- PostgreSQL or MongoDB persistence for saved boards;
- authenticated users and durable ownership;
- permanent shareable whiteboards;
- Redis adapter for horizontal Socket.IO scaling;
- cursor presence;
- zoom and pan;
- text and shape tools;
- image insertion;
- page rename/reorder/delete;
- version history;
- room roles and permissions;
- file/export enhancements;
- rate limiting and abuse protection.

## Why I built CanvasSync

I wanted to build something beyond a traditional CRUD application and understand how multiple clients can safely mutate the same shared state in real time.

CanvasSync let me work directly with the problems behind collaborative applications:

```text
React interaction
      ↓
Canvas rendering
      ↓
Socket event
      ↓
Server validation
      ↓
Authoritative room update
      ↓
Broadcast
      ↓
Remote render
```

The most interesting parts are not only drawing on a canvas, but coordinating ownership, page state, reconnection, ordering, and history across multiple connected users.

## Author

**Utkarsh Verma**

Built as a full-stack real-time systems project focused on collaborative state synchronization, Socket.IO architecture, and product-quality whiteboard interactions.

- GitHub: https://github.com/utkarshverma-ai

---

<p align="center">
  <strong>CanvasSync · Real-time collaboration, one board at a time.</strong>
</p>

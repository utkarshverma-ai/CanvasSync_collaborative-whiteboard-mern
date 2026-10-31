<h1 align="center">CanvasSync</h1>

<p align="center">
  <strong>Real-time collaborative multi-page whiteboard with room chat and collaboration notifications, built with React, TypeScript, Node.js, Express, Socket.IO, and the HTML5 Canvas API.</strong>
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

CanvasSync is a real-time collaborative whiteboard where multiple users can join the same room, draw together, create additional board pages, see collaborator presence, undo or redo their own work, exchange room-wide text messages, receive collaboration notifications, share the room, and export the active page as PNG.

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
Server-authoritative room, page, stroke, presence, drawing history, and chat state
```

CanvasSync focuses on the engineering problems behind collaborative software: synchronized shared state, ownership-aware history, reconnect behavior, page-scoped updates, and real-time event validation.

## Features

| Area | What CanvasSync supports |
| --- | --- |
| Collaboration | Multiple users in the same room with synchronized drawing |
| Multi-page boards | Collaborative page creation with up to 50 pages per active room |
| Drawing | Pen, eraser, custom colors, adjustable brush width |
| Presence | Join/leave updates and collaborator list without duplicate socket entries |
| Room chat | Room-isolated text messaging, latest 100 messages, unread counts, and responsive chat panel |
| Notifications | Message previews, join toasts, subtle Web Audio tones, and persisted mute controls |
| Undo / redo | Server-authoritative, user-owned, page-scoped history |
| Sharing | Room ID in the URL and copyable invite link |
| Export | Export the active page as a PNG |
| Connection handling | Reconnect attempts, room rejoin, connection-status UI |
| Validation | Server-side validation of room, page, stroke, history, and chat commands; chat rate limiting and retry deduplication |
| Testing | Frontend utility tests and backend Socket.IO collaboration tests |

## Real-time collaboration

When a user joins a board:

1. The browser opens a Socket.IO connection.
2. The client emits `join-room` with the room ID and user presence data.
3. The server creates the room if it does not already exist.
4. The server returns the room's current pages, strokes, connected users, and latest 100 chat messages.
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

### Chat protocol and server validation

Chat reuses the existing Socket.IO connection and room membership; it has no page ID.
The client sends `send-chat-message` with `{ roomId, clientMessageId, text }` and an
acknowledgement callback. The request ID must be a non-empty string of at most 100
characters. The raw text must be no longer than 500 characters; the server trims
it and rejects empty or whitespace-only messages. Unsupported payload fields,
including client-supplied sender metadata, are rejected.

The server checks both socket membership and the room's user map, then generates
the message UUID and ISO timestamp. Sender ID, name, and collaborator color come
from that server-side membership. An accepted message contains `id`, `roomId`,
`clientMessageId`, `senderId`, `senderName`, `senderColor`, `text`, and `timestamp`.
It is emitted as `chat-message` to every joined participant, including the sender.

Acknowledgements have one of these shapes:

```ts
type ChatAcknowledgement =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: { code: string; message: string; retryAfterMs?: number } };
```

Error codes are `INVALID_PAYLOAD`, `NOT_JOINED`, `RATE_LIMITED`, and `ID_CONFLICT`.
Rate-limit errors include `retryAfterMs`. Reusing a cached request ID with the same
trimmed text returns the original message without another broadcast or consuming
another rate-limit slot; changing the text for that ID returns `ID_CONFLICT`.
The 500-entry request cache is separate from the 100-message visible history, so
recent retries can still be recognized after a message leaves visible history.
The client waits up to four seconds for an acknowledgement and retries once on the
same connection. Live broadcasts and acknowledgements are deduplicated by server
message ID in the UI.

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

## Architecture

```text
┌────────────────────────────────────┐
│ React + TypeScript Frontend        │
│                                    │
│ Landing / Room UI                  │
│ Multi-page board                   │
│ HTML5 Canvas renderer              │
│ Toolbar + collaborators            │
│ Room chat + unread counts          │
│ Toasts + Web Audio + mute control  │
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
│ Chat validation + rate limiting    │
│ Acknowledgements + deduplication   │
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
│ ├── per-user/page redo stacks      │
│ ├── latest 100 chat messages       │
│ └── latest 500 chat request entries│
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
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── Collaborators.tsx
│   │   │   ├── LandingSections.tsx
│   │   │   ├── RoomNotifications.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── Whiteboard.tsx
│   │   ├── hooks/
│   │   │   ├── useRoomNotifications.ts
│   │   │   └── useRoomSocket.ts
│   │   ├── utils/
│   │   │   ├── canvasRenderer.ts
│   │   │   ├── appendPage.js
│   │   │   ├── appendStrokeToPage.js
│   │   │   ├── chatState.js
│   │   │   ├── chatState.test.js
│   │   │   ├── chatTransport.js
│   │   │   ├── chatTransport.test.js
│   │   │   ├── findLatestOwnedStroke.js
│   │   │   ├── notificationAudio.js
│   │   │   ├── notificationAudio.test.js
│   │   │   ├── roomNotifications.js
│   │   │   ├── roomNotifications.test.js
│   │   │   ├── pageCreation.js
│   │   │   └── pageHistory.js
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
│   │   │   ├── registerChatHandlers.ts
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
- Native Web Audio API
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
| `join-room` | Client → Server | Join or create a room with presence data and an optional anonymous participant ID |
| `load-room` | Server → Client | Send current pages, strokes, users, and latest 100 chat messages |
| `send-chat-message` | Client → Server | Submit room text and a client request ID; receive a structured acknowledgement |
| `chat-message` | Server → Room | Deliver a server-confirmed message to all joined participants, including its sender |
| `create-page` | Client → Server | Request a new board page |
| `page-created` | Server → Room | Synchronize a created page |
| `page-create-rejected` | Server → Client | Reject page creation, e.g. page limit reached |
| `draw-stroke` | Client → Server | Submit a completed page stroke |
| `remote-stroke` | Server → Peers | Broadcast another user's stroke |
| `user-joined` | Server → Peers | Announce a new socket membership with room ID and anonymous participant ID |
| `user-left` | Server → Room | Announce a collaborator leaving, including the room ID |
| `undo-stroke` | Client → Server | Request ownership-validated undo |
| `undo-stroke-remote` | Server → Room | Synchronize confirmed undo |
| `redo-stroke` | Client → Server | Request restoration from redo history |
| `redo-stroke-remote` | Server → Room | Synchronize confirmed redo |

## Connection behavior

The Socket.IO client is configured to reconnect automatically.

When the connection returns:

- CanvasSync updates the connection-status UI;
- the client rejoins the current room;
- the server sends the current room state, including available chat history, again;
- loaded chat history never produces message sounds or toasts;
- stale disconnected history commands remain unavailable until the socket is connected.

This helps avoid applying undo/redo operations after a temporary disconnect against outdated local assumptions. Chat waits for the room snapshot before sending and does not queue offline sends. The anonymous participant ID used for join-notification deduplication survives socket reconnects during the room visit; message and stroke ownership still use the current socket ID.

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
npx tsc --noEmit
npm run build
npm run dev
npm run preview
```

The current frontend test command covers ownership/history/page utility behavior, including:

- latest owned stroke selection;
- page-scoped stroke updates;
- page history helpers;
- page appending;
- collaborative page-creation helpers;
- chat snapshots, unread counts, deduplication, keyboard and scroll decisions;
- chat acknowledgement retries, disconnected sends, and connection changes;
- live notification filtering, join identity, cross-room isolation, and bounded toast queues;
- mute preference, blocked audio, tone throttling, and audio resource cleanup.

### Backend

Run from `backend/`:

```bash
npm test
npx tsc --noEmit
npm run build
npm run start
```

The backend test suite starts its own Socket.IO server and exercises drawing, pages, presence, undo/redo, three-user chat delivery, room isolation, validation, acknowledgements, retry deduplication, rate-limit cooldown, 100-message history truncation, late joins, reconnects, and empty-room cleanup. It also checks stable join metadata and duplicate-join suppression.

The current suites contain **48 frontend tests** and **25 backend tests**. Frontend tests use Node's built-in test runner and cover utility behavior; browser interaction and actual audio playback also need manual verification. `npm run start` runs the compiled backend from `dist/`.

There is also a collaboration smoke-test script:

```bash
cd backend
node scripts/collaboration-smoke-test.js
```

Start the backend before running the smoke test.

### Manual collaboration, chat, and notification verification

1. Start the backend and frontend as described above. Join a room as Alice, use
   Share, and open its link in two other browser windows or profiles as Bob and
   Carol. Verify collaborator counts and exchange messages with Chat open.
2. Close Carol's panel, send from Alice, and check Carol's unread count and sender
   preview toast. Click the toast to open chat; verify unread clears. Try Enter,
   Shift+Enter, Escape, blank input, and the 500-character limit.
3. Interact with Alice's workspace to allow browser audio, then join as another
   participant. Check the distinct join tone and message chime. While chat is open
   in a visible document, new messages should not trigger distracting alerts.
4. Toggle sounds off, refresh, and confirm the preference remains off while visual
   notices still work. Check keyboard focus, toast dismissal and pausing, reduced
   motion, narrow viewports, and visual fallback when audio is blocked.
5. Add a whiteboard page: chat must remain shared across pages. Draw, undo, redo,
   export the active page, and copy the Share link while chat or notices are shown.
   Join a different room and verify chat and notifications stay isolated.
6. Keep Bob connected and refresh Alice to confirm available history restores
   silently. Temporarily disconnect Alice's network without reloading: sending
   should be unavailable, the draft should survive, and reconnecting should not
   produce another join alert for the same visit. Check restored history before
   resending a message whose delivery was unconfirmed.
7. Scroll older messages while another participant sends; the view should stay in
   place until you choose New messages. Close every window for that room, rejoin,
   and confirm its history has been deleted.

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
- there is no authenticated or private room access; anyone with a room ID can join, although commands validate socket membership;
- chat has a per-socket limit of five accepted messages per ten seconds; other socket events are not rate limited;
- only the latest 100 chat messages and 500 chat retry entries per active room are retained;
- chat retry deduplication is bounded and scoped to the same room and socket, not a durable identity;
- sounds require browser interaction and may be blocked; in-app visual notifications remain available;
- mute preferences persist only when localStorage is available; anonymous join IDs last for the current room visit;
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
- broader rate limiting and abuse protection.

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

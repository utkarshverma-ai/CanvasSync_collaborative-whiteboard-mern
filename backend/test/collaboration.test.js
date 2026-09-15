import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const EVENT_TIMEOUT_MS = 2_000;
let backend;
let backendUrl;
const clients = new Set();

function withTimeout(promise, description) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${description}`)), EVENT_TIMEOUT_MS);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert(address && typeof address !== 'string');
  const { port } = address;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function waitForServer(process) {
  return withTimeout(new Promise((resolve, reject) => {
    let output = '';

    const onOutput = chunk => {
      output += chunk.toString();
      if (output.includes('Server running on')) {
        cleanup();
        resolve();
      }
    };
    const onExit = code => {
      cleanup();
      reject(new Error(`Backend exited before starting (code ${code}).`));
    };
    const cleanup = () => {
      process.stdout.off('data', onOutput);
      process.stderr.off('data', onOutput);
      process.off('exit', onExit);
    };

    process.stdout.on('data', onOutput);
    process.stderr.on('data', onOutput);
    process.once('exit', onExit);
  }), 'backend startup');
}

function waitForEvent(socket, event) {
  return withTimeout(new Promise(resolve => socket.once(event, resolve)), `${event} event`);
}

async function connectClient() {
  const socket = io(backendUrl, { reconnection: false });
  clients.add(socket);

  await withTimeout(new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  }), 'Socket.IO connection');

  return socket;
}

async function joinRoom(socket, roomId, userName, userColor) {
  const roomLoaded = waitForEvent(socket, 'load-room');
  socket.emit('join-room', { roomId, userName, userColor });
  return roomLoaded;
}

async function disconnectClient(socket) {
  if (!socket.connected) return;
  const disconnected = waitForEvent(socket, 'disconnect');
  socket.disconnect();
  await disconnected;
}

async function waitForEmptyRooms() {
  const deadline = Date.now() + EVENT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(`${backendUrl}/health`);
    const health = await response.json();
    if (health.activeRooms === 0) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  throw new Error('Timed out waiting for empty-room cleanup');
}

before(async () => {
  const port = await getAvailablePort();
  backendUrl = `http://127.0.0.1:${port}`;
  backend = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer(backend);
});

after(async () => {
  await Promise.all([...clients].map(disconnectClient));

  if (backend && backend.exitCode === null) {
    backend.kill('SIGTERM');
    await withTimeout(new Promise(resolve => backend.once('exit', resolve)), 'backend shutdown');
  }
});

test('joins rooms and broadcasts presence changes', async () => {
  const roomId = `presence-${Date.now()}`;
  const alice = await connectClient();
  const aliceRoom = await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  assert.deepEqual(aliceRoom.strokes, []);
  assert.equal(aliceRoom.users.length, 1);
  assert.equal(aliceRoom.users[0].name, 'Alice');
  assert.equal(aliceRoom.users[0].isMe, true);

  const aliceSeesBob = waitForEvent(alice, 'user-joined');
  const bob = await connectClient();
  const bobRoom = await joinRoom(bob, roomId, 'Bob', '#ef4444');
  const joined = await aliceSeesBob;

  assert.equal(joined.userId, bob.id);
  assert.equal(joined.userName, 'Bob');
  assert.equal(bobRoom.users.length, 2);

  const aliceSeesBobLeave = waitForEvent(alice, 'user-left');
  await disconnectClient(bob);
  const left = await aliceSeesBobLeave;
  assert.equal(left.userId, joined.userId);
  assert.equal(left.userName, 'Bob');

  await disconnectClient(alice);
  await waitForEmptyRooms();
});

test('synchronizes completed strokes and loads stored room state', async () => {
  const roomId = `drawing-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');

  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');

  const stroke = {
    id: `stroke-${Date.now()}`,
    userId: 'client-supplied-id',
    tool: 'pen',
    color: '#000000',
    width: 5,
    points: [{ x: 10, y: 10 }, { x: 100, y: 100 }]
  };
  const bobReceivesStroke = waitForEvent(bob, 'remote-stroke');
  alice.emit('draw-stroke', { roomId, stroke });
  const remoteStroke = await bobReceivesStroke;

  assert.equal(remoteStroke.id, stroke.id);
  assert.equal(remoteStroke.userId, alice.id);
  assert.deepEqual(remoteStroke.points, stroke.points);

  const charlie = await connectClient();
  const charlieRoom = await joinRoom(charlie, roomId, 'Charlie', '#10b981');
  assert.equal(charlieRoom.strokes.length, 1);
  assert.equal(charlieRoom.strokes[0].id, stroke.id);
  assert.equal(charlieRoom.strokes[0].userId, alice.id);

  await Promise.all([disconnectClient(alice), disconnectClient(bob), disconnectClient(charlie)]);
  await waitForEmptyRooms();
});

test('enforces stroke ownership for undo and broadcasts accepted undos', async () => {
  const roomId = `undo-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');

  const aliceStroke = {
    id: `undo-alice-${Date.now()}`,
    userId: 'ignored-by-server',
    tool: 'pen',
    color: '#000000',
    width: 5,
    points: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
  };
  const bobReceivesStroke = waitForEvent(bob, 'remote-stroke');
  alice.emit('draw-stroke', { roomId, stroke: aliceStroke });
  await bobReceivesStroke;

  const aliceSecondStroke = {
    ...aliceStroke,
    id: `undo-alice-second-${Date.now()}`
  };
  const bobReceivesSecondAliceStroke = waitForEvent(bob, 'remote-stroke');
  alice.emit('draw-stroke', { roomId, stroke: aliceSecondStroke });
  await bobReceivesSecondAliceStroke;

  const bobStroke = {
    ...aliceStroke,
    id: `undo-bob-${Date.now()}`,
    color: '#ef4444'
  };
  const aliceReceivesStroke = waitForEvent(alice, 'remote-stroke');
  bob.emit('draw-stroke', { roomId, stroke: bobStroke });
  await aliceReceivesStroke;

  bob.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  const afterUnauthorizedUndo = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(afterUnauthorizedUndo.strokes.map(stroke => stroke.id), [aliceStroke.id, aliceSecondStroke.id, bobStroke.id]);

  const bobReceivesUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceSecondStroke.id });
  assert.equal(await bobReceivesUndo, aliceSecondStroke.id);

  const bobReceivesSecondUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  assert.equal(await bobReceivesSecondUndo, aliceStroke.id);

  const afterAliceUndos = await joinRoom(await connectClient(), roomId, 'Dana', '#f59e0b');
  assert.deepEqual(afterAliceUndos.strokes.map(stroke => stroke.id), [bobStroke.id]);

  alice.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  const afterRepeatedUndo = await joinRoom(await connectClient(), roomId, 'Eve', '#8b5cf6');
  assert.deepEqual(afterRepeatedUndo.strokes.map(stroke => stroke.id), [bobStroke.id]);

  const aliceReceivesUndo = waitForEvent(alice, 'undo-stroke-remote');
  bob.emit('undo-stroke', { roomId, strokeId: bobStroke.id });
  assert.equal(await aliceReceivesUndo, bobStroke.id);

  const afterBothOwnersUndo = await joinRoom(await connectClient(), roomId, 'Frank', '#14b8a6');
  assert.deepEqual(afterBothOwnersUndo.strokes, []);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('clears a room after its final participant leaves', async () => {
  const roomId = `cleanup-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');

  const verifier = await connectClient();
  await joinRoom(verifier, roomId, 'Verifier', '#ef4444');
  const verifierReceivesStroke = waitForEvent(verifier, 'remote-stroke');
  alice.emit('draw-stroke', {
    roomId,
    stroke: {
      id: `cleanup-stroke-${Date.now()}`,
      userId: 'ignored-by-server',
      tool: 'pen',
      color: '#000000',
      width: 5,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
    }
  });
  assert.equal((await verifierReceivesStroke).id.startsWith('cleanup-stroke-'), true);
  await disconnectClient(verifier);
  await disconnectClient(alice);
  await waitForEmptyRooms();

  const newParticipant = await connectClient();
  const recreatedRoom = await joinRoom(newParticipant, roomId, 'New participant', '#10b981');
  assert.deepEqual(recreatedRoom.strokes, []);
  assert.equal(recreatedRoom.users.length, 1);

  await disconnectClient(newParticipant);
  await waitForEmptyRooms();
});

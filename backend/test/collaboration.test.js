import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const EVENT_TIMEOUT_MS = 2_000;
const NEGATIVE_EVENT_WINDOW_MS = 100;
let backend;
let backendUrl;
const clients = new Set();
const initialPageIds = new Map();

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

function expectNoEvent(socket, event, trigger) {
  return new Promise((resolve, reject) => {
    let timeout;
    const onEvent = () => {
      cleanup();
      reject(new Error(`Unexpected ${event} event`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(event, onEvent);
    };

    socket.once(event, onEvent);
    trigger();
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, NEGATIVE_EVENT_WINDOW_MS);
  });
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
  const roomState = await roomLoaded;
  initialPageIds.set(roomId, getInitialPage(roomState).id);
  return roomState;
}

function drawStroke(socket, roomId, stroke, pageId = initialPageIds.get(roomId)) {
  assert.equal(typeof pageId, 'string', `Missing initial page ID for room ${roomId}`);
  socket.emit('draw-stroke', { roomId, pageId, stroke });
}

function getInitialPage(roomState) {
  assert.ok(Array.isArray(roomState.pages));
  assert.equal(roomState.pages.length >= 1, true);
  return roomState.pages[0];
}

function getInitialStrokes(roomState) {
  return getInitialPage(roomState).strokes;
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
  backend = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/index.ts'], {
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
  assert.deepEqual(getInitialStrokes(aliceRoom), []);
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

test('creates one stable initial page and broadcasts server-created pages in insertion order', async () => {
  const roomId = `pages-${Date.now()}`;
  const alice = await connectClient();
  const aliceRoom = await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const firstPage = getInitialPage(aliceRoom);

  assert.equal(aliceRoom.pages.length, 1);
  assert.equal(typeof firstPage.id, 'string');
  assert.notEqual(firstPage.id.trim(), '');
  assert.deepEqual(firstPage.strokes, []);
  assert.equal(aliceRoom.users.length, 1);

  const bob = await connectClient();
  const bobRoom = await joinRoom(bob, roomId, 'Bob', '#ef4444');
  assert.equal(bobRoom.pages.length, 1);
  assert.equal(bobRoom.pages[0].id, firstPage.id);
  assert.equal(bobRoom.users.length, 2);

  const aliceReceivesSecondPage = waitForEvent(alice, 'page-created');
  const bobReceivesSecondPage = waitForEvent(bob, 'page-created');
  alice.emit('create-page', { roomId });
  const secondPageForAlice = await aliceReceivesSecondPage;
  const secondPageForBob = await bobReceivesSecondPage;

  assert.equal(secondPageForAlice.page.id, secondPageForBob.page.id);
  assert.notEqual(secondPageForAlice.page.id, firstPage.id);
  assert.deepEqual(secondPageForAlice.page.strokes, []);

  const aliceReceivesThirdPage = waitForEvent(alice, 'page-created');
  const bobReceivesThirdPage = waitForEvent(bob, 'page-created');
  bob.emit('create-page', { roomId });
  const thirdPageForAlice = await aliceReceivesThirdPage;
  const thirdPageForBob = await bobReceivesThirdPage;

  assert.equal(thirdPageForAlice.page.id, thirdPageForBob.page.id);
  const lateJoiner = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(lateJoiner.pages.map(page => page.id), [
    firstPage.id,
    secondPageForAlice.page.id,
    thirdPageForAlice.page.id
  ]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('rejects malformed, unjoined, and cross-room page creation', async () => {
  const roomOne = `page-protected-${Date.now()}`;
  const roomTwo = `page-other-${Date.now()}`;
  const attacker = await connectClient();
  const alice = await connectClient();
  await joinRoom(alice, roomOne, 'Alice', '#3b82f6');
  const witness = await connectClient();
  await joinRoom(witness, roomOne, 'Witness', '#10b981');
  const bob = await connectClient();
  await joinRoom(bob, roomTwo, 'Bob', '#ef4444');

  await expectNoEvent(witness, 'page-created', () => {
    attacker.emit('create-page', { roomId: roomOne });
  });
  await expectNoEvent(bob, 'page-created', () => {
    alice.emit('create-page', { roomId: roomTwo });
  });

  for (const payload of [null, {}, { roomId: '' }, { roomId: 123 }, { roomId: roomOne, pageId: 'client-chosen-page' }]) {
    await expectNoEvent(witness, 'page-created', () => {
      alice.emit('create-page', payload);
    });
  }

  const roomOneState = await joinRoom(await connectClient(), roomOne, 'Verifier', '#f59e0b');
  const roomTwoState = await joinRoom(await connectClient(), roomTwo, 'Room two verifier', '#8b5cf6');
  assert.equal(roomOneState.pages.length, 1);
  assert.equal(roomTwoState.pages.length, 1);

  await Promise.all([...clients].map(disconnectClient));
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
  drawStroke(alice, roomId, stroke);
  const remoteStroke = await bobReceivesStroke;

  assert.equal(remoteStroke.pageId, initialPageIds.get(roomId));
  assert.equal(remoteStroke.stroke.id, stroke.id);
  assert.equal(remoteStroke.stroke.userId, alice.id);
  assert.deepEqual(remoteStroke.stroke.points, stroke.points);

  const charlie = await connectClient();
  const charlieRoom = await joinRoom(charlie, roomId, 'Charlie', '#10b981');
  assert.equal(getInitialStrokes(charlieRoom).length, 1);
  assert.equal(getInitialStrokes(charlieRoom)[0].id, stroke.id);
  assert.equal(getInitialStrokes(charlieRoom)[0].userId, alice.id);

  await Promise.all([disconnectClient(alice), disconnectClient(bob), disconnectClient(charlie)]);
  await waitForEmptyRooms();
});

test('keeps page-aware strokes isolated and broadcasts their authoritative page IDs', async () => {
  const roomId = `page-drawing-${Date.now()}`;
  const alice = await connectClient();
  const aliceRoom = await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const firstPageId = getInitialPage(aliceRoom).id;
  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');
  const charlie = await connectClient();
  await joinRoom(charlie, roomId, 'Charlie', '#10b981');

  const aliceReceivesPage = waitForEvent(alice, 'page-created');
  const bobReceivesPage = waitForEvent(bob, 'page-created');
  alice.emit('create-page', { roomId });
  const secondPageId = (await aliceReceivesPage).page.id;
  assert.equal((await bobReceivesPage).page.id, secondPageId);

  const firstPageStroke = {
    id: `page-one-${Date.now()}`,
    userId: 'ignored-by-server',
    tool: 'pen',
    color: '#000000',
    width: 5,
    points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
  };
  const bobReceivesFirstPageStroke = waitForEvent(bob, 'remote-stroke');
  const charlieReceivesFirstPageStroke = waitForEvent(charlie, 'remote-stroke');
  drawStroke(alice, roomId, firstPageStroke, firstPageId);
  const firstPagePayload = await bobReceivesFirstPageStroke;
  assert.deepEqual(await charlieReceivesFirstPageStroke, firstPagePayload);
  assert.equal(firstPagePayload.pageId, firstPageId);
  assert.equal(firstPagePayload.stroke.id, firstPageStroke.id);
  assert.equal(firstPagePayload.stroke.userId, alice.id);

  const secondPageStroke = {
    ...firstPageStroke,
    id: `page-two-${Date.now()}`,
    color: '#ef4444'
  };
  const aliceReceivesSecondPageStroke = waitForEvent(alice, 'remote-stroke');
  const charlieReceivesSecondPageStroke = waitForEvent(charlie, 'remote-stroke');
  drawStroke(bob, roomId, secondPageStroke, secondPageId);
  const secondPagePayload = await aliceReceivesSecondPageStroke;
  assert.deepEqual(await charlieReceivesSecondPageStroke, secondPagePayload);
  assert.equal(secondPagePayload.pageId, secondPageId);
  assert.equal(secondPagePayload.stroke.id, secondPageStroke.id);
  assert.equal(secondPagePayload.stroke.userId, bob.id);

  const lateJoiner = await joinRoom(await connectClient(), roomId, 'Dana', '#f59e0b');
  assert.deepEqual(lateJoiner.pages.map(page => page.strokes.map(stroke => stroke.id)), [
    [firstPageStroke.id],
    [secondPageStroke.id]
  ]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('rejects invalid, cross-room, and unjoined page-aware drawing requests', async () => {
  const roomOne = `page-draw-protected-${Date.now()}`;
  const roomTwo = `page-draw-other-${Date.now()}`;
  const alice = await connectClient();
  const roomOneState = await joinRoom(alice, roomOne, 'Alice', '#3b82f6');
  const roomOnePageId = getInitialPage(roomOneState).id;
  const roomTwoState = await joinRoom(alice, roomTwo, 'Alice', '#3b82f6');
  const roomTwoPageId = getInitialPage(roomTwoState).id;
  const witness = await connectClient();
  await joinRoom(witness, roomOne, 'Witness', '#10b981');
  const attacker = await connectClient();
  const stroke = {
    id: `invalid-page-stroke-${Date.now()}`,
    userId: 'ignored-by-server',
    tool: 'pen',
    color: '#000000',
    width: 5,
    points: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
  };

  for (const payload of [
    { roomId: roomOne, stroke },
    { roomId: roomOne, pageId: '', stroke },
    { roomId: roomOne, pageId: 123, stroke },
    { roomId: roomOne, pageId: 'x'.repeat(101), stroke },
    { roomId: roomOne, pageId: 'unknown-page', stroke },
    { roomId: roomOne, pageId: roomTwoPageId, stroke }
  ]) {
    await expectNoEvent(witness, 'remote-stroke', () => {
      alice.emit('draw-stroke', payload);
    });
  }

  await expectNoEvent(witness, 'remote-stroke', () => {
    attacker.emit('draw-stroke', { roomId: roomOne, pageId: roomOnePageId, stroke });
  });

  const verifier = await joinRoom(await connectClient(), roomOne, 'Verifier', '#f59e0b');
  assert.deepEqual(getInitialStrokes(verifier), []);

  await Promise.all([...clients].map(disconnectClient));
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
  drawStroke(alice, roomId, aliceStroke);
  await bobReceivesStroke;

  const aliceSecondStroke = {
    ...aliceStroke,
    id: `undo-alice-second-${Date.now()}`
  };
  const bobReceivesSecondAliceStroke = waitForEvent(bob, 'remote-stroke');
  drawStroke(alice, roomId, aliceSecondStroke);
  await bobReceivesSecondAliceStroke;

  const bobStroke = {
    ...aliceStroke,
    id: `undo-bob-${Date.now()}`,
    color: '#ef4444'
  };
  const aliceReceivesStroke = waitForEvent(alice, 'remote-stroke');
  drawStroke(bob, roomId, bobStroke);
  await aliceReceivesStroke;

  bob.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  const afterUnauthorizedUndo = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(getInitialStrokes(afterUnauthorizedUndo).map(stroke => stroke.id), [aliceStroke.id, aliceSecondStroke.id, bobStroke.id]);

  const bobReceivesUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceSecondStroke.id });
  assert.equal(await bobReceivesUndo, aliceSecondStroke.id);

  const bobReceivesSecondUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  assert.equal(await bobReceivesSecondUndo, aliceStroke.id);

  const afterAliceUndos = await joinRoom(await connectClient(), roomId, 'Dana', '#f59e0b');
  assert.deepEqual(getInitialStrokes(afterAliceUndos).map(stroke => stroke.id), [bobStroke.id]);

  alice.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  const afterRepeatedUndo = await joinRoom(await connectClient(), roomId, 'Eve', '#8b5cf6');
  assert.deepEqual(getInitialStrokes(afterRepeatedUndo).map(stroke => stroke.id), [bobStroke.id]);

  const aliceReceivesUndo = waitForEvent(alice, 'undo-stroke-remote');
  bob.emit('undo-stroke', { roomId, strokeId: bobStroke.id });
  assert.equal(await aliceReceivesUndo, bobStroke.id);

  const afterBothOwnersUndo = await joinRoom(await connectClient(), roomId, 'Frank', '#14b8a6');
  assert.deepEqual(getInitialStrokes(afterBothOwnersUndo), []);

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
  const strokeId = `cleanup-stroke-${Date.now()}`;
  drawStroke(alice, roomId, {
      id: strokeId,
      userId: 'ignored-by-server',
      tool: 'pen',
      color: '#000000',
      width: 5,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
  });
  assert.equal((await verifierReceivesStroke).stroke.id.startsWith('cleanup-stroke-'), true);
  const verifierReceivesUndo = waitForEvent(verifier, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId });
  assert.equal(await verifierReceivesUndo, strokeId);
  await disconnectClient(verifier);
  await disconnectClient(alice);
  await waitForEmptyRooms();

  const newParticipant = await connectClient();
  const recreatedRoom = await joinRoom(newParticipant, roomId, 'New participant', '#10b981');
  assert.equal(recreatedRoom.pages.length, 1);
  assert.deepEqual(getInitialStrokes(recreatedRoom), []);
  assert.equal(recreatedRoom.users.length, 1);

  newParticipant.emit('redo-stroke', { roomId, strokeId });
  const afterRedoAttempt = await joinRoom(await connectClient(), roomId, 'Verifier', '#ef4444');
  assert.deepEqual(getInitialStrokes(afterRedoAttempt), []);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('synchronizes redo across collaborators and rejects invalid redo requests', async () => {
  const roomId = `redo-sync-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');

  const aliceStroke = {
    id: `redo-alice-${Date.now()}`,
    userId: 'ignored-by-server',
    tool: 'pen',
    color: '#000000',
    width: 5,
    points: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
  };
  const bobReceivesAliceStroke = waitForEvent(bob, 'remote-stroke');
  drawStroke(alice, roomId, aliceStroke);
  await bobReceivesAliceStroke;

  const bobStroke = { ...aliceStroke, id: `redo-bob-${Date.now()}`, color: '#ef4444' };
  const aliceReceivesBobStroke = waitForEvent(alice, 'remote-stroke');
  drawStroke(bob, roomId, bobStroke);
  await aliceReceivesBobStroke;

  const bobReceivesUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  assert.equal(await bobReceivesUndo, aliceStroke.id);

  alice.emit('redo-stroke', { roomId, strokeId: 'wrong-stroke-id' });
  bob.emit('redo-stroke', { roomId, strokeId: aliceStroke.id });
  const afterInvalidRedo = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(getInitialStrokes(afterInvalidRedo).map(stroke => stroke.id), [bobStroke.id]);

  const aliceReceivesRedo = waitForEvent(alice, 'redo-stroke-remote');
  const bobReceivesRedo = waitForEvent(bob, 'redo-stroke-remote');
  alice.emit('redo-stroke', { roomId, strokeId: aliceStroke.id });
  assert.equal((await aliceReceivesRedo).id, aliceStroke.id);
  assert.equal((await bobReceivesRedo).id, aliceStroke.id);

  alice.emit('redo-stroke', { roomId, strokeId: aliceStroke.id });
  const afterDuplicateRedo = await joinRoom(await connectClient(), roomId, 'Dana', '#f59e0b');
  assert.deepEqual(getInitialStrokes(afterDuplicateRedo).map(stroke => stroke.id), [bobStroke.id, aliceStroke.id]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('restores a user’s undone strokes in LIFO order without removing collaborator strokes', async () => {
  const roomId = `redo-lifo-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');

  const aliceFirst = { id: `redo-a1-${Date.now()}`, userId: 'ignored-by-server', tool: 'pen', color: '#000000', width: 5, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
  const aliceSecond = { ...aliceFirst, id: `redo-a2-${Date.now()}` };
  const bobStroke = { ...aliceFirst, id: `redo-b1-${Date.now()}`, color: '#ef4444' };

  for (const stroke of [aliceFirst, aliceSecond]) {
    const bobReceivesStroke = waitForEvent(bob, 'remote-stroke');
    drawStroke(alice, roomId, stroke);
    await bobReceivesStroke;
  }
  const aliceReceivesBobStroke = waitForEvent(alice, 'remote-stroke');
  drawStroke(bob, roomId, bobStroke);
  await aliceReceivesBobStroke;

  for (const stroke of [aliceSecond, aliceFirst]) {
    const bobReceivesUndo = waitForEvent(bob, 'undo-stroke-remote');
    alice.emit('undo-stroke', { roomId, strokeId: stroke.id });
    assert.equal(await bobReceivesUndo, stroke.id);
  }

  for (const stroke of [aliceFirst, aliceSecond]) {
    const aliceReceivesRedo = waitForEvent(alice, 'redo-stroke-remote');
    const bobReceivesRedo = waitForEvent(bob, 'redo-stroke-remote');
    alice.emit('redo-stroke', { roomId, strokeId: stroke.id });
    assert.equal((await aliceReceivesRedo).id, stroke.id);
    assert.equal((await bobReceivesRedo).id, stroke.id);
  }

  const lateJoiner = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(getInitialStrokes(lateJoiner).map(stroke => stroke.id), [bobStroke.id, aliceFirst.id, aliceSecond.id]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('clears only the drawing user’s redo history after a new stroke', async () => {
  const roomId = `redo-branch-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');

  const aliceFirst = { id: `branch-a1-${Date.now()}`, userId: 'ignored-by-server', tool: 'pen', color: '#000000', width: 5, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
  const aliceSecond = { ...aliceFirst, id: `branch-a2-${Date.now()}` };
  const bobReceivesFirst = waitForEvent(bob, 'remote-stroke');
  drawStroke(alice, roomId, aliceFirst);
  await bobReceivesFirst;

  const bobReceivesUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceFirst.id });
  await bobReceivesUndo;

  const bobReceivesSecond = waitForEvent(bob, 'remote-stroke');
  drawStroke(alice, roomId, aliceSecond);
  await bobReceivesSecond;
  alice.emit('redo-stroke', { roomId, strokeId: aliceFirst.id });

  const afterOwnNewStroke = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(getInitialStrokes(afterOwnNewStroke).map(stroke => stroke.id), [aliceSecond.id]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('preserves a user’s redo history when a collaborator draws', async () => {
  const roomId = `redo-collaborator-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomId, 'Alice', '#3b82f6');
  const bob = await connectClient();
  await joinRoom(bob, roomId, 'Bob', '#ef4444');

  const aliceStroke = { id: `collaborator-a1-${Date.now()}`, userId: 'ignored-by-server', tool: 'pen', color: '#000000', width: 5, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] };
  const bobStroke = { ...aliceStroke, id: `collaborator-b1-${Date.now()}`, color: '#ef4444' };
  const bobReceivesAliceStroke = waitForEvent(bob, 'remote-stroke');
  drawStroke(alice, roomId, aliceStroke);
  await bobReceivesAliceStroke;

  const bobReceivesUndo = waitForEvent(bob, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId, strokeId: aliceStroke.id });
  await bobReceivesUndo;

  const aliceReceivesBobStroke = waitForEvent(alice, 'remote-stroke');
  drawStroke(bob, roomId, bobStroke);
  await aliceReceivesBobStroke;

  const aliceReceivesRedo = waitForEvent(alice, 'redo-stroke-remote');
  const bobReceivesRedo = waitForEvent(bob, 'redo-stroke-remote');
  alice.emit('redo-stroke', { roomId, strokeId: aliceStroke.id });
  assert.equal((await aliceReceivesRedo).id, aliceStroke.id);
  assert.equal((await bobReceivesRedo).id, aliceStroke.id);

  const lateJoiner = await joinRoom(await connectClient(), roomId, 'Charlie', '#10b981');
  assert.deepEqual(getInitialStrokes(lateJoiner).map(stroke => stroke.id), [bobStroke.id, aliceStroke.id]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

test('rejects malformed, unjoined, and cross-room room mutations', async () => {
  const attacker = await connectClient();
  await expectNoEvent(attacker, 'load-room', () => {
    attacker.emit('join-room', { roomId: '   ', userName: 'Attacker', userColor: '#000000' });
  });
  const healthAfterInvalidJoin = await fetch(`${backendUrl}/health`).then(response => response.json());
  assert.equal(healthAfterInvalidJoin.activeRooms, 0);

  const roomOne = `protected-${Date.now()}`;
  const roomTwo = `other-${Date.now()}`;
  const alice = await connectClient();
  await joinRoom(alice, roomOne, 'Alice', '#3b82f6');
  const witness = await connectClient();
  await joinRoom(witness, roomOne, 'Witness', '#10b981');
  const bob = await connectClient();
  await joinRoom(bob, roomTwo, 'Bob', '#ef4444');

  const protectedStroke = {
    id: `protected-stroke-${Date.now()}`,
    userId: 'ignored-by-server',
    tool: 'pen',
    color: '#000000',
    width: 5,
    points: [{ x: 1, y: 1 }, { x: 2, y: 2 }]
  };
  const witnessReceivesStroke = waitForEvent(witness, 'remote-stroke');
  drawStroke(alice, roomOne, protectedStroke);
  await witnessReceivesStroke;

  await expectNoEvent(witness, 'remote-stroke', () => {
    attacker.emit('draw-stroke', { roomId: roomOne, pageId: initialPageIds.get(roomOne), stroke: { ...protectedStroke, id: 'attacker-stroke' } });
  });
  await expectNoEvent(bob, 'remote-stroke', () => {
    alice.emit('draw-stroke', { roomId: roomTwo, pageId: initialPageIds.get(roomTwo), stroke: { ...protectedStroke, id: 'cross-room-stroke' } });
  });

  const roomTwoWitness = await connectClient();
  await joinRoom(roomTwoWitness, roomTwo, 'Room two witness', '#8b5cf6');
  const roomTwoStroke = { ...protectedStroke, id: `room-two-stroke-${Date.now()}`, color: '#ef4444' };
  const roomTwoWitnessReceivesStroke = waitForEvent(roomTwoWitness, 'remote-stroke');
  drawStroke(bob, roomTwo, roomTwoStroke);
  await roomTwoWitnessReceivesStroke;
  await expectNoEvent(roomTwoWitness, 'undo-stroke-remote', () => {
    alice.emit('undo-stroke', { roomId: roomTwo, strokeId: roomTwoStroke.id });
  });

  const roomTwoWitnessReceivesUndo = waitForEvent(roomTwoWitness, 'undo-stroke-remote');
  bob.emit('undo-stroke', { roomId: roomTwo, strokeId: roomTwoStroke.id });
  assert.equal(await roomTwoWitnessReceivesUndo, roomTwoStroke.id);
  await expectNoEvent(roomTwoWitness, 'redo-stroke-remote', () => {
    alice.emit('redo-stroke', { roomId: roomTwo, strokeId: roomTwoStroke.id });
  });
  const roomTwoWitnessReceivesRedo = waitForEvent(roomTwoWitness, 'redo-stroke-remote');
  bob.emit('redo-stroke', { roomId: roomTwo, strokeId: roomTwoStroke.id });
  assert.equal((await roomTwoWitnessReceivesRedo).id, roomTwoStroke.id);

  const spoofedStroke = { ...protectedStroke, id: `spoofed-${Date.now()}`, userId: bob.id };
  const witnessReceivesSpoofedStroke = waitForEvent(witness, 'remote-stroke');
  drawStroke(alice, roomOne, spoofedStroke);
  assert.equal((await witnessReceivesSpoofedStroke).stroke.userId, alice.id);

  const malformedStrokes = [
    { ...protectedStroke, id: '' },
    { ...protectedStroke, id: 'non-array-points', points: {} },
    { ...protectedStroke, id: 'malformed-point', points: [{ x: '1', y: 2 }] },
    { ...protectedStroke, id: 'non-finite-point', points: [{ x: Number.NaN, y: 2 }] },
    { ...protectedStroke, id: 'unsupported-tool', tool: 'text' },
    { ...protectedStroke, id: 'invalid-width', width: 0 },
    { ...protectedStroke, id: 'too-many-points', points: Array.from({ length: 10_001 }, () => ({ x: 1, y: 1 })) }
  ];
  for (const stroke of malformedStrokes) {
    await expectNoEvent(witness, 'remote-stroke', () => {
      drawStroke(alice, roomOne, stroke);
    });
  }

  await expectNoEvent(witness, 'undo-stroke-remote', () => {
    attacker.emit('undo-stroke', { roomId: roomOne, strokeId: protectedStroke.id });
  });
  await expectNoEvent(witness, 'undo-stroke-remote', () => {
    bob.emit('undo-stroke', { roomId: roomOne, strokeId: protectedStroke.id });
  });

  const witnessReceivesUndo = waitForEvent(witness, 'undo-stroke-remote');
  alice.emit('undo-stroke', { roomId: roomOne, strokeId: protectedStroke.id });
  assert.equal(await witnessReceivesUndo, protectedStroke.id);

  await expectNoEvent(witness, 'redo-stroke-remote', () => {
    attacker.emit('redo-stroke', { roomId: roomOne, strokeId: protectedStroke.id });
  });
  await expectNoEvent(witness, 'redo-stroke-remote', () => {
    bob.emit('redo-stroke', { roomId: roomOne, strokeId: protectedStroke.id });
  });

  const witnessReceivesRedo = waitForEvent(witness, 'redo-stroke-remote');
  alice.emit('redo-stroke', { roomId: roomOne, strokeId: protectedStroke.id });
  assert.equal((await witnessReceivesRedo).id, protectedStroke.id);

  const roomOneState = await joinRoom(await connectClient(), roomOne, 'Verifier', '#f59e0b');
  assert.deepEqual(getInitialStrokes(roomOneState).map(stroke => stroke.id), [spoofedStroke.id, protectedStroke.id]);
  const roomTwoState = await joinRoom(await connectClient(), roomTwo, 'Room two verifier', '#8b5cf6');
  assert.deepEqual(getInitialStrokes(roomTwoState).map(stroke => stroke.id), [roomTwoStroke.id]);

  await Promise.all([...clients].map(disconnectClient));
  await waitForEmptyRooms();
});

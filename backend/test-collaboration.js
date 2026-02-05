#!/usr/bin/env node

/**
 * Socket.IO Collaboration Test Script
 * Tests real-time synchronization between multiple clients
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3002';
const TEST_ROOM = 'test-room-' + Date.now();

console.log('🧪 Testing Socket.IO Collaboration...\n');

// Simulate User 1
const user1 = io(BACKEND_URL);
let user1Id = null;

user1.on('connect', () => {
    user1Id = user1.id;
    console.log('✅ User 1 connected:', user1Id);

    user1.emit('join-room', {
        roomId: TEST_ROOM,
        userName: 'Alice',
        userColor: '#3b82f6'
    });
});

user1.on('load-room', (data) => {
    console.log('📦 User 1 loaded room:', {
        strokes: data.strokes.length,
        users: data.users.length
    });
});

user1.on('user-joined', (data) => {
    console.log('👋 User 1 sees new user joined:', data.userName);

    // User 1 draws after User 2 joins
    setTimeout(() => {
        console.log('✏️  User 1 drawing stroke...');
        user1.emit('draw-stroke', {
            roomId: TEST_ROOM,
            stroke: {
                id: 'stroke-1',
                userId: user1Id,
                tool: 'pen',
                color: '#000000',
                width: 5,
                points: [{ x: 10, y: 10 }, { x: 100, y: 100 }]
            }
        });
    }, 500);
});

user1.on('remote-stroke', (stroke) => {
    console.log('🎨 User 1 received remote stroke:', stroke.id, 'from', stroke.userId);

    // Test passed!
    setTimeout(() => {
        console.log('\n✅ COLLABORATION TEST PASSED!');
        console.log('Both users can see each other\'s drawings.\n');
        process.exit(0);
    }, 500);
});

// Simulate User 2 (joins after 2 seconds)
setTimeout(() => {
    const user2 = io(BACKEND_URL);
    let user2Id = null;

    user2.on('connect', () => {
        user2Id = user2.id;
        console.log('✅ User 2 connected:', user2Id);

        user2.emit('join-room', {
            roomId: TEST_ROOM,
            userName: 'Bob',
            userColor: '#ef4444'
        });
    });

    user2.on('load-room', (data) => {
        console.log('📦 User 2 loaded room:', {
            strokes: data.strokes.length,
            users: data.users.length
        });
    });

    user2.on('remote-stroke', (stroke) => {
        console.log('🎨 User 2 received remote stroke:', stroke.id, 'from', stroke.userId);

        // User 2 draws back
        setTimeout(() => {
            console.log('✏️  User 2 drawing stroke...');
            user2.emit('draw-stroke', {
                roomId: TEST_ROOM,
                stroke: {
                    id: 'stroke-2',
                    userId: user2Id,
                    tool: 'pen',
                    color: '#ff0000',
                    width: 5,
                    points: [{ x: 200, y: 200 }, { x: 300, y: 300 }]
                }
            });
        }, 500);
    });
}, 2000);

// Timeout after 10 seconds
setTimeout(() => {
    console.log('\n❌ TEST TIMEOUT - Collaboration may not be working');
    process.exit(1);
}, 10000);

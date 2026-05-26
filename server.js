const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const robot = require('robotjs');

console.log("====== WebRTC Remote Desktop Server ======");
console.log("Current DISPLAY:", process.env.DISPLAY || "Not set (needs to be set for robotjs to work on Linux)");
console.log("Current XAUTHORITY:", process.env.XAUTHORITY || "Not set");
console.log("==========================================");

const app = express();
app.use(express.static('public'));

const serverOptions = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

const server = https.createServer(serverOptions, app);
const io = socketIo(server);

const activeRooms = {};

io.on('connection', (socket) => {
    socket.on('create_room', () => {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        activeRooms[code] = socket.id;
        socket.join(code);
        socket.emit('room_created', code);
    });

    socket.on('join_room', (code) => {
        if (activeRooms[code]) {
            socket.join(code);
            socket.emit('room_joined', { success: true, code: code });
            socket.to(code).emit('viewer_ready');
        } else {
            socket.emit('room_joined', { success: false });
        }
    });

    socket.on('webrtc_event', (data) => {
        socket.to(data.room).emit('webrtc_event', data.event);
    });

    socket.on('chat_message', (data) => {
        socket.to(data.room).emit('chat_message', data);
    });

    // --- Eksekusi Kontrol Tetikus & Papan Ketik ---

    socket.on('mouse_move', (data) => {
        if (data.room) {
            socket.to(data.room).emit('local_execute', { type: 'mouse_move', ...data });
        }
    });

    socket.on('mouse_down', (data) => {
        if (data.room) {
            socket.to(data.room).emit('local_execute', { type: 'mouse_down', ...data });
        }
    });

    socket.on('mouse_up', (data) => {
        if (data.room) {
            socket.to(data.room).emit('local_execute', { type: 'mouse_up', ...data });
        }
    });

    socket.on('mouse_drag', (data) => {
        if (data.room) {
            socket.to(data.room).emit('local_execute', { type: 'mouse_drag', ...data });
        }
    });

    socket.on('mouse_scroll', (data) => {
        if (data.room) {
            socket.to(data.room).emit('local_execute', { type: 'mouse_scroll', ...data });
        }
    });

    socket.on('keyboard_input', (data) => {
        if (data.room) {
            socket.to(data.room).emit('local_execute', { type: 'keyboard_input', ...data });
        }
    });

    socket.on('disconnect', () => {
        for (const code in activeRooms) {
            if (activeRooms[code] === socket.id) { delete activeRooms[code]; break; }
        }
    });
});

server.listen(3000, '0.0.0.0');

// --- Loopback HTTP Control Agent (Port 3001) ---
const http = require('http');

const localControlServer = http.createServer((req, res) => {
    // Aktifkan CORS agar halaman web dari server utama bisa memanggil localhost ini
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method === 'POST' && req.url === '/control') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.type === 'mouse_move') {
                    const screenSize = robot.getScreenSize();
                    const targetX = Math.round(data.x * screenSize.width);
                    const targetY = Math.round(data.y * screenSize.height);
                    robot.moveMouse(targetX, targetY);
                } else if (data.type === 'mouse_down') {
                    robot.mouseToggle("down", data.button);
                } else if (data.type === 'mouse_up') {
                    robot.mouseToggle("up", data.button);
                } else if (data.type === 'mouse_drag') {
                    const screenSize = robot.getScreenSize();
                    robot.dragMouse(Math.round(data.x * screenSize.width), Math.round(data.y * screenSize.height));
                } else if (data.type === 'mouse_scroll') {
                    const scrollX = Math.round(data.deltaX / 50) * -1;
                    const scrollY = Math.round(data.deltaY / 50) * -1;
                    robot.scrollMouse(scrollX, scrollY);
                } else if (data.type === 'keyboard_input') {
                    robot.keyTap(data.key);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(400);
                res.end(err.message);
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

localControlServer.listen(3001, '127.0.0.1', () => {
    console.log("Local Control Agent aktif di http://127.0.0.1:3001 (untuk single IP remote)");
});
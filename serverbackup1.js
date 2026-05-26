const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const robot = require('robotjs');

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

    socket.on('mouse_move', (data) => {
        const screenSize = robot.getScreenSize();
        robot.moveMouse(Math.round(data.x * screenSize.width), Math.round(data.y * screenSize.height));
    });

    socket.on('mouse_down', (data) => {
        try { robot.mouseToggle("down", data.button); } catch(e) {}
    });

    socket.on('mouse_up', (data) => {
        try { robot.mouseToggle("up", data.button); } catch(e) {}
    });

    // Menambahkan instruksi khusus untuk menggeser sambil menahan klik
    socket.on('mouse_drag', (data) => {
        const screenSize = robot.getScreenSize();
        robot.dragMouse(
            Math.round(data.x * screenSize.width), 
            Math.round(data.y * screenSize.height)
        );
    });
    
    // --- Tambahkan di bawah socket.on('mouse_drag', ...) ---
    
    socket.on('mouse_scroll', (data) => {
        try {
            // Nilai delta dari browser biasanya ratusan, jadi dibagi 50 agar lebih halus.
            // Dikali -1 karena arah sumbu peramban dan sistem operasi sering kali berlawanan.
            const scrollX = Math.round(data.deltaX / 50) * -1;
            const scrollY = Math.round(data.deltaY / 50) * -1;
            
            robot.scrollMouse(scrollX, scrollY);
        } catch (e) {
            console.error("Gagal melakukan scroll:", e);
        }
    });

    socket.on('keyboard_input', (data) => { try { robot.keyTap(data.key); } catch (e) {} });

    socket.on('disconnect', () => {
        for (const code in activeRooms) {
            if (activeRooms[code] === socket.id) { delete activeRooms[code]; break; }
        }
    });
});

server.listen(3000, '0.0.0.0');

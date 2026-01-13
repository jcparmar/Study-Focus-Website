const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('create_room', () => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        socket.join(roomId);
        rooms[roomId] = [socket.id];
        socket.emit('room_created', roomId);
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on('join_room', (roomId) => {
        const room = rooms[roomId];
        if (room && room.length < 2) {
            socket.join(roomId);
            room.push(socket.id);
            io.to(roomId).emit('paired');
            console.log(`User ${socket.id} joined room ${roomId}`);
        } else {
            socket.emit('error', 'Room invalid or full');
        }
    });

    socket.on('focus_status', (data) => {
        // data: { roomId, focused: boolean }
        socket.to(data.roomId).emit('peer_focus_status', data.focused);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
        // Cleanup rooms logic could be added here
        for (const roomId in rooms) {
            const index = rooms[roomId].indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].splice(index, 1);
                socket.to(roomId).emit('peer_disconnected');
                if (rooms[roomId].length === 0) {
                    delete rooms[roomId];
                }
                break;
            }
        }
    });
});

const os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const ip = getLocalIp();
    console.log(`Server running on port ${PORT}`);
    console.log(`To connect with your phone, visit: http://${ip}:${PORT}`);
});

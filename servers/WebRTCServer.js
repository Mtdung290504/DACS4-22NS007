import express from 'express';
import https from 'https';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class WebRTCServer {
    constructor(port = 3000, wifiIP) {
        this.port = port;
        this.wifiIP = wifiIP;
        this.app = express();

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Đọc chứng chỉ SSL
        const options = {
            key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
            cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.cert'))
        };

        // Tạo server HTTPS
        this.server = https.createServer(options, this.app);
        this.io = new Server(this.server);

        // Dùng để theo dõi số người tham gia trong từng phòng
        this.rooms = {};

        // Cấu hình thư mục public cho các tệp tĩnh
        this.app.use('/', express.static('client-demo/demoRTCBase'));

        // Thiết lập các sự kiện của Socket.io
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            socket.on('join-room', (roomId) => {
                socket.join(roomId);

                // Tạo phòng mới nếu phòng chưa tồn tại
                if (!this.rooms[roomId]) {
                    this.rooms[roomId] = [];
                }

                // Thêm user vào danh sách phòng
                this.rooms[roomId].push(socket.id);

                const roomSize = this.rooms[roomId].length;
                console.log(`User ${socket.id} joined room ${roomId}, now has ${roomSize} participants`);

                // Gửi danh sách peers hiện tại cho client
                socket.emit('peers-in-room', { peers: this.rooms[roomId], roomId });

                // Thông báo user mới tham gia đến những người khác trong phòng
                socket.broadcast.to(roomId).emit('new-peer', { peerId: socket.id });

                if (roomSize < 5) {
                    this.setupP2PEvents(socket, roomId);
                } else {
                    this.setupSFUEvents(socket, roomId);
                }

                // Xử lý khi user ngắt kết nối
                socket.on('disconnect', () => {
                    console.log(`User ${socket.id} disconnected from room ${roomId}`);
                    this.rooms[roomId] = this.rooms[roomId].filter((id) => id !== socket.id);
                    socket.broadcast.to(roomId).emit('peer-disconnected', { peerId: socket.id });
                });
            });
        });
    }

    /**
     * Cấu hình sự kiện cho mô hình P2P
     */
    setupP2PEvents(socket, roomId) {
        socket.on('offer', ({ offer, to }) => {
            this.io.to(to).emit('offer', { offer, from: socket.id });
        });

        socket.on('answer', ({ answer, to }) => {
            this.io.to(to).emit('answer', { answer, from: socket.id });
        });

        socket.on('ice-candidate', ({ candidate, to }) => {
            this.io.to(to).emit('ice-candidate', { candidate, from: socket.id });
        });
    }

    /**
     * Cấu hình sự kiện cho mô hình SFU
     */
    setupSFUEvents(socket, roomId) {
        socket.emit('sfu-mode');
        socket.on('produce', ({ streamId }) => {
            socket.broadcast.to(roomId).emit('new-producer', { producerId: socket.id, streamId });
        });

        socket.on('consume', ({ producerId }) => {
            this.io.to(producerId).emit('consume', { consumerId: socket.id });
        });

        socket.on('ice-candidate-sfu', ({ candidate, targetId }) => {
            this.io.to(targetId).emit('ice-candidate-sfu', { candidate, from: socket.id });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Server is running on `, this.wifiIP ? `https://${this.wifiIP}:${this.port}` : `https://localhost:${this.port}`);
        });
    }
}

export default WebRTCServer;
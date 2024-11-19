// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

class WebRTCServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server);

        // Cấu hình thư mục public cho các tệp tĩnh
        this.app.use('/', express.static('client_demo/demoRTC2'));

        // Thiết lập các sự kiện của Socket.io
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('A user connected');

            // Lắng nghe sự kiện 'offer' từ một client và gửi nó đến client khác
            socket.on('offer', (offer) => {
                socket.broadcast.emit('offer', offer);
            });

            // Lắng nghe sự kiện 'answer' từ client và gửi nó đến client khác
            socket.on('answer', (answer) => {
                socket.broadcast.emit('answer', answer);
            });

            // Lắng nghe sự kiện 'candidate' khi ICE candidate được gửi
            socket.on('candidate', (candidate) => {
                socket.broadcast.emit('candidate', candidate);
            });

            // Xử lý khi client ngắt kết nối
            socket.on('disconnect', () => {
                console.log('User disconnected');
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
        });
    }
}

export default WebRTCServer;
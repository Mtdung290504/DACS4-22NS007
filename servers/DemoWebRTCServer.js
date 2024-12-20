import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

class MeetingServer {
    constructor(port = 3000, wifiIP) {
        this.app = express();
        this.server = null;
        this.io = null;
        this.port = port;
        this.wifiIP = wifiIP;
    }

    // Placeholder function to create SSL options
    createSSLOptions() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        return {
            key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
            cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.cert'))
        };
    }

    // Method to start the server
    start(port = 3000) {
        const sslOptions = this.createSSLOptions();
        this.server = createServer(sslOptions, this.app);
        this.io = new Server(this.server);
        this.rtcDebug = false;

        // Serve client files
        this.app.use('/meet/:roomId', express.static('client_demo/demoRTC'));

        // Socket.IO logic
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            // Khi người dùng join một room
            socket.on('join-room', (roomId, userId) => {
                socket.join(roomId);
                socket.to(roomId).emit('user-connected', userId);
                console.log(`User ${userId} joined room ${roomId}`);

                socket.joinedRoom = roomId;

                // Xử lý khi có offer từ peer
                socket.on('offer', (targetId, offer) => {
                    this.rtcDebug && console.log('offer to: ', targetId, offer);
                    socket.to(targetId).emit('offer', socket.id, offer);
                });

                // Xử lý khi có answer từ peer
                socket.on('answer', (targetId, answer) => {
                    this.rtcDebug && console.log('answer to: ', targetId, answer);
                    socket.to(targetId).emit('answer', socket.id, answer);
                });

                // Xử lý khi có ICE candidate từ peer
                socket.on('candidate', (targetId, candidate) => {
                    this.rtcDebug && console.log('candidate to: ', targetId, candidate);
                    socket.to(targetId).emit('candidate', socket.id, candidate);
                });

                // Khi người dùng rời khỏi room
                socket.on('disconnect', () => {
                    socket.to(roomId).emit('user-disconnected', userId);
                    console.log(`User ${userId} disconnected`);
                });
            });
        });

        this.server.listen(this.port, () => {
            console.log(`Server is running on `, this.wifiIP ? `https://${this.wifiIP}:${this.port}` : `https://localhost:${this.port}`);
        });
    }
}

export default MeetingServer;
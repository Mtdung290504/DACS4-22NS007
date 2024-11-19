class App {
    /**
     * Luồng media của user
     * @type {MediaStream} 
     */
    userStream = undefined;

    /**
     * Danh sách peers
     * @type {{ [socketId: string]: RTCPeerConnection}} 
     */
    peers = {};

    /**
     * Trạng thái media của user
     * @type {{ video: boolean, audio: boolean }}
     */
    mediaStatus = {
        video: false,
        audio: false
    }

    /**
     * @typedef {Object} Views
     * @property {HTMLVideoElement} userVideo - Video của user.
     * @property {HTMLDivElement} videoGrid - Khu vực hiển thị một lưới video.
     * @property {HTMLButtonElement} toggleMicButton - Nút bật/tắt micro.
     * @property {HTMLButtonElement} toggleCameraButton - Nút bật/tắt camera.
     * @property {HTMLButtonElement} leaveButton - Nút thoát khỏi phòng.
     */
    /**
     * Các HTML Element để sử dụng
     * @namespace
     * @type {Views}
     */
    views = {
        'userVideo': undefined,
        'videoGrid': undefined,
        'toggleMicButton': undefined,
        'toggleCameraButton': undefined,
        'leaveButton': undefined,
    }

    constructor() {
        try {
            /**
             * Socket kết nối đến server
             */
            this.socket = io();
            this.isSFU = false; // Xác định chế độ hiện tại (P2P hoặc SFU)
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Khởi động ứng dụng
     */
    async start() {
        this.defineViews();
        this.clearCurrentDesignView();
        await this.initMedia();

        this.setupSocketEvents();
        // Tham gia vào phòng với ID nhất định (ví dụ: roomId có thể lấy từ URL hoặc nhập thủ công)
        const roomId = "example-room-id"; // Bạn có thể thay đổi ID này tùy ý
        this.socket.emit('join-room', roomId);
    }

    /**
     * Định nghĩa các phần tử HTML của ứng dụng
     */
    defineViews() {
        const { views } = this;
        views['videoGrid'] = document.querySelector('#video-grid');
        views['toggleMicButton'] = document.querySelector('#toggle-mic-button');
        views['toggleCameraButton'] = document.querySelector('#toggle-cam-button');
        views['leaveButton'] = document.querySelector('#leave-button');
    }

    /**
     * Gắn các action
     */
    initActions() {
        const { views, mediaStatus } = this;
    
        views['toggleMicButton'].addEventListener('click', async () => {
            const micIsOn = mediaStatus.audio;
    
            if (micIsOn) {
                if(!this.userStream) return;

                // Tắt mic bằng cách dừng track
                this.userStream.getAudioTracks().forEach(track => track.stop());
                if(this.userStream.getTracks() === 0) {
                    this.userStream = null;                    
                }
                this.onTurnOffMicCallback();
                mediaStatus.audio = false;
            } else {
                // Bật mic lại bằng cách xin lại stream
                await this.requireMedia({ audio: true, video: mediaStatus.video });
                this.onTurnOnMicCallback();
                mediaStatus.audio = true;
            }
        });
    
        views['toggleCameraButton'].addEventListener('click', async () => {
            const cameraIsOn = mediaStatus.video;
    
            if (cameraIsOn) {
                if(!this.userStream) return;

                // Tắt camera bằng cách dừng track
                this.userStream.getVideoTracks().forEach(track => track.stop());
                if(this.userStream.getTracks() === 0) {
                    this.userStream = null;
                }
                this.onTurnOffCameraCallback();
                this.views['userVideo'].srcObject = null;
                mediaStatus.video = false
            } else {
                // Bật camera lại bằng cách xin lại stream
                await this.requireMedia({ video: true, audio: mediaStatus.audio });
                this.onTurnOnCameraCallback();
                mediaStatus.video = true;
            }
        });
    }
    
    /**
     * Yêu cầu cấp quyền media
     * @param {MediaStreamConstraints} constraints 
     * @returns {Promise<boolean>}
     */
    async requireMedia(constraints = { ...this.mediaStatus }) {
        try {
            if(!(constraints.audio || constraints.video)) return false;

            // Xin một stream mới với constraints
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    
            // Cập nhật userStream bằng stream mới
            this.userStream = newStream;

            // Cập nhật lại srcObject của video khi có stream mới
            if (this.views['userVideo']) {
                this.views['userVideo'].srcObject = this.userStream;
                this.views['userVideo'].play();
            }

            return true;
        } catch (error) {
            console.error('Lỗi khi xin quyền media:', error);
            alert('Quyền truy cập media bị từ chối');
        }
    }    

    onTurnOffCameraCallback() {
        console.log('Turn off camera');
    }

    onTurnOnCameraCallback() {
        console.log('Turn on camera');
    }

    onTurnOffMicCallback() {
        console.log('Turn off mic');
    }

    onTurnOnMicCallback() {
        console.log('Turn on mic');
    }

    /**
     * Yêu cầu quyền truy cập media và thực hiện các hành động cần sau khi có media stream
     */
    async initMedia() {
        await this.requireMedia();
        this.appendVideoToGrid(this.userStream);
        this.initActions();
    } 

    /**
     * Thêm giao diện video ứng với stream của một người dùng vào lưới video
     * @param {MediaStream} userStream 
     */
    appendVideoToGrid(userStream) {
        const container = document.createElement('div');
        container.className = 'video-wrapper';
        const video = document.createElement('video');
        video.playsInline = true;

        container.appendChild(video);
        this.views['videoGrid'].appendChild(container);
        this.views['userVideo'] = video;

        video.srcObject = userStream;
        video.autoplay = true;
    }

    /**
     * Dọn dẹp giao diện thiết kế ban đầu
     */
    clearCurrentDesignView() {
        this.views['videoGrid'].innerHTML = '';
    }

    setupSocketEvents() {
        const { socket } = this;

        socket.on('peers-in-room', ({ peers, roomId }) => {
            peers.forEach(peerId => {
                if (peerId !== socket.id) {
                    this.connectToPeer(peerId);
                }
            });
        });

        socket.on('new-peer', ({ peerId }) => {
            if (peerId !== socket.id) {
                this.connectToPeer(peerId);
            }
        });

        socket.on('offer', async ({ offer, from }) => {
            const peerConnection = this.createPeerConnection(from);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', { answer, to: from });
        });

        socket.on('answer', async ({ answer, from }) => {
            const peerConnection = this.peers[from];
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('ice-candidate', ({ candidate, from }) => {
            const peerConnection = this.peers[from];
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on('peer-disconnected', ({ peerId }) => {
            if (this.peers[peerId]) {
                this.peers[peerId].close();
                delete this.peers[peerId];
            }
        });

        socket.on('sfu-mode', () => {
            this.isSFU = true;
        });
    }

    connectToPeer(peerId) {
        const peerConnection = this.createPeerConnection(peerId);
        peerConnection.createOffer().then(offer => {
            peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', { offer, to: peerId });
        });
    }

    createPeerConnection(peerId) {
        console.log(peerId);
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        console.log(this);

        this.userStream.getTracks().forEach(track => peerConnection.addTrack(track, this.userStream));
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', { candidate: event.candidate, to: peerId });
            }
        };

        peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            this.appendVideoToGrid(remoteStream);
        };

        this.peers[peerId] = peerConnection;
        return peerConnection;
    }
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

function init() {
    const app = new App();
    app.start();
}
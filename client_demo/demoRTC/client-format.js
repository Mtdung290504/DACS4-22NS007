import { io } from "./libs/socket.io-client.min.js";

const socket = io();

/**@type {Map<MediaStreamTrack, boolean>} */
const trackMap = new Map();

const roomId = (function getRoomId() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const roomId = pathParts[pathParts.length - 1];
    console.log('Room id:', roomId);
    return roomId;
})();

const myStream = (function createDummyStream() {
    const f = faker();
    const myStream = {
        media: new MediaStream([f.createPlaceholderVideoTrack(), f.createSilentAudioTrack()]),
        screen: new MediaStream([f.createPlaceholderVideoTrack()]),
    }
    console.log('Dummy stream:', myStream);
    return myStream;
})();

/**@type {{ [socketId: string]: RTCPeerConnection }} */
let peerConnections = {};

/**@type {{ [socketId: string]: RTCDataChannel }} */
let dataChannels = {};

let myVideo = document.createElement('video');
myVideo.muted = true;

let view;

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', startApp) : startApp();

function startApp() {
    console.log('Start building app...');
    view = getElements();
    const { videoGrid, shareScreenBtn, toggleCamBtn, toggleMicBtn, leaveRoomBtn } = view;
    addVideoStream(myVideo, myStream.media);
    initSocket();

    toggleCamBtn.addEventListener('click', async () => {
        const videoTrack = myStream.media.getVideoTracks()[0];
    
        if (videoTrack && !trackMap.get(videoTrack)) {
            // Nếu đang bật camera, tắt camera:
            console.log('Tắt camera...');
    
            // Dừng track video thật
            videoTrack.stop();
            myStream.media.removeTrack(videoTrack);
    
            // Thay thế bằng track giả
            const placeholderTrack = faker().createPlaceholderVideoTrack();
            myStream.media.addTrack(placeholderTrack);
    
            // Cập nhật track cho các peer
            Object.values(peerConnections).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(placeholderTrack);
            });
    
            console.log('Camera đã tắt');
            view.toggleCamBtn.classList.add('inactive'); // Cập nhật giao diện
        } else {
            try {
                // Nếu đang tắt camera (track giả), bật lại camera:
                console.log('Bật lại camera...');
                const stream = await requestUserMedia({ video: true });
                const newVideoTrack = stream.getVideoTracks()[0];
    
                // Thay thế track giả bằng track thật
                myStream.media.getVideoTracks().forEach(track => myStream.media.removeTrack(track));
                myStream.media.addTrack(newVideoTrack);
    
                // Cập nhật track cho các peer
                Object.values(peerConnections).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track.kind === 'video');
                    if (sender) sender.replaceTrack(newVideoTrack);
                });
    
                console.log('Camera đã bật');
                view.toggleCamBtn.classList.remove('inactive'); // Cập nhật giao diện
            } catch (error) {
                console.error('Không thể bật camera:', error);
            }
        }
    });
    
    // Logic tương tự cho toggleMicBtn
    toggleMicBtn.addEventListener('click', async () => {
        const audioTrack = myStream.media.getAudioTracks()[0];
    
        if (audioTrack && !trackMap.get(audioTrack)) {
            audioTrack.enabled = !audioTrack.enabled;
            view.toggleMicBtn.classList.toggle('inactive', !audioTrack.enabled);
            console.log(audioTrack.enabled ? 'Micro đã bật' : 'Micro đã tắt');
        } else {
            try {
                const stream = await requestUserMedia({ audio: true });
                const newAudioTrack = stream.getAudioTracks()[0];
    
                myStream.media.getAudioTracks().forEach(track => myStream.media.removeTrack(track));
                myStream.media.addTrack(newAudioTrack);
    
                Object.values(peerConnections).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track.kind === 'audio');
                    if (sender) sender.replaceTrack(newAudioTrack);
                });
    
                console.log('Micro đã bật');
                view.toggleMicBtn.classList.remove('inactive');
            } catch (error) {
                console.error('Không thể bật micro:', error);
            }
        }
    });

    shareScreenBtn.addEventListener('click', async () => {
        // Lưu trạng thái camera ban đầu
        const isCameraOn = myStream.media.getVideoTracks().some(track => !trackMap.get(track));
    
        try {
            console.log('Đang bắt đầu chia sẻ màn hình...');
            const screenStream = await requestUserDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
    
            // Thay thế track hiện tại bằng track màn hình
            const currentVideoTrack = myStream.media.getVideoTracks()[0];
            if (currentVideoTrack) myStream.media.removeTrack(currentVideoTrack);
            myStream.media.addTrack(screenTrack);
    
            // Cập nhật track cho các peer
            Object.values(peerConnections).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            });
    
            console.log('Đã bắt đầu chia sẻ màn hình');
            view.shareScreenBtn.classList.add('active');
            view.toggleCamBtn.disabled = true; // Vô hiệu hóa nút toggle camera
    
            // Lắng nghe sự kiện khi dừng chia sẻ màn hình
            screenTrack.onended = async () => {
                console.log('Dừng chia sẻ màn hình');
                view.shareScreenBtn.classList.remove('active');
                view.toggleCamBtn.disabled = false;
    
                // Phục hồi trạng thái camera ban đầu
                if (isCameraOn) {
                    try {
                        const stream = await requestUserMedia({ video: true });
                        const newVideoTrack = stream.getVideoTracks()[0];
    
                        myStream.media.removeTrack(screenTrack);
                        myStream.media.addTrack(newVideoTrack);
    
                        // Cập nhật track camera cho các peer
                        Object.values(peerConnections).forEach(peer => {
                            const sender = peer.getSenders().find(s => s.track.kind === 'video');
                            if (sender) sender.replaceTrack(newVideoTrack);
                        });
    
                        console.log('Quay lại sử dụng camera');
                    } catch (error) {
                        console.error('Không thể bật lại camera:', error);
                    }
                } else {
                    // Nếu camera ban đầu đang tắt, thay thế bằng track giả
                    const placeholderTrack = faker().createPlaceholderVideoTrack();
                    myStream.media.removeTrack(screenTrack);
                    myStream.media.addTrack(placeholderTrack);
    
                    Object.values(peerConnections).forEach(peer => {
                        const sender = peer.getSenders().find(s => s.track.kind === 'video');
                        if (sender) sender.replaceTrack(placeholderTrack);
                    });
    
                    console.log('Quay lại sử dụng track giả');
                }
            };
        } catch (error) {
            console.error('Không thể chia sẻ màn hình:', error);
        }
    });

    leaveRoomBtn.addEventListener('click', () => {
        socket.disconnect();
        window.location.href = '/';
    });
}

function initSocket(debugRTC = false, debugSocket = false) {
    socket.on('connect', () => {
        debugSocket && console.log('Socket info:', socket, socket.id);
        socket.emit('join-room', roomId, socket.id);

        socket.on('user-connected', userId => { // Khi có người dùng mới kết nối
            debugSocket && console.log(`User connected: ${userId}`);
            connectToNewUser(userId, myStream.media);
        });

        socket.on('user-disconnected', userId => { // Khi có người dùng ngắt kết nối
            debugSocket && console.log(`User disconnected: ${userId}`);
            if (peerConnections[userId]) {
                peerConnections[userId].close(); // Đóng kết nối RTC
                delete peerConnections[userId]; // Xóa peer
                delete dataChannels[userId]; // Xóa datachanel
                removeUIOfUserDisconnect(userId)  // Xóa video của user đã ngắt kết nối
            }
        });

        socket.on('offer', (fromId, offer) => {
            debugSocket && console.log(`Received offer from ${fromId}:`, offer);
            if (!peerConnections[fromId]) {
                const peer = createPeerConnection(fromId, myStream.media);
                peer.setRemoteDescription(new RTCSessionDescription(offer));
                peer.createAnswer().then(answer => { // Tạo answer để gửi lại cho peer gửi offer
                    peer.setLocalDescription(answer);
                    socket.emit('answer', fromId, answer); // Gửi answer đến peer khác
                });
            }
        });
        
        socket.on('answer', (fromId, answer) => { // Nhận answer từ peer khác
            debugSocket && console.log(`Received answer from ${fromId}:`, answer);
            peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(answer));  // Thiết lập remote description với answer nhận được
        });

        socket.on('candidate', (fromId, candidate) => { // Nhận ICE candidate từ peer khác
            debugSocket && console.log(`Received ICE candidate from ${fromId}:`, candidate);
        
            // Kiểm tra nếu peer connection đã được tạo ra cho userId
            if (peerConnections[fromId]) {
                const iceCandidate = new RTCIceCandidate(candidate);
                peerConnections[fromId].addIceCandidate(iceCandidate)
                    .then(() => {
                        debugRTC && console.log('Successfully added ICE candidate');
                    })
                    .catch(error => {
                        debugRTC && console.error('Failed to add ICE candidate:', error);
                    });
            } else {
                debugSocket && console.error(`Peer connection not found for ${fromId}`);
            }
        });        
    });
}

/**
 * @param {string} userId 
 * @param {MediaStream} stream 
 */
function connectToNewUser(userId, stream) {
    const peer = createPeerConnection(userId, stream);

    peer.createOffer().then(offer => { // Tạo offer để bắt đầu kết nối WebRTC
        peer.setLocalDescription(offer);
        socket.emit('offer', userId, offer);  // Gửi offer đến peer khác
    });
}

/**
 * @param {string} userId 
 * @param {MediaStream} stream 
 * @returns {RTCPeerConnection}
 */
function createPeerConnection(userId, stream) {
    const peer = new RTCPeerConnection({
        "iceServers": [{ "urls": "stun:stun.1.google.com:19302" }]
    });
    peerConnections[userId] = peer;

    // Tạo DataChannel cho peer này
    const dataChannel = peer.createDataChannel("screen-sharing-channel");
    dataChannels[userId] = dataChannel;
    dataChannel.onmessage = (event) => handleDataChannelMessage(userId, event);

    stream.getTracks().forEach(track => peer.addTrack(track, stream)); // Gửi các track từ stream vào peer connection

    peer.ontrack = event => handleIncomingTrack(userId, event); // Xử lý các track nhận từ peer khác
    peer.onicecandidate = event => handleIceCandidate(userId, event); // Xử lý ICE candidates
    peer.onconnectionstatechange = () => handleConnectionStateChange(userId, peer); // Thiết lập trạng thái kết nối

    return peer;

    function handleIncomingTrack(userId, event) { // Hàm xử lý track nhận được từ peer khác
        console.log('Stream receive:', event.streams);
        console.log("Track received:", event.track.kind, event.track.readyState);
        handleUIForNewTrack(userId, event.streams[0]);
    }
    
    function handleIceCandidate(userId, event) { // Hàm xử lý ICE candidates
        if (event.candidate) {
            console.log(`Sending ICE candidate to ${userId}:`, event.candidate);
            socket.emit('candidate', userId, event.candidate);
        } else {
            console.log('All ICE candidates have been sent');
        }
    }

    function handleConnectionStateChange(userId, peer) { // Hàm xử lý trạng thái kết nối
        console.log(`Connection state of ${userId}:`, peer.connectionState);
        if (peer.connectionState === 'failed') {
            console.error(`Connection to ${userId} failed`);
            peer.close();
        }
    }
}

/**
 * @param {string} userId 
 * @param {MediaStream} stream 
 */
function handleUIForNewTrack(userId, stream) {
    const videoElementId = `video-${userId}`;
    if (!document.getElementById(videoElementId)) {
        const video = document.createElement('video');
        video.id = videoElementId;
        addVideoStream(video, stream);
    } else {
        const video = document.getElementById(videoElementId);
        video.srcObject = stream;
    }
}

/**
 * @param {HTMLVideoElement} video 
 * @param {MediaStream} stream 
 */
function addVideoStream(video, stream) {
    video.srcObject = stream;
    console.log("Assigned stream to video element:", video.srcObject, video.srcObject.getTracks());
    video.autoplay = true;
    video.playsinline = true;
    video.addEventListener('play', () => {
        console.log(`Video ${video.id} is playing`);
    });
    video.addEventListener('loadedmetadata', () => {
        console.log(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
        video.play().catch(error => {
            console.error("Video playback failed:", error);
        });
    });
    console.log('Added stream for', video);
    view.videoGrid.appendChild(video);
}

/**
 * @param {string} userId 
 */
function removeUIOfUserDisconnect(userId) {
    document.getElementById(`video-${userId}`)?.remove();
}

/**
 * Yêu cầu quyền truy cập vào media (camera/mic).
 * @param {MediaStreamConstraints} constraints - Ràng buộc cho media (video, audio).
 * @returns {Promise<MediaStream>} - Promise trả về MediaStream.
 */
async function requestUserMedia(constraints) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Đã truy cập media stream:", stream);
        return stream;
    } catch (error) {
        console.error("Lỗi khi yêu cầu media stream:", error);
        if (error.name === 'NotAllowedError') {
            showPopup("Bạn đã từ chối cấp quyền truy cập camera/mic. Vui lòng kiểm tra cài đặt trình duyệt.");
        } else if (error.name === 'NotFoundError') {
            showPopup("Không tìm thấy thiết bị camera hoặc microphone trên thiết bị của bạn.");
        } else if (error.name === 'OverconstrainedError') {
            showPopup(`Không thể đáp ứng ràng buộc media: ${error.constraint}.`);
        } else {
            showPopup("Xảy ra lỗi không xác định khi truy cập camera/mic.");
        }
        return null;
    }
}

/**
 * Yêu cầu quyền chia sẻ màn hình.
 * @param {DisplayMediaStreamOptions} options - Tùy chọn cho màn hình chia sẻ.
 * @returns {Promise<MediaStream>} - Promise trả về MediaStream.
 */
async function requestUserDisplayMedia(options) {
    try {
        if (!navigator.mediaDevices.getDisplayMedia) {
            showPopup("Tính năng chia sẻ màn hình không được hỗ trợ trên thiết bị này.");
            return null;
        }
        const stream = await navigator.mediaDevices.getDisplayMedia(options);
        console.log("Đã truy cập màn hình chia sẻ:", stream);
        return stream;
    } catch (error) {
        console.error("Lỗi khi yêu cầu chia sẻ màn hình:", error);
        if (error.name === 'NotAllowedError') {
            showPopup("Bạn đã từ chối quyền chia sẻ màn hình. Vui lòng thử lại.");
        } else if (error.name === 'NotFoundError') {
            showPopup("Không tìm thấy màn hình hoặc cửa sổ để chia sẻ.");
        } else {
            showPopup("Xảy ra lỗi không xác định khi chia sẻ màn hình.");
        }
        return null;
    }
}

function faker() {
    return {
        createSilentAudioTrack() {
            const audioContext = new AudioContext();
            const silenceBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 1, audioContext.sampleRate);
            const source = audioContext.createBufferSource();
            source.buffer = silenceBuffer;
        
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);
            source.start();

            const placeholderTrack = destination.stream.getAudioTracks()[0];
            // Gắn cờ track giả
            trackMap.set(placeholderTrack, true);
        
            return placeholderTrack;
        },
        
        createPlaceholderVideoTrack() {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
        
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const stream = canvas.captureStream();
            const placeholderTrack = stream.getVideoTracks()[0];
        
            // Gắn cờ track giả
            trackMap.set(placeholderTrack, true);
        
            return placeholderTrack;
        }
    }
}

function getElements() {
    const videoGrid = document.getElementById('video-grid');
    const shareScreenBtn = document.getElementById('toggle-share-screen');
    const toggleMicBtn = document.getElementById('toggle-mic');
    const toggleCamBtn = document.getElementById('toggle-cam');
    const leaveRoomBtn = document.getElementById('leave-room');

    return { videoGrid, shareScreenBtn, toggleCamBtn, toggleMicBtn, leaveRoomBtn };
}

/**
 * @param {string} message 
 */
function showPopup(message) {
    const popup = document.getElementById('popup');
    const messageElement = document.getElementById('popup-message');
    const closeButton = document.getElementById('popup-close-btn');

    messageElement.textContent = message;
    popup.style.display = 'block';

    closeButton.onclick = () => {
        popup.style.display = 'none';
    };

    setTimeout(() => {
        popup.style.display = 'none';
    }, 5000);
}
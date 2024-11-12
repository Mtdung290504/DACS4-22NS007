const socket = io();
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;  // Tắt tiếng video của chính mình

/**
 * Media stream của chính mình
 * @type {MediaStream}
 */
let myVideoStream = null;
let screenStream = null;

/**
 * Lưu trữ các kết nối WebRTC cho mỗi peer: 1 cho camera và 1 cho màn hình
 * @type {{[socketId: string]: { camera: RTCPeerConnection, screen: RTCPeerConnection }}}
 */
let peerConnections = {};

const roomId = window.location.pathname.split('/')[2];  // Lấy roomId từ URL

// Lấy stream video & audio từ thiết bị của người dùng
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);  // Hiển thị video của chính mình

    // Tham gia phòng họp
    socket.emit('join-room', roomId, socket.id);

    // Khi có người dùng mới kết nối
    socket.on('user-connected', userId => {
        console.log(`User connected: ${userId}`);
        connectToNewUser(userId, stream);  // Kết nối với người dùng mới
    });

    // Khi có người dùng ngắt kết nối
    socket.on('user-disconnected', userId => {
        if (peerConnections[userId]) {
            if (peerConnections[userId].camera) {
                peerConnections[userId].camera.close();
            }
            if (peerConnections[userId].screen) {
                peerConnections[userId].screen.close();
            }
            delete peerConnections[userId];

            document.getElementById(`video-${userId}`)?.remove();
            document.getElementById(`screen-${userId}`)?.remove();
        }
        console.log(`User disconnected: ${userId}`);
    });

    // Lắng nghe các sự kiện signaling
    handleSignalingEvents();
});

function connectToNewUser(userId, stream) {
    peerConnections[userId] = { 
        camera: new RTCPeerConnection(),
        screen: new RTCPeerConnection()
    };

    // Kết nối camera
    stream.getTracks().forEach(track => peerConnections[userId].camera.addTrack(track, stream));
    
    // Xử lý sự kiện ontrack của kết nối camera
    peerConnections[userId].camera.ontrack = event => onTrackCall(event, userId, false);
    setupPeerConnection(peerConnections[userId].camera, userId, "camera");

    // Xử lý sự kiện ontrack của kết nối màn hình (screen)
    peerConnections[userId].screen.ontrack = event => onTrackCall(event, userId, true);
    setupPeerConnection(peerConnections[userId].screen, userId, "screen");
}

function setupPeerConnection(peer, userId, type) {
    peer.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', userId, event.candidate, type);
        }
    };

    peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit('offer', userId, offer, type);
    });
}

// Xử lý các sự kiện signaling từ các peer khác
function handleSignalingEvents() {
    socket.on('offer', (fromId, offer, type) => {
        if (!peerConnections[fromId]) {
            peerConnections[fromId] = { 
                camera: new RTCPeerConnection(),
                screen: new RTCPeerConnection()
            };
        }
        const peer = peerConnections[fromId][type];
        
        peer.ontrack = event => onTrackCall(event, fromId, type === "screen");
        peer.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('candidate', fromId, event.candidate, type);
            }
        };
        peer.setRemoteDescription(new RTCSessionDescription(offer));
        peer.createAnswer().then(answer => {
            peer.setLocalDescription(answer);
            socket.emit('answer', fromId, answer, type);
        });
    });

    socket.on('answer', (fromId, answer, type) => {
        peerConnections[fromId][type].setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', (fromId, candidate, type) => {
        const iceCandidate = new RTCIceCandidate(candidate);
        peerConnections[fromId][type].addIceCandidate(iceCandidate);
    });
}

/**
 * @param {RTCTrackEvent} event 
 * @param {string} userId 
 * @param {boolean} isScreenTrack 
 */
function onTrackCall(event, userId, isScreenTrack) {
    const videoId = isScreenTrack ? `screen-${userId}` : `video-${userId}`;
    let video = document.getElementById(videoId);

    if (!video) {
        video = document.createElement('video');
        video.id = videoId;
        video.autoplay = true;
        addVideoStream(video, event.streams[0]);
    }
}

// Hàm thêm video stream vào lưới video
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

// Bắt đầu hoặc dừng chia sẻ màn hình
async function toggleScreenShare() {
    if (!screenStream) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStream.getTracks().forEach(track => {
                Object.values(peerConnections).forEach(peers => {
                    peers.screen.addTrack(track, screenStream);
                });
            });
            screenStream.getVideoTracks()[0].onended = stopScreenShare;
        } catch (error) {
            console.error("Không thể chia sẻ màn hình:", error);
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
}

// Thêm nút toggle-screen-share vào HTML của bạn
document.getElementById('toggle-share-screen').addEventListener('click', toggleScreenShare);

// Controls for mic, camera, and leaving the room
const toggleMicButton = document.getElementById('toggle-mic');
const toggleCamButton = document.getElementById('toggle-cam');

// Thay đổi trạng thái âm thanh
toggleMicButton.addEventListener('click', () => {
    const audioTrack = myVideoStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    if (audioTrack.enabled) {
        toggleMicButton.classList.add('active');
        toggleMicButton.classList.remove('inactive');
    } else {
        toggleMicButton.classList.add('inactive');
        toggleMicButton.classList.remove('active');
    }
});

toggleCamButton.addEventListener('click', async () => {
    if (myVideoStream.getVideoTracks().length) {
        // Dừng và xóa track camera hiện tại khỏi myVideoStream
        myVideoStream.getVideoTracks().forEach(track => {
            track.stop();
            myVideoStream.removeTrack(track);
        });

        toggleCamButton.classList.add('inactive');
        toggleCamButton.classList.remove('active');
    } else {
        try {
            // Kiểm tra nếu đã có track âm thanh, chỉ yêu cầu video nếu có
            const constraints = myVideoStream.getAudioTracks().length ? { video: true } : { video: true, audio: true };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Giữ lại audio track cũ nếu stream mới không có
            if (constraints.video && myVideoStream.getAudioTracks().length) {
                myVideoStream.getAudioTracks().forEach(track => newStream.addTrack(track));
            }

            const newVideoTrack = newStream.getVideoTracks()[0];

            // Thay myVideoStream hiện tại bằng stream mới có video
            myVideoStream = newStream;

            // Cập nhật kết nối WebRTC với video track mới
            replaceTrack(newVideoTrack);

            // Cập nhật video trong giao diện
            addVideoStream(myVideo, newStream);

            toggleCamButton.classList.add('active');
            toggleCamButton.classList.remove('inactive');
        } catch (err) {
            console.error("Không thể bật camera:", err);
        }
    }
});

// Hàm thay thế video track hiện tại
function replaceTrack(newTrack) {
    const videoSender = Object.values(peerConnections).map(({ camera: peer }) =>
        peer.getSenders().find(sender => sender.track && sender.track.kind === 'video')
    ).filter(Boolean);

    videoSender.forEach(sender => sender.replaceTrack(newTrack));
}

document.getElementById('leave-room').addEventListener('click', () => {
    socket.disconnect();
    window.location.href = '/';
});
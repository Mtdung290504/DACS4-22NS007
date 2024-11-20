const socket = io();
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;  // Tắt tiếng video của chính mình

/**
 * Media stream của chính mình
 * @type {MediaStream} 
 */
let myVideoStream;

/**
 * Lưu trữ các kết nối WebRTC của các peer
 * @type {{[socketId: string]: RTCPeerConnection}} 
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
            peerConnections[userId].close();  // Đóng kết nối WebRTC
            delete peerConnections[userId];

            document.getElementById(`video-${userId}`)?.remove();
        }
        console.log(`User disconnected: ${userId}`);
    });

    // Lắng nghe các sự kiện signaling
    handleSignalingEvents();
});

// Kết nối với người dùng mới qua WebRTC
function connectToNewUser(userId, stream) {
    const peer = new RTCPeerConnection();
    peerConnections[userId] = peer;

    // Gửi các track của stream (video & audio) vào kết nối
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    // Khi nhận được track của peer khác (stream từ người khác)
    peer.ontrack = event => {
        if (!document.getElementById(`video-${userId}`)) {
            const video = document.createElement('video');
            video.id = `video-${userId}`;
            video.autoplay = true;  // Bật tự động phát
            video.playsinline = true;  // Đảm bảo video phát trên các thiết bị di động
            addVideoStream(video, event.streams[0]);
        }
    };

    // Xử lý khi có ICE candidate
    peer.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', userId, event.candidate);  // Gửi ICE candidate đến peer khác
        }
    };

    // Tạo offer để bắt đầu kết nối WebRTC
    peer.createOffer()
        .then(offer => {
            peer.setLocalDescription(offer);
            socket.emit('offer', userId, offer);  // Gửi offer đến peer khác
        });
}

// Hàm xử lý các sự kiện signaling từ các peer khác
function handleSignalingEvents() {
    // Nhận offer từ peer khác
    socket.on('offer', (fromId, offer) => {
        if (!peerConnections[fromId]) {
            const peer = new RTCPeerConnection();
            peerConnections[fromId] = peer;

            // Gửi các track của stream (video & audio) vào kết nối
            myVideoStream.getTracks().forEach(track => peer.addTrack(track, myVideoStream));

            // Khi nhận được track của peer khác
            peer.ontrack = event => {
                if (!document.getElementById(`video-${fromId}`)) { // Kiểm tra xem video đã tồn tại chưa
                    const video = document.createElement('video');
                    video.id = `video-${fromId}`;
                    video.autoplay = true;  // Bật tự động phát
                    video.playsinline = true;  // Đảm bảo video phát trên các thiết bị di động
                    addVideoStream(video, event.streams[0]);
                }
            };

            peer.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('candidate', fromId, event.candidate);  // Gửi ICE candidate
                }
            };

            // Thiết lập remote description với offer nhận được từ peer
            peer.setRemoteDescription(new RTCSessionDescription(offer));

            // Tạo answer để gửi lại cho peer gửi offer
            peer.createAnswer()
                .then(answer => {
                    peer.setLocalDescription(answer);
                    socket.emit('answer', fromId, answer);  // Gửi answer đến peer khác
                });
        }
    });

    // Nhận answer từ peer khác
    socket.on('answer', (fromId, answer) => {
        peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(answer));  // Thiết lập remote description với answer
    });

    // Nhận ICE candidate từ peer khác
    socket.on('candidate', (fromId, candidate) => {
        const iceCandidate = new RTCIceCandidate(candidate);
        peerConnections[fromId].addIceCandidate(iceCandidate);  // Thêm ICE candidate vào kết nối
    });
}

// Hàm thêm video stream vào lưới video
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

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
    const videoSender = Object.values(peerConnections).map((peer) =>
        peer.getSenders().find(sender => sender.track && sender.track.kind === 'video')
    ).filter(Boolean);

    videoSender.forEach(sender => sender.replaceTrack(newTrack));
}

document.getElementById('leave-room').addEventListener('click', () => {
    socket.disconnect();
    window.location.href = '/';
});

let screenStream;  // Để lưu stream chia sẻ màn hình

document.getElementById('toggle-share-screen').addEventListener('click', async () => {
    if (!screenStream) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStream.getVideoTracks()[0].onended = stopScreenSharing;
            // Thêm vào kết nối WebRTC và hiển thị
            replaceTrack(screenStream.getVideoTracks()[0]);
            addVideoStream(myVideo, screenStream); // Hiển thị video màn hình cho chính mình
        } catch (err) {
            console.error('Không thể chia sẻ màn hình:', err);
        }
    } else {
        stopScreenSharing();
    }
});

function stopScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;

        // Nếu camera vẫn hoạt động, thay thế màn hình bằng camera
        if (myVideoStream.getVideoTracks().length) {
            replaceTrack(myVideoStream.getVideoTracks()[0]);
            addVideoStream(myVideo, myVideoStream); // Trở lại video camera cho chính mình
        }
    }
}
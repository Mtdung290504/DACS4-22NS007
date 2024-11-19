const socket = io();
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;  // Tắt tiếng video của chính mình

/**
 * Media stream của chính mình
 * @type {MediaStream} 
 */
let myVideoStream;

let dumpTrack = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    
    const context = canvas.getContext("2d");
    context.fillStyle = "black";
    context.fillRect(0, 0, 1, 1); // Tô màu để tạo hình ảnh nhỏ
    
    return canvas.captureStream().getVideoTracks()[0];
})();

let screenTrack = null;

/**
 * Lưu trữ các RTCPeerConnection của các peer
 * @type {{[socketId: string]: RTCPeerConnection}} 
 */
let peerConnections = {};

/**
 * Lưu trữ các RTCDataChannel của các peer
 * @type {{[socketId: string]: RTCDataChannel}}
 */
let dataChannels = {};

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

function connectToNewUser(userId, stream) {
    const peer = new RTCPeerConnection();
    peerConnections[userId] = peer;

    // Tạo data channel để gửi và nhận sự kiện chia sẻ màn hình
    const dataChannel = peer.createDataChannel("screenShareChannel");
    dataChannel.onmessage = handleScreenShareMessage;
    dataChannels[userId] = dataChannel;

    // Thêm track giả để dùng cho chia sẻ màn hình
    peer.addTrack(dumpTrack, myVideoStream);
    // Thêm tất cả các track của stream (camera) vào kết nối
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    // Khi nhận được track từ peer (camera hoặc màn hình)
    peer.ontrack = onTrackCall.bind(userId);

    peer.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', userId, event.candidate);
        }
    };

    // Tạo offer để bắt đầu kết nối WebRTC
    peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit('offer', userId, offer);
    });
}

// Xử lý tin nhắn chia sẻ màn hình từ các peer
function handleScreenShareMessage(event) {
    const message = JSON.parse(event.data);
    const { action, userId } = message;

    if (action === 'startScreenShare') {
        console.log(`${userId} đã bắt đầu chia sẻ màn hình`);
        // Khi peer bắt đầu chia sẻ màn hình, tạo video cho màn hình
        const video = document.createElement('video');
        video.id = `screen-${userId}`;
        video.autoplay = true;
        document.body.append(video);
    } else if (action === 'stopScreenShare') {
        console.log(`${userId} đã dừng chia sẻ màn hình`);
        // Khi peer dừng chia sẻ màn hình, xóa video màn hình
        document.getElementById(`screen-${userId}`)?.remove();
    }
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
            peer.ontrack = onTrackCall.bind(fromId);

            peer.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('candidate', fromId, event.candidate);  // Gửi ICE candidate
                }
            };

            // Thiết lập remote description với offer nhận được từ peer
            peer.setRemoteDescription(new RTCSessionDescription(offer));

            // Tạo answer để gửi lại cho peer gửi offer
            peer.createAnswer().then(answer => {
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

/**
 * @param {RTCTrackEvent} event 
 */
/**
 * @param {RTCTrackEvent} event 
 */
function onTrackCall(event) {
    const userId = this;
    const [remoteStream] = event.streams;
    const isScreenTrack = event.track.label.includes("screen");

    const videoId = isScreenTrack ? `screen-${userId}` : `video-${userId}`;
    if (!document.getElementById(videoId)) {
        const video = document.createElement('video');
        video.id = videoId;
        video.autoplay = true;
        video.srcObject = remoteStream;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });

        videoGrid.append(video);  // Thêm video vào lưới giao diện
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

// Hàm xử lý khi người dùng bật hoặc tắt chia sẻ màn hình
async function toggleScreenShare() {
    // Kiểm tra nếu chưa có track màn hình thì bắt đầu chia sẻ
    if (!screenTrack) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenTrack = screenStream.getVideoTracks()[0];

            // Thay thế track giả bằng track màn hình trong mỗi kết nối
            Object.values(peerConnections).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track === dumpTrack);
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            });

            // Khi track màn hình bị dừng (người dùng tắt chia sẻ)
            screenTrack.onended = stopScreenShare;

            // Gửi thông báo bắt đầu chia sẻ đến các peer
            Object.values(dataChannels).forEach(channel => {
                channel.send(JSON.stringify({ action: 'startScreenShare', userId: socket.id }));
            });
        } catch (error) {
            console.error("Không thể chia sẻ màn hình:", error);
        }
    } else {
        stopScreenShare(); // Nếu đang chia sẻ, dừng chia sẻ
    }
}

// Hàm dừng chia sẻ màn hình
function stopScreenShare() {
    if (screenTrack) {
        screenTrack.stop(); // Dừng track màn hình
        screenTrack = null;

        // Thay thế lại track màn hình bằng track giả
        Object.values(peerConnections).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(dumpTrack);
            }
        });

        // Thông báo đến các peer rằng đã dừng chia sẻ màn hình
        Object.values(dataChannels).forEach(channel => {
            channel.send(JSON.stringify({ action: 'stopScreenShare', userId: socket.id }));
        });
    }
}

// Thêm nút toggle-screen-share vào HTML của bạn
document.getElementById('toggle-share-screen').addEventListener('click', toggleScreenShare);
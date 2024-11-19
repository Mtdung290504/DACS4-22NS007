const socket = io();
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;  // Tắt tiếng video của chính mình

/**
 * @type {MediaStream}
 */
let myVideoStream;

/**
 * @type {{ [socketId: string]: RTCPeerConnection }}
 */
let peerConnections = {};  // Lưu trữ các kết nối WebRTC của các peer

/**
 * @type {{ [socketId: string]: RTCDataChannel }}
 */
let dataChannels = {};  // Lưu trữ các DataChannel của các peer

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
            delete dataChannels[userId];  // Xóa DataChannel tương ứng
            document.getElementById(`video-${userId}`)?.remove();  // Xóa video của user đã ngắt kết nối
        }
        console.log(`User disconnected: ${userId}`);
    });

    // Lắng nghe các sự kiện signaling (offer, answer, ICE candidate)
    handleSignalingEvents();
});

// Kết nối với người dùng mới qua WebRTC
function connectToNewUser(userId, stream) {
    const peer = new RTCPeerConnection({
        "iceServers": [{ "urls": "stun:stun.1.google.com:19302" }]
    });
    peerConnections[userId] = peer;

    // Tạo DataChannel cho mỗi peer để truyền dữ liệu (ví dụ: chia sẻ màn hình)
    const dataChannel = peer.createDataChannel("screen-sharing-channel");
    dataChannels[userId] = dataChannel;

    // Xử lý thông điệp nhận được từ DataChannel
    dataChannel.onmessage = (event) => handleDataChannelMessage(userId, event);

    // Gửi các track của stream (video & audio) vào kết nối
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    // Khi nhận được track của peer khác (stream từ người khác)
    // peer.ontrack = event => {
    //     if (!document.getElementById(`video-${userId}`)) { // Kiểm tra xem video đã tồn tại chưa
    //         const video = document.createElement('video');
    //         video.id = `video-${userId}`; // Thêm ID duy nhất cho video
    //         addVideoStream(video, event.streams[0]);
    //     }
    // };

    peer.ontrack = event => {
        // alert('ontrack');
        if (event.track.kind === 'video') {
            if (event.streams[0].getVideoTracks()[0].onended?.name === 'stopScreenSharing') {
                // Nếu stream là chia sẻ màn hình, tạo một thẻ video riêng cho màn hình
                if (!document.getElementById(`screen-video-${userId}`)) {
                    const screenVideo = createScreenVideoElement(userId);
                    addVideoStream(screenVideo, event.streams[0]);
                }
            } else {
                // Nếu stream là từ camera, tạo thẻ video cho camera
                if (!document.getElementById(`video-${userId}`)) {
                    const video = document.createElement('video');
                    video.id = `video-${userId}`;
                    addVideoStream(video, event.streams[0]);
                }
            }
        }
    };

    // Xử lý khi có ICE candidate
    peer.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', userId, event.candidate);  // Gửi ICE candidate đến peer khác
        }
    };

    // Tạo offer để bắt đầu kết nối WebRTC
    peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit('offer', userId, offer);  // Gửi offer đến peer khác
    });
}

// Hàm xử lý các sự kiện signaling từ các peer khác (offer, answer, ICE candidate)
function handleSignalingEvents() {
    // Nhận offer từ peer khác
    socket.on('offer', (fromId, offer) => {
        if (!peerConnections[fromId]) {
            const peer = new RTCPeerConnection({
                "iceServers": [{ "urls": "stun:stun.1.google.com:19302" }]
            });
            peerConnections[fromId] = peer;

            // Xử lý khi nhận được DataChannel từ peer khác
            peer.ondatachannel = (event) => {
                const dataChannel = event.channel;
                dataChannels[fromId] = dataChannel;
                dataChannel.onmessage = (event) => handleDataChannelMessage(fromId, event);
            };

            // Gửi các track của stream (video & audio) vào kết nối
            myVideoStream.getTracks().forEach(track => peer.addTrack(track, myVideoStream));

            // Khi nhận được track của peer khác
            // peer.ontrack = event => {
            //     if (!document.getElementById(`video-${fromId}`)) { // Kiểm tra xem video đã tồn tại chưa
            //         const video = document.createElement('video');
            //         video.id = `video-${fromId}`;
            //         addVideoStream(video, event.streams[0]);
            //     }
            // };
            peer.ontrack = event => {
                // alert('ontrack');
                if (event.track.kind === 'video') {
                    if (event.streams[0].getVideoTracks()[0].onended?.name === 'stopScreenSharing') {
                        // Nếu stream là chia sẻ màn hình, tạo một thẻ video riêng cho màn hình
                        if (!document.getElementById(`screen-video-${fromId}`)) {
                            const screenVideo = createScreenVideoElement(fromId);
                            addVideoStream(screenVideo, event.streams[0]);
                        }
                    } else {
                        // Nếu stream là từ camera, tạo thẻ video cho camera
                        if (!document.getElementById(`video-${fromId}`)) {
                            const video = document.createElement('video');
                            video.id = `video-${fromId}`;
                            addVideoStream(video, event.streams[0]);
                        }
                    }
                }
            };

            // Xử lý khi có ICE candidate
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
        peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(answer));  // Thiết lập remote description với answer nhận được
    });

    // Nhận ICE candidate từ peer khác
    socket.on('candidate', (fromId, candidate) => {
        const iceCandidate = new RTCIceCandidate(candidate);
        peerConnections[fromId].addIceCandidate(iceCandidate);  // Thêm ICE candidate vào kết nối
    });
}

// Hàm xử lý các thông điệp từ DataChannel
function handleDataChannelMessage(userId, event) {
    const message = JSON.parse(event.data);
    if (message.type === 'CAMERA_OFF') {
        // Thay đổi video thành màu đen khi camera tắt
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
            videoElement.srcObject = null;  // Xóa video stream hiện tại
        }
    } else if (message.type === 'CAMERA_ON') {
        // Khi camera bật lại, khôi phục stream video
        const peer = peerConnections[userId];
        const videoElement = document.getElementById(`video-${userId}`);
        if (peer && videoElement) {
            const remoteStream = new MediaStream(peer.getReceivers().map(receiver => receiver.track));
            videoElement.srcObject = remoteStream;  // Khôi phục stream
        }
    } 
    // else if (message.type === 'SCREEN_SHARING_STARTED') {
    //     if (!document.getElementById(`screen-video-${userId}`)) {
    //         const screenVideo = createScreenVideoElement(userId);
    //         videoGrid.append(screenVideo);
    //     }
    // } 
    else if (message.type === 'SCREEN_SHARING_STOPPED') {
        const screenVideo = document.getElementById(`screen-video-${userId}`);
        if(screenVideo.srcObject) {
            screenVideo.srcObject = null;
        }
        screenVideo?.remove();
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

// Chia sẻ màn hình
let screenStream;  // Để lưu stream chia sẻ màn hình
let screenVideo;   // Thẻ video riêng cho chia sẻ màn hình

// Khi bắt đầu chia sẻ màn hình
document.getElementById('toggle-share-screen').addEventListener('click', async () => {
    if (!screenStream) {
        try {
            // Lấy stream chia sẻ màn hình
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStream.getVideoTracks()[0].onended = stopScreenSharing;  // Dừng khi người dùng ngừng chia sẻ màn hình

            broadcastScreenStream(screenStream);  // Gửi stream chia sẻ màn hình đến các peer
            screenVideo = createScreenVideoElement(socket.id);  // Tạo phần tử video cho chia sẻ màn hình
            addVideoStream(screenVideo, screenStream);  // Hiển thị video chia sẻ màn hình của chính mình

            // Gửi thông báo chia sẻ màn hình qua DataChannel
            broadcastData({ type: 'SCREEN_SHARING_STARTED' });
        } catch (err) {
            console.error('Không thể chia sẻ màn hình:', err);
        }
    } else {
        stopScreenSharing();  // Dừng chia sẻ màn hình nếu đang chia sẻ
    }
});

// Hàm dừng chia sẻ màn hình
function stopScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());  // Dừng các track trong stream chia sẻ màn hình
        screenStream = null;

        // Gỡ bỏ video chia sẻ màn hình của chính mình khỏi giao diện
        document.getElementById(`screen-video-${socket.id}`)?.remove();

        // Khôi phục lại track camera
        const videoTrack = myVideoStream.getVideoTracks()[0];
        Object.values(peerConnections).forEach(peer => {
            const videoSender = peer.getSenders().find(sender => sender.track.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(videoTrack);  // Khôi phục track camera
            }
        });

        // Gửi thông báo dừng chia sẻ màn hình qua DataChannel
        broadcastData({ type: 'SCREEN_SHARING_STOPPED' });
    }
}

// Hàm gửi thông báo chia sẻ màn hình qua DataChannel đến tất cả các peer
function broadcastData(data) {
    Object.values(dataChannels).forEach(channel => {
        if (channel.readyState === 'open') {
            channel.send(JSON.stringify(data));  // Gửi dữ liệu qua các DataChannel mở
        }
    });
}

// Hàm gửi stream chia sẻ màn hình tới tất cả các peer
// function broadcastScreenStream(stream) {
//     Object.values(peerConnections).forEach(peer => {
//         const videoTrack = stream.getVideoTracks()[0];
//         const videoSender = peer.getSenders().find(sender => sender.track.kind === 'video');
        
//         if (videoSender) {
//             videoSender.replaceTrack(videoTrack);  // Thay thế track video hiện tại bằng track chia sẻ màn hình
//         } else {
//             peer.addTrack(videoTrack, stream);  // Nếu không có sender video, thêm track mới
//         }
//     });
// }
function broadcastScreenStream(screenStream) {
    Object.values(peerConnections).forEach(peer => {
        const screenTrack = screenStream.getVideoTracks()[0];
        // console.log(screenTrack);
        // console.log(myVideoStream.getVideoTracks()[0]);
        screenTrack.isScreenTrack = true;
        // Thêm track chia sẻ màn hình mà không thay thế video camera
        peer.addTrack(screenTrack, screenStream);
    });
}

// Tạo một phần tử video riêng cho chia sẻ màn hình
function createScreenVideoElement(userId) {
    const screenVideo = document.createElement('video');
    screenVideo.id = `screen-video-${userId}`;
    screenVideo.muted = true;
    screenVideo.classList.add('screen-video');
    return screenVideo;
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

// Thay đổi trạng thái video
toggleCamButton.addEventListener('click', async () => {
    if (myVideoStream.getVideoTracks().length) {
        // Dừng và xóa track camera hiện tại khỏi myVideoStream
        myVideoStream.getVideoTracks().forEach(track => {
            track.stop();
            myVideoStream.removeTrack(track);
        });

        broadcastData({ type: 'CAMERA_OFF' });
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
            broadcastData({ type: 'CAMERA_ON' });
            toggleCamButton.classList.add('active');
            toggleCamButton.classList.remove('inactive');
        } catch (err) {
            console.error("Không thể bật camera:", err);
        }
    }
});

// Hàm thay thế video track hiện tại trong kết nối WebRTC
function replaceTrack(newTrack) {
    const videoSender = Object.values(peerConnections).map((peer) =>
        peer.getSenders().find(sender => sender.track && sender.track.kind === 'video')
    ).filter(Boolean);

    videoSender.forEach(sender => sender.replaceTrack(newTrack));  // Thay thế track video bằng track mới
}

// Khi người dùng rời phòng
document.getElementById('leave-room').addEventListener('click', () => {
    socket.disconnect();  // Ngắt kết nối socket
    window.location.href = '/';  // Chuyển hướng người dùng về trang chủ
});
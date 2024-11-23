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
    //     console.log("Track received:", event.track.kind, event.track.readyState);
    //     console.log("Stream tracks:", event.streams[0].getTracks());
    //     if (!document.getElementById(`video-${userId}`)) { // Kiểm tra xem video đã tồn tại chưa
    //         const video = document.createElement('video');
    //         video.id = `video-${userId}`; // Thêm ID duy nhất cho video
    //         addVideoStream(video, event.streams[0]);
    //     }
    // };
    peer.ontrack = event => {
        console.log("Track received:", event.track.kind, event.track.readyState);
    
        const videoElementId = `video-${userId}`;
        if (!document.getElementById(videoElementId)) {
            const video = document.createElement('video');
            video.id = videoElementId;
            addVideoStream(video, event.streams[0]);
        } else {
            const video = document.getElementById(videoElementId);
            video.srcObject = event.streams[0];
        }
    };
    

    // Xử lý khi có ICE candidate
    peer.onicecandidate = event => {
        if (event.candidate) {
            console.log(`Sending ICE candidate to ${userId}:`, event.candidate);
            socket.emit('candidate', userId, event.candidate);  // Gửi ICE candidate đến peer khác
        } else {
            console.log('All ICE candidates have been sent');
        }
    };

    // Tạo offer để bắt đầu kết nối WebRTC
    peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit('offer', userId, offer);  // Gửi offer đến peer khác
    });

    peer.onconnectionstatechange = () => {
        console.log(`Connection state of ${userId}:`, peer.connectionState);
    
        if (peer.connectionState === 'failed') {
            console.error(`Connection to ${userId} failed`);
            peer.close();  // Đóng kết nối nếu nó gặp lỗi
        }
    };
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
            //     console.log("Track received:", event.track.kind, event.track.readyState);
            //     console.log("Stream tracks:", event.streams[0].getTracks());
            //     if (!document.getElementById(`video-${fromId}`)) { // Kiểm tra xem video đã tồn tại chưa
            //         const video = document.createElement('video');
            //         video.id = `video-${fromId}`;
            //         addVideoStream(video, event.streams[0]);
            //     }
            // };
            peer.ontrack = event => {
                console.log("Track received:", event.track.kind, event.track.readyState);
            
                const videoElementId = `video-${fromId}`;
                if (!document.getElementById(videoElementId)) {
                    const video = document.createElement('video');
                    video.id = videoElementId;
                    addVideoStream(video, event.streams[0]);
                } else {
                    const video = document.getElementById(videoElementId);
                    video.srcObject = event.streams[0];
                }
            };            

            // Xử lý khi có ICE candidate
            peer.onicecandidate = event => {
                if (event.candidate) {
                    console.log(`Sending ICE candidate to ${fromId}:`, event.candidate);
                    socket.emit('candidate', fromId, event.candidate);  // Gửi ICE candidate đến peer khác
                } else {
                    console.log('All ICE candidates have been sent');
                }
            };

            // Thiết lập remote description với offer nhận được từ peer
            peer.setRemoteDescription(new RTCSessionDescription(offer));

            // Tạo answer để gửi lại cho peer gửi offer
            peer.createAnswer().then(answer => {
                peer.setLocalDescription(answer);
                socket.emit('answer', fromId, answer);  // Gửi answer đến peer khác
            });

            peer.onconnectionstatechange = () => {
                console.log(`Connection state of ${fromId}:`, peer.connectionState);
            
                if (peer.connectionState === 'failed') {
                    console.error(`Connection to ${fromId} failed`);
                    peer.close();  // Đóng kết nối nếu nó gặp lỗi
                }
            };
        }
    });

    // Nhận answer từ peer khác
    socket.on('answer', (fromId, answer) => {
        peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(answer));  // Thiết lập remote description với answer nhận được
    });

    // Nhận ICE candidate từ peer khác
    socket.on('candidate', (fromId, candidate) => {
        console.log(`Received ICE candidate from ${fromId}:`, candidate);
        const iceCandidate = new RTCIceCandidate(candidate);
        peerConnections[fromId].addIceCandidate(iceCandidate)
            .then(() => {
                console.log('Successfully added ICE candidate');
            })
            .catch(error => {
                console.error('Failed to add ICE candidate:', error);
            });
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
    else if (message.type === 'SCREEN_SHARING_STARTED') {
        if (!document.getElementById(`video-${userId}`)) {
            console.log(userId, 'share screen!');
        }
    } else if (message.type === 'SCREEN_SHARING_STOPPED') {
        if (!document.getElementById(`video-${userId}`)) {
            console.log(userId, 'share screen!');
        }
    }
}

// Hàm thêm video stream vào lưới video
function addVideoStream(video, stream) {
    const videoTrack = stream.getVideoTracks()[0];
    console.log(`Video track state: ${videoTrack.readyState}`);

    video.srcObject = stream;
    console.log("Assigned stream to video element:", video.srcObject);
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

    videoGrid.append(video);
    console.log('Added stream for', video);
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
function broadcastScreenStream(stream) {
    Object.values(peerConnections).forEach(peer => {
        const videoTrack = stream.getVideoTracks()[0];
        const videoSender = peer.getSenders().find(sender => sender.track.kind === 'video');
        
        if (videoSender) {
            videoSender.replaceTrack(videoTrack);  // Thay thế track video hiện tại bằng track chia sẻ màn hình
        } else {
            peer.addTrack(videoTrack, stream);  // Nếu không có sender video, thêm track mới
        }
    });
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
    const videoTrack = myVideoStream.getVideoTracks()[0];

    if (videoTrack && !isPlaceholderTrack(videoTrack)) {
        // Người dùng tắt camera
        myVideoStream.getVideoTracks().forEach(track => track.stop());
        const placeholderTrack = createPlaceholderVideoTrack();
        myVideoStream.removeTrack(videoTrack);
        myVideoStream.addTrack(placeholderTrack);

        replaceTrack(placeholderTrack); // Cập nhật cho các peer
        broadcastData({ type: 'CAMERA_OFF' });

        toggleCamButton.classList.add('inactive');
        toggleCamButton.classList.remove('active');
    } else {
        try {
            // Người dùng bật lại camera
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = newStream.getVideoTracks()[0];

            // Thay thế track giả bằng track thật
            myVideoStream.getVideoTracks().forEach(track => myVideoStream.removeTrack(track));
            myVideoStream.addTrack(newVideoTrack);

            replaceTrack(newVideoTrack); // Cập nhật cho các peer
            addVideoStream(myVideo, myVideoStream); // Cập nhật giao diện

            broadcastData({ type: 'CAMERA_ON' });

            toggleCamButton.classList.add('active');
            toggleCamButton.classList.remove('inactive');
        } catch (err) {
            console.error("Không thể bật camera:", err);
        }
    }
});

// Thay đổi trạng thái video
// toggleCamButton.addEventListener('click', async () => {
//     if (myVideoStream.getVideoTracks().length) {
//         // Dừng và xóa track camera hiện tại khỏi myVideoStream
//         myVideoStream.getVideoTracks().forEach(track => {
//             track.stop();
//             myVideoStream.removeTrack(track);
//         });

//         broadcastData({ type: 'CAMERA_OFF' });
//         toggleCamButton.classList.add('inactive');
//         toggleCamButton.classList.remove('active');
//     } else {
//         try {
//             // Kiểm tra nếu đã có track âm thanh, chỉ yêu cầu video nếu có
//             const constraints = myVideoStream.getAudioTracks().length ? { video: true } : { video: true, audio: true };
//             const newStream = await navigator.mediaDevices.getUserMedia(constraints);

//             // Giữ lại audio track cũ nếu stream mới không có
//             if (constraints.video && myVideoStream.getAudioTracks().length) {
//                 myVideoStream.getAudioTracks().forEach(track => newStream.addTrack(track));
//             }

//             const newVideoTrack = newStream.getVideoTracks()[0];

//             // Thay myVideoStream hiện tại bằng stream mới có video
//             myVideoStream = newStream;

//             // Cập nhật kết nối WebRTC với video track mới
//             replaceTrack(newVideoTrack);

//             // Cập nhật video trong giao diện
//             addVideoStream(myVideo, newStream);
//             broadcastData({ type: 'CAMERA_ON' });
//             toggleCamButton.classList.add('active');
//             toggleCamButton.classList.remove('inactive');
//         } catch (err) {
//             console.error("Không thể bật camera:", err);
//         }
//     }
// });

// Hàm thay thế video track hiện tại trong kết nối WebRTC
// function replaceTrack(newTrack) {
//     const videoSender = Object.values(peerConnections).map((peer) =>
//         peer.getSenders().find(sender => sender.track && sender.track.kind === 'video')
//     ).filter(Boolean);

//     videoSender.forEach(sender => sender.replaceTrack(newTrack));  // Thay thế track video bằng track mới
// }

function replaceTrack(newTrack) {
    Object.values(peerConnections).forEach(peer => {
        const videoSender = peer.getSenders().find(sender => sender.track && sender.track.kind === 'video');
        if (videoSender) {
            videoSender.replaceTrack(newTrack).catch(err => console.error("Failed to replace track:", err));
        }
    });
}

// Khi người dùng rời phòng
document.getElementById('leave-room').addEventListener('click', () => {
    socket.disconnect();  // Ngắt kết nối socket
    window.location.href = '/';  // Chuyển hướng người dùng về trang chủ
});

// Map để theo dõi trạng thái track
const trackMap = new Map();

// Hàm tạo track video giả
function createPlaceholderVideoTrack() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const stream = canvas.captureStream();
    const placeholderTrack = stream.getVideoTracks()[0];

    // Gắn cờ track giả
    trackMap.set(placeholderTrack, { isPlaceholder: true });

    return placeholderTrack;
}

// Kiểm tra track có phải là track giả không
function isPlaceholderTrack(track) {
    const trackInfo = trackMap.get(track);
    return trackInfo?.isPlaceholder || false;
}
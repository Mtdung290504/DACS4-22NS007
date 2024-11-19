const socket = io();

class App {
    /**
     * Luồng media của user
     * @type {MediaStream} 
     */
    userStream = undefined;

    /**
     * @type {{ [socketId: string]: RTCPeerConnection}} 
     */
    peers = undefined;


    constructor() {
        this.socket = io();
        
    }
}

// Lấy các thẻ video
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Lấy các nút để điều khiển mic và camera
const toggleMicButton = document.getElementById('toggleMic');
const toggleCameraButton = document.getElementById('toggleCamera');

let localStream;
let remoteStream;
let peerConnection;
let isMicEnabled = true;
let isCameraEnabled = true;
let videoTrack; // Track video hiện tại
let videoSender; // Đối tượng RTCRtpSender để quản lý track gửi đi

// Cấu hình ICE servers (STUN servers)
const configuration = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302',
        },
    ],
};

// Yêu cầu quyền truy cập vào camera và microphone
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;

        // Lấy track video để điều khiển sau này
        videoTrack = localStream.getVideoTracks()[0];

        // Khởi tạo cuộc gọi sau khi localStream đã sẵn sàng
        startCall();
    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

// Tạo kết nối peer-to-peer và thiết lập các sự kiện liên quan
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Khi ICE candidate được tìm thấy, gửi nó đến server
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            socket.emit('candidate', candidate);
        }
    };

    // Khi kết nối được thiết lập, stream video từ người khác sẽ được hiển thị
    peerConnection.ontrack = (event) => {
        if (!remoteStream) {
            remoteStream = new MediaStream();
            remoteVideo.srcObject = remoteStream;
        }
        remoteStream.addTrack(event.track);
    };

    // Kiểm tra xem localStream đã sẵn sàng chưa trước khi thêm các track
    if (localStream) {
        localStream.getTracks().forEach(track => {
            // Thêm track vào peer connection và lưu lại sender để quản lý track sau này
            videoSender = peerConnection.addTrack(track, localStream);
        });
    } else {
        console.error('localStream is not initialized yet.');
    }
}

// Khởi tạo kết nối và gửi offer
async function startCall() {
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer);
}

// Xử lý việc tắt/mở microphone
toggleMicButton.addEventListener('click', () => {
    isMicEnabled = !isMicEnabled;
    localStream.getAudioTracks()[0].enabled = isMicEnabled;
    toggleMicButton.textContent = isMicEnabled ? 'Tắt Mic' : 'Bật Mic';
});

// Xử lý việc tắt/mở camera
toggleCameraButton.addEventListener('click', () => {
    if (isCameraEnabled) {
        // Dừng track video hoàn toàn để tắt camera vật lý
        if (videoTrack) {
            videoTrack.stop();
        }

        // Xóa track video cũ khỏi peer connection
        if (videoSender) {
            peerConnection.removeTrack(videoSender);
        }

        toggleCameraButton.textContent = 'Bật Camera';
    } else {
        // Khi bật lại, yêu cầu quyền truy cập camera
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                // Lấy track video mới từ stream mới
                videoTrack = stream.getVideoTracks()[0];
                localStream.addTrack(videoTrack); // Thêm track vào local stream
                localVideo.srcObject = localStream;

                // Thêm track video mới vào peer connection
                videoSender = peerConnection.addTrack(videoTrack, localStream);
                toggleCameraButton.textContent = 'Tắt Camera';
            })
            .catch(error => {
                console.error('Error accessing camera to restart video.', error);
            });
    }

    isCameraEnabled = !isCameraEnabled;
});
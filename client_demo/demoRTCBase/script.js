const toggleChatButton = document.getElementById('toggle-chat-button');
const chatPanel = document.getElementById('chat-panel');
const videoGridWrapper = document.getElementById('video-grid-wrapper');
const videoGrid = document.getElementById('video-grid');
const chatPanelClose = document.getElementById('chat-panel-close');

toggleChatButton.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
    toggleChatButton.classList.toggle('active');
    videoGridWrapper.classList.toggle('chat-open');
});

chatPanelClose.addEventListener('click', () => {
    chatPanel.classList.remove('open');
    toggleChatButton.classList.remove('active');
    videoGridWrapper.classList.remove('chat-open');
});

// Thêm sự kiện cho việc double click để pin video
document.querySelectorAll('.video-wrapper').forEach(e => {
    e.addEventListener('dblclick', () => {
        e.classList.toggle('pin');
        // Nếu video được pin, đưa nó lên đầu
        if (e.classList.contains('pin')) {
            videoGridWrapper.prepend(e);  // Di chuyển phần tử lên đầu
        } else {
            videoGrid.appendChild(e); // Đưa phần tử về cuối
        }
        videoGridWrapper.scrollTop = 0;
    });
});

// setInterval(() => {
//     document.querySelector('.video-wrapper').classList.add('on-voice');
//     setTimeout(() => document.querySelector('.video-wrapper').classList.remove('on-voice'), 500);
// }, 1000);
const toggleChatButton = document.getElementById('toggle-chat-button');
const chatPanel = document.getElementById('chat-panel');
const videoGridWrapper = document.getElementById('video-grid-wrapper');
const videoGrid = document.getElementById('video-grid');
const chatPanelClose = document.getElementById('chat-panel-close');

toggleChatButton.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
    toggleChatButton.classList.toggle('active');
});

chatPanelClose.addEventListener('click', () => {
    chatPanel.classList.remove('open');
    toggleChatButton.classList.remove('active');
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

const chatContainer = document.getElementById('chat-content');
const chatForm = document.getElementById('chat-form');
const userOutput = document.getElementById('chat-text');
const sendButton = document.getElementById('chat-send');

sendButton.addEventListener('click', onSendMessage);
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    onSendMessage();
})

function onSendMessage() {
    sendMessage(userOutput.value);
    userOutput.value = null;
}

function sendMessage(message) {
    const box = document.createElement('div');
    box.className = 'message outgoing';
    box.textContent = message;
    chatContainer.appendChild(box);
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth"
    });
}

function receiveMessage(message, sender) {
    const box = document.createElement('div');
    box.className = 'message incoming';
    box.textContent = message;
    box.setAttribute('sender', sender);
    chatContainer.appendChild(box);
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth"
    });
}
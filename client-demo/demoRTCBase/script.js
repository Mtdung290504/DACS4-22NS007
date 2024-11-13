const toggleChatButton = document.getElementById('toggle-chat-button');
const chatPanel = document.getElementById('chat-panel');
const videoGridWrapper = document.getElementById('video-grid-wrapper');
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

document.querySelectorAll('.video-wrapper').forEach(e => e.addEventListener('dblclick', () => {
    e.classList.toggle('pin');
}))
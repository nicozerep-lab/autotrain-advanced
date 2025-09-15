document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let activeModel = 'gpt-5';
    let activeView = 'chat';
    let activeCreationType = 'image';
    let currentChatId = null;
    let isLoggedIn = document.getElementById('username-display') !== null;

    // --- DOM ELEMENTS ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.main-view');
    const modelItems = document.querySelectorAll('.model-item');

    // Auth
    const authModal = document.getElementById('auth-modal');
    const loginModalBtn = document.getElementById('login-modal-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.createElement('a');
    switchToLogin.href = '#';
    switchToLogin.textContent = 'Login here';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authError = document.getElementById('auth-error');
    const modalTitle = document.getElementById('modal-title');
    const modalSubtitle = document.getElementById('modal-subtitle');

    // Chat
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatHistoryList = document.getElementById('chat-history-list');
    const newChatBtn = document.getElementById('new-chat-btn');

    // Create
    const creationTypeBtns = document.querySelectorAll('.option-btn');
    const creationPrompt = document.getElementById('creation-prompt');
    const createGenerateBtn = document.getElementById('create-generate-btn');
    const creationOutput = document.getElementById('creation-output');

    // --- INITIALIZATION ---
    if (isLoggedIn) {
        loadChatHistory();
    }

    // --- AUTHENTICATION LOGIC ---
    function toggleAuthForm() {
        if (loginForm.style.display === 'none') {
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            modalTitle.textContent = 'Login';
            modalSubtitle.innerHTML = `Don't have an account? <a href="#" id="switch-to-register">Register here</a>.`;
            document.getElementById('switch-to-register').addEventListener('click', toggleAuthForm);
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
            modalTitle.textContent = 'Register';
            modalSubtitle.innerHTML = `Already have an account? <a href="#" id="switch-to-login">Login here</a>.`;
            document.getElementById('switch-to-login').addEventListener('click', toggleAuthForm);
        }
        authError.textContent = '';
    }

    if(switchToRegister) switchToRegister.addEventListener('click', toggleAuthForm);
    if(loginModalBtn) loginModalBtn.addEventListener('click', () => authModal.classList.add('show-modal'));

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            window.location.reload();
        } else {
            authError.textContent = data.error || 'Login failed.';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            window.location.reload();
        } else {
            authError.textContent = data.error || 'Registration failed.';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.reload();
        });
    }

    // --- CHAT HISTORY LOGIC ---
    async function loadChatHistory() {
        if (!isLoggedIn) return;
        const response = await fetch('/api/chats');
        const chats = await response.json();
        chatHistoryList.innerHTML = '';
        chats.forEach(chat => {
            const li = document.createElement('li');
            li.classList.add('chat-history-item');
            li.dataset.chatId = chat.id;
            li.textContent = chat.title;
            li.addEventListener('click', () => loadChat(chat.id));
            chatHistoryList.appendChild(li);
        });
    }

    async function loadChat(chatId) {
        currentChatId = chatId;
        // Highlight active chat
        document.querySelectorAll('.chat-history-item').forEach(item => {
            item.classList.toggle('active', item.dataset.chatId == chatId);
        });

        const response = await fetch(`/api/chats/${chatId}/messages`);
        const messages = await response.json();
        chatMessages.innerHTML = '';
        messages.forEach(msg => appendMessage(msg.role, msg.content));
    }

    newChatBtn.addEventListener('click', () => {
        currentChatId = null;
        chatMessages.innerHTML = '';
        appendMessage('bot', 'New chat started. What would you like to talk about?');
        document.querySelectorAll('.chat-history-item').forEach(item => item.classList.remove('active'));
    });


    // --- CORE CHAT FUNCTIONALITY ---
    const sendChatMessage = async () => {
        const prompt = promptInput.value.trim();
        if (!prompt || !isLoggedIn) return;

        appendMessage('user', prompt);
        promptInput.value = '';
        promptInput.style.height = 'auto';
        appendMessage('bot', '...', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: activeModel, chat_id: currentChatId })
            });

            if (!response.ok) throw new Error((await response.json()).error);

            const data = await response.json();
            updateBotMessage(data.response);
            if (data.new_chat_title) {
                currentChatId = data.chat_id;
                loadChatHistory(); // Refresh history
            }
        } catch (error) {
            updateBotMessage(`Sorry, an error occurred: ${error.message}`);
        }
    };

    // --- EVENT LISTENERS ---
    generateBtn.addEventListener('click', sendChatMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // ... (rest of the event listeners and helper functions from the original file)

    // --- VIEW NAVIGATION ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.dataset.target;
            if (targetView === activeView) return;
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            views.forEach(view => view.classList.remove('active-view'));
            document.getElementById(`${targetView}-section`).classList.add('active-view');
            activeView = targetView;
        });
    });

    // --- MODEL SELECTION ---
    modelItems.forEach(item => {
        item.addEventListener('click', () => {
            activeModel = item.dataset.model;
            modelItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // --- DYNAMIC TEXTAREA RESIZING ---
    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = `${promptInput.scrollHeight}px`;
    });

    // --- MESSAGE UI HELPERS ---
    function appendMessage(role, content, isThinking = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        const avatar = document.createElement('div');
        avatar.classList.add('message-avatar');
        avatar.textContent = role === 'user' ? 'U' : 'N';
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        if (isThinking) {
            contentDiv.classList.add('message-thinking');
            contentDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            contentDiv.textContent = content;
        }
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function updateBotMessage(newContent) {
        const thinkingMessage = document.querySelector('.message-content.message-thinking');
        if (thinkingMessage) {
            thinkingMessage.innerHTML = '';
            thinkingMessage.textContent = newContent;
            thinkingMessage.classList.remove('message-thinking');
        }
    }

    // --- CREATION FUNCTIONALITY ---
    creationTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            creationTypeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCreationType = btn.dataset.creation;
            creationOutput.innerHTML = '';
        });
    });

    createGenerateBtn.addEventListener('click', async () => {
        const prompt = creationPrompt.value.trim();
        if (!prompt) return;

        creationOutput.innerHTML = '<p>Generando, por favor espera...</p>';
        let endpoint = '';
        let payload = {};

        if (activeCreationType === 'image') {
            endpoint = '/api/generate-image';
            payload = { prompt };
        } else if (activeCreationType === 'video') {
            endpoint = '/api/generate-video';
            payload = { prompt };
        } else if (activeCreationType === 'audio') {
            endpoint = '/api/text-to-speech';
            payload = { text: prompt };
        } else {
            return;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate content');
            }

            // Handle different content types
            if (activeCreationType === 'image') {
                const data = await response.json();
                creationOutput.innerHTML = `<img src="${data.image_url}" alt="Generated Image">`;
            } else if (activeCreationType === 'video') {
                const data = await response.json();
                creationOutput.innerHTML = `<p>Video generation started (Operation ID: ${data.id}). Check status separately.</p>`;
            } else if (activeCreationType === 'audio') {
                const blob = await response.blob();
                const audioUrl = URL.createObjectURL(blob);
                creationOutput.innerHTML = `<audio controls src="${audioUrl}"></audio>`;
            }

        } catch (error) {
            console.error('Creation API error:', error);
            creationOutput.innerHTML = `<p>Error al generar: ${error.message}</p>`;
        }
    });
});

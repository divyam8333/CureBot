// Simple Chat UI with localStorage persistence and mock assistant streaming
(() => {
  const els = {
    sidebar: document.getElementById('sidebar'),
    openSidebarBtn: document.getElementById('openSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('historyList'),
    historySearch: document.getElementById('historySearch'),
    renameChatBtn: document.getElementById('renameChatBtn'),
    deleteChatBtn: document.getElementById('deleteChatBtn'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    chatTitle: document.getElementById('chatTitle'),
    fileBadge: document.getElementById('fileBadge'),
    fileCount: document.getElementById('fileCount'),
    messages: document.getElementById('messages'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    stopBtn: document.getElementById('stopBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    attachments: document.getElementById('attachments'),
    composer: document.getElementById('composer'),
    dropzone: document.getElementById('dropzone'),
    toggleDropzone: document.getElementById('toggleDropzone'),
    toast: document.getElementById('toast'),
  };

  // State
  let chats = loadJSON('chats-v1') || [];
  let currentChatId = loadJSON('current-chat-id') || null;
  let isStreaming = false;
  let streamTimer = null;

  initTheme();
  ensureDefaultChat();
  renderHistory();
  openChat(currentChatId);

  // === Event Listeners ===
  els.openSidebarBtn.addEventListener('click', () => els.sidebar.classList.add('open'));
  els.closeSidebarBtn.addEventListener('click', () => els.sidebar.classList.remove('open'));

  els.newChatBtn.addEventListener('click', () => {
    const id = createChat();
    renderHistory();
    openChat(id);
    showToast('New chat started');
  });

  els.historySearch.addEventListener('input', () => renderHistory(els.historySearch.value));

  els.renameChatBtn.addEventListener('click', () => {
    const chat = getCurrentChat();
    if (!chat) return;
    const name = prompt('Rename chat:', chat.title || 'Untitled chat');
    if (name !== null) {
      chat.title = name.trim() || chat.title;
      persist();
      renderHeader();
      renderHistory();
    }
  });

  els.deleteChatBtn.addEventListener('click', () => {
    const chat = getCurrentChat();
    if (!chat) return;
    if (!confirm('Delete this chat?')) return;
    chats = chats.filter(c => c.id !== chat.id);
    if (!chats.length) createChat();
    currentChatId = chats[chats.length - 1].id;
    persist();
    renderHistory();
    openChat(currentChatId);
    showToast('Chat deleted');
  });

  els.themeToggle.addEventListener('click', toggleTheme);

  els.sendBtn.addEventListener('click', onSend);
  els.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });
  autoResizeTextarea(els.userInput);

  els.uploadBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  ['dragover', 'dragenter'].forEach(evt =>
    els.composer.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.hidden = false;
      els.dropzone.style.borderColor = 'var(--accent)';
    })
  );
  ['dragleave', 'dragend', 'drop'].forEach(evt =>
    els.composer.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === 'drop') {
        handleFiles(e.dataTransfer.files);
      }
      els.dropzone.style.borderColor = 'var(--border)';
      if (!attachmentsForCurrent().length) els.dropzone.hidden = true;
    })
  );

  els.toggleDropzone.addEventListener('click', () => {
    els.dropzone.hidden = !els.dropzone.hidden;
  });

  els.stopBtn.addEventListener('click', stopStream);

  // === Functions ===
  function ensureDefaultChat() {
    if (!chats.length) {
      const id = createChat();
      currentChatId = id;
      persist();
    } else if (!currentChatId) {
      currentChatId = chats[0].id;
    }
  }

  function createChat() {
    const id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const chat = {
      id,
      title: 'New chat',
      createdAt: Date.now(),
      messages: [],
      files: [] // {name, size, type}
    };
    chats.unshift(chat);
    currentChatId = id;
    persist();
    return id;
  }

  function getCurrentChat() {
    return chats.find(c => c.id === currentChatId);
  }

  function persist() {
    saveJSON('chats-v1', chats);
    saveJSON('current-chat-id', currentChatId);
  }

  function renderHistory(filter = '') {
    const q = filter.trim().toLowerCase();
    els.historyList.innerHTML = '';
    chats
      .filter(c => !q || (c.title || '').toLowerCase().includes(q))
      .forEach(c => {
        const item = document.createElement('button');
        item.className = 'history-item' + (c.id === currentChatId ? ' active' : '');
        item.setAttribute('role', 'option');
        item.innerHTML = `
          <div class="icon">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
          <div class="title" title="${escapeHtml(c.title || 'Untitled chat')}">${escapeHtml(c.title || 'Untitled chat')}</div>
          <div class="time">${new Date(c.createdAt).toLocaleDateString()}</div>
        `;
        item.addEventListener('click', () => {
          currentChatId = c.id;
          persist();
          renderHistory(q);
          openChat(c.id);
          if (window.innerWidth <= 980) els.sidebar.classList.remove('open');
        });
        els.historyList.appendChild(item);
      });
  }

  function openChat(id) {
    currentChatId = id;
    const chat = getCurrentChat();
    if (!chat) return;
    renderHeader();
    renderMessages();
    renderAttachments();
    scrollToBottom();
  }

  function renderHeader() {
    const chat = getCurrentChat();
    if (!chat) return;
    const titleFallback = chat.messages.find(m => m.role === 'user')?.content?.slice(0, 40) || 'New chat';
    els.chatTitle.textContent = chat.title && chat.title !== 'New chat' ? chat.title : titleFallback;
    if (chat.files.length) {
      els.fileBadge.hidden = false;
      els.fileCount.textContent = chat.files.length;
    } else {
      els.fileBadge.hidden = true;
    }
  }

  function renderMessages() {
    const chat = getCurrentChat();
    els.messages.innerHTML = '';
    chat.messages.forEach((m, idx) => {
      const row = messageRow(m, idx);
      els.messages.appendChild(row);
    });
  }

  function messageRow(message, index) {
    const row = document.createElement('div');
    row.className = 'message-row';
    const isUser = message.role === 'user';
    const avatar = document.createElement('div');
    avatar.className = 'avatar ' + (isUser ? 'user' : 'assistant');
    avatar.innerHTML = isUser ? '🧑' : '🤖';
    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (isUser ? ' user' : '');
    bubble.innerHTML = `<div class="content">${richify(message.content)}</div>
                        <div class="meta">${new Date(message.ts || Date.now()).toLocaleTimeString()}</div>`;
    const tools = document.createElement('div');
    tools.className = 'tools';
    const copy = document.createElement('button');
    copy.className = 'copy-btn' + (isUser ? '' : ' light');
    copy.title = 'Copy';
    copy.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 9h10v10H9z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15H4V4h11v1" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(message.content).then(() => showToast('Copied'));
    });
    tools.appendChild(copy);
    bubble.appendChild(tools);
    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  function renderAttachments() {
    const files = attachmentsForCurrent();
    els.attachments.innerHTML = '';
    if (!files.length) {
      els.attachments.hidden = true;
      return;
    }
    els.attachments.hidden = false;
    files.forEach((f, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6" stroke="currentColor" stroke-width="2" fill="none"/></svg>
        <span>${escapeHtml(f.name)}</span>
        <span class="muted">(${humanSize(f.size)})</span>
      `;
      const remove = document.createElement('button');
      remove.className = 'remove icon-btn';
      remove.title = 'Remove';
      remove.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
      remove.addEventListener('click', () => {
        const chat = getCurrentChat();
        chat.files.splice(idx, 1);
        persist();
        renderAttachments();
        renderHeader();
      });
      chip.appendChild(remove);
      els.attachments.appendChild(chip);
    });
  }

  function onSend() {
    if (isStreaming) return;
    const text = els.userInput.value.trim();
    if (!text && !attachmentsForCurrent().length) {
      showToast('Type a message or attach a file');
      return;
    }
    const chat = getCurrentChat();

    // Add user message
    chat.messages.push({ role: 'user', content: text || '(sent with attachments)', ts: Date.now() });
    if (!chat.title || chat.title === 'New chat') {
      chat.title = text.slice(0, 40) || 'Chat with attachments';
    }

    persist();
    renderHeader();
    renderMessages();
    els.userInput.value = '';
    autoResizeTextarea(els.userInput, true);

    // Simulate bot typing and streaming
    simulateAssistantReply(text);
    scrollToBottom();
  }

  function simulateAssistantReply(promptText) {
    const chat = getCurrentChat();
    const contextNote = chat.files.length
      ? `I also see you attached ${chat.files.length} file${chat.files.length > 1 ? 's' : ''}: ${chat.files.slice(0,3).map(f => f.name).join(', ')}.`
      : '';
    const reply = mockAssistant(promptText, contextNote);

    const assistantMsg = { role: 'assistant', content: '', ts: Date.now() };
    chat.messages.push(assistantMsg);
    persist();
    renderMessages();
    scrollToBottom();

    // Streaming
    isStreaming = true;
    els.stopBtn.hidden = false;
    els.sendBtn.disabled = true;

    const tokens = tokenize(reply);
    let i = 0;
    streamTimer = setInterval(() => {
      if (i >= tokens.length) {
        stopStream(true);
        return;
      }
      assistantMsg.content += tokens[i++];
      updateLastAssistantBubble(assistantMsg.content);
      scrollToBottom();
    }, 25);
  }

  function stopStream(completed = false) {
    if (streamTimer) clearInterval(streamTimer);
    isStreaming = false;
    els.stopBtn.hidden = true;
    els.sendBtn.disabled = false;
    if (!completed) showToast('Generation stopped');
  }

  function updateLastAssistantBubble(content) {
    const bubbles = els.messages.querySelectorAll('.message-row .bubble');
    if (!bubbles.length) return;
    const lastBubble = bubbles[bubbles.length - 1];
    const contentDiv = lastBubble.querySelector('.content');
    contentDiv.innerHTML = richify(content) + typingDots();
  }

  function typingDots() {
    return `<span class="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
  }

  function finalizeLastAssistantBubble() {
    const bubbles = els.messages.querySelectorAll('.message-row .bubble');
    if (!bubbles.length) return;
    const last = bubbles[bubbles.length - 1];
    const contentDiv = last.querySelector('.content');
    contentDiv.innerHTML = contentDiv.innerHTML.replace(typingDots(), '');
  }

  function tokenize(text) {
    // Simple tokenization for streaming
    return text.split(/(\s+)/); // keep spaces
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const chat = getCurrentChat();

    for (const f of files) {
      // Only store metadata to avoid large localStorage usage
      chat.files.push({ name: f.name, size: f.size, type: f.type });
    }
    persist();
    renderAttachments();
    renderHeader();
    showToast(`${files.length} file(s) attached`);
  }

  function attachmentsForCurrent() {
    const chat = getCurrentChat();
    return chat ? chat.files : [];
  }

  function renderThemeIcon(mode) {
    const isDark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    els.themeIcon.innerHTML = isDark
      ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="none" stroke="currentColor" stroke-width="2" />'
      : '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" />';
  }

  function initTheme() {
    const saved = localStorage.getItem('theme-mode') || 'system';
    document.documentElement.setAttribute('data-theme', saved);
    renderThemeIcon(saved);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderThemeIcon(localStorage.getItem('theme-mode') || 'system'));
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'system';
    const next = current === 'dark' ? 'system' : current === 'system' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme-mode', next);
    renderThemeIcon(next);
  }

  function autoResizeTextarea(ta, reset = false) {
    const resize = () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
    };
    if (reset) {
      ta.style.height = 'auto';
    } else {
      ta.addEventListener('input', resize);
      resize();
    }
  }

  function richify(text) {
    const escaped = escapeHtml(text || '');
    // Basic markdown-ish formatting: code ticks and links
    const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    const withLinks = withCode.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return withLinks.replace(/\n/g, '<br/>');
  }

  function showToast(msg, timeout = 1600) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), timeout);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      els.messages.scrollTop = els.messages.scrollHeight + 1000;
    });
  }

  function openChatById(id) {
    currentChatId = id;
    persist();
    openChat(id);
    renderHistory();
  }

  // Helper: Save/Load
  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('localStorage save failed', e); }
  }
  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  function humanSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Mock assistant brain
  function mockAssistant(promptText, contextNote) {
    const prefix = "Here's a helpful response:";
    const hints = [
      "I can summarize, explain, or provide examples.",
      "Use Shift+Enter for a newline.",
      "You can attach documents using the button or drag-and-drop.",
      "Click the sun/moon icon to toggle themes."
    ];
    let reply = `${prefix}\n\n`;
    if (promptText) {
      reply += `You said: "${promptText}".\n`;
    }
    if (contextNote) {
      reply += contextNote + "\n";
    }
    reply += "\n";
    reply += "• Tip: Ask me to outline, brainstorm, or generate step-by-step guides.\n";
    reply += "• Tip: Click the copy icon on any message to copy it.\n";
    reply += "• Tip: Rename or delete chats from the top right.\n\n";
    reply += "Example: `Generate a project plan for a chatbot UI`.\n\n";
    reply += hints[Math.floor(Math.random() * hints.length)];
    return reply;
  }

  // Finalize bubble after stream stops/completes
  const observer = new MutationObserver(() => {
    if (!isStreaming) finalizeLastAssistantBubble();
  });
  observer.observe(els.messages, { childList: true, subtree: true });

  // Expose openChatById for debugging (optional)
  window.openChatById = openChatById;
})();
// ── State ──────────────────────────────────────────────────────────────────
let activePhone = null;
let prevEscalatedCount = 0;

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
    tab.classList.add('active');
    const content = document.getElementById('tab-' + tab.dataset.tab);
    content.classList.remove('hidden');
    content.classList.add('active');
    if (tab.dataset.tab === 'chats') loadConversations();
    if (tab.dataset.tab === 'calls') loadCalls();
    if (tab.dataset.tab === 'settings') loadSettings();
  });
});

// ── Knowledge Base ─────────────────────────────────────────────────────────
async function loadKnowledge() {
  const res = await fetch('/api/knowledge');
  const data = await res.json();
  document.getElementById('kb-text').value = data.text || '';
  if (data.updatedAt) {
    document.getElementById('kb-updated').textContent = 'Last saved: ' + new Date(data.updatedAt).toLocaleString();
  }
}

async function saveKnowledge() {
  const text = document.getElementById('kb-text').value;
  const res = await fetch('/api/knowledge', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (res.ok) {
    const data = await res.json();
    document.getElementById('kb-updated').textContent = 'Last saved: ' + new Date(data.updatedAt).toLocaleString();
    showToast('Knowledge base saved!');
  }
}

// ── Conversations ──────────────────────────────────────────────────────────
async function loadConversations() {
  const res = await fetch('/api/conversations');
  const convs = await res.json();

  const escalated = convs.filter(c => c.mode === 'escalated');
  const badge = document.getElementById('escalation-badge');
  if (escalated.length > 0) {
    badge.textContent = escalated.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  // Browser notification for new escalations
  if (escalated.length > prevEscalatedCount && prevEscalatedCount !== null) {
    if (Notification.permission === 'granted') {
      new Notification('Cucilab Assistant', { body: `${escalated.length} conversation(s) need your attention!` });
    }
  }
  prevEscalatedCount = escalated.length;

  const list = document.getElementById('chat-list');
  if (convs.length === 0) {
    list.innerHTML = '<p class="empty-state">No conversations yet.</p>';
    return;
  }

  list.innerHTML = convs.map(c => {
    const lastMsg = c.messages.length ? c.messages[c.messages.length - 1] : null;
    const preview = lastMsg ? lastMsg.content.substring(0, 60) : 'No messages';
    const modeClass = 'mode-' + c.mode;
    const modeLabel = { ai: 'AI', human: 'Human', escalated: 'Needs Attention' }[c.mode] || c.mode;
    return `<div class="chat-item ${c.mode === 'escalated' ? 'escalated' : ''} ${activePhone === c.phone ? 'active' : ''}"
                 onclick="openChat('${c.phone}')">
      <div class="chat-meta">
        <span class="chat-phone">${c.phone}</span>
        <span class="chat-mode ${modeClass}">${modeLabel}</span>
      </div>
      <div class="chat-preview">${preview}</div>
    </div>`;
  }).join('');

  // Refresh active chat if open
  if (activePhone) openChat(activePhone, false);
}

async function openChat(phone, scrollToBottom = true) {
  activePhone = phone;
  const res = await fetch('/api/conversations/' + phone);
  if (!res.ok) return;
  const conv = await res.json();

  const detail = document.getElementById('chat-detail');
  const modeLabel = { ai: 'AI Handling', human: 'You are handling', escalated: 'Needs Your Attention' }[conv.mode] || conv.mode;
  const isHuman = conv.mode === 'human';

  detail.innerHTML = `
    <div class="chat-header">
      <div>
        <h3>${phone}</h3>
        <small style="color:#5a6a8a">${modeLabel} — ${conv.messages.length} messages</small>
      </div>
      <div class="chat-actions">
        ${conv.mode !== 'human' ? `<button class="btn-danger" onclick="takeOver('${phone}')">Take Over</button>` : ''}
        ${conv.mode === 'human' ? `<button class="btn-secondary" onclick="handBack('${phone}')">Hand Back to AI</button>` : ''}
      </div>
    </div>
    <div class="messages" id="messages-${phone}">
      ${conv.messages.map(m => {
        const cls = m.sender === 'customer' ? 'msg-customer' : m.sender === 'owner' ? 'msg-owner' : 'msg-ai';
        const senderLabel = m.sender === 'customer' ? 'Customer' : m.sender === 'owner' ? 'You' : 'AI';
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
        return `<div class="msg ${cls}">
          ${m.content}
          <div class="msg-sender">${senderLabel}</div>
          <div class="msg-time">${time}</div>
        </div>`;
      }).join('')}
    </div>
    ${isHuman ? `
    <div class="reply-box">
      <input type="text" id="reply-input" placeholder="Type your reply..." onkeydown="if(event.key==='Enter') sendReply('${phone}')" />
      <button class="btn-primary" onclick="sendReply('${phone}')">Send</button>
    </div>` : ''}
  `;

  if (scrollToBottom) {
    const msgs = document.getElementById('messages-' + phone);
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
}

async function takeOver(phone) {
  await fetch('/api/conversations/' + phone + '/mode', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'human' })
  });
  loadConversations();
  openChat(phone);
}

async function handBack(phone) {
  await fetch('/api/conversations/' + phone + '/mode', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'ai' })
  });
  loadConversations();
  openChat(phone);
}

async function sendReply(phone) {
  const input = document.getElementById('reply-input');
  const text = input.value.trim();
  if (!text) return;
  const res = await fetch('/api/conversations/' + phone + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) { showToast('Failed to send message. Try again.'); return; }
  input.value = '';
  openChat(phone);
}

// ── Calls ──────────────────────────────────────────────────────────────────
async function loadCalls() {
  const res = await fetch('/api/calls');
  const calls = await res.json();

  const followups = calls.filter(c => c.follow_up_required);
  const badge = document.getElementById('followup-badge');
  if (followups.length > 0) {
    badge.textContent = followups.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const wrap = document.getElementById('calls-table-wrap');
  if (!calls.length) {
    wrap.innerHTML = '<p class="empty-state">No calls recorded yet. Send a test call above or wait for a real Vapi call.</p>';
    return;
  }

  wrap.innerHTML = `
    <div class="calls-table-scroll">
      <table class="calls-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Caller</th>
            <th>Phone</th>
            <th>Location</th>
            <th>Service</th>
            <th>Intent</th>
            <th>Follow-up</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          ${calls.map(c => `
            <tr>
              <td style="white-space:nowrap">${new Date(c.created_at).toLocaleString()}</td>
              <td>${c.caller_name || '—'}</td>
              <td>${c.caller_phone || '—'}</td>
              <td>${c.location || '—'}</td>
              <td><span class="service-tag">${(c.service_requested || '—').replace(/_/g, ' ')}</span></td>
              <td><span class="intent-tag intent-${c.call_intent}">${(c.call_intent || '—').replace(/_/g, ' ')}</span></td>
              <td style="text-align:center">${c.follow_up_required ? '<span class="followup-yes">Yes</span>' : '<span class="followup-no">No</span>'}</td>
              <td class="summary-cell">${c.summary || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

async function sendTestCall() {
  const payload = {
    message: {
      type: 'end-of-call-report',
      durationSeconds: 87,
      recordingUrl: '',
      call: {
        id: 'test_' + Date.now(),
        customer: { number: document.getElementById('t-phone').value }
      },
      analysis: {
        summary: `${document.getElementById('t-name').value} called about ${document.getElementById('t-service').value.replace(/_/g,' ')} in ${document.getElementById('t-location').value}. ${document.getElementById('t-notes').value}`,
        successEvaluation: 'true',
        structuredData: {
          caller_name: document.getElementById('t-name').value,
          caller_phone: document.getElementById('t-phone').value,
          location: document.getElementById('t-location').value,
          service_requested: document.getElementById('t-service').value,
          service_details: document.getElementById('t-details').value,
          preferred_date: document.getElementById('t-date').value,
          call_intent: document.getElementById('t-intent').value,
          urgency: 'normal',
          follow_up_required: document.getElementById('t-intent').value === 'booking' || document.getElementById('t-intent').value === 'callback_request',
          notes: document.getElementById('t-notes').value
        }
      }
    }
  };

  const res = await fetch('/api/vapi/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    showToast('Test call sent!');
    loadCalls();
  } else {
    showToast('Failed to send test call.');
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
async function loadSettings() {
  const res = await fetch('/api/settings');
  const s = await res.json();
  document.getElementById('s-phone-number-id').value = s.phoneNumberId || '';
  document.getElementById('s-access-token').value = s.accessToken || '';
  document.getElementById('s-verify-token').value = s.verifyToken || '';
  document.getElementById('s-claude-api-key').value = s.claudeApiKey || '';
  document.getElementById('s-escalation-triggers').value = s.escalationTriggers || '';
  document.getElementById('s-owner-phone').value = s.ownerPhone || '';
  document.getElementById('s-ai-paused').checked = s.aiPaused || false;
  document.getElementById('webhook-url').textContent = window.location.origin + '/webhook';
}

async function saveSettings() {
  const body = {
    phoneNumberId: document.getElementById('s-phone-number-id').value,
    accessToken: document.getElementById('s-access-token').value,
    verifyToken: document.getElementById('s-verify-token').value,
    claudeApiKey: document.getElementById('s-claude-api-key').value,
    escalationTriggers: document.getElementById('s-escalation-triggers').value,
    ownerPhone: document.getElementById('s-owner-phone').value,
    aiPaused: document.getElementById('s-ai-paused').checked
  };
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) showToast('Settings saved!');
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px', background: '#1B2A6B',
    color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '600',
    fontSize: '0.88rem', zIndex: 9999, opacity: '0', transition: 'opacity 0.3s'
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Notification permission ────────────────────────────────────────────────
if (Notification.permission === 'default') Notification.requestPermission();

// ── Init ───────────────────────────────────────────────────────────────────
loadKnowledge();
setInterval(loadConversations, 5000); // Poll every 5 seconds

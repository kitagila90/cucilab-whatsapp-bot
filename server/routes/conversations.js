const express = require('express');
const { getAllConversations, getConversation, upsertConversation, getSettings } = require('../db');
const { sendMessage } = require('../whatsapp');

function createConversationsRouter(db) {
  const router = express.Router();

  router.get('/conversations', (req, res) => {
    res.json(getAllConversations(db));
  });

  router.get('/conversations/:phone', (req, res) => {
    const conv = getConversation(db, req.params.phone);
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json(conv);
  });

  router.patch('/conversations/:phone/mode', (req, res) => {
    const { mode } = req.body;
    if (!['ai', 'human', 'escalated'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be ai, human, or escalated' });
    }
    const conv = getConversation(db, req.params.phone);
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const updated = upsertConversation(db, req.params.phone, {
      mode,
      escalated: mode === 'escalated',
      escalationReason: mode !== 'escalated' ? '' : conv.escalationReason
    });
    res.json(updated);
  });

  router.post('/conversations/:phone/messages', async (req, res) => {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    const conv = getConversation(db, req.params.phone);
    if (!conv) return res.status(404).json({ error: 'Not found' });

    const settings = getSettings(db);
    await sendMessage(settings.phoneNumberId, settings.accessToken, req.params.phone, text);

    const ownerMsg = { role: 'assistant', content: text, sender: 'owner', timestamp: new Date().toISOString() };
    const updated = upsertConversation(db, req.params.phone, { messages: [...conv.messages, ownerMsg] });
    res.json(updated);
  });

  return router;
}

module.exports = { createConversationsRouter };

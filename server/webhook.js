const express = require('express');
const { getSettings, getKnowledgeBase, getConversation, upsertConversation } = require('./db');
const { generateReply } = require('./ai');
const { sendMessage } = require('./whatsapp');

function shouldEscalate(messageText, escalationTriggers) {
  const lower = messageText.toLowerCase();
  const triggers = escalationTriggers.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  if (triggers.some(t => lower.includes(t))) {
    return { escalate: true, reason: 'Trigger word detected' };
  }
  const humanPhrases = ['speak to human', 'talk to human', 'real person', 'cakap dengan orang', 'manusia', 'staf'];
  if (humanPhrases.some(p => lower.includes(p))) {
    return { escalate: true, reason: 'Customer requested human' };
  }
  return { escalate: false, reason: '' };
}

function createWebhookRouter(db) {
  const router = express.Router();

  router.get('/webhook', (req, res) => {
    const settings = getSettings(db);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === settings.verifyToken) {
      return res.status(200).send(challenge);
    }
    res.sendStatus(403);
  });

  router.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Always acknowledge Meta immediately

    try {
      const body = req.body;
      if (body.object !== 'whatsapp_business_account') return;

      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message || message.type !== 'text') return;

      const phone = message.from;
      const text = message.text.body;
      const settings = getSettings(db);

      const existing = getConversation(db, phone);
      const prevMessages = existing ? existing.messages : [];

      // Add customer message to history
      const customerMsg = { role: 'user', content: text, sender: 'customer', timestamp: new Date().toISOString() };
      const messages = [...prevMessages, customerMsg];

      // If already in human/escalated mode: store and wait for owner
      if (existing && (existing.mode === 'human' || existing.mode === 'escalated')) {
        upsertConversation(db, phone, { messages });
        return;
      }

      // Global AI pause
      if (settings.aiPaused) {
        upsertConversation(db, phone, { messages, mode: 'escalated', escalated: true, escalationReason: 'AI paused by owner' });
        return;
      }

      // Trigger word check
      const triggerCheck = shouldEscalate(text, settings.escalationTriggers);
      if (triggerCheck.escalate) {
        upsertConversation(db, phone, { messages, mode: 'escalated', escalated: true, escalationReason: triggerCheck.reason });
        return;
      }

      // Too many exchanges (>20 messages = >10 back-and-forth)
      if (messages.length > 20) {
        upsertConversation(db, phone, { messages, mode: 'escalated', escalated: true, escalationReason: 'Conversation too long without resolution' });
        return;
      }

      // Call Claude AI
      const kb = getKnowledgeBase(db);
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const aiResult = await generateReply(settings.claudeApiKey, kb.text, history);

      if (aiResult.escalate) {
        upsertConversation(db, phone, { messages, mode: 'escalated', escalated: true, escalationReason: aiResult.reason });
        return;
      }

      // Send reply to customer
      await sendMessage(settings.phoneNumberId, settings.accessToken, phone, aiResult.reply);
      const replyMsg = { role: 'assistant', content: aiResult.reply, sender: 'ai', timestamp: new Date().toISOString() };
      upsertConversation(db, phone, { messages: [...messages, replyMsg], mode: 'ai', escalated: false, escalationReason: '' });

    } catch (err) {
      console.error('Webhook processing error:', err.message);
    }
  });

  return router;
}

module.exports = { createWebhookRouter, shouldEscalate };

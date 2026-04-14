const { initDb, getKnowledgeBase, updateKnowledgeBase, getConversation, upsertConversation, getAllConversations, getSettings, updateSettings } = require('../server/db');

describe('db', () => {
  let db;
  beforeEach(() => { db = initDb(':memory:'); });
  afterEach(() => { db.close(); });

  describe('knowledge_base', () => {
    test('getKnowledgeBase returns empty text by default', () => {
      const kb = getKnowledgeBase(db);
      expect(kb.text).toBe('');
      expect(kb.updated_at).toBeDefined();
    });

    test('updateKnowledgeBase persists text', () => {
      updateKnowledgeBase(db, 'Cucilab offers sofa cleaning at RM150');
      const kb = getKnowledgeBase(db);
      expect(kb.text).toBe('Cucilab offers sofa cleaning at RM150');
    });
  });

  describe('conversations', () => {
    test('getConversation returns null for unknown phone', () => {
      expect(getConversation(db, '60123456789')).toBeNull();
    });

    test('upsertConversation creates a new conversation', () => {
      const conv = upsertConversation(db, '60123456789', {
        messages: [{ role: 'user', content: 'Hello', sender: 'customer', timestamp: '2026-04-15T10:00:00Z' }],
        mode: 'ai',
        escalated: false,
        escalationReason: ''
      });
      expect(conv.phone).toBe('60123456789');
      expect(conv.messages).toHaveLength(1);
      expect(conv.mode).toBe('ai');
      expect(conv.escalated).toBe(false);
    });

    test('upsertConversation updates an existing conversation', () => {
      upsertConversation(db, '60123456789', { messages: [], mode: 'ai', escalated: false, escalationReason: '' });
      const updated = upsertConversation(db, '60123456789', { mode: 'escalated', escalated: true, escalationReason: 'Trigger word' });
      expect(updated.mode).toBe('escalated');
      expect(updated.escalated).toBe(true);
      expect(updated.escalationReason).toBe('Trigger word');
    });

    test('getAllConversations returns all sorted by updated_at desc', () => {
      upsertConversation(db, '601', { messages: [], mode: 'ai', escalated: false, escalationReason: '' });
      upsertConversation(db, '602', { messages: [], mode: 'human', escalated: false, escalationReason: '' });
      const all = getAllConversations(db);
      expect(all).toHaveLength(2);
    });
  });

  describe('settings', () => {
    test('getSettings returns defaults', () => {
      const s = getSettings(db);
      expect(s.verifyToken).toBe('cucilab_verify');
      expect(s.aiPaused).toBe(false);
      expect(s.escalationTriggers).toContain('complaint');
    });

    test('updateSettings persists changes', () => {
      updateSettings(db, { phoneNumberId: '12345', claudeApiKey: 'sk-ant-test' });
      const s = getSettings(db);
      expect(s.phoneNumberId).toBe('12345');
      expect(s.claudeApiKey).toBe('sk-ant-test');
    });
  });
});

const request = require('supertest');
const express = require('express');
const { initDb, upsertConversation } = require('../../server/db');
const { createConversationsRouter } = require('../../server/routes/conversations');

jest.mock('../../server/whatsapp', () => ({
  sendMessage: jest.fn().mockResolvedValue({})
}));

function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api', createConversationsRouter(db));
  return app;
}

describe('GET /api/conversations', () => {
  test('returns empty array when no conversations', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).get('/api/conversations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    db.close();
  });

  test('returns list of conversations', async () => {
    const db = initDb(':memory:');
    upsertConversation(db, '60111', { messages: [], mode: 'ai', escalated: false, escalationReason: '' });
    const res = await request(buildApp(db)).get('/api/conversations');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].phone).toBe('60111');
    db.close();
  });
});

describe('GET /api/conversations/:phone', () => {
  test('returns 404 for unknown phone', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).get('/api/conversations/60999');
    expect(res.status).toBe(404);
    db.close();
  });

  test('returns conversation by phone', async () => {
    const db = initDb(':memory:');
    upsertConversation(db, '60111', { messages: [], mode: 'escalated', escalated: true, escalationReason: 'Trigger' });
    const res = await request(buildApp(db)).get('/api/conversations/60111');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('escalated');
    db.close();
  });
});

describe('PATCH /api/conversations/:phone/mode', () => {
  test('updates conversation mode to human', async () => {
    const db = initDb(':memory:');
    upsertConversation(db, '60111', { messages: [], mode: 'escalated', escalated: true, escalationReason: 'x' });
    const res = await request(buildApp(db)).patch('/api/conversations/60111/mode').send({ mode: 'human' });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('human');
    db.close();
  });

  test('returns 400 for invalid mode', async () => {
    const db = initDb(':memory:');
    upsertConversation(db, '60111', { messages: [], mode: 'ai', escalated: false, escalationReason: '' });
    const res = await request(buildApp(db)).patch('/api/conversations/60111/mode').send({ mode: 'banana' });
    expect(res.status).toBe(400);
    db.close();
  });
});

describe('POST /api/conversations/:phone/messages', () => {
  test('sends message and adds it to history', async () => {
    const db = initDb(':memory:');
    upsertConversation(db, '60111', { messages: [], mode: 'human', escalated: false, escalationReason: '' });
    const res = await request(buildApp(db)).post('/api/conversations/60111/messages').send({ text: 'Hi there!' });
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Hi there!');
    expect(res.body.messages[0].sender).toBe('owner');
    db.close();
  });

  test('returns 400 if text is empty', async () => {
    const db = initDb(':memory:');
    upsertConversation(db, '60111', { messages: [], mode: 'human', escalated: false, escalationReason: '' });
    const res = await request(buildApp(db)).post('/api/conversations/60111/messages').send({ text: '' });
    expect(res.status).toBe(400);
    db.close();
  });
});

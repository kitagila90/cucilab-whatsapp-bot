const request = require('supertest');
const express = require('express');
const { initDb } = require('../../server/db');
const { createKnowledgeRouter } = require('../../server/routes/knowledge');

function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api', createKnowledgeRouter(db));
  return app;
}

describe('GET /api/knowledge', () => {
  test('returns empty knowledge base by default', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).get('/api/knowledge');
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('');
    db.close();
  });
});

describe('PUT /api/knowledge', () => {
  test('updates and returns knowledge base', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).put('/api/knowledge').send({ text: 'Sofa: RM150' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Sofa: RM150');
    db.close();
  });

  test('returns 400 if text is missing', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).put('/api/knowledge').send({});
    expect(res.status).toBe(400);
    db.close();
  });
});

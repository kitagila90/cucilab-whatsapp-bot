const request = require('supertest');
const express = require('express');
const { initDb } = require('../../server/db');
const { createSettingsRouter } = require('../../server/routes/settings');

function buildApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/api', createSettingsRouter(db));
  return app;
}

describe('GET /api/settings', () => {
  test('returns default settings', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.verifyToken).toBe('cucilab_verify');
    expect(res.body.aiPaused).toBe(false);
    db.close();
  });
});

describe('PUT /api/settings', () => {
  test('updates and returns new settings', async () => {
    const db = initDb(':memory:');
    const res = await request(buildApp(db)).put('/api/settings').send({
      phoneNumberId: '123456',
      claudeApiKey: 'sk-ant-xyz',
      aiPaused: true
    });
    expect(res.status).toBe(200);
    expect(res.body.phoneNumberId).toBe('123456');
    expect(res.body.claudeApiKey).toBe('sk-ant-xyz');
    expect(res.body.aiPaused).toBe(true);
    db.close();
  });
});

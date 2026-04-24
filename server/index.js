require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');
const { createWebhookRouter } = require('./webhook');
const { createKnowledgeRouter } = require('./routes/knowledge');
const { createConversationsRouter } = require('./routes/conversations');
const { createSettingsRouter } = require('./routes/settings');
const { createVapiRouter } = require('./routes/vapi');

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/cucilab.db');

// Ensure data directory exists
const dataDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = initDb(DB_PATH);
const app = express();

app.use(express.json());

// WhatsApp webhook
app.use('/', createWebhookRouter(db));

// Health check — Railway uses this to verify the app is running
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Vapi call webhook + calls API
app.use('/api', createVapiRouter(db));

// Dashboard API
app.use('/api', createKnowledgeRouter(db));
app.use('/api', createConversationsRouter(db));
app.use('/api', createSettingsRouter(db));

// Serve dashboard static files
app.use(express.static(path.join(__dirname, '../dashboard')));

// Fallback — serve dashboard for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

app.listen(PORT, () => {
  console.log(`Cucilab WhatsApp Bot running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});

module.exports = app;

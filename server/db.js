const { DatabaseSync } = require('node:sqlite');

function initDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO knowledge_base (id, text, updated_at)
      VALUES (1, '', datetime('now'));

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      mode TEXT NOT NULL DEFAULT 'ai',
      escalated INTEGER NOT NULL DEFAULT 0,
      escalation_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT UNIQUE NOT NULL,
      caller_phone TEXT NOT NULL DEFAULT '',
      caller_name TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      service_requested TEXT NOT NULL DEFAULT '',
      service_details TEXT NOT NULL DEFAULT '',
      preferred_date TEXT NOT NULL DEFAULT '',
      preferred_time TEXT NOT NULL DEFAULT '',
      call_intent TEXT NOT NULL DEFAULT '',
      urgency TEXT NOT NULL DEFAULT 'normal',
      follow_up_required INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      success_evaluation TEXT NOT NULL DEFAULT '',
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      recording_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      phone_number_id TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL DEFAULT '',
      verify_token TEXT NOT NULL DEFAULT 'cucilab_verify',
      claude_api_key TEXT NOT NULL DEFAULT '',
      escalation_triggers TEXT NOT NULL DEFAULT 'complaint,refund,problem,tidak puas hati,kecewa',
      ai_paused INTEGER NOT NULL DEFAULT 0,
      owner_phone TEXT NOT NULL DEFAULT ''
    );
    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `);
  return db;
}

function getKnowledgeBase(db) {
  const row = { ...db.prepare('SELECT text, updated_at FROM knowledge_base WHERE id = 1').get() };
  return { text: row.text, updatedAt: row.updated_at };
}

function updateKnowledgeBase(db, text) {
  db.prepare("UPDATE knowledge_base SET text = ?, updated_at = datetime('now') WHERE id = 1").run(text);
}

function _rowToConversation(row) {
  if (!row) return null;
  const plain = { ...row };
  return {
    id: plain.id,
    phone: plain.phone,
    messages: JSON.parse(plain.messages),
    mode: plain.mode,
    escalated: Boolean(plain.escalated),
    escalationReason: plain.escalation_reason,
    created_at: plain.created_at,
    updated_at: plain.updated_at
  };
}

function getConversation(db, phone) {
  return _rowToConversation(db.prepare('SELECT * FROM conversations WHERE phone = ?').get(phone));
}

function upsertConversation(db, phone, data) {
  const now = new Date().toISOString();
  const existing = getConversation(db, phone);
  if (!existing) {
    db.prepare(`
      INSERT INTO conversations (phone, messages, mode, escalated, escalation_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      phone,
      JSON.stringify(data.messages || []),
      data.mode || 'ai',
      data.escalated ? 1 : 0,
      data.escalationReason || '',
      now, now
    );
  } else {
    db.prepare(`
      UPDATE conversations
      SET messages = ?, mode = ?, escalated = ?, escalation_reason = ?, updated_at = ?
      WHERE phone = ?
    `).run(
      JSON.stringify(data.messages !== undefined ? data.messages : existing.messages),
      data.mode !== undefined ? data.mode : existing.mode,
      data.escalated !== undefined ? (data.escalated ? 1 : 0) : (existing.escalated ? 1 : 0),
      data.escalationReason !== undefined ? data.escalationReason : existing.escalationReason,
      now,
      phone
    );
  }
  return getConversation(db, phone);
}

function getAllConversations(db) {
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all().map(row => _rowToConversation(row));
}

function getSettings(db) {
  const row = { ...db.prepare('SELECT * FROM settings WHERE id = 1').get() };
  return {
    phoneNumberId: row.phone_number_id,
    accessToken: row.access_token,
    verifyToken: row.verify_token,
    claudeApiKey: row.claude_api_key,
    escalationTriggers: row.escalation_triggers,
    aiPaused: Boolean(row.ai_paused),
    ownerPhone: row.owner_phone
  };
}

function updateSettings(db, settings) {
  const map = {
    phoneNumberId: 'phone_number_id',
    accessToken: 'access_token',
    verifyToken: 'verify_token',
    claudeApiKey: 'claude_api_key',
    escalationTriggers: 'escalation_triggers',
    aiPaused: 'ai_paused',
    ownerPhone: 'owner_phone'
  };
  const entries = Object.entries(settings).filter(([k]) => map[k] !== undefined);
  if (!entries.length) return;
  const setClause = entries.map(([k]) => `${map[k]} = ?`).join(', ');
  const values = entries.map(([k, v]) => k === 'aiPaused' ? (v ? 1 : 0) : v);
  db.prepare(`UPDATE settings SET ${setClause} WHERE id = 1`).run(...values);
}

function insertCall(db, data) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO calls (
      call_id, caller_phone, caller_name, location, service_requested,
      service_details, preferred_date, preferred_time, call_intent,
      urgency, follow_up_required, notes, summary, success_evaluation,
      duration_seconds, recording_url, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.call_id, data.caller_phone || '', data.caller_name || '',
    data.location || '', data.service_requested || '', data.service_details || '',
    data.preferred_date || '', data.preferred_time || '', data.call_intent || '',
    data.urgency || 'normal', data.follow_up_required ? 1 : 0,
    data.notes || '', data.summary || '', data.success_evaluation || '',
    data.duration_seconds || 0, data.recording_url || '',
    data.status || 'completed', now
  );
}

function getAllCalls(db) {
  return db.prepare('SELECT * FROM calls ORDER BY created_at DESC').all();
}

module.exports = { initDb, getKnowledgeBase, updateKnowledgeBase, getConversation, upsertConversation, getAllConversations, getSettings, updateSettings, insertCall, getAllCalls };

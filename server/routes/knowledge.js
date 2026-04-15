const express = require('express');
const { getKnowledgeBase, updateKnowledgeBase } = require('../db');

function createKnowledgeRouter(db) {
  const router = express.Router();

  router.get('/knowledge', (req, res) => {
    res.json(getKnowledgeBase(db));
  });

  router.put('/knowledge', (req, res) => {
    const { text } = req.body;
    if (typeof text !== 'string') return res.status(400).json({ error: 'text is required' });
    updateKnowledgeBase(db, text);
    res.json(getKnowledgeBase(db));
  });

  return router;
}

module.exports = { createKnowledgeRouter };

const express = require('express');
const { getSettings, updateSettings } = require('../db');

function createSettingsRouter(db) {
  const router = express.Router();

  router.get('/settings', (req, res) => {
    res.json(getSettings(db));
  });

  router.put('/settings', (req, res) => {
    updateSettings(db, req.body);
    res.json(getSettings(db));
  });

  return router;
}

module.exports = { createSettingsRouter };

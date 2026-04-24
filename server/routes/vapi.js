const express = require('express');
const { insertCall, getAllCalls } = require('../db');

function createVapiRouter(db) {
  const router = express.Router();

  // Vapi sends this at the end of every call
  router.post('/vapi/webhook', (req, res) => {
    const body = req.body;

    // Vapi wraps everything under a "message" object with a "type" field
    if (body?.message?.type !== 'end-of-call-report') {
      return res.status(200).json({ received: true });
    }

    const msg = body.message;
    const structured = msg.analysis?.structuredData || {};
    const call = msg.call || {};

    insertCall(db, {
      call_id: call.id || `vapi_${Date.now()}`,
      caller_phone: call.customer?.number || '',
      caller_name: structured.caller_name || '',
      location: structured.location || '',
      service_requested: structured.service_requested || '',
      service_details: structured.service_details || '',
      preferred_date: structured.preferred_date || '',
      preferred_time: structured.preferred_time || '',
      call_intent: structured.call_intent || '',
      urgency: structured.urgency || 'normal',
      follow_up_required: structured.follow_up_required || false,
      notes: structured.notes || '',
      summary: msg.analysis?.summary || '',
      success_evaluation: msg.analysis?.successEvaluation || '',
      duration_seconds: Math.round((msg.durationSeconds || 0)),
      recording_url: msg.recordingUrl || '',
      status: 'completed'
    });

    console.log(`[Vapi] Call saved: ${call.id} | intent: ${structured.call_intent} | follow_up: ${structured.follow_up_required}`);
    res.status(200).json({ received: true });
  });

  // Dashboard API — list all calls
  router.get('/calls', (req, res) => {
    res.json(getAllCalls(db));
  });

  return router;
}

module.exports = { createVapiRouter };

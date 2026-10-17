// POST /assistant/chat — conversational AI productivity assistant.
// The model only *proposes*; all reads/writes flow through tasksRepo with the
// same validation as the REST API. Bulk changes need confirm=true from the UI.
const express = require('express');
const assistant = require('../services/assistantService');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({
    configured: assistant.isConfigured(),
    provider: assistant.providerName(),
    note: assistant.isConfigured()
      ? null
      : 'No AI provider key configured — the assistant is running in offline heuristic mode. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in backend/.env for full natural-language understanding.',
  });
});

router.post('/chat', async (req, res, next) => {
  try {
    const { message, confirm } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.length > 2000) return res.status(400).json({ error: 'message too long (max 2000 chars)' });
    const result = await assistant.chat({ message, confirm: confirm === true });
    res.json(result);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

module.exports = router;

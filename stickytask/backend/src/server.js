require('dotenv').config();
const express = require('express');
const cors = require('cors');
const tasksRouter = require('./routes/tasks');

const app = express();

app.disable('x-powered-by');

// Perf: gzip JSON/text responses (task lists are repetitive and compress well).
const compression = require('compression');
app.use(compression());

app.use(cors());
// Cap request bodies early — parse failures cost less on oversized payloads.
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/tasks', tasksRouter);

// Error handler — surfaces DB/provider failures as JSON.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal error' });
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`StickyTask API listening on :${PORT}`));
}

module.exports = app;

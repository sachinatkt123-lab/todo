// Anthropic provider — uses the Messages REST API via global fetch (Node 18+).
// Selected when ANTHROPIC_API_KEY is set and AI_PROVIDER=anthropic.
const MODEL = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

async function messages(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, ...body }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  return data.content.map((b) => b.text || '').join('');
}

const PARSE_SYSTEM = `You extract structured task fields from natural language.
Today is {{TODAY}}. Respond ONLY with a JSON object with keys:
title, description, due_date ("YYYY-MM-DD" or null), due_time ("HH:MM" 24h or null),
priority ("low"|"medium"|"high" or null), tags (lowercase string array),
snooze_until (ISO timestamp or null).
Use snooze_until when the user says to hide/snooze the task until a future time.`;

async function parse(rawText) {
  const system = PARSE_SYSTEM.replace('{{TODAY}}', new Date().toISOString().slice(0, 10));
  const content = await messages({ system, messages: [{ role: 'user', content: rawText }] });
  // Models sometimes wrap JSON in code fences; strip them.
  const cleaned = content.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function digest(tasks) {
  const content = await messages({
    system:
      'You are a concise daily task coach. Write a short plain-text digest with three sections: Overdue, Due today, and Suggested top 3 to tackle. No markdown, just text.',
    messages: [{ role: 'user', content: JSON.stringify(tasks) }],
  });
  return content.trim();
}

module.exports = { parse, digest };

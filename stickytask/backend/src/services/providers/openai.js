// OpenAI provider — uses the REST API directly via global fetch (Node 18+),
// so no SDK dependency is needed. Selected when OPENAI_API_KEY is set and
// AI_PROVIDER=openai.
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

async function chat(messages, { json = false } = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(json ? { response_format: { type: 'json_object' }, temperature: 0.2 } : { temperature: 0.4 }),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

const PARSE_SYSTEM = `You extract structured task fields from natural language.
Today is {{TODAY}}. Respond ONLY with a JSON object with keys:
title (string), description (string|null), due_date ("YYYY-MM-DD"|null),
due_time ("HH:MM" 24h|null), priority ("low"|"medium"|"high"|null),
tags (array of lowercase strings), snooze_until (ISO timestamp|null).
Use snooze_until when the user says to hide/snooze the task until a future time.`;

async function parse(rawText) {
  const system = PARSE_SYSTEM.replace('{{TODAY}}', new Date().toISOString().slice(0, 10));
  const content = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: rawText },
    ],
    { json: true }
  );
  return JSON.parse(content);
}

async function digest(tasks) {
  const content = await chat([
    {
      role: 'system',
      content:
        'You are a concise daily task coach. Write a short plain-text digest with three sections: Overdue, Due today, and Suggested top 3 to tackle. No markdown, just text.',
    },
    { role: 'user', content: JSON.stringify(tasks) },
  ]);
  return content.trim();
}

module.exports = { parse, digest };

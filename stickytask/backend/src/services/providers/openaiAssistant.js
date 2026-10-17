// OpenAI adapter for the conversational assistant. Uses REST via global fetch
// (Node 18+) like providers/openai.js — no SDK dependency. The model may ONLY
// return a structured JSON proposal; it never executes anything itself.
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const SYSTEM = `You are the AI assistant inside a simple to-do app. Today is {{TODAY}}.
The user's current visible tasks (JSON) are provided with stable ids.

Respond ONLY with a JSON object:
{
  "intent": "create_task" | "break_down_goal" | "prioritize" | "plan_day" | "summarize" | "update_task" | "complete_task" | "chat",
  "reply": "short friendly plain-text answer",
  "tasks": [ { "title": "...", "description": null, "due_date": "YYYY-MM-DD"|null, "priority": "low"|"medium"|"high"|null, "tags": [] } ],
  "updates": [ { "task_id": "<id from the provided list>", "due_date": "YYYY-MM-DD"|null, "priority": null, "status": "todo"|"in progress"|"done"|null } ]
}
Rules:
- create_task: put exactly one item in "tasks".
- break_down_goal: 3-8 concrete steps in "tasks"; leave due_date null unless stated.
- prioritize / plan_day / summarize: answer in "reply" using only the provided tasks; "tasks"/"updates" empty.
- update_task / complete_task: reference existing task_id values ONLY; if the named task is ambiguous or missing, use intent "chat" and ask a follow-up question.
- Never invent task ids. Never include markdown. Keep replies under 120 words.`;

async function assist(message, tasks) {
  const slim = tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date }));
  const system = SYSTEM.replace('{{TODAY}}', new Date().toISOString().slice(0, 10));
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: `${system}\nCurrent tasks: ${JSON.stringify(slim)}` },
        { role: 'user', content: message },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

module.exports = { assist };

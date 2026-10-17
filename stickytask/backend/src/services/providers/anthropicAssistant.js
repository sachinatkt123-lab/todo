// Anthropic adapter for the conversational assistant (REST via fetch).
// Same contract as openaiAssistant: returns a structured JSON proposal only.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

function buildSystem(tasks) {
  const slim = tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date }));
  return `You are the AI assistant inside a simple to-do app. Today is ${new Date().toISOString().slice(0, 10)}.
User's visible tasks: ${JSON.stringify(slim)}
Respond ONLY with a JSON object: {"intent":"create_task|break_down_goal|prioritize|plan_day|summarize|update_task|complete_task|chat","reply":"short plain text","tasks":[{"title":"","description":null,"due_date":null,"priority":null,"tags":[]}],"updates":[{"task_id":"<existing id>","due_date":null,"priority":null,"status":null}]}.
Only reference task ids from the list. Ask a follow-up (intent chat) when info is missing.`;
}

async function assist(message, tasks) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: buildSystem(tasks),
      messages: [{ role: 'user', content: message }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

module.exports = { assist };

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// Right-side AI assistant chat panel. Opens over the task list without
// navigating away. The backend only *proposes* changes; bulk or destructive
// proposals are previewed here with explicit Confirm / Cancel buttons.
const SUGGESTIONS = [
  'Plan my day',
  'Break a goal into tasks',
  'What should I do next?',
  'Summarize my pending tasks',
];

export default function AiPanel({ open, onClose, onDataChanged }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! I can add tasks, break goals into steps, prioritize your list, plan your day, summarize what’s pending, or reschedule tasks. What do you need?' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { configured, note }
  const [pending, setPending] = useState(null); // last proposal awaiting confirm
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && !status) {
      api.assistantStatus().then(setStatus).catch(() => setStatus({ configured: false, note: 'Could not reach the assistant service.' }));
    }
  }, [open, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text, confirm = false) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setBusy(true);
    try {
      const res = await api.assistantChat(msg, confirm);
      setMessages((m) => [...m, { role: 'ai', text: res.reply, intent: res.intent }]);
      if (res.requiresConfirmation) setPending({ message: msg, proposals: res.proposals || {} });
      else {
        setPending(null);
        if (res.applied) onDataChanged(); // created/updated/deleted tasks → refresh list
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: `Something went wrong: ${err.message}` }]);
    } finally {
      setBusy(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function cancelPending() {
    setPending(null);
    setMessages((m) => [...m, { role: 'ai', text: 'OK, cancelled — nothing was changed.' }]);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose} role="dialog" aria-modal="true" aria-label="AI Assistant">
      <div className="flex h-full w-full flex-col bg-white shadow-2xl sm:w-[380px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-indigo-600 text-xs text-white">✨</span>
            AI Assistant
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close assistant">✕</button>
        </div>

        {status && !status.configured && (
          <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-700">
            {status.note}
          </p>
        )}

        {/* Conversation */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user' ? 'ml-auto bg-indigo-600 text-white' :
              m.role === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
            }`}>{m.text}</div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:240ms]" />
              </span>
              Thinking…
            </div>
          )}

          {/* Proposal preview + Confirm/Cancel */}
          {pending && !busy && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">Suggested changes</p>
              {(pending.proposals.tasks || []).map((t, i) => (
                <div key={`t${i}`} className="mb-1.5 flex items-start gap-2 rounded-lg bg-white px-2.5 py-1.5 card-shadow">
                  <span className="mt-0.5 text-indigo-500">＋</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      {[t.due_date && `📅 ${t.due_date}`, t.priority && `${t.priority} priority`, (t.tags || []).map((x) => `#${x}`).join(' ')].filter(Boolean).join(' · ') || 'no date · no priority'}
                    </p>
                  </div>
                </div>
              ))}
              {(pending.proposals.updates || []).map((u, i) => (
                <div key={`u${i}`} className="mb-1.5 flex items-start gap-2 rounded-lg bg-white px-2.5 py-1.5 card-shadow">
                  <span className="mt-0.5 text-amber-500">↻</span>
                  <div className="min-w-0 text-slate-700">
                    <p className="truncate font-medium">{u.currentTitle}</p>
                    <p className="text-xs text-slate-500">
                      {[u.due_date && `→ due ${u.due_date}`, u.status && `→ ${u.status}`, u.priority && `→ ${u.priority} priority`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
              {(pending.proposals.deletes || []).map((d, i) => (
                <div key={`d${i}`} className="mb-1.5 flex items-start gap-2 rounded-lg bg-white px-2.5 py-1.5 card-shadow">
                  <span className="mt-0.5 text-red-500">🗑</span>
                  <p className="truncate font-medium text-red-600 line-through">{d.title}</p>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <button onClick={() => send(pending.message, true)} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  ✓ Confirm & apply
                </button>
                <button onClick={cancelPending} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions + input */}
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try “Remind me to call mom tomorrow”'
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              disabled={busy}
              aria-label="Message the AI assistant"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40" aria-label="Send message">
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

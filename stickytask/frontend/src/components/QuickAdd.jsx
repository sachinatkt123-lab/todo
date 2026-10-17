import React, { useState } from 'react';
import { api } from '../api/client';

// Quick-add bar: sends raw input to /tasks/parse, then hands the structured
// fields up to App which pre-fills the create form (TaskFormModal).
export default function QuickAdd({ onParsed }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await api.parse(raw);
      onParsed(parsed); // opens the pre-filled create form
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Try: "Pay rent friday at 5pm #finance high priority"'
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
        >
          {busy ? '…' : 'Add'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  );
}

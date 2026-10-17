import React from 'react';

// Modal that shows the plain-text daily digest returned by POST /tasks/digest.
export default function DigestModal({ open, loading, text, error, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">☀️ Daily digest</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>
        {loading && <p className="animate-pulse text-sm text-slate-500">Cooking your summary…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && text && (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">
            {text}
          </pre>
        )}
      </div>
    </div>
  );
}

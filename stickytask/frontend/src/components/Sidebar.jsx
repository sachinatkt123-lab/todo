import React from 'react';

// Left navigation: views + labels. Collapsible on desktop; slides in as an
// overlay drawer on mobile (parent controls `open`).
const VIEWS = [
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'today', label: 'Today', icon: '📅' },
  { key: 'upcoming', label: 'Upcoming', icon: '🗓️' },
  { key: 'completed', label: 'Completed', icon: '✅' },
];

export default function Sidebar({
  view, setView, label, setLabel, counts, open, onClose, collapsed, setCollapsed, labels = [],
}) {
  const itemCls = (active) =>
    `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
      active ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-white ${
        collapsed ? 'w-[68px]' : 'w-60'
      } fixed inset-y-0 left-0 z-40 transition-all md:static md:translate-x-0 ${
        open ? 'translate-x-0 shadow-xl md:shadow-none' : '-translate-x-full'
      }`}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-base text-white">✓</span>
        {!collapsed && <span className="text-[15px] font-bold tracking-tight text-slate-800">StickyTask</span>}
        <button onClick={onClose} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 md:hidden" aria-label="Close menu">✕</button>
      </div>

      {/* Views */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => { setView(v.key); setLabel(null); onClose?.(); }}
            className={itemCls(view === v.key && !label)}
            title={collapsed ? v.label : undefined}
          >
            <span aria-hidden>{v.icon}</span>
            {!collapsed && <span className="flex-1 text-left">{v.label}</span>}
            {!collapsed && counts[v.key] > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${view === v.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {counts[v.key]}
              </span>
            )}
          </button>
        ))}

        {!collapsed && !!labels.length && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Labels</p>
            {labels.map((t) => (
              <button key={t} onClick={() => { setLabel(t); onClose?.(); }} className={itemCls(label === t)}>
                <span aria-hidden>#</span><span className="flex-1 truncate text-left">{t}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Footer: profile/settings */}
      <div className="border-t border-slate-200 p-3">
        <div className={`flex items-center gap-2 ${collapsed ? 'md:justify-center' : ''}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">ME</span>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">My Workspace</p>
                <p className="truncate text-xs text-slate-400">Free plan</p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="hidden rounded p-1 text-slate-400 hover:bg-slate-100 md:block"
                title="Collapse sidebar" aria-label="Collapse sidebar"
              >«</button>
            </>
          )}
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="mt-2 hidden w-full rounded-md py-1 text-xs text-slate-400 hover:bg-slate-100 md:block" title="Expand sidebar">»</button>
        )}
      </div>
    </aside>
  );
}


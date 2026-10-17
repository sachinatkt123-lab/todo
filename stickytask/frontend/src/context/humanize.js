/**
 * Redesign — shared human-friendly vocabulary for the "AI does the work" app.
 *
 * The old developer model used ticket IDs (ENG-104), P0–P3 priorities, git
 * branches and agent jargon. Everything now speaks plain words: Urgent / High
 * / Normal priorities, team categories, and friendly AI status labels.
 */

export const PRIORITIES = ['Urgent', 'High', 'Normal'];

export const PRIORITY_TONE = {
  Urgent: 'bg-red-500/15 text-red-400 border border-red-500/30',
  High: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  Normal: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
};

// Plain-language mapping of the internal agent pipeline states.
export const AGENT_LABELS = {
  idle: 'Not started yet',
  running: '✨ AI is working on this...',
  'diff-ready': '✨ AI Draft Ready',
  completed: '✓ Approved & Done',
};

export const CATEGORIES = ['Sales', 'Marketing', 'Operations', 'Finance'];

export const CATEGORY_TONE = {
  Sales: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  Marketing: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  Operations: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  Finance: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
};

/**
 * Translate a legacy technical title into friendly everyday language so the
 * older canvas surfaces (Spec Doc / Diff views) keep rendering readable copy.
 */
const LEGACY_TITLE_MAP = {
  'Fix WebSocket Reconnect Dropping Sync': 'Fix sync dropping off after laptop sleep',
  'Automate Q3 Enterprise Customer Onboarding Flow': 'Automate new customer onboarding steps',
  'Add pgvector embeddings for organizational memory': 'Let AI remember past team decisions',
  'Implement Role-Based Guardrails for Red-Tier Agent Actions': 'Add approval guardrails for risky AI actions',
  'Synthesize Q4 Competitor Pricing Matrix via Web Agent': 'Research competitor pricing for Q4 planning',
  'Stream Agent Telemetry to Right Terminal Drawer': 'Show live AI progress in the assistant panel',
  'Draft Autonomous Sprint Retro Digest with Diff Insights': 'Draft the weekly team recap email',
};

const LEGACY_OBJECTIVE_MAP = {
  'Fix WebSocket Reconnect Dropping Sync':
    'When a laptop wakes from sleep, live board updates get dropped until a hard refresh. Make reconnection automatic so nothing is ever lost.',
  'Automate Q3 Enterprise Customer Onboarding Flow':
    'New enterprise customers need 6 manual setup steps each. Automate everything except one human approval for secure login setup.',
  'Add pgvector embeddings for organizational memory':
    'Let the AI assistant search past tasks and decisions by meaning instead of exact keywords, so it always has full team context.',
  'Implement Role-Based Guardrails for Red-Tier Agent Actions':
    'Risky actions (publishing, deleting data) must pause for an admin approval before the AI can perform them.',
  'Synthesize Q4 Competitor Pricing Matrix via Web Agent':
    'Gather current competitor prices automatically and build one simple comparison table for the leadership meeting.',
  'Stream Agent Telemetry to Right Terminal Drawer':
    'Show real-time AI progress updates in the assistant panel instead of making people dig through logs.',
  'Draft Autonomous Sprint Retro Digest with Diff Insights':
    'Auto-draft the weekly recap: what got done, where AI helped most, and what needs attention next week.',
};

export function humanizeTitle(title) {
  return LEGACY_TITLE_MAP[title] || title;
}

export function humanizeObjective(task) {
  if (!task.objective) return '';
  // New everyday seeds carry clean objectives already; only rewrite the old
  // engineering-flavored ones.
  if (LEGACY_TITLE_MAP[task.title]) {
    return LEGACY_OBJECTIVE_MAP[task.title] || task.objective;
  }
  return task.objective;
}

/** Map legacy P0–P3 values onto the new plain-word scale. */
export function normalizePriority(priority) {
  switch (priority) {
    case 'P0':
      return 'Urgent';
    case 'P1':
      return 'High';
    case 'P2':
    case 'P3':
      return 'Normal';
    default:
      return priority;
  }
}

/**
 * Strip developer jargon from any log line so quiet telemetry stays readable
 * even if an action logs raw text.
 */
export function humanizeLogText(text) {
  return String(text)
    .replace(/#[A-Z]{2,4}-\d+/g, (m) => m) // keep ticket refs (used internally)
    .replace(/\bws_client\.ts\b/gi, 'the sync settings')
    .replace(/\bws_reconnect\.spec\.ts\b/gi, 'the sync checks')
    .replace(/\+\d+ -\d+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const WorkspaceContext = createContext(null);

let logIdCounter = 0;
function nextLogId() {
  logIdCounter += 1;
  return `log-${Date.now()}-${logIdCounter}`;
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const INITIAL_LOGS = [
  { id: nextLogId(), timestamp: formatTimestamp(), source: 'SYS', message: 'StickyTask 2030 Kernel initialized' },
  { id: nextLogId(), timestamp: formatTimestamp(), source: 'SYS', message: 'Workspace mounted: stickytask-core' },
  { id: nextLogId(), timestamp: formatTimestamp(), source: 'AGENT', message: 'Background orchestrator standing by (0 active runs)' },
];

let checklistIdCounter = 0;
function nextChecklistId() {
  checklistIdCounter += 1;
  return `chk-${Date.now().toString(36)}-${checklistIdCounter}`;
}
let criteriaIdCounter = 0;
function nextCriteriaId() {
  criteriaIdCounter += 1;
  return `ac-${Date.now().toString(36)}-${criteriaIdCounter}`;
}

function recalcSubtasks(checklists) {
  return {
    completed: checklists.filter((c) => c.checked).length,
    total: checklists.length,
  };
}

/**
 * Enrich a raw task seed with Step 4 spec-document fields, filling sensible
 * defaults so every task always carries objective / checklists /
 * acceptanceCriteria / codeSnippet.
 */
function withSpecDefaults(task, spec = {}) {
  const checklists = spec.checklists || [];
  return {
    ...task,
    objective: spec.objective || `No objective drafted yet for "${task.title}".`,
    checklists,
    acceptanceCriteria: spec.acceptanceCriteria || [],
    codeSnippet: spec.codeSnippet || null,
    subtaskCount: spec.subtaskCount || recalcSubtasks(checklists),
  };
}

// Step 3 — enriched high-density task model (7 seeds across P0–P3, mixed
// statuses and agent states: 2 diff-ready, 1 running, rest idle/completed).
// Step 4 — each seed now carries full spec-document content (objective,
// nested checklists, acceptance criteria, optional code snippet).
const INITIAL_TASKS = [
  withSpecDefaults(
    {
      id: 'ENG-104', title: 'Fix WebSocket Reconnect Dropping Sync', priority: 'P0', status: 'In-Progress',
      assignee: 'Sachin', branch: 'feat/ws-sync', agentStatus: 'diff-ready',
      agentSummary: 'Drafted patch in ws_client.ts (+42 -8)', updatedAt: '2m ago',
    },
    {
      objective:
        'When the laptop wakes from sleep, the WebSocket reconnect handshake races with the pending sync queue and drops board deltas.\nRepro: sleep 10 min → wake → sticky notes show stale positions until a hard refresh.\nGoal: exponential-backoff reconnect + last-event-id replay so zero deltas are lost.',
      checklists: [
        { id: 'chk-a1', label: 'Instrument reconnect lifecycle (open/close/error events)', checked: true, indent: 0 },
        { id: 'chk-a2', label: 'Add exponential backoff with jitter (max 30s)', checked: true, indent: 1 },
        { id: 'chk-a3', label: 'Persist lastEventId and replay missed deltas on resume', checked: false, indent: 0 },
        { id: 'chk-a4', label: 'Cover wake-from-sleep path in integration test', checked: false, indent: 1 },
      ],
      subtaskCount: { completed: 2, total: 4 },
      acceptanceCriteria: [
        { id: 'ac-a1', checkpoint: 'Zero dropped deltas after simulated 10-min sleep', threshold: '0 losses / 500 events', status: 'Pending' },
        { id: 'ac-a2', checkpoint: 'Reconnect p95 latency', threshold: '< 1.2s', status: 'Passed' },
      ],
      codeSnippet: {
        language: 'typescript', filename: 'ws_client.ts',
        code: 'const backoff = Math.min(MAX_DELAY, BASE_DELAY * 2 ** attempt) * (0.8 + Math.random() * 0.4);\nsocket.on("reconnect", async () => {\n  await replayDeltas(lastEventId); // ✨ agent-drafted\n});',
      },
    }
  ),
  withSpecDefaults(
    {
      id: 'OPS-202', title: 'Automate Q3 Enterprise Customer Onboarding Flow', priority: 'P1', status: 'Backlog',
      assignee: 'Adithya', branch: 'ops/onboard-agent', agentStatus: 'idle',
      agentSummary: '2 sub-tasks queued', updatedAt: '14m ago',
    },
    {
      objective:
        'Enterprise onboarding still requires 6 manual steps per customer (workspace provisioning, SSO config, seat invites, digest opt-in).\nTarget: an autonomous runner that completes provisioning end-to-end with a single human approval gate at the SSO step.',
      checklists: [
        { id: 'chk-b1', label: 'Map current 6-step manual flow & identify automation seams', checked: false, indent: 0 },
        { id: 'chk-b2', label: 'Draft Terraform module for workspace provisioning', checked: false, indent: 1 },
        { id: 'chk-b3', label: 'Define human approval gate UX for SSO config', checked: false, indent: 0 },
      ],
      acceptanceCriteria: [
        { id: 'ac-b1', checkpoint: 'Onboarding touches reduced from 6 to ≤ 2', threshold: 'Measured over 10 pilot customers', status: 'Pending' },
      ],
    }
  ),
  withSpecDefaults(
    {
      id: 'ENG-105', title: 'Add pgvector embeddings for organizational memory', priority: 'P2', status: 'In-Review',
      assignee: 'Hareesha', branch: 'chore/pgvector', agentStatus: 'completed',
      agentSummary: 'Merged migration 0042 (+118 -3)', updatedAt: '1h ago',
    },
    {
      objective:
        'Store task/spec embeddings in Postgres via pgvector so the Omni-Agent can retrieve organizational context semantically instead of keyword grep.\nMigration 0042 adds the vector(1536) column + HNSW index.',
      checklists: [
        { id: 'chk-c1', label: 'Enable pgvector extension in docker init', checked: true, indent: 0 },
        { id: 'chk-c2', label: 'Migration 0042: embeddings table + HNSW index', checked: true, indent: 0 },
        { id: 'chk-c3', label: 'Backfill script for historical tasks', checked: true, indent: 1 },
        { id: 'chk-c4', label: 'Wire retrieval into digest prompt assembly', checked: true, indent: 0 },
        { id: 'chk-c5', label: 'Load-test ANN query at 100k vectors', checked: true, indent: 1 },
      ],
      subtaskCount: { completed: 5, total: 5 },
      acceptanceCriteria: [
        { id: 'ac-c1', checkpoint: 'ANN recall@10 vs brute force', threshold: '≥ 0.95', status: 'Passed' },
        { id: 'ac-c2', checkpoint: 'Query p99 at 100k rows', threshold: '< 80ms', status: 'Passed' },
      ],
    }
  ),
  withSpecDefaults(
    {
      id: 'SEC-089', title: 'Implement Role-Based Guardrails for Red-Tier Agent Actions', priority: 'P0', status: 'In-Progress',
      assignee: 'Sachin', branch: 'sec/agent-guardrails', agentStatus: 'running',
      agentSummary: 'Scanning policy engine… 68%', updatedAt: 'just now',
    },
    {
      objective:
        'Red-tier actions (deploy, schema migration, bulk delete) must be blocked unless a human with role=admin explicitly approves.\nThe agent is currently scanning all call-sites that mutate production state to classify them into tiers.',
      checklists: [
        { id: 'chk-d1', label: 'Classify all mutating endpoints into green/amber/red tiers', checked: true, indent: 0 },
        { id: 'chk-d2', label: 'Policy engine middleware for red-tier interception', checked: false, indent: 1 },
        { id: 'chk-d3', label: 'Approval-token issuance flow (admin only)', checked: false, indent: 1 },
        { id: 'chk-d4', label: 'Audit-log every denied attempt', checked: false, indent: 0 },
        { id: 'chk-d5', label: 'Dry-run mode flag for staging agents', checked: false, indent: 2 },
        { id: 'chk-d6', label: 'Threat-model review with security guild', checked: false, indent: 0 },
      ],
      subtaskCount: { completed: 1, total: 6 },
      acceptanceCriteria: [
        { id: 'ac-d1', checkpoint: 'Red-tier bypass attempts', threshold: '0 in pen-test suite', status: 'Failed' },
        { id: 'ac-d2', checkpoint: 'Deny-path audit coverage', threshold: '100% of intercepted calls logged', status: 'Pending' },
      ],
      codeSnippet: {
        language: 'yaml', filename: 'policy_tiers.yaml',
        code: 'red_tier:\n  - deploy.production\n  - db.schema.migrate\nrequires: role=admin & approval_token=fresh(5m)',
      },
    }
  ),
  withSpecDefaults(
    {
      id: 'GTM-310', title: 'Synthesize Q4 Competitor Pricing Matrix via Web Agent', priority: 'P3', status: 'Done',
      assignee: 'Rakshith', branch: 'gtm/pricing-research', agentStatus: 'completed',
      agentSummary: 'Report generated · 14 sources cited', updatedAt: '3h ago',
    },
    {
      objective:
        'Autonomous web agent crawled 14 competitor pricing pages and synthesized a normalized matrix (seat tiers, usage caps, enterprise floors). Report archived to org memory.',
      checklists: [
        { id: 'chk-e1', label: 'Crawl & snapshot 14 competitor pricing pages', checked: true, indent: 0 },
        { id: 'chk-e2', label: 'Normalize into unified seat/usage matrix', checked: true, indent: 0 },
        { id: 'chk-e3', label: 'Publish digest to #gtm-leadership', checked: true, indent: 0 },
      ],
      subtaskCount: { completed: 3, total: 3 },
      acceptanceCriteria: [
        { id: 'ac-e1', checkpoint: 'Matrix freshness', threshold: 'All snapshots < 7 days old', status: 'Passed' },
      ],
    }
  ),
  withSpecDefaults(
    {
      id: 'ENG-106', title: 'Stream Agent Telemetry to Right Terminal Drawer', priority: 'P1', status: 'Backlog',
      assignee: 'Hareesha', branch: 'feat/telemetry-ws', agentStatus: 'diff-ready',
      agentSummary: 'Proposed SSE bridge (+27 -0)', updatedAt: '22m ago',
    },
    {
      objective:
        'Pipe real agent execution events (tool calls, token burn, run state) into the AGENT TERMINAL drawer over SSE so operators watch runs live instead of polling logs.',
      checklists: [
        { id: 'chk-f1', label: 'SSE endpoint /api/agent/events with ring buffer', checked: false, indent: 0 },
        { id: 'chk-f2', label: 'Token-meter component bound to live burn rate', checked: true, indent: 1 },
      ],
      subtaskCount: { completed: 1, total: 2 },
      acceptanceCriteria: [
        { id: 'ac-f1', checkpoint: 'Event delivery lag', threshold: '< 250ms p95', status: 'Pending' },
      ],
    }
  ),
  withSpecDefaults(
    {
      id: 'PLN-011', title: 'Draft Autonomous Sprint Retro Digest with Diff Insights', priority: 'P2', status: 'In-Review',
      assignee: 'Rakshith', branch: 'pln/retro-digest', agentStatus: 'idle',
      agentSummary: 'Awaiting human approval gate', updatedAt: '45m ago',
    },
    {
      objective:
        'Weekly retro digest auto-generated from merged diffs + closed tasks, highlighting where agent-authored patches outperformed human estimates. Currently awaiting PM approval gate before publishing.',
      checklists: [
        { id: 'chk-g1', label: 'Aggregate sprint metrics (lead time, reopen rate)', checked: true, indent: 0 },
        { id: 'chk-g2', label: 'LLM summary of top 5 merged diffs', checked: true, indent: 1 },
        { id: 'chk-g3', label: 'Sentiment trend vs previous sprint', checked: true, indent: 1 },
        { id: 'chk-g4', label: 'Approval-gate workflow (PM sign-off)', checked: true, indent: 0 },
        { id: 'chk-g5', label: 'Auto-publish channel binding', checked: false, indent: 0 },
        { id: 'chk-g6', label: 'Archive artifact to org memory (pgvector)', checked: false, indent: 1 },
        { id: 'chk-g7', label: 'Notify stakeholders via digest email', checked: false, indent: 2 },
      ],
      subtaskCount: { completed: 4, total: 7 },
      acceptanceCriteria: [
        { id: 'ac-g1', checkpoint: 'Digest generation wall-clock', threshold: '< 90s per sprint', status: 'Pending' },
      ],
    }
  ),
];

const STATUS_CYCLE = ['Backlog', 'In-Progress', 'In-Review', 'Done'];
const ASSIGNEE_POOL = ['Sachin', 'Adithya', 'Hareesha', 'Rakshith'];

// Context-aware AI decomposition templates used by decomposeTaskWithAI.
const DECOMPOSE_TEMPLATES = {
  ENG: [
    'Scaffold failing regression test reproducing the issue',
    'Implement minimal fix behind feature flag',
    'Run agent fuzz pass against changed surface (+est. 4k tokens)',
  ],
  OPS: [
    'Enumerate manual touchpoints and owner per step',
    'Prototype scripted happy-path automation',
    'Insert human approval gate at highest-risk transition',
  ],
  SEC: [
    'Static-scan mutating call-sites for tier classification',
    'Draft policy-as-code rules for red-tier verbs',
    'Add deny-path audit logging + alerting hook',
  ],
  GTM: [
    'Queue source crawl with freshness SLA',
    'Normalize findings into comparison matrix',
    'Generate executive summary with cited snapshots',
  ],
  PLN: [
    'Pull sprint velocity + reopen metrics',
    'Summarize top merged diffs via LLM',
    'Route draft through approval-gate workflow',
  ],
};

export function WorkspaceProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [activePane, setActivePaneState] = useState('canvas');
  const [canvasViewMode, setCanvasViewModeState] = useState('stream');
  const [activeProjectId] = useState('sprint-14');
  const [activeTaskId, setActiveTaskIdState] = useState('ENG-104');
  const [commandPaletteOpen, setCommandPaletteOpenState] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpenState] = useState(false);
  const [systemLogs, setSystemLogs] = useState(INITIAL_LOGS);

  // Step 2 — keyboard engine state
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState(0);
  const [shortcutHelpOpen, setShortcutHelpOpenState] = useState(false);
  const [lastTriggeredKey, setLastTriggeredKey] = useState(null);

  // Step 3 — stream filtering, inline creation & inline editing state
  const [streamFilter, setStreamFilterState] = useState('all');
  const [isCreatingTask, setIsCreatingTaskState] = useState(false);
  const [editingTaskId, setEditingTaskIdState] = useState(null);

  // Refs kept in sync so stable callbacks can read latest state without stale closures.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const focusedTaskIndexRef = useRef(focusedTaskIndex);
  focusedTaskIndexRef.current = focusedTaskIndex;
  const streamFilterRef = useRef(streamFilter);
  streamFilterRef.current = streamFilter;

  // ID generator counter for created tasks (ENG-106+ seeded already, so start high).
  const taskIdCounterRef = useRef(106);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  const toggleTerminal = useCallback(() => {
    setTerminalOpen((open) => !open);
  }, []);

  const setActivePane = useCallback((pane) => {
    setActivePaneState(pane);
  }, []);

  const setCanvasViewMode = useCallback((mode) => {
    setCanvasViewModeState(mode);
  }, []);

  // Step 5: setting the active task also syncs the stream focus cursor to the
  // task's position in the current filtered view (used by the Quick Switcher).
  const setActiveTaskId = useCallback((id) => {
    setActiveTaskIdState(id);
    const view = filteredTasksRef.current;
    const idx = view.findIndex((t) => t.id === id);
    if (idx !== -1) setFocusedTaskIndex(idx);
  }, []);

  const setCommandPaletteOpen = useCallback((open) => {
    setCommandPaletteOpenState(open);
  }, []);

  const setQuickSwitcherOpen = useCallback((open) => {
    setQuickSwitcherOpenState(open);
  }, []);

  const setShortcutHelpOpen = useCallback((open) => {
    setShortcutHelpOpenState(open);
  }, []);

  const addSystemLog = useCallback((source, message) => {
    setSystemLogs((logs) => {
      const entry = { id: nextLogId(), timestamp: formatTimestamp(), source, message };
      const next = [...logs, entry];
      // Cap the in-memory log ring to keep the drawer light.
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  const clearSystemLogs = useCallback(() => {
    setSystemLogs([]);
  }, []);

  // ---- Step 2: keyboard-engine helpers ----------------------------------

  // Step 3: j/k navigation must operate over the *filtered* stream bounds.
  const applyStreamFilter = useCallback((list, filter) => {
    switch (filter) {
      case 'p0':
        return list.filter((t) => t.priority === 'P0');
      case 'agent-ready':
        return list.filter((t) => t.agentStatus === 'diff-ready' || t.agentStatus === 'running');
      case 'active':
        return list.filter((t) => t.status === 'In-Progress' || t.status === 'In-Review');
      case 'done':
        return list.filter((t) => t.status === 'Done');
      case 'all':
      default:
        return list;
    }
  }, []);

  const filteredTasks = useMemo(
    () => applyStreamFilter(tasks, streamFilter),
    [tasks, streamFilter, applyStreamFilter]
  );
  const filteredTasksRef = useRef(filteredTasks);
  filteredTasksRef.current = filteredTasks;

  const moveTaskFocus = useCallback((direction) => {
    setFocusedTaskIndex((idx) => {
      const max = Math.max(filteredTasksRef.current.length - 1, 0);
      const raw = direction === 'down' ? idx + 1 : idx - 1;
      // Clamp safely within bounds 0..filteredTasks.length-1.
      const next = Math.min(Math.max(raw, 0), max);
      const task = filteredTasksRef.current[next];
      if (task) setActiveTaskIdState(task.id);
      return next;
    });
  }, []);

  const toggleFocusedTaskDone = useCallback(() => {
    setTasks((currentTasks) => {
      const view = applyStreamFilter(currentTasks, streamFilterRef.current);
      const task = view[focusedTaskIndexRef.current];
      if (!task) return currentTasks;
      const nextStatus = task.status === 'Done' ? 'In-Progress' : 'Done';
      addSystemLog('HOTKEY', `Toggled status for #${task.id}`);
      return currentTasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus, updatedAt: 'just now' } : t));
    });
  }, [addSystemLog, applyStreamFilter]);

  const triggerKeyFeedback = useCallback((combo, label) => {
    setLastTriggeredKey({ combo, label, timestamp: Date.now() });
    addSystemLog('HOTKEY', `${combo} → ${label}`);
  }, [addSystemLog]);

  // ---- Step 3: stream filter / inline create / inline edit ---------------

  const setStreamFilter = useCallback((filter) => {
    setStreamFilterState(filter);
    // Keep focus cursor valid inside the new filtered bounds and re-sync activeTaskId.
    setFocusedTaskIndex((idx) => {
      const view = applyStreamFilter(tasksRef.current, filter);
      const next = Math.min(idx, Math.max(view.length - 1, 0));
      const task = view[next];
      if (task) setActiveTaskIdState(task.id);
      return next;
    });
  }, [applyStreamFilter]);

  const setIsCreatingTask = useCallback((open) => {
    setIsCreatingTaskState(open);
  }, []);

  const setEditingTaskId = useCallback((id) => {
    setEditingTaskIdState(id);
  }, []);

  const createTask = useCallback(({ title, priority = 'P1', assignee = 'Sachin', branch = 'feat/agent-branch' }) => {
    const trimmed = (title || '').trim();
    if (!trimmed) return null;
    taskIdCounterRef.current += 1;
    const newId = `ENG-${taskIdCounterRef.current}`;
    const newTask = withSpecDefaults(
      {
        id: newId,
        title: trimmed,
        priority,
        status: 'Backlog',
        assignee,
        branch,
        agentStatus: 'idle',
        agentSummary: 'Awaiting first dispatch',
        updatedAt: 'just now',
      },
      {
        objective: `Objective not drafted yet for "${trimmed}". Dispatch the agent or write it here.`,
        checklists: [],
        acceptanceCriteria: [],
      }
    );
    setTasks((currentTasks) => [newTask, ...currentTasks]);
    setFocusedTaskIndex(0);
    setActiveTaskIdState(newId);
    addSystemLog('USR', `Created task #${newId}`);
    return newId;
  }, [addSystemLog]);

  const updateTaskPriority = useCallback((taskId, priority) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => (t.id === taskId ? { ...t, priority, updatedAt: 'just now' } : t))
    );
    addSystemLog('HOTKEY', `Set #${taskId} priority -> ${priority}`);
  }, [addSystemLog]);

  const updateTaskTitle = useCallback((taskId, newTitle) => {
    const trimmed = (newTitle || '').trim();
    setTasks((currentTasks) =>
      trimmed
        ? currentTasks.map((t) => (t.id === taskId ? { ...t, title: trimmed, updatedAt: 'just now' } : t))
        : currentTasks
    );
    setEditingTaskIdState(null);
    if (trimmed) addSystemLog('USR', `Renamed #${taskId} → "${trimmed}"`);
  }, [addSystemLog]);

  const cycleFocusedTaskStatus = useCallback(() => {
    setTasks((currentTasks) => {
      const view = applyStreamFilter(currentTasks, streamFilterRef.current);
      const task = view[focusedTaskIndexRef.current];
      if (!task) return currentTasks;
      const currentIdx = STATUS_CYCLE.indexOf(task.status);
      const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
      addSystemLog('HOTKEY', `Cycled #${task.id} status ${task.status} -> ${nextStatus}`);
      return currentTasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus, updatedAt: 'just now' } : t));
    });
  }, [addSystemLog, applyStreamFilter]);

  const triggerAgentOnTask = useCallback((taskId) => {
    if (!taskId) return;
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId ? { ...t, agentStatus: 'running', agentSummary: 'Autonomous runner engaged…', updatedAt: 'just now' } : t
      )
    );
    addSystemLog('AGENT', `Dispatched autonomous runner on #${taskId}`);
    setTimeout(() => {
      // Only flip to diff-ready if the task still exists and is still running.
      setTasks((currentTasks) => {
        const target = currentTasks.find((t) => t.id === taskId);
        if (!target || target.agentStatus !== 'running') return currentTasks;
        addSystemLog('AGENT', `Diff ready for review on #${taskId}`);
        return currentTasks.map((t) =>
          t.id === taskId
            ? { ...t, agentStatus: 'diff-ready', agentSummary: `Drafted patch in ${t.branch}.ts (+${9 + (t.id.length * 3)} -4)`, updatedAt: 'just now' }
            : t
        );
      });
    }, 1800);
  }, [addSystemLog]);

  // ---- Step 4: document-spec mutations ------------------------------------

  // Generic helper: immutably patch one task and run an updater fn.
  const patchTask = useCallback((taskId, updater) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => (t.id === taskId ? updater(t) : t))
    );
  }, []);

  const updateTaskMetadata = useCallback((taskId, partialUpdates) => {
    patchTask(taskId, (t) => ({ ...t, ...partialUpdates, updatedAt: 'just now' }));
    addSystemLog('USR', `Updated metadata on #${taskId}`);
  }, [addSystemLog, patchTask]);

  const updateTaskObjective = useCallback((taskId, newObjective) => {
    patchTask(taskId, (t) => ({ ...t, objective: newObjective }));
  }, [patchTask]);

  const toggleChecklistItem = useCallback((taskId, itemId) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const checklists = t.checklists.map((c) =>
          c.id === itemId ? { ...c, checked: !c.checked } : c
        );
        const item = checklists.find((c) => c.id === itemId);
        addSystemLog('USR', `Checklist ${item && item.checked ? '✓ done' : '↺ reopened'} on #${taskId}: "${(item && item.label) || itemId}"`);
        return { ...t, checklists, subtaskCount: recalcSubtasks(checklists), updatedAt: 'just now' };
      })
    );
  }, [addSystemLog]);

  // Returns the new item id so callers can focus it immediately.
  const addChecklistItem = useCallback((taskId, label, indent = 0, agentGenerated = false) => {
    const trimmed = (label || '').trim();
    if (!trimmed) return null;
    const id = nextChecklistId();
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const checklists = [...t.checklists, { id, label: trimmed, checked: false, indent, ...(agentGenerated ? { agentGenerated: true } : {}) }];
        return { ...t, checklists, subtaskCount: recalcSubtasks(checklists), updatedAt: 'just now' };
      })
    );
    addSystemLog(agentGenerated ? 'AGENT' : 'USR', `${agentGenerated ? 'AI generated' : 'Added'} checklist step on #${taskId}`);
    return id;
  }, [addSystemLog]);

  // Insert a checklist item directly *below* an existing one (Enter-in-place).
  const insertChecklistItemAfter = useCallback((taskId, afterItemId, label = '', indent = 0) => {
    const id = nextChecklistId();
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const idx = t.checklists.findIndex((c) => c.id === afterItemId);
        if (idx === -1) return t;
        const checklists = [...t.checklists];
        checklists.splice(idx + 1, 0, { id, label, checked: false, indent });
        return { ...t, checklists, subtaskCount: recalcSubtasks(checklists) };
      })
    );
    return id;
  }, []);

  const indentChecklistItem = useCallback((taskId, itemId, direction) => {
    patchTask(taskId, (t) => ({
      ...t,
      checklists: t.checklists.map((c) => {
        if (c.id !== itemId) return c;
        const next = direction === 'in' ? Math.min(c.indent + 1, 2) : Math.max(c.indent - 1, 0);
        return next === c.indent ? c : { ...c, indent: next };
      }),
    }));
  }, [patchTask]);

  const deleteChecklistItem = useCallback((taskId, itemId) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const checklists = t.checklists.filter((c) => c.id !== itemId);
        return { ...t, checklists, subtaskCount: recalcSubtasks(checklists), updatedAt: 'just now' };
      })
    );
    addSystemLog('USR', `Deleted checklist step on #${taskId}`);
  }, [addSystemLog]);

  const addAcceptanceRow = useCallback((taskId, checkpoint, threshold) => {
    const trimmed = (checkpoint || '').trim();
    if (!trimmed) return null;
    const id = nextCriteriaId();
    patchTask(taskId, (t) => ({
      ...t,
      acceptanceCriteria: [
        ...t.acceptanceCriteria,
        { id, checkpoint: trimmed, threshold: (threshold || '').trim() || 'TBD', status: 'Pending' },
      ],
      updatedAt: 'just now',
    }));
    addSystemLog('USR', `Added acceptance criterion on #${taskId}`);
    return id;
  }, [addSystemLog, patchTask]);

  const ACCEPTANCE_CYCLE = ['Pending', 'Passed', 'Failed'];

  const cycleAcceptanceStatus = useCallback((taskId, rowId) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const acceptanceCriteria = t.acceptanceCriteria.map((r) => {
          if (r.id !== rowId) return r;
          const next = ACCEPTANCE_CYCLE[(ACCEPTANCE_CYCLE.indexOf(r.status) + 1) % ACCEPTANCE_CYCLE.length];
          addSystemLog('USR', `#${taskId} criterion "${r.checkpoint}" → ${next}`);
          return { ...r, status: next };
        });
        return { ...t, acceptanceCriteria };
      })
    );
  }, [addSystemLog]);

  // Insert / toggle / update a technical code-snippet block on a task.
  const upsertCodeSnippet = useCallback((taskId, snippet) => {
    patchTask(taskId, (t) => ({ ...t, codeSnippet: snippet === null ? null : snippet, updatedAt: 'just now' }));
    addSystemLog(snippet === null ? 'USR' : 'AGENT', `${snippet === null ? 'Removed' : 'Inserted'} code block on #${taskId}`);
  }, [addSystemLog, patchTask]);

  const decomposeTaskWithAI = useCallback((taskId) => {
    if (!taskId) return;
    addSystemLog('AGENT', `Decomposing #${taskId} into executable sub-steps...`);
    setTimeout(() => {
      setTasks((currentTasks) =>
        currentTasks.map((t) => {
          if (t.id !== taskId) return t;
          const prefix = (t.id.split('-')[0] || 'ENG').toUpperCase();
          const templates = DECOMPOSE_TEMPLATES[prefix] || DECOMPOSE_TEMPLATES.ENG;
          const newItems = templates.map((label) => ({
            id: nextChecklistId(), label, checked: false, indent: 0, agentGenerated: true,
          }));
          const checklists = [...t.checklists, ...newItems];
          const newCriterion = {
            id: nextCriteriaId(),
            checkpoint: `Agent decomposition verified for "${t.title.slice(0, 40)}"`,
            threshold: 'All ✦ AI steps closed or explicitly waived',
            status: 'Pending',
          };
          addSystemLog('AGENT', `#${taskId}: +3 AI sub-tasks, +1 acceptance gate drafted`);
          return {
            ...t,
            checklists,
            acceptanceCriteria: [...t.acceptanceCriteria, newCriterion],
            subtaskCount: recalcSubtasks(checklists),
            agentSummary: `Decomposed into ${checklists.length} executable steps`,
            updatedAt: 'just now',
          };
        })
      );
    }, 900);
  }, [addSystemLog]);

  const cycleAssignee = useCallback((taskId) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const next = ASSIGNEE_POOL[(ASSIGNEE_POOL.indexOf(t.assignee) + 1) % ASSIGNEE_POOL.length];
        addSystemLog('USR', `Reassigned #${taskId} → @${next}`);
        return { ...t, assignee: next, updatedAt: 'just now' };
      })
    );
  }, [addSystemLog]);

  // Step 5: Omni Palette natural-language fallback — append the user's custom
  // composer prompt as an ✦ AI checklist step, then dispatch the agent.
  const runComposerPrompt = useCallback((taskId, query) => {
    const trimmed = (query || '').trim();
    if (!taskId || !trimmed) return;
    const id = nextChecklistId();
    setTasks((currentTasks) =>
      currentTasks.map((t) => {
        if (t.id !== taskId) return t;
        const checklists = [...t.checklists, { id, label: trimmed, checked: false, indent: 0, agentGenerated: true }];
        return { ...t, checklists, subtaskCount: recalcSubtasks(checklists), updatedAt: 'just now' };
      })
    );
    addSystemLog('AGENT', `Executing custom composer prompt on #${taskId}: "${trimmed}"`);
    triggerAgentOnTask(taskId);
  }, [addSystemLog, triggerAgentOnTask]);

  const value = useMemo(
    () => ({
      sidebarOpen,
      terminalOpen,
      activePane,
      canvasViewMode,
      activeProjectId,
      activeTaskId,
      commandPaletteOpen,
      quickSwitcherOpen,
      systemLogs,
      tasks,
      filteredTasks,
      focusedTaskIndex,
      shortcutHelpOpen,
      lastTriggeredKey,
      streamFilter,
      isCreatingTask,
      editingTaskId,
      toggleSidebar,
      toggleTerminal,
      setActivePane,
      setCanvasViewMode,
      setActiveTaskId,
      setCommandPaletteOpen,
      setQuickSwitcherOpen,
      setShortcutHelpOpen,
      setFocusedTaskIndex,
      setStreamFilter,
      setIsCreatingTask,
      setEditingTaskId,
      addSystemLog,
      clearSystemLogs,
      moveTaskFocus,
      toggleFocusedTaskDone,
      triggerKeyFeedback,
      createTask,
      updateTaskPriority,
      updateTaskTitle,
      cycleFocusedTaskStatus,
      triggerAgentOnTask,
      updateTaskMetadata,
      updateTaskObjective,
      toggleChecklistItem,
      addChecklistItem,
      insertChecklistItemAfter,
      indentChecklistItem,
      deleteChecklistItem,
      addAcceptanceRow,
      cycleAcceptanceStatus,
      upsertCodeSnippet,
      decomposeTaskWithAI,
      cycleAssignee,
      runComposerPrompt,
    }),
    [
      sidebarOpen,
      terminalOpen,
      activePane,
      canvasViewMode,
      activeProjectId,
      activeTaskId,
      commandPaletteOpen,
      quickSwitcherOpen,
      systemLogs,
      tasks,
      filteredTasks,
      focusedTaskIndex,
      shortcutHelpOpen,
      lastTriggeredKey,
      streamFilter,
      isCreatingTask,
      editingTaskId,
      toggleSidebar,
      toggleTerminal,
      setActivePane,
      setCanvasViewMode,
      setActiveTaskId,
      setCommandPaletteOpen,
      setQuickSwitcherOpen,
      setShortcutHelpOpen,
      setFocusedTaskIndex,
      setStreamFilter,
      setIsCreatingTask,
      setEditingTaskId,
      addSystemLog,
      clearSystemLogs,
      moveTaskFocus,
      toggleFocusedTaskDone,
      triggerKeyFeedback,
      createTask,
      updateTaskPriority,
      updateTaskTitle,
      cycleFocusedTaskStatus,
      triggerAgentOnTask,
      updateTaskMetadata,
      updateTaskObjective,
      toggleChecklistItem,
      addChecklistItem,
      insertChecklistItemAfter,
      indentChecklistItem,
      deleteChecklistItem,
      addAcceptanceRow,
      cycleAcceptanceStatus,
      upsertCodeSnippet,
      decomposeTaskWithAI,
      cycleAssignee,
      runComposerPrompt,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}

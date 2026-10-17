import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { buildAiDeliverable } from './deliverables';

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
  { id: nextLogId(), timestamp: formatTimestamp(), source: 'SYS', message: 'Welcome back! Your AI assistant is ready.' },
  { id: nextLogId(), timestamp: formatTimestamp(), source: 'SYS', message: 'Team workspace "Acme Team" loaded' },
  { id: nextLogId(), timestamp: formatTimestamp(), source: 'AGENT', message: 'AI assistant standing by — 2 drafts waiting for your approval' },
];

// Redesign — the noisy developer telemetry simulator is retired. The right
// panel is now a friendly "AI Assistant & Task Details" surface, so no raw
// agent event stream is emitted anymore. (Export kept as a no-op so any
// legacy importers stay safe.)
export function useAgentTelemetrySimulator() {}

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
  const enriched = {
    ...task,
    objective: spec.objective || `No objective drafted yet for "${task.title}".`,
    checklists,
    acceptanceCriteria: spec.acceptanceCriteria || [],
    codeSnippet: spec.codeSnippet || null,
    subtaskCount: spec.subtaskCount || recalcSubtasks(checklists),
  };
  // Step 6 — every task carries an AI deliverable (before/after artifact).
  // Seeds may override pieces via spec.aiDeliverable; otherwise build from
  // the realistic per-prefix templates in ./deliverables.
  enriched.aiDeliverable = {
    ...buildAiDeliverable(enriched),
    ...(spec.aiDeliverable || {}),
  };
  return enriched;
}

// Redesign seed set — five realistic everyday business tasks any team member
// can relate to (Sales / Marketing / Finance / Operations), plain-word
// priorities (Urgent / High / Normal) and friendly AI states. Internal ids
// remain stable so keyboard/palette wiring keeps working, but the UI never
// surfaces them as jargon.
const INITIAL_TASKS = [
  withSpecDefaults(
    {
      id: 'ENG-104', title: 'Send follow-up email to 5 warm client leads', category: 'Sales',
      priority: 'High', status: 'In-Progress', assignee: 'Adithya', agentStatus: 'diff-ready',
      agentSummary: 'AI wrote 5 personalized follow-up emails with calendar booking links attached.',
      updatedAt: '2m ago',
    },
    {
      objective:
        "Reach out to the 5 leads from yesterday's webinar and schedule a 15-minute intro call.",
      checklists: [
        { id: 'chk-a1', label: 'Review the 5 webinar leads and their notes', checked: true, indent: 0 },
        { id: 'chk-a2', label: 'Personalize the AI-drafted emails', checked: true, indent: 1, agentGenerated: true },
        { id: 'chk-a3', label: 'Send emails with the booking link', checked: false, indent: 0 },
        { id: 'chk-a4', label: 'Add replies to the sales pipeline', checked: false, indent: 1 },
      ],
      subtaskCount: { completed: 2, total: 4 },
      acceptanceCriteria: [
        { id: 'ac-a1', checkpoint: 'All 5 leads contacted', threshold: 'Emails sent today', status: 'Pending' },
        { id: 'ac-a2', checkpoint: 'Intro calls booked', threshold: 'At least 2 on the calendar', status: 'Pending' },
      ],
      aiDeliverable: {
        __seedOverride: {
          summary: 'AI wrote 5 personalized follow-up emails with calendar booking links attached.',
          beforeContent: ['Goal: Follow up with webinar leads', 'Status: Not started'],
          afterContent: [
            'Subject: Quick follow-up & next steps!',
            '',
            'Hi Rahul,',
            'Great having you at our session yesterday. I put together a custom plan for your team—would Tuesday at 3 PM work for a quick 10-min chat?',
            '',
            'Best,',
            'Adithya',
          ],
        },
      },
    }
  ),
  withSpecDefaults(
    {
      id: 'OPS-202', title: 'Create 7-day social media content calendar', category: 'Marketing',
      priority: 'Urgent', status: 'Backlog', assignee: 'Sachin', agentStatus: 'diff-ready',
      agentSummary: 'AI generated 7 daily post topics, hooks, and caption drafts.',
      updatedAt: '14m ago',
    },
    {
      objective: "Plan Instagram Reels and LinkedIn posts for next week's product launch.",
      checklists: [
        { id: 'chk-b1', label: 'Confirm launch-week key messages', checked: false, indent: 0 },
        { id: 'chk-b2', label: 'Approve the AI-drafted 7-day plan', checked: false, indent: 0, agentGenerated: true },
        { id: 'chk-b3', label: 'Schedule posts in the publishing tool', checked: false, indent: 1 },
      ],
      acceptanceCriteria: [
        { id: 'ac-b1', checkpoint: 'One post per day planned', threshold: '7 days covered', status: 'Pending' },
      ],
      aiDeliverable: {
        __seedOverride: {
          summary: 'AI generated 7 daily post topics, hooks, and caption drafts.',
          beforeContent: ['Need 7 days of social posts for launch week'],
          afterContent: [
            "Mon: Reel — 'Stop wasting time on manual tasks' (Hook + Script ready)",
            'Tue: Carousel — 3 ways AI saves 2 hours a day',
            'Wed: Customer story highlight',
            'Thu: Live Q&A announcement',
            'Fri: Weekend productivity tip',
          ],
        },
      },
    }
  ),
  withSpecDefaults(
    {
      id: 'ENG-105', title: 'Summarize monthly vendor expenses & pending bills', category: 'Finance',
      priority: 'Normal', status: 'In-Review', assignee: 'Rakshith', agentStatus: 'idle',
      agentSummary: 'Ready when you are — click "Let AI Do This"',
      updatedAt: '1h ago',
    },
    {
      objective: 'Check all October bills and list what needs to be paid this Friday.',
      checklists: [
        { id: 'chk-c1', label: 'Collect October invoices from email', checked: false, indent: 0 },
        { id: 'chk-c2', label: 'Group by vendor and due date', checked: false, indent: 1 },
        { id: 'chk-c3', label: 'Share the Friday payment list with finance', checked: false, indent: 0 },
      ],
      acceptanceCriteria: [
        { id: 'ac-c1', checkpoint: 'Every bill categorized', threshold: 'No unassigned invoices', status: 'Pending' },
      ],
    }
  ),
  withSpecDefaults(
    {
      id: 'SEC-089', title: 'Prepare onboarding checklist for new graphic designer', category: 'Operations',
      priority: 'Normal', status: 'In-Progress', assignee: 'Hareesha', agentStatus: 'running',
      agentSummary: 'AI is gathering access lists and drafting first-week tasks…',
      updatedAt: 'just now',
    },
    {
      objective: 'Set up workspace access, brand guidelines folder, and first week tasks.',
      checklists: [
        { id: 'chk-d1', label: 'Request design tool licenses', checked: true, indent: 0 },
        { id: 'chk-d2', label: 'Share the brand guidelines folder', checked: false, indent: 0 },
        { id: 'chk-d3', label: 'Draft a friendly first-week schedule', checked: false, indent: 1, agentGenerated: true },
      ],
      acceptanceCriteria: [
        { id: 'ac-d1', checkpoint: 'Day-one ready', threshold: 'All access granted before Monday', status: 'Pending' },
      ],
    }
  ),
  withSpecDefaults(
    {
      id: 'GTM-310', title: 'Book conference room and catering for Friday team meet', category: 'Operations',
      priority: 'High', status: 'Done', assignee: 'Sachin', agentStatus: 'completed',
      agentSummary: 'Room booked · catering confirmed for 12 people',
      updatedAt: '3h ago',
    },
    {
      objective: 'Arrange lunch for 12 people and reserve the main boardroom.',
      checklists: [
        { id: 'chk-e1', label: 'Reserve the main boardroom (Friday 12–2)', checked: true, indent: 0 },
        { id: 'chk-e2', label: 'Order lunch for 12 (2 vegetarian)', checked: true, indent: 0 },
        { id: 'chk-e3', label: 'Send calendar invite to the team', checked: true, indent: 0 },
      ],
      subtaskCount: { completed: 3, total: 3 },
      acceptanceCriteria: [
        { id: 'ac-e1', checkpoint: 'Everything confirmed', threshold: 'Booking + catering receipts in email', status: 'Passed' },
      ],
    }
  ),
];

const STATUS_CYCLE = ['Backlog', 'In-Progress', 'In-Review', 'Done'];
const ASSIGNEE_POOL = ['Sachin', 'Adithya', 'Hareesha', 'Rakshith'];
const PRIORITY_CYCLE = ['Urgent', 'High', 'Normal'];

// Context-aware AI decomposition templates used by decomposeTaskWithAI,
// keyed by team category with plain, actionable everyday language.
const DECOMPOSE_TEMPLATES = {
  Sales: [
    'Double-check each lead name and company detail',
    'Tweak the tone of the AI drafts if needed',
    'Send the emails and add replies to the pipeline',
  ],
  Marketing: [
    'Pick the best posting times for each day',
    'Attach visuals or screenshots to the drafts',
    'Schedule everything in the publishing tool',
  ],
  Finance: [
    'Collect the latest invoices from email',
    'Verify amounts against last month',
    'Send the Friday payment list for approval',
  ],
  Operations: [
    'Confirm who needs access or supplies',
    'Check calendars before booking',
    'Send confirmations to everyone involved',
  ],
  ENG: [
    'Review the details and gather what is missing',
    'Draft the fix or response for a quick look',
    'Confirm results before marking it done',
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

  // Redesign — friendly everyday filter buckets driven by the left sidebar and
  // the single clean pill row in the stream header.
  const applyStreamFilter = useCallback((list, filter) => {
    switch (filter) {
      case 'ready': // ✨ Ready for Approval / Ready to Review
        return list.filter(
          (t) => t.agentStatus === 'diff-ready' || (t.status !== 'Done' && t.agentStatus === 'running')
        );
      case 'urgent': // 🔥 Urgent & Important
        return list.filter(
          (t) => t.priority === 'Urgent' && t.status !== 'Done'
        );
      case 'completed': // ✅ Completed
        return list.filter((t) => t.status === 'Done');
      case 'sales':
      case 'marketing':
      case 'operations':
      case 'finance': {
        const cat = filter.charAt(0).toUpperCase() + filter.slice(1);
        return list.filter((t) => t.category === cat);
      }
      // Legacy keys kept working quietly for older surfaces.
      case 'p0':
        return list.filter((t) => t.priority === 'Urgent' || t.priority === 'P0');
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
      addSystemLog('USR', task.status === 'Done' ? 'Reopened a task' : '✓ Marked a task as done');
      return currentTasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus, updatedAt: 'just now' } : t));
    });
  }, [addSystemLog, applyStreamFilter]);

  const triggerKeyFeedback = useCallback((combo, label) => {
    setLastTriggeredKey({ combo, label, timestamp: Date.now() });
    addSystemLog('USR', `${label} (${combo})`);
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

  const createTask = useCallback(({ title, priority = 'Normal', assignee = 'Sachin', category = 'Operations' }) => {
    const trimmed = (title || '').trim();
    if (!trimmed) return null;
    taskIdCounterRef.current += 1;
    const newId = `TASK-${taskIdCounterRef.current}`;
    const newTask = withSpecDefaults(
      {
        id: newId,
        title: trimmed,
        category,
        priority,
        status: 'Backlog',
        assignee,
        agentStatus: 'idle',
        agentSummary: 'Ready when you are — click "Let AI Do This"',
        updatedAt: 'just now',
      },
      {
        objective: `Describe the goal for "${trimmed}" here, or let the AI figure out the steps.`,
        checklists: [],
        acceptanceCriteria: [],
      }
    );
    setTasks((currentTasks) => [newTask, ...currentTasks]);
    setFocusedTaskIndex(0);
    setActiveTaskIdState(newId);
    addSystemLog('USR', `Added new task "${trimmed}"`);
    return newId;
  }, [addSystemLog]);

  const updateTaskPriority = useCallback((taskId, priority) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) => (t.id === taskId ? { ...t, priority, updatedAt: 'just now' } : t))
    );
    addSystemLog('USR', `Marked this task as ${priority}`);
  }, [addSystemLog]);

  // Redesign — cycle the focused task's priority through the plain-word scale.
  const cycleFocusedTaskPriority = useCallback(() => {
    setTasks((currentTasks) => {
      const view = applyStreamFilter(currentTasks, streamFilterRef.current);
      const task = view[focusedTaskIndexRef.current];
      if (!task) return currentTasks;
      const idx = PRIORITY_CYCLE.indexOf(task.priority);
      const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
      addSystemLog('USR', `Priority for "${task.title.slice(0, 40)}" → ${next}`);
      return currentTasks.map((t) => (t.id === task.id ? { ...t, priority: next, updatedAt: 'just now' } : t));
    });
  }, [addSystemLog, applyStreamFilter]);

  const updateTaskTitle = useCallback((taskId, newTitle) => {
    const trimmed = (newTitle || '').trim();
    setTasks((currentTasks) =>
      trimmed
        ? currentTasks.map((t) => (t.id === taskId ? { ...t, title: trimmed, updatedAt: 'just now' } : t))
        : currentTasks
    );
    setEditingTaskIdState(null);
    if (trimmed) addSystemLog('USR', `Renamed to "${trimmed}"`);
  }, [addSystemLog]);

  const cycleFocusedTaskStatus = useCallback(() => {
    setTasks((currentTasks) => {
      const view = applyStreamFilter(currentTasks, streamFilterRef.current);
      const task = view[focusedTaskIndexRef.current];
      if (!task) return currentTasks;
      const currentIdx = STATUS_CYCLE.indexOf(task.status);
      const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
      addSystemLog('USR', `Status moved to ${nextStatus}`);
      return currentTasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus, updatedAt: 'just now' } : t));
    });
  }, [addSystemLog, applyStreamFilter]);

  const triggerAgentOnTask = useCallback((taskId) => {
    if (!taskId) return;
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId ? { ...t, agentStatus: 'running', agentSummary: 'AI is working on this...', updatedAt: 'just now' } : t
      )
    );
    addSystemLog('AGENT', 'AI started working on the task');
    setTimeout(() => {
      // Only flip to diff-ready if the task still exists and is still running.
      setTasks((currentTasks) => {
        const target = currentTasks.find((t) => t.id === taskId);
        if (!target || target.agentStatus !== 'running') return currentTasks;
        addSystemLog('AGENT', `✨ AI finished "${(target.title || '').slice(0, 48)}" — ready for your approval`);
        return currentTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                agentStatus: 'diff-ready',
                agentSummary: (t.aiDeliverable && t.aiDeliverable.summary) || 'AI prepared the work — ready for your review',
                updatedAt: 'just now',
              }
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
    addSystemLog('USR', 'Updated task details');
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
        addSystemLog('USR', `${item && item.checked ? '✓ Completed step' : '↺ Reopened step'} "${(item && item.label) || ''}"`);
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
    addSystemLog(agentGenerated ? 'AGENT' : 'USR', agentGenerated ? 'AI added a suggested step' : 'Added a new step');
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
    addSystemLog('USR', 'Removed a step');
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
    addSystemLog('USR', 'Added a success checkpoint');
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
          addSystemLog('USR', `Checkpoint "${r.checkpoint}" → ${next}`);
          return { ...r, status: next };
        });
        return { ...t, acceptanceCriteria };
      })
    );
  }, [addSystemLog]);

  // Insert / toggle / update a technical code-snippet block on a task.
  const upsertCodeSnippet = useCallback((taskId, snippet) => {
    patchTask(taskId, (t) => ({ ...t, codeSnippet: snippet === null ? null : snippet, updatedAt: 'just now' }));
    addSystemLog(snippet === null ? 'USR' : 'AGENT', snippet === null ? 'Removed the attached snippet' : 'Attached a snippet to the task');
  }, [addSystemLog, patchTask]);

  const decomposeTaskWithAI = useCallback((taskId) => {
    if (!taskId) return;
    addSystemLog('AGENT', 'AI is breaking this task into simple steps…');
    setTimeout(() => {
      setTasks((currentTasks) =>
        currentTasks.map((t) => {
          if (t.id !== taskId) return t;
          const templates = DECOMPOSE_TEMPLATES[t.category] || DECOMPOSE_TEMPLATES.ENG;
          const newItems = templates.map((label) => ({
            id: nextChecklistId(), label, checked: false, indent: 0, agentGenerated: true,
          }));
          const checklists = [...t.checklists, ...newItems];
          const newCriterion = {
            id: nextCriteriaId(),
            checkpoint: `Steps confirmed for "${t.title.slice(0, 40)}"`,
            threshold: 'Every step done or skipped on purpose',
            status: 'Pending',
          };
          addSystemLog('AGENT', 'AI suggested 3 extra steps for this task');
          return {
            ...t,
            checklists,
            acceptanceCriteria: [...t.acceptanceCriteria, newCriterion],
            subtaskCount: recalcSubtasks(checklists),
            agentSummary: `Broken into ${checklists.length} easy steps`,
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
        addSystemLog('USR', `Reassigned to ${next}`);
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
    addSystemLog('AGENT', `AI got to work on: "${trimmed}"`);
    triggerAgentOnTask(taskId);
  }, [addSystemLog, triggerAgentOnTask]);

  // ---- Step 6: AI Diff & Merge Engine actions ------------------------------

  const RISK_GATE = {
    'Green (Autonomous)': { mergeable: true, label: 'AUTO-MERGE ALLOWED' },
    'Amber (Soft Review)': { mergeable: true, label: 'SOFT REVIEW — MERGE OK' },
    'Red (Strict Gate)': { mergeable: false, label: 'STRICT GATE — ADMIN APPROVAL REQUIRED' },
  };

  // Immutably patch a task's aiDeliverable.
  const patchDeliverable = useCallback((taskId, updater) => {
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId ? { ...t, aiDeliverable: updater(t.aiDeliverable), updatedAt: 'just now' } : t
      )
    );
  }, []);

  const mergeAiDeliverable = useCallback((taskId) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task || !task.aiDeliverable) return;
    const gate = RISK_GATE[task.aiDeliverable.riskTier];
    if (gate && !gate.mergeable) {
      addSystemLog('AGENT', 'This one needs an admin sign-off before it can be approved.');
      return;
    }
    const mergedAt = formatTimestamp();
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              agentStatus: 'completed',
              status: 'Done',
              agentSummary: 'Approved — great job!',
              aiDeliverable: { ...t.aiDeliverable, mergedAt },
              checklists: t.checklists.map((c) => ({ ...c, checked: true })),
              subtaskCount: { completed: t.checklists.length, total: t.checklists.length },
              updatedAt: 'just now',
            }
          : t
      )
    );
    addSystemLog('USR', `✓ Approved the AI work on "${(task.title || '').slice(0, 48)}"`);
  }, [addSystemLog]);

  const rejectAiDeliverable = useCallback((taskId) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task) return;
    patchDeliverable(taskId, (d) => ({ ...d, mergedAt: null }));
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId
          ? { ...t, agentStatus: 'idle', agentSummary: 'Not sent anywhere — try again whenever you like', updatedAt: 'just now' }
          : t
      )
    );
    addSystemLog('USR', 'AI draft set aside');
  }, [addSystemLog, patchDeliverable]);

  const requestChangesOnDeliverable = useCallback((taskId, note = '') => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task) return;
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId
          ? { ...t, agentStatus: 'running', agentSummary: 'AI is revising this for you…', updatedAt: 'just now' }
          : t
      )
    );
    addSystemLog('AGENT', note ? `AI is revising based on your feedback: "${note.slice(0, 60)}"` : 'AI is revising this for you…');
    setTimeout(() => {
      // Deliver a friendly revision after the thinking pause.
      setTasks((currentTasks) => {
        const target = currentTasks.find((t) => t.id === taskId);
        if (!target || target.agentStatus !== 'running') return currentTasks;
        addSystemLog('AGENT', `✨ Fresh version of "${(target.title || '').slice(0, 40)}" is ready to review`);
        return currentTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                agentStatus: 'diff-ready',
                agentSummary: note
                  ? `AI updated the draft using your note: "${note.slice(0, 48)}"`
                  : 'AI prepared a fresh version for you',
                updatedAt: 'just now',
              }
            : t
        );
      });
    }, 1800);
  }, [addSystemLog]);

  // Regenerate: back to running, then produce a fresh diff-ready artifact.
  const regenerateDeliverable = useCallback((taskId) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task) return;
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId
          ? { ...t, agentStatus: 'running', agentSummary: 'AI is working on a new version…', updatedAt: 'just now' }
          : t
      )
    );
    addSystemLog('AGENT', 'AI is preparing a fresh version of this task');
    setTimeout(() => {
      setTasks((currentTasks) =>
        currentTasks.map((t) => {
          if (t.id !== taskId || t.agentStatus !== 'running') return t;
          const d = t.aiDeliverable;
          const bump = Math.min(99, (d.confidenceScore || 80) + 3);
          return {
            ...t,
            agentStatus: 'diff-ready',
            agentSummary: `${d.summary} (new version · looks good)`,
            aiDeliverable: {
              ...d,
              confidenceScore: bump,
              afterContent: [...d.afterContent, '', 'P.S. This version was polished with your latest feedback.'],
              mergedAt: null,
            },
            updatedAt: 'just now',
          };
        })
      );
      addSystemLog('AGENT', 'The new version is ready for you to review');
    }, 1800);
  }, [addSystemLog]);

  // Redesign — "Ask AI to Change…": store the user's plain-language feedback,
  // revise the deliverable copy, and re-run the agent so a fresh draft lands
  // back in the review panel automatically.
  const askAiToChangeDeliverable = useCallback((taskId, note = '') => {
    const trimmedNote = (note || '').trim();
    patchDeliverable(taskId, (d) => ({
      ...d,
      revisionNote: trimmedNote || d.revisionNote || '',
      afterContent: trimmedNote
        ? [...d.afterContent, '', `✎ Revised with your note: "${trimmedNote}"`]
        : d.afterContent,
    }));
    requestChangesOnDeliverable(taskId, trimmedNote);
  }, [patchDeliverable, requestChangesOnDeliverable]);

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
      cycleFocusedTaskPriority,
      triggerAgentOnTask,
      askAiToChangeDeliverable,
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
      mergeAiDeliverable,
      rejectAiDeliverable,
      requestChangesOnDeliverable,
      regenerateDeliverable,
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
      cycleFocusedTaskPriority,
      triggerAgentOnTask,
      askAiToChangeDeliverable,
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
      mergeAiDeliverable,
      rejectAiDeliverable,
      requestChangesOnDeliverable,
      regenerateDeliverable,
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

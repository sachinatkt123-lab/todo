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

// Step 3 — enriched high-density task model (7 seeds across P0–P3, mixed
// statuses and agent states: 2 diff-ready, 1 running, rest idle/completed).
const INITIAL_TASKS = [
  {
    id: 'ENG-104', title: 'Fix WebSocket Reconnect Dropping Sync', priority: 'P0', status: 'In-Progress',
    assignee: 'Sachin', branch: 'feat/ws-sync', agentStatus: 'diff-ready',
    agentSummary: 'Drafted patch in ws_client.ts (+42 -8)', updatedAt: '2m ago', subtaskCount: { completed: 2, total: 4 },
  },
  {
    id: 'OPS-202', title: 'Automate Q3 Enterprise Customer Onboarding Flow', priority: 'P1', status: 'Backlog',
    assignee: 'Adithya', branch: 'ops/onboard-agent', agentStatus: 'idle',
    agentSummary: '2 sub-tasks queued', updatedAt: '14m ago', subtaskCount: { completed: 0, total: 3 },
  },
  {
    id: 'ENG-105', title: 'Add pgvector embeddings for organizational memory', priority: 'P2', status: 'In-Review',
    assignee: 'Hareesha', branch: 'chore/pgvector', agentStatus: 'completed',
    agentSummary: 'Merged migration 0042 (+118 -3)', updatedAt: '1h ago', subtaskCount: { completed: 5, total: 5 },
  },
  {
    id: 'SEC-089', title: 'Implement Role-Based Guardrails for Red-Tier Agent Actions', priority: 'P0', status: 'In-Progress',
    assignee: 'Sachin', branch: 'sec/agent-guardrails', agentStatus: 'running',
    agentSummary: 'Scanning policy engine… 68%', updatedAt: 'just now', subtaskCount: { completed: 1, total: 6 },
  },
  {
    id: 'GTM-310', title: 'Synthesize Q4 Competitor Pricing Matrix via Web Agent', priority: 'P3', status: 'Done',
    assignee: 'Rakshith', branch: 'gtm/pricing-research', agentStatus: 'completed',
    agentSummary: 'Report generated · 14 sources cited', updatedAt: '3h ago', subtaskCount: { completed: 3, total: 3 },
  },
  {
    id: 'ENG-106', title: 'Stream Agent Telemetry to Right Terminal Drawer', priority: 'P1', status: 'Backlog',
    assignee: 'Hareesha', branch: 'feat/telemetry-ws', agentStatus: 'diff-ready',
    agentSummary: 'Proposed SSE bridge (+27 -0)', updatedAt: '22m ago', subtaskCount: { completed: 1, total: 2 },
  },
  {
    id: 'PLN-011', title: 'Draft Autonomous Sprint Retro Digest with Diff Insights', priority: 'P2', status: 'In-Review',
    assignee: 'Rakshith', branch: 'pln/retro-digest', agentStatus: 'idle',
    agentSummary: 'Awaiting human approval gate', updatedAt: '45m ago', subtaskCount: { completed: 4, total: 7 },
  },
];

const STATUS_CYCLE = ['Backlog', 'In-Progress', 'In-Review', 'Done'];

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

  const setActiveTaskId = useCallback((id) => {
    setActiveTaskIdState(id);
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
    const newTask = {
      id: newId,
      title: trimmed,
      priority,
      status: 'Backlog',
      assignee,
      branch,
      agentStatus: 'idle',
      agentSummary: 'Awaiting first dispatch',
      updatedAt: 'just now',
      subtaskCount: { completed: 0, total: 0 },
    };
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

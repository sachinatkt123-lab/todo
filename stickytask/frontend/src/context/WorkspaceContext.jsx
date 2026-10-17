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

const INITIAL_TASKS = [
  { id: 'ENG-104', title: 'Fix WebSocket Reconnect Dropping Sync', priority: 'P0', status: 'In-Progress', assignee: 'Sachin', branch: 'feat/ws-sync' },
  { id: 'OPS-202', title: 'Automate Q3 Enterprise Customer Onboarding Flow', priority: 'P1', status: 'Backlog', assignee: 'Adithya', branch: 'ops/onboard-agent' },
  { id: 'ENG-105', title: 'Add pgvector embeddings for organizational memory', priority: 'P2', status: 'In-Review', assignee: 'Hareesha', branch: 'chore/pgvector' },
  { id: 'SEC-089', title: 'Implement Role-Based Guardrails for Red-Tier Agent Actions', priority: 'P0', status: 'In-Progress', assignee: 'Sachin', branch: 'sec/agent-guardrails' },
  { id: 'GTM-310', title: 'Synthesize Q4 Competitor Pricing Matrix via Web Agent', priority: 'P3', status: 'Done', assignee: 'Rakshith', branch: 'gtm/pricing-research' },
];

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

  // Refs kept in sync so stable callbacks can read latest state without stale closures.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const focusedTaskIndexRef = useRef(focusedTaskIndex);
  focusedTaskIndexRef.current = focusedTaskIndex;

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

  const moveTaskFocus = useCallback((direction) => {
    setFocusedTaskIndex((idx) => {
      const max = INITIAL_TASKS.length - 1;
      if (max < 0) return 0;
      const raw = direction === 'down' ? idx + 1 : idx - 1;
      // Clamp safely within bounds 0..tasks.length-1.
      const next = Math.min(Math.max(raw, 0), max);
      const task = tasksRef.current[next];
      if (task) setActiveTaskIdState(task.id);
      return next;
    });
  }, []);

  const toggleFocusedTaskDone = useCallback(() => {
    setTasks((currentTasks) => {
      const idx = focusedTaskIndexRef.current;
      const task = currentTasks[idx];
      if (!task) return currentTasks;
      const nextStatus = task.status === 'Done' ? 'In-Progress' : 'Done';
      addSystemLog('HOTKEY', `Toggled status for #${task.id}`);
      return currentTasks.map((t, i) => (i === idx ? { ...t, status: nextStatus } : t));
    });
  }, [addSystemLog]);

  const triggerKeyFeedback = useCallback((combo, label) => {
    setLastTriggeredKey({ combo, label, timestamp: Date.now() });
    addSystemLog('HOTKEY', `${combo} → ${label}`);
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
      focusedTaskIndex,
      shortcutHelpOpen,
      lastTriggeredKey,
      toggleSidebar,
      toggleTerminal,
      setActivePane,
      setCanvasViewMode,
      setActiveTaskId,
      setCommandPaletteOpen,
      setQuickSwitcherOpen,
      setShortcutHelpOpen,
      setFocusedTaskIndex,
      addSystemLog,
      clearSystemLogs,
      moveTaskFocus,
      toggleFocusedTaskDone,
      triggerKeyFeedback,
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
      focusedTaskIndex,
      shortcutHelpOpen,
      lastTriggeredKey,
      toggleSidebar,
      toggleTerminal,
      setActivePane,
      setCanvasViewMode,
      setActiveTaskId,
      setCommandPaletteOpen,
      setQuickSwitcherOpen,
      setShortcutHelpOpen,
      setFocusedTaskIndex,
      addSystemLog,
      clearSystemLogs,
      moveTaskFocus,
      toggleFocusedTaskDone,
      triggerKeyFeedback,
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

import { useEffect, useRef } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

/**
 * Input Focus Guardrail — returns true when the active DOM element is a text
 * input surface (input / textarea / select / contenteditable). Single-key
 * shortcuts must not fire while the user is typing.
 */
export function isEditableElement(target) {
  if (!target || target === document.body || target === document.documentElement) {
    return false;
  }
  const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    // Only text-like inputs trap single-key hotkeys (checkbox/radio should not).
    const type = (target.type || 'text').toLowerCase();
    const nonText = ['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color'];
    if (nonText.includes(type) && !target.isContentEditable) return false;
    return true;
  }
  return target.isContentEditable === true;
}

/**
 * Centralized Global Keyboard Engine (Step 2).
 * Mount once inside AppShell — it owns every workspace hotkey and routes them
 * through WorkspaceContext so all panes stay in sync.
 */
export function useKeyboardEngine() {
  const {
    toggleSidebar,
    toggleTerminal,
    setActivePane,
    setCanvasViewMode,
    setCommandPaletteOpen,
    setQuickSwitcherOpen,
    setShortcutHelpOpen,
    moveTaskFocus,
    toggleFocusedTaskDone,
    triggerKeyFeedback,
    addSystemLog,
    setIsCreatingTask,
    setEditingTaskId,
    updateTaskPriority,
    cycleFocusedTaskStatus,
    triggerAgentOnTask,
    canvasViewMode,
    commandPaletteOpen,
    quickSwitcherOpen,
    shortcutHelpOpen,
    isCreatingTask,
    editingTaskId,
    sidebarOpen,
    terminalOpen,
    filteredTasks,
    focusedTaskIndex,
    activeTaskId,
  } = useWorkspace();

  // Refs so the key handler always reads the freshest values without re-binding.
  const filteredTasksRef = useRef([]);
  const focusedTaskIndexRef = useRef(0);
  const activeTaskIdRef = useRef(null);
  filteredTasksRef.current = filteredTasks;
  focusedTaskIndexRef.current = focusedTaskIndex;
  activeTaskIdRef.current = activeTaskId;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const editing = isEditableElement(e.target);
      const modalOpen = commandPaletteOpen || quickSwitcherOpen || shortcutHelpOpen;
      // Step 3: inline create/rename rows are transient modals too — their own
      // inputs handle Enter/Esc locally, so global single keys stay suppressed.
      const inlineComposerOpen = isCreatingTask || editingTaskId !== null;
      const trapOpen = modalOpen || inlineComposerOpen;
      const mod = e.metaKey || e.ctrlKey;

      // ---- B. Global modifier shortcuts (fire even while typing) ----------
      if (mod && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
            triggerKeyFeedback('Cmd+B', 'Toggle Sidebar');
            return;
          case 'j':
            e.preventDefault();
            e.stopPropagation();
            toggleTerminal();
            triggerKeyFeedback('Cmd+J', 'Toggle Terminal');
            return;
          case 'k':
            // Step 5: Cmd+K toggles the palette and never stacks with the
            // Quick Switcher — opening one closes the other.
            e.preventDefault();
            e.stopPropagation();
            if (commandPaletteOpen) {
              setCommandPaletteOpen(false);
            } else {
              setQuickSwitcherOpen(false);
              setCommandPaletteOpen(true);
            }
            triggerKeyFeedback('Cmd+K', 'Omni Composer');
            return;
          case 'p':
            e.preventDefault();
            e.stopPropagation();
            if (quickSwitcherOpen) {
              setQuickSwitcherOpen(false);
            } else {
              setCommandPaletteOpen(false);
              setQuickSwitcherOpen(true);
            }
            triggerKeyFeedback('Cmd+P', 'Quick Jump');
            return;
          default:
            return;
        }
      }

      // ---- Escape: priority cascade (works everywhere, incl. inputs) -------
      if (e.key === 'Escape') {
        // Step 3: cancel inline create / rename first when nothing else is open.
        if (!modalOpen && inlineComposerOpen) {
          e.preventDefault();
          setIsCreatingTask(false);
          setEditingTaskId(null);
          triggerKeyFeedback('Esc', 'Cancelled Inline Edit');
          return;
        }
        if (modalOpen) {
          e.preventDefault();
          setCommandPaletteOpen(false);
          setQuickSwitcherOpen(false);
          setShortcutHelpOpen(false);
          triggerKeyFeedback('Esc', 'Closed Modals');
          return;
        }
        if (editing) {
          e.preventDefault();
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
          addSystemLog('HOTKEY', 'Escape → Blurred input (focus trap released)');
          return;
        }
        if (canvasViewMode !== 'stream') {
          e.preventDefault();
          setCanvasViewMode('stream');
          addSystemLog('HOTKEY', 'Escape -> Returned to Stream View');
          return;
        }
        return;
      }

      // ---- A. Input guardrail: block everything else while typing ---------
      if (editing) return;

      // ---- C. Pane focus switching: Alt + 1/2/3 ----------------------------
      if (e.altKey && !mod) {
        if (e.key === '1') {
          e.preventDefault();
          setActivePane('sidebar');
          if (!sidebarOpen) toggleSidebar();
          triggerKeyFeedback('Alt+1', 'Focus Sidebar');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setActivePane('canvas');
          triggerKeyFeedback('Alt+2', 'Focus Canvas');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setActivePane('terminal');
          if (!terminalOpen) toggleTerminal();
          triggerKeyFeedback('Alt+3', 'Focus Terminal');
          return;
        }
        return;
      }

      // ---- D. Single-key canvas ergonomics ---------------------------------
      // When a modal (or inline composer) is open, swallow remaining single
      // keys (Esc handled above).
      if (trapOpen) return;

      // Step 4: in doc view, most stream-only keys stay dormant so users can
      // write naturally; only Esc (above), d and ? remain active here.
      const inDoc = canvasViewMode === 'doc';
      // Step 6: inside the AI Diff view, j/k/x/c/s/1-4 are dormant — the diff
      // surface owns its own merge controls; keep r (re-dispatch), Enter/Esc
      // (back to stream) and ? alive for operator ergonomics.
      const inDiff = canvasViewMode === 'diff';

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          if (inDiff) return;
          e.preventDefault();
          moveTaskFocus('down');
          triggerKeyFeedback(e.key === 'j' ? 'j' : '↓', 'Next Task');
          return;
        case 'k':
        case 'ArrowUp':
          if (inDiff) return;
          e.preventDefault();
          moveTaskFocus('up');
          triggerKeyFeedback(e.key === 'k' ? 'k' : '↑', 'Previous Task');
          return;
        case 'x':
          if (inDoc || inDiff) return; // dormant inside spec editor & diff view
          e.preventDefault();
          toggleFocusedTaskDone();
          triggerKeyFeedback('x', 'Toggle Done');
          return;
        case 'Enter':
          e.preventDefault();
          if (canvasViewMode === 'stream') {
            setCanvasViewMode('doc');
          } else if (inDoc) {
            setCanvasViewMode('stream'); // Enter toggles back from doc
          } else if (inDiff) {
            setCanvasViewMode('stream'); // Enter returns from diff review
          }
          triggerKeyFeedback('Enter', canvasViewMode === 'stream' ? 'Open Spec Doc' : 'Return to Stream');
          return;
        case 'd':
          if (inDiff) return; // already reviewing the diff
          e.preventDefault();
          setCanvasViewMode('diff');
          triggerKeyFeedback('d', 'Inspect AI Diff');
          return;
        // ---- Step 3: stream power shortcuts ------------------------------
        case 'c':
          if (inDoc || inDiff) return;
          e.preventDefault();
          setIsCreatingTask(true);
          triggerKeyFeedback('c', 'New Inline Task');
          return;
        case 'e':
          e.preventDefault();
          if (canvasViewMode === 'stream') {
            const focused = filteredTasksRef.current[focusedTaskIndexRef.current];
            if (focused) {
              setEditingTaskId(focused.id);
              triggerKeyFeedback('e', 'Inline Rename');
            }
          }
          return;
        case 's':
          if (inDoc || inDiff) return;
          e.preventDefault();
          cycleFocusedTaskStatus();
          triggerKeyFeedback('s', 'Cycle Status');
          return;
        case 'r':
          if (inDoc) return;
          e.preventDefault();
          triggerAgentOnTask(activeTaskIdRef.current);
          triggerKeyFeedback('r', 'Run AI Agent');
          return;
        case '1':
        case '2':
        case '3':
        case '4': {
          if (inDoc || inDiff) return;
          e.preventDefault();
          const priority = `P${Number(e.key) - 1}`;
          const focused = filteredTasksRef.current[focusedTaskIndexRef.current];
          if (focused) {
            updateTaskPriority(focused.id, priority);
            triggerKeyFeedback(e.key, `Set Priority ${priority}`);
          }
          return;
        }
        case '?':
          e.preventDefault();
          setShortcutHelpOpen(!shortcutHelpOpen);
          triggerKeyFeedback('?', 'Keyboard Map');
          return;
        case '[':
          e.preventDefault();
          setActivePane('sidebar');
          if (!sidebarOpen) toggleSidebar();
          triggerKeyFeedback('[', 'Focus Prev Pane');
          return;
        case ']':
          e.preventDefault();
          setActivePane('terminal');
          if (!terminalOpen) toggleTerminal();
          triggerKeyFeedback(']', 'Focus Next Pane');
          return;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleSidebar,
    toggleTerminal,
    setActivePane,
    setCanvasViewMode,
    setCommandPaletteOpen,
    setQuickSwitcherOpen,
    setShortcutHelpOpen,
    moveTaskFocus,
    toggleFocusedTaskDone,
    triggerKeyFeedback,
    addSystemLog,
    setIsCreatingTask,
    setEditingTaskId,
    updateTaskPriority,
    cycleFocusedTaskStatus,
    triggerAgentOnTask,
    canvasViewMode,
    commandPaletteOpen,
    quickSwitcherOpen,
    shortcutHelpOpen,
    isCreatingTask,
    editingTaskId,
    sidebarOpen,
    terminalOpen,
  ]);
}

export default useKeyboardEngine;

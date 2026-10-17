import { useEffect } from 'react';
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
    canvasViewMode,
    commandPaletteOpen,
    quickSwitcherOpen,
    shortcutHelpOpen,
    sidebarOpen,
    terminalOpen,
  } = useWorkspace();

  useEffect(() => {
    const handleKeyDown = (e) => {
      const editing = isEditableElement(e.target);
      const modalOpen = commandPaletteOpen || quickSwitcherOpen || shortcutHelpOpen;
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
            e.preventDefault();
            e.stopPropagation();
            setCommandPaletteOpen(!commandPaletteOpen);
            triggerKeyFeedback('Cmd+K', 'Omni Composer');
            return;
          case 'p':
            e.preventDefault();
            e.stopPropagation();
            setQuickSwitcherOpen(!quickSwitcherOpen);
            triggerKeyFeedback('Cmd+P', 'Quick Jump');
            return;
          default:
            return;
        }
      }

      // ---- Escape: priority cascade (works everywhere, incl. inputs) -------
      if (e.key === 'Escape') {
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
      // When a modal is open, swallow remaining single keys (Esc handled above).
      if (modalOpen) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          moveTaskFocus('down');
          triggerKeyFeedback(e.key === 'j' ? 'j' : '↓', 'Next Task');
          return;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          moveTaskFocus('up');
          triggerKeyFeedback(e.key === 'k' ? 'k' : '↑', 'Previous Task');
          return;
        case 'x':
          e.preventDefault();
          toggleFocusedTaskDone();
          triggerKeyFeedback('x', 'Toggle Done');
          return;
        case 'Enter':
          e.preventDefault();
          if (canvasViewMode === 'stream') {
            setCanvasViewMode('doc');
          }
          triggerKeyFeedback('Enter', 'Open Spec Doc');
          return;
        case 'd':
          e.preventDefault();
          setCanvasViewMode('diff');
          triggerKeyFeedback('d', 'Inspect AI Diff');
          return;
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
    canvasViewMode,
    commandPaletteOpen,
    quickSwitcherOpen,
    shortcutHelpOpen,
    sidebarOpen,
    terminalOpen,
  ]);
}

export default useKeyboardEngine;

import React from 'react';
import TopCommandBar from './TopCommandBar';
import LeftSidebar from './LeftSidebar';
import CenterCanvas from './CenterCanvas';
import StatusBar from './StatusBar';
import RightTerminal from '../terminal/RightTerminal';
import ShortcutHelpModal from '../modals/ShortcutHelpModal';
import { useKeyboardEngine } from '../../hooks/useKeyboardEngine';

function AppShell() {
  // Step 2 — global keyboard interceptor mounted once at the shell level.
  useKeyboardEngine();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-canvas)] text-zinc-100 antialiased">
      <TopCommandBar />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftSidebar />
        <CenterCanvas />
        <RightTerminal />
      </div>
      <StatusBar />
      <ShortcutHelpModal />
    </div>
  );
}

export default AppShell;

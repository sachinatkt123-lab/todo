import React from 'react';
import { WorkspaceProvider } from './context/WorkspaceContext';
import AppShell from './components/layout/AppShell';

// Root shell: every Step-1 surface (TopCommandBar, LeftSidebar, CenterCanvas,
// RightTerminal, StatusBar) lives inside <AppShell />, which shares state via
// the single WorkspaceContext source of truth.
export default function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}

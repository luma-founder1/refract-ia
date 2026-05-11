import React from 'react';
import { AppShell } from './pages/AppShell';
import { FilesProvider } from './context/FilesContext';
import { AuthProvider } from './lib/AuthContext';

/**
 * Root App component.
 * Wraps with AuthProvider and FilesProvider.
 * App opens directly into the main shell (or auth page if not authenticated).
 */
export const App: React.FC = () => {
  return (
    <AuthProvider>
      <FilesProvider>
        <AppShell />
      </FilesProvider>
    </AuthProvider>
  );
};

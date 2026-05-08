import React, { useState } from 'react';
import { HomePage } from './HomePage';
import { ProjectsPage } from './ProjectsPage';
import { ReposPage } from './ReposPage';
import { GuidelinesPage } from './GuidelinesPage';
import { SettingsPage } from './SettingsPage';
import { ProjectView } from './projectView/ProjectView';

export type Page = 'home' | 'projects' | 'repos' | 'guidelines' | 'settings' | 'projectView' | 'reports' | 'chat' | 'deals' | 'accounts' | 'competitors' | 'feedback' | 'review';

export const AppShell: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleNavigate = (page: Page | string, params?: any) => {
    if (params?.projectId) {
      setActiveProjectId(params.projectId);
    }
    const normalizedPage = page === 'project-view' ? 'projectView' : (page as Page);
    setActivePage(normalizedPage);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':
      case 'reports':
      case 'chat':
      case 'accounts':
      case 'feedback':
      case 'review':
        return <HomePage onNavigate={handleNavigate} />;
      case 'projects':
      case 'deals':
        return <ProjectsPage onOpenProject={(id) => handleNavigate('projectView', { projectId: id })} />;
      case 'repos':
      case 'competitors':
        return <ReposPage onNavigate={handleNavigate} />;
      case 'guidelines':  return <GuidelinesPage />;
      case 'settings':    return <SettingsPage />;
      case 'projectView': return <ProjectView projectId={activeProjectId} onBack={() => setActivePage('home')} />;
      default:            return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--background)' }}>
      <main style={{ flex: 1, overflow: 'hidden', height: '100vh' }}>
        {renderPage()}
      </main>
    </div>
  );
};

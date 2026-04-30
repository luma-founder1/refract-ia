import React, { useState } from 'react';
import { Sidebar, Page } from '../components/Sidebar';
import { HomePage } from './HomePage';
import { ProjectsPage } from './ProjectsPage';
import { ReposPage } from './ReposPage';
import { GuidelinesPage } from './GuidelinesPage';
import { SettingsPage } from './SettingsPage';
import { ProjectView } from './projectView/ProjectView';

export const AppShell: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleNavigate = (page: Page | string, params?: any) => {
    // If navigation comes with a projectId, store it
    if (params?.projectId) {
      setActiveProjectId(params.projectId);
    }
    // Convert 'project-view' to 'projectView' if needed
    const normalizedPage = page === 'project-view' ? 'projectView' : (page as Page);
    setActivePage(normalizedPage);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':        return <HomePage onNavigate={handleNavigate} />;
      case 'projects':    return <ProjectsPage onOpenProject={(id) => handleNavigate('projectView', { projectId: id })} />;
      case 'repos':       return <ReposPage />;
      case 'guidelines':  return <GuidelinesPage />;
      case 'settings':    return <SettingsPage />;
      case 'projectView': return <ProjectView projectId={activeProjectId} onBack={() => setActivePage('home')} />;
      default:            return <HomePage onNavigate={handleNavigate} />;
    }
  };

  // Hide sidebar in project view (full screen)
  const showSidebar = activePage !== 'projectView';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0a0a0a' }}>
      {showSidebar && (
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      )}
      <main style={{ flex: 1, overflow: 'hidden', height: '100vh' }}>
        {renderPage()}
      </main>
    </div>
  );
};

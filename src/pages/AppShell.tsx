import React, { useState, useEffect } from 'react';
import { HomePage } from './HomePage';
import { ProjectsPage } from './ProjectsPage';
import { ReposPage } from './ReposPage';
import { GuidelinesPage } from './GuidelinesPage';
import { SettingsPage } from './SettingsPage';
import { ProjectView } from './projectView/ProjectView';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../lib/AuthContext';
import { AuthPage } from './AuthPage';
import { SplashScreen } from '../components/SplashScreen';
import { OnboardingPage } from './OnboardingPage';

export type Page = 'home' | 'projects' | 'repos' | 'guidelines' | 'settings' | 'projectView' | 'reports' | 'chat' | 'deals' | 'accounts' | 'competitors' | 'feedback' | 'review';

export const AppShell: React.FC = () => {
  const { session, loading, profile, refreshProfile } = useAuth();
  const [activePage, setActivePage] = useState<Page>('home');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (session && !profile) {
      // Try to refresh/create profile if it wasn't loaded yet
      refreshProfile().catch(() => {})
    }
  }, [session, profile, refreshProfile])


  // Auth gate: show splash screen while loading auth state
  if (loading) {
    return <SplashScreen />;
  }

  // Auth gate: show login page if not authenticated
  if (!session) {
    return <AuthPage />;
  }

  // Wait for profile to load after session is established
  if (session && !profile) {
    return <SplashScreen />;
  }

  // Onboarding gate: show onboarding if user hasn't completed it
  if (profile && !profile.onboarding_completed) {
    return (
      <OnboardingPage
        onComplete={async () => {
          try {
            sessionStorage.removeItem('justSignedUp')
            await refreshProfile()
          } catch (err) {
            console.error('onboarding onComplete refreshProfile failed', err)
          }
        }}
      />
    )
  }

  // User is authenticated and onboarding is complete, show app

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
        return <ProjectsPage onOpenProject={(id) => handleNavigate('projectView', { projectId: id })} onNavigate={handleNavigate} />;
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
      {activePage !== 'projectView' && (
        <Sidebar activePage={activePage} onNavigate={(p) => handleNavigate(p)} />
      )}
      <main style={{ flex: 1, overflow: 'hidden', height: '100vh' }}>
        {renderPage()}
      </main>
    </div>
  );
};

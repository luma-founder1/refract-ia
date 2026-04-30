import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  FileText,
  GitBranch,
} from 'lucide-react';
import { Page } from '../components/Sidebar';
import { IPC_CHANNELS, Project, Activity } from '../../shared/ipc';
import { NewProjectModal } from '../components/NewProjectModal';

interface HomePageProps {
  onNavigate: (page: Page | string, params?: any) => void;
}

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
};

const StatusBadge: React.FC<{ status: 'Refracted' | 'Pending' | 'Not analysed' | string }> = ({ status }) => {
  const map: Record<string, { cls: string, label: string }> = {
    Refracted:     { cls: 'badge badge-success', label: 'Refracted' },
    Pending:       { cls: 'badge badge-medium',  label: 'Pending' },
    'Not analysed':{ cls: 'badge badge-low',     label: 'Not analysed' },
  };
  const { cls, label } = map[status] || map['Not analysed'];
  return <span className={cls}>{label}</span>;
};

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [activity, setActivity]   = useState<Activity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!window.electron) {
          console.error('window.electron is not defined — preload script may not be loaded');
          return;
        }
        const [p, a] = await Promise.all([
          window.electron.invoke(IPC_CHANNELS.GET_RECENT_PROJECTS),
          window.electron.invoke(IPC_CHANNELS.GET_ACTIVITY),
        ]);
        setProjects(p ?? []);
        setActivity(a ?? []);
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'created': return <Plus size={13} />;
      case 'connected': return <GitBranch size={13} />;
      case 'refracted': return <RefreshCw size={13} />;
      case 'docs': return <FileText size={13} />;
      default: return <RefreshCw size={13} />;
    }
  };

  return (
    <div style={{ padding: '32px 36px', minHeight: '100%' }}>
      <style>{`
        @keyframes custom-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', letterSpacing: '-0.4px' }}>
          {greeting()}
        </h1>
        <button className="btn btn-secondary" onClick={() => setShowModal(true)}>
          <Plus size={13} />
          New Project
        </button>
      </div>

      {/* Recent Projects */}
      <div style={{ marginTop: 36 }}>
        <p className="section-label" style={{ marginBottom: 14 }}>Projects</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {loading ? (
            // Skeleton Loading State
            <>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="card"
                  style={{
                    padding: 18,
                    background: '#111',
                    border: '1px solid #1c1c1c',
                    borderRadius: 7,
                    minHeight: 100,
                    animation: 'custom-pulse 1.2s infinite ease-in-out',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: '60%', height: 10, background: '#1c1c1c', borderRadius: 4 }} />
                    <div style={{ width: '40%', height: 10, background: '#1c1c1c', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: '60%', height: 10, background: '#1c1c1c', borderRadius: 4 }} />
                </div>
              ))}
            </>
          ) : (
            // Loaded State
            <>
              {projects.map(p => (
                <div 
                  key={p.id} 
                  className="card" 
                  style={{ padding: 18, cursor: 'pointer' }}
                  onClick={() => onNavigate('project-view', { projectId: p.id })}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{p.name}</span>
                    <span
                      className="badge badge-muted"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <GitBranch size={9} />
                      {p.branch || 'main'}
                    </span>
                  </div>

                  {/* Repo path */}
                  <p
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      color: '#333',
                      margin: '8px 0 16px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.repo || p.path || ''}
                  </p>

                  {/* Bottom row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <StatusBadge status={p.status} />
                    <span style={{ fontSize: 10, color: '#2a2a2a' }}>
                      {p.last_run ? p.last_run : p.created_at ? 'Just now' : ''}
                    </span>
                  </div>
                </div>
              ))}

              {/* New project card */}
              <button
                onClick={() => setShowModal(true)}
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: '1px dashed #1c1c1c',
                  cursor: 'pointer',
                  minHeight: 100,
                  width: '100%',
                  borderRadius: 7,
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#333';
                  (e.currentTarget as HTMLButtonElement).querySelectorAll('.new-card-text').forEach(el => {
                    (el as HTMLElement).style.color = '#444';
                  });
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#1c1c1c';
                  (e.currentTarget as HTMLButtonElement).querySelectorAll('.new-card-text').forEach(el => {
                    (el as HTMLElement).style.color = '#222';
                  });
                }}
              >
                <Plus size={16} className="new-card-text" style={{ color: '#222', transition: 'color 0.12s ease' }} />
                <span
                  className="new-card-text"
                  style={{ fontSize: 11, color: '#222', transition: 'color 0.12s ease' }}
                >
                  New project
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Activity */}
      <div style={{ marginTop: 40 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Activity</p>
        <div>
          {activity.length === 0 && !loading && (
             <div style={{ fontSize: 12, color: '#555', padding: '4px' }}>No recent activity.</div>
          )}
          {activity.map(a => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 38,
                padding: '0 4px',
                borderBottom: '1px solid #0f0f0f',
                borderRadius: 4,
                transition: 'background 0.12s ease',
                cursor: 'default',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#111'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#2a2a2a', display: 'flex', alignItems: 'center' }}>
                  {getActivityIcon(a.type)}
                </span>
                <span style={{ fontSize: 12, color: '#fff' }}>
                  {a.description}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#2a2a2a' }}>
                {a.created_at ? 'Just now' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onProjectCreated={(project) => {
            setProjects(prev => [project, ...prev]);
            setShowModal(false);
            onNavigate('project-view', { projectId: project.id });
          }}
        />
      )}
    </div>
  );
};

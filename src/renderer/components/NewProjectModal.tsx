import React, { useState } from 'react';
import { Folder, GitBranch, X, Loader2 } from 'lucide-react';
import { IPC_CHANNELS, Project } from '../../shared/ipc';

interface Props {
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const NewProjectModal: React.FC<Props> = ({ onClose, onProjectCreated }) => {
  const [selected, setSelected] = useState<'folder' | 'repo' | null>(null);
  const [repoUrl, setRepoUrl]   = useState('');
  const [branch, setBranch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleOpenFolder = async () => {
    setLoading(true);
    setError('');
    try {
      const project = await window.electron.invoke(IPC_CHANNELS.OPEN_PROJECT);
      if (!project) { setError('No folder selected.'); return; }
      onProjectCreated(project);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectRepo = async () => {
    if (!repoUrl.startsWith('http')) { setError('Enter a valid repository URL.'); return; }
    setLoading(true);
    setError('');
    try {
      const project = await window.electron.invoke(IPC_CHANNELS.CONNECT_REPO, {
        url: repoUrl,
        branch: branch || 'main',
      });
      if (!project) { setError('Failed to connect repository.'); return; }
      onProjectCreated(project);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#111', border: '1px solid #1c1c1c', borderRadius: 8,
            width: 480, padding: 24, position: 'relative',
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#444', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444')}
          >
            <X size={14} />
          </button>

          {/* Header */}
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '-0.3px', margin: 0 }}>
            New Project
          </h2>
          <p style={{ fontSize: 12, color: '#555', marginTop: 4, marginBottom: 0 }}>
            Open a local folder or connect a repository.
          </p>

          {/* Option cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
            {[
              { key: 'folder' as const, icon: <Folder size={20} />, title: 'Local Folder', sub: 'Open a project from your machine.' },
              { key: 'repo'   as const, icon: <GitBranch size={20} />, title: 'Repository', sub: 'Clone from GitHub or GitLab.' },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                style={{
                  background: selected === opt.key ? '#0d1a2e' : '#0a0a0a',
                  border: `1px solid ${selected === opt.key ? '#3B82F6' : '#1c1c1c'}`,
                  borderRadius: 7, padding: 18, cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={e => { if (selected !== opt.key) (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a'; }}
                onMouseLeave={e => { if (selected !== opt.key) (e.currentTarget as HTMLDivElement).style.borderColor = '#1c1c1c'; }}
              >
                <div style={{ color: '#fff', marginBottom: 10 }}>{opt.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#fff', margin: 0 }}>{opt.title}</p>
                <p style={{ fontSize: 11, color: '#555', margin: '4px 0 0' }}>{opt.sub}</p>
              </div>
            ))}
          </div>

          {/* Step 2a — Folder */}
          {selected === 'folder' && (
            <button
              onClick={handleOpenFolder}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
            >
              {loading
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Opening...</>
                : 'Choose Folder'
              }
            </button>
          )}

          {/* Step 2b — Repo */}
          {selected === 'repo' && (
            <div style={{ marginTop: 20 }}>
              <input
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#0a0a0a', border: '1px solid #1c1c1c',
                  borderRadius: 5, height: 34, padding: '0 12px',
                  fontSize: 13, fontFamily: 'Geist Mono, monospace',
                  color: '#fff', outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1c1c1c')}
              />
              <input
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="Branch (default: main)"
                style={{
                  width: '100%', boxSizing: 'border-box', marginTop: 8,
                  background: '#0a0a0a', border: '1px solid #1c1c1c',
                  borderRadius: 5, height: 34, padding: '0 12px',
                  fontSize: 13, fontFamily: 'Geist Mono, monospace',
                  color: '#fff', outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#1c1c1c')}
              />
              <button
                onClick={handleConnectRepo}
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              >
                {loading
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Connecting...</>
                  : 'Clone Repository'
                }
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: 11, color: '#ef4444', marginTop: 12, marginBottom: 0 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

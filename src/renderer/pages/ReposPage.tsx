import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Search, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { IPC_CHANNELS, Project } from '../../shared/ipc';

// GitHub SVG icon
const GitHubIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

// GitLab SVG icon
const GitLabIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
  </svg>
);

interface Account {
  id: number;
  provider: 'GitHub' | 'GitLab';
  name: string;
  username: string;
  connected: boolean;
}

const ACCOUNTS: Account[] = [
  { id: 1, provider: 'GitHub', name: 'GitHub',  username: '@lopes',    connected: true },
  { id: 2, provider: 'GitLab', name: 'GitLab',  username: '@lopes-gl', connected: false },
];

const COL = { name: '28%', provider: '20%', branch: '16%', lastAnalysed: '20%', actions: '16%' };

export const ReposPage: React.FC = () => {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRepos() {
      setLoading(true);
      try {
        const p = await window.electron.invoke(IPC_CHANNELS.GET_ALL_PROJECTS);
        // Filter out those without a repo
        setRepos((p || []).filter((proj: Project) => !!proj.repo));
      } catch (err) {
        console.error('Failed to load repos', err);
      }
      setLoading(false);
    }
    fetchRepos();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to disconnect this repository?')) {
      await window.electron.invoke(IPC_CHANNELS.DELETE_PROJECT, id);
      setRepos(prev => prev.filter(r => r.id !== id));
    }
  };

  const filtered = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || (r.repo && r.repo.toLowerCase().includes(search.toLowerCase())));

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 className="page-title">Repositories</h1>
      </div>

      {/* Connected accounts */}
      <p className="section-label" style={{ marginBottom: 12 }}>Connected accounts</p>
      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        {ACCOUNTS.map(acc => (
          <div
            key={acc.id}
            className="card"
            style={{
              flex: 1,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'default',
            }}
          >
            <span style={{ color: '#fff', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {acc.provider === 'GitHub' ? <GitHubIcon size={20} /> : <GitLabIcon size={20} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{acc.name}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>{acc.username}</div>
            </div>
            {acc.connected ? (
              <>
                <span className="badge badge-success">Connected</span>
                <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>Disconnect</button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
                <Plus size={11} />
                Connect
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Repos list */}
      <p className="section-label" style={{ marginBottom: 12 }}>Repositories</p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#333',
            pointerEvents: 'none',
          }}
        />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          placeholder="Search repositories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          borderBottom: '1px solid #1c1c1c',
          padding: '0 8px',
        }}
      >
        {(['Name', 'Provider', 'Branch', 'Last analysed', 'Actions'] as const).map((col, i) => (
          <span
            key={col}
            className="section-label"
            style={{
              width: [COL.name, COL.provider, COL.branch, COL.lastAnalysed, COL.actions][i],
              letterSpacing: '1.2px',
            }}
          >
            {col}
          </span>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 13, marginTop: 40, justifyContent: 'center' }}>
          <Loader2 size={14} className="spin" /> Loading repositories...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 13, marginTop: 20 }}>
          {repos.length === 0 ? 'No repositories connected yet.' : 'No repositories found matching your search.'}
        </div>
      ) : (
        <>
          {/* Rows */}
          {filtered.map(r => {
            const isGitLab = r.repo?.includes('gitlab');
            const providerName = isGitLab ? 'GitLab' : 'GitHub';
            return (
              <div
                key={r.id}
                onMouseEnter={() => setHoveredRow(r.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 44,
                  borderBottom: '1px solid #0d0d0d',
                  background: hoveredRow === r.id ? '#111' : 'transparent',
                  padding: '0 8px',
                  transition: 'background 0.12s ease',
                }}
              >
                <span style={{ width: COL.name, fontSize: 13, fontWeight: 500, color: '#fff' }}>{r.name}</span>
                <span style={{ width: COL.provider, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#888', display: 'flex' }}>
                    {isGitLab ? <GitLabIcon size={13} /> : <GitHubIcon size={13} />}
                  </span>
                  <span style={{ fontSize: 11, color: '#444' }}>{providerName}</span>
                </span>
                <span style={{ width: COL.branch }}>
                  <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <GitBranch size={9} />{r.branch || 'main'}
                  </span>
                </span>
                <span style={{ width: COL.lastAnalysed, fontSize: 11, color: '#333' }}>{r.last_run ? 'Just now' : 'Never'}</span>
                <span
                  style={{
                    width: COL.actions,
                    display: 'flex',
                    gap: 6,
                    opacity: hoveredRow === r.id ? 1 : 0,
                    transition: 'opacity 0.12s ease',
                  }}
                >
                  <button className="btn btn-primary btn-sm">
                    <RefreshCw size={10} />
                    Analyse
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ padding: '0 8px' }} onClick={() => handleDelete(r.id)}>
                    <Trash2 size={10} />
                  </button>
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

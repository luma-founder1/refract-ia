import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, ExternalLink, Download, Lock, Globe } from 'lucide-react';
import { Project } from '../shared/types';
import { getAllProjects } from '../lib/db';

// GitHub SVG icon
const GitHubIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const COL = { name: '35%', visibility: '15%', lastPush: '25%', actions: '25%' };

export const ReposPage: React.FC<{ onNavigate: (page: string, params?: any) => void }> = ({ onNavigate }) => {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloningUrl, setCloningUrl] = useState(false);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const p = await getAllProjects();
      setRepos((p || []).filter((proj: Project) => !!proj.repo).map((r: Project) => ({
        id: r.id,
        name: r.name,
        full_name: r.repo,
        private: false,
        updated_at: r.last_run,
        isLocal: true,
        path: r.path
      })));
    } catch (err) {
      console.error('Failed to load repos', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleCloneFromUrl = async () => {
    // GitHub cloning not available in web version yet
    alert('GitHub cloning not available in web version yet. Use folder upload from the Projects page instead.');
  };

  const filtered = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    (r.full_name && r.full_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto', background: 'var(--background)' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        @keyframes pulse { 0% { opacity: 0.3 } 50% { opacity: 0.6 } 100% { opacity: 0.3 } }
        .skeleton { background: var(--muted); border-radius: var(--radius); animation: pulse 1.5s infinite ease-in-out; }
      `}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 className="page-title" style={{ fontSize: 28, marginBottom: 4 }}>Repositories</h1>
      </div>

      {/* Clone repository */}
      <p className="section-label" style={{ marginBottom: 12 }}>Clone repository (Coming Soon)</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 32, opacity: 0.5 }}>
        <input
          value={cloneUrl}
          onChange={e => setCloneUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className="input font-mono"
          style={{ flex: 1, height: 40 }}
          disabled
        />
        <button
          onClick={handleCloneFromUrl}
          disabled={true}
          className="btn btn-primary"
          style={{ height: 40, padding: '0 20px', whiteSpace: 'nowrap' }}
        >
          <Download size={16} />
          Clone & Analyse
        </button>
      </div>

      {/* Repos list */}
      <p className="section-label" style={{ marginBottom: 12 }}>Local Repositories</p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
        <input 
          className="input"
          style={{ width: '100%', height: 40, paddingLeft: 40 }}
          placeholder="Search local repositories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', padding: '0 16px', marginBottom: 8 }}>
        {(['Name', 'Visibility', 'Last push', 'Actions'] as const).map((col, i) => (
          <span key={col} className="section-label" style={{ width: Object.values(COL)[i], fontSize: 10 }}>{col}</span>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: i === 4 ? 'none' : '1px solid var(--border)' }}>
              <div className="skeleton" style={{ width: '30%', height: 12 }} />
              <div style={{ width: '15%' }}><div className="skeleton" style={{ width: 40, height: 12 }} /></div>
              <div className="skeleton" style={{ width: '25%', height: 12 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>No local repositories found.</p>
          </div>
        ) : (
          filtered.map((repo, idx) => (
            <div 
              key={repo.id}
              onMouseEnter={() => setHoveredRow(repo.id)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                height: 52, 
                padding: '0 16px', 
                borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--border)',
                background: hoveredRow === repo.id ? 'var(--secondary)' : 'transparent',
                transition: 'background 0.1s ease'
              }}
            >
              <div style={{ width: COL.name, display: 'flex', alignItems: 'center', gap: 10 }}>
                <GitHubIcon size={16} />
                <span style={{ fontSize: 14, color: 'var(--foreground)', fontWeight: 500 }}>{repo.name}</span>
              </div>
              <div style={{ width: COL.visibility }}>
                <span className={repo.private ? 'badge badge-error' : 'badge badge-success'} style={{ padding: '2px 8px', fontSize: 10, textTransform: 'uppercase' }}>
                  {repo.private ? <Lock size={10} style={{ marginRight: 4 }} /> : <Globe size={10} style={{ marginRight: 4 }} />}
                  {repo.private ? 'Private' : 'Public'}
                </span>
              </div>
              <div style={{ width: COL.lastPush, fontSize: 12, color: 'var(--muted-foreground)' }}>
                {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : 'Never'}
              </div>
              <div style={{ width: COL.actions, display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => onNavigate('project-view', { projectId: repo.id })}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ExternalLink size={14} /> Open
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, GitBranch, Play, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { IPC_CHANNELS, Project } from '../../shared/ipc';
import { NewProjectModal } from '../components/NewProjectModal';

interface ProjectsPageProps {
  onOpenProject: (id: string) => void;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    Refracted:      'badge badge-success',
    Pending:        'badge badge-medium',
    'Not analysed': 'badge badge-low',
  };
  return <span className={map[status] || 'badge badge-low'}>{status}</span>;
};

const COL_WIDTHS = { name: '22%', repo: '30%', branch: '14%', status: '14%', lastRun: '12%', actions: '8%' };

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onOpenProject }) => {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const p = await window.electron.invoke(IPC_CHANNELS.GET_ALL_PROJECTS);
      setProjects(p || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent opening project
    if (confirm('Are you sure you want to delete this project?')) {
      await window.electron.invoke(IPC_CHANNELS.DELETE_PROJECT, id);
      setProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 className="page-title">Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={13} />
          New Project
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 13, marginTop: 80, justifyContent: 'center' }}>
          <Loader2 size={14} className="spin" /> Loading projects...
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 80 }}>
          <FolderOpen size={24} style={{ color: '#222' }} />
          <p style={{ fontSize: 13, color: '#333' }}>No projects yet</p>
          <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={() => setShowModal(true)}>
            <Plus size={13} /> New Project
          </button>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          {/* Table header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 32,
              borderBottom: '1px solid #1c1c1c',
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            {(['Name', 'Repo', 'Branch', 'Status', 'Last run', ''] as const).map((col, i) => (
              <span
                key={col || `action-${i}`}
                className="section-label"
                style={{
                  width: [COL_WIDTHS.name, COL_WIDTHS.repo, COL_WIDTHS.branch, COL_WIDTHS.status, COL_WIDTHS.lastRun, COL_WIDTHS.actions][i],
                  letterSpacing: '1.2px',
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          {projects.map(p => (
            <div
              key={p.id}
              onMouseEnter={() => setHoveredRow(p.id)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 44,
                borderBottom: '1px solid #0d0d0d',
                background: hoveredRow === p.id ? '#111' : 'transparent',
                padding: '0 8px',
                transition: 'background 0.12s ease',
                cursor: 'pointer',
              }}
              onClick={() => onOpenProject(p.id)}
            >
              <span style={{ width: COL_WIDTHS.name, fontSize: 13, color: '#fff', fontWeight: 500 }}>
                {p.name}
              </span>
              <span
                className="font-mono"
                style={{
                  width: COL_WIDTHS.repo, fontSize: 11, color: '#444',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8,
                }}
              >
                {p.repo || p.path}
              </span>
              <span style={{ width: COL_WIDTHS.branch }}>
                <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <GitBranch size={9} />{p.branch || 'main'}
                </span>
              </span>
              <span style={{ width: COL_WIDTHS.status }}>
                <StatusBadge status={p.status || 'Not analysed'} />
              </span>
              <span style={{ width: COL_WIDTHS.lastRun, fontSize: 11, color: '#333' }}>{p.last_run ? 'Just now' : 'Never'}</span>
              <span style={{ width: COL_WIDTHS.actions, display: 'flex', gap: 4, opacity: hoveredRow === p.id ? 1 : 0, transition: 'opacity 0.12s ease' }}>
                <button className="btn btn-ghost btn-sm" title="Run" style={{ padding: '0 7px' }} onClick={(e) => { e.stopPropagation(); onOpenProject(p.id); }}><Play size={11} /></button>
                <button className="btn btn-danger btn-sm" title="Delete" style={{ padding: '0 7px' }} onClick={(e) => handleDelete(e, p.id)}><Trash2 size={11} /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onProjectCreated={(project) => {
            setProjects(prev => [project, ...prev]);
            setShowModal(false);
            onOpenProject(project.id);
          }}
        />
      )}
    </div>
  );
};


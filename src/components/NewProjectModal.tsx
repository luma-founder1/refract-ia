import React, { useState } from 'react';
import { Folder, GitBranch, X, Loader2 } from 'lucide-react';
import { Project } from '../shared/types';
import { DropZone } from './DropZone';
import { createProject } from '../lib/db';
import { useFiles } from '../context/FilesContext';

const RELEVANT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md',
]);

const IGNORE_PATHS = ['node_modules', '.git', 'dist', 'build', '.next'];

interface Props {
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const NewProjectModal: React.FC<Props> = ({ onClose, onProjectCreated }) => {
  const [selected, setSelected] = useState<'folder' | 'repo' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setFileMap } = useFiles();

  const handleFolderUpload = async (files: File[] | FileList) => {
    setLoading(true);
    setError('');

    try {
      // Extract project name from first folder or use default
      const projectName = files[0]?.webkitRelativePath?.split('/')[0] || 'New Project';

      // Read file contents into memory
      const map = new Map<string, string>();
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const path = file.webkitRelativePath || file.name;

        const pathParts = path.split('/');
        if (IGNORE_PATHS.some(ign => pathParts.includes(ign))) continue;

        // Only read relevant extensions
        const ext = '.' + path.split('.').pop()?.toLowerCase();
        if (!RELEVANT_EXTS.has(ext)) continue;

        try {
          const content = await file.text();
          map.set(path, content);
        } catch {
          // Skip unreadable files
        }
      }

      setFileMap(map);

      let project: Project;
      try {
        project = await createProject({
          name: projectName,
          path: 'uploaded', // Will be replaced with storage_id later
          repo: null,
          branch: 'main',
          status: 'Not analysed',
          last_run: null,
        });
      } catch (err) {
        console.warn('Failed to create project in Supabase, using local fallback', err);
        project = {
          id: 'local-' + Date.now(),
          name: projectName,
          path: 'uploaded',
          repo: null,
          branch: 'main',
          status: 'Not analysed',
          last_run: null,
        };
      }

      onProjectCreated(project);
    } catch (err) {
      setError('Failed to create project. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectRepo = async () => {
    // For now, GitHub repo cloning is not implemented in web version
    setError('GitHub cloning not available in web version yet. Use folder upload instead.');
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
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          className="card"
          style={{
            background: 'var(--background)',
            width: 520, padding: '32px', position: 'relative',
            boxShadow: 'var(--shadow-border), 0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 32, height: 32, padding: 0,
            }}
          >
            <X size={16} />
          </button>

          {/* Header */}
          <h2 className="page-title" style={{ fontSize: 24, marginBottom: 8 }}>
            New Project
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 32 }}>
            Open a local folder or connect a repository.
          </p>

          {/* Option cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
              { key: 'folder' as const, icon: <Folder size={24} />, title: 'Local Folder', sub: 'Upload a project folder from your machine.' },
              { key: 'repo'   as const, icon: <GitBranch size={24} />, title: 'Repository', sub: 'Clone a remote repository (coming soon).' },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => opt.key === 'repo' ? null : setSelected(opt.key)}
                className="card"
                style={{
                  background: selected === opt.key ? 'var(--accent)' : 'var(--background)',
                  boxShadow: selected === opt.key ? '0 0 0 1px var(--ring)' : 'var(--shadow-border)',
                  padding: '24px', cursor: opt.key === 'repo' ? 'not-allowed' : 'pointer',
                  opacity: opt.key === 'repo' ? 0.5 : 1,
                }}
              >
                <div style={{ color: 'var(--foreground)', marginBottom: 12 }}>{opt.icon}</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>{opt.title}</p>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '6px 0 0', lineHeight: 1.5 }}>{opt.sub}</p>
              </div>
            ))}
          </div>

          {/* Step 2a — Folder */}
          {selected === 'folder' && (
            <div style={{ marginTop: 24 }}>
              <DropZone onFiles={handleFolderUpload} />
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, color: 'var(--muted-foreground)' }}>
                  <Loader2 size={16} className="animate-spin" /> Processing files...
                </div>
              )}
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

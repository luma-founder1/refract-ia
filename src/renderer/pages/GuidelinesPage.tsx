import React, { useState, useEffect } from 'react';
import { GitBranch, Save, Loader } from 'lucide-react';
import { IPC_CHANNELS, Project } from '../../shared/ipc';

interface ProjectGuideline {
  project: Project;
  text: string;
  isSaving: boolean;
  savedAt: string;
}

export const GuidelinesPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectGuideline[]>([]);
  const [globalText, setGlobalText] = useState('');
  const [isGlobalSaving, setIsGlobalSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const gText = await window.electron.invoke(IPC_CHANNELS.READ_GLOBAL_GUIDELINE);
        setGlobalText(gText || '');

        const allProjects: Project[] = await window.electron.invoke(IPC_CHANNELS.GET_ALL_PROJECTS);
        
        const guidelines: ProjectGuideline[] = [];
        for (const proj of allProjects) {
          if (proj.path) {
            const text = await window.electron.invoke(IPC_CHANNELS.READ_GUIDELINE, proj.path);
            guidelines.push({
              project: proj,
              text: text || '',
              isSaving: false,
              savedAt: 'Synced',
            });
          }
        }
        setProjects(guidelines);
      } catch (e) {
        console.error('Error loading guidelines', e);
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  const updateText = (id: string, text: string) =>
    setProjects(prev => prev.map(p => (p.project.id === id ? { ...p, text } : p)));

  const saveProjectGuideline = async (id: string) => {
    setProjects(prev => prev.map(p => p.project.id === id ? { ...p, isSaving: true } : p));
    const target = projects.find(p => p.project.id === id);
    if (target) {
      await window.electron.invoke(IPC_CHANNELS.WRITE_GUIDELINE, target.project.path, target.text);
      setProjects(prev => prev.map(p => p.project.id === id ? { ...p, isSaving: false, savedAt: 'Just now' } : p));
    }
  };

  const saveGlobalGuideline = async () => {
    setIsGlobalSaving(true);
    await window.electron.invoke(IPC_CHANNELS.WRITE_GLOBAL_GUIDELINE, globalText);
    setTimeout(() => setIsGlobalSaving(false), 500); // small delay for UX
  };

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title" style={{ marginBottom: 6 }}>Guidelines</h1>
        <p style={{ fontSize: 13, color: '#555' }}>
          Define rules for how Refract should transform your code.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 13 }}>
          <Loader size={14} className="spin" /> Loading guidelines...
        </div>
      ) : (
        <>
          {/* Per-project guidelines */}
          <p className="section-label" style={{ marginBottom: 14 }}>Per project</p>
          
          {projects.length === 0 ? (
            <div style={{ padding: 20, border: '1px dashed #333', borderRadius: 8, fontSize: 13, color: '#666', marginBottom: 24 }}>
              No local projects found. Create or open a project first.
            </div>
          ) : (
            projects.map(p => (
              <div
                key={p.project.id}
                className="card"
                style={{ padding: 20, marginBottom: 12, cursor: 'default' }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{p.project.name}</span>
                  <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <GitBranch size={9} />{p.project.branch}
                  </span>
                </div>

                {/* Textarea */}
                <textarea
                  className="textarea"
                  style={{ minHeight: 100 }}
                  placeholder="Write your guidelines in plain language. Example: Always use named exports. Never use any types. Split components larger than 150 lines."
                  value={p.text}
                  onChange={e => updateText(p.project.id, e.target.value)}
                />

                {/* Bottom row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 12,
                  }}
                >
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => saveProjectGuideline(p.project.id)}
                    disabled={p.isSaving}
                  >
                    {p.isSaving ? <Loader size={11} className="spin" /> : <Save size={11} />}
                    {p.isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <span style={{ fontSize: 10, color: '#555' }}>Last saved {p.savedAt}</span>
                </div>
              </div>
            ))
          )}

          {/* Global guidelines */}
          <div style={{ marginTop: 36, paddingBottom: 64 }}>
            <p className="section-label" style={{ marginBottom: 14 }}>Global</p>
            <p style={{ fontSize: 11, color: '#444', marginBottom: 12 }}>Applied to all projects.</p>

            <textarea
              className="textarea"
              style={{ minHeight: 140 }}
              placeholder="Write your guidelines in plain language. Example: Always use named exports. Never use any types. Split components larger than 150 lines."
              value={globalText}
              onChange={e => setGlobalText(e.target.value)}
            />

            <button 
              className="btn btn-primary btn-sm" 
              style={{ marginTop: 12 }}
              onClick={saveGlobalGuideline}
              disabled={isGlobalSaving}
            >
              {isGlobalSaving ? <Loader size={11} className="spin" /> : <Save size={11} />}
              {isGlobalSaving ? 'Saving...' : 'Save global guidelines'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};


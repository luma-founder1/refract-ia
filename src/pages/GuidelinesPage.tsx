import React, { useState, useEffect } from 'react';
import { GitBranch, Save, Loader } from 'lucide-react';
import { Project } from '../shared/types';
import { useAuth } from '../lib/AuthContext';
import { getAllProjects, getSetting, setSetting } from '../lib/db';

interface ProjectGuideline {
  project: Project;
  text: string;
  isSaving: boolean;
  savedAt: string;
}

export const GuidelinesPage: React.FC = () => {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<ProjectGuideline[]>([]);
  const [globalText, setGlobalText] = useState('');
  const [isGlobalSaving, setIsGlobalSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile?.id) {
        setIsLoading(false)
        return
      }
      setIsLoading(true);
      try {
        const gText = await getSetting('global_guidelines', '');
        setGlobalText(gText);

        const allProjects: Project[] = await getAllProjects(profile.id);
        
        const guidelines: ProjectGuideline[] = [];
        for (const proj of allProjects) {
          if (proj.path) {
            const text = await getSetting(`guideline_${proj.id}`, '');
            guidelines.push({
              project: proj,
              text,
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
  }, [profile?.id]);

  const updateText = (id: string, text: string) =>
    setProjects(prev => prev.map(p => (p.project.id === id ? { ...p, text } : p)));

  const saveProjectGuideline = async (id: string) => {
    setProjects(prev => prev.map(p => p.project.id === id ? { ...p, isSaving: true } : p));
    const target = projects.find(p => p.project.id === id);
    if (target) {
      await setSetting(`guideline_${target.project.id}`, target.text);
      setProjects(prev => prev.map(p => p.project.id === id ? { ...p, isSaving: false, savedAt: 'Just now' } : p));
    }
  };

  const saveGlobalGuideline = async () => {
    setIsGlobalSaving(true);
    await setSetting('global_guidelines', globalText);
    setTimeout(() => setIsGlobalSaving(false), 500);
  };

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto', background: 'var(--canvas)' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title" style={{ marginBottom: 6, fontSize: '26px', fontWeight: 400, letterSpacing: '-0.325px' }}>Guidelines</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
          Define rules for how Refract should transform your code.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-muted)', fontSize: 14 }}>
          <Loader size={16} className="spin" /> Loading guidelines...
        </div>
      ) : (
        <>
          {/* Per-project guidelines */}
          <p className="section-label" style={{ marginBottom: 14 }}>Per project</p>
          
          {projects.length === 0 ? (
            <div style={{ padding: 20, border: '1px dashed var(--hairline-strong)', borderRadius: '12px', fontSize: 14, color: 'var(--ink-muted)', marginBottom: 24, textAlign: 'center' }}>
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
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{p.project.name}</span>
                  <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <GitBranch size={9} />{p.project.branch}
                  </span>
                </div>

                {/* Textarea */}
                <textarea
                  className="textarea font-mono"
                  style={{ minHeight: 100, padding: '12px 14px', fontSize: 14, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
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
                    {p.isSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                    {p.isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Last saved {p.savedAt}</span>
                </div>
              </div>
            ))
          )}

          {/* Global guidelines */}
          <div style={{ marginTop: 36, paddingBottom: 64 }}>
            <p className="section-label" style={{ marginBottom: 14 }}>Global</p>
            <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 12 }}>Applied to all projects.</p>

            <textarea
              className="textarea font-mono"
              style={{ minHeight: 140, padding: '12px 14px', fontSize: 14, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
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
              {isGlobalSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
              {isGlobalSaving ? 'Saving...' : 'Save global guidelines'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

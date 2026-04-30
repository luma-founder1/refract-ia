import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import db from '../storage/db';
import { randomUUID } from 'crypto';
import fs from 'original-fs';
import path from 'path';
import { runAnalysis } from '../engine/analysis';

export function registerIpcHandlers(): void {

  // Open local folder picker → save project → return project
  ipcMain.handle(IPC_CHANNELS.OPEN_PROJECT, async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const folderPath = result.filePaths[0];
    const name = folderPath.split(/[\\/]/).pop() || 'Unnamed';
    const id = randomUUID();
    const created_at = new Date().toISOString();

    try {
      const guidelinePath = path.join(folderPath, 'guideline.md');
      if (!fs.existsSync(guidelinePath)) {
        fs.writeFileSync(guidelinePath, '# Project Guidelines\n\nWrite your rules here.', 'utf-8');
      }
    } catch (e) {
      console.error('Failed to create guideline.md', e);
    }

    db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, path, status, created_at)
      VALUES (?, ?, ?, 'Not analysed', ?)
    `).run(id, name, folderPath, created_at);

    db.prepare(`
      INSERT INTO activity (id, project_id, project_name, type, description, created_at)
      VALUES (?, ?, ?, 'created', ?, ?)
    `).run(randomUUID(), id, name, `Created project ${name}`, created_at);

    return { id, name, path: folderPath, repo: null, branch: 'main', status: 'Not analysed', created_at, last_run: null };
  });

  // Connect repository via URL → save project → return project
  ipcMain.handle(IPC_CHANNELS.CONNECT_REPO, async (_event, { url, branch = 'main' }: { url: string; branch?: string }) => {
    if (!url || !url.startsWith('http')) return null;

    const name = url.split('/').pop()?.replace('.git', '') || 'Unnamed';
    const id = randomUUID();
    const created_at = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, path, repo, branch, status, created_at)
      VALUES (?, ?, '', ?, ?, 'Not analysed', ?)
    `).run(id, name, url, branch, created_at);

    db.prepare(`
      INSERT INTO activity (id, project_id, project_name, type, description, created_at)
      VALUES (?, ?, ?, 'connected', ?, ?)
    `).run(randomUUID(), id, name, `Connected ${url}`, created_at);

    return { id, name, path: '', repo: url, branch, status: 'Not analysed', created_at, last_run: null };
  });

  // Get recent projects from SQLite
  ipcMain.handle(IPC_CHANNELS.GET_RECENT_PROJECTS, async () => {
    try {
      return db.prepare(`
        SELECT * FROM projects ORDER BY created_at DESC LIMIT 6
      `).all();
    } catch {
      return [];
    }
  });

  // Get recent activity
  ipcMain.handle(IPC_CHANNELS.GET_ACTIVITY, async () => {
    try {
      return db.prepare(`
        SELECT * FROM activity ORDER BY created_at DESC LIMIT 8
      `).all();
    } catch {
      return [];
    }
  });

  // Get single project by id
  ipcMain.handle(IPC_CHANNELS.GET_PROJECT, async (_event, id: string) => {
    try {
      return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) ?? null;
    } catch {
      return null;
    }
  });

  // Delete project
  ipcMain.handle(IPC_CHANNELS.DELETE_PROJECT, async (_event, id: string) => {
    try {
      db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Get all projects
  ipcMain.handle(IPC_CHANNELS.GET_ALL_PROJECTS, async () => {
    try {
      return db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all();
    } catch {
      return [];
    }
  });

  // Read project guideline
  ipcMain.handle(IPC_CHANNELS.READ_GUIDELINE, async (_event, projectPath: string) => {
    if (!projectPath) return '';
    try {
      const filepath = path.join(projectPath, 'guideline.md');
      if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath, 'utf-8');
      }
    } catch {}
    return '';
  });

  // Write project guideline
  ipcMain.handle(IPC_CHANNELS.WRITE_GUIDELINE, async (_event, projectPath: string, text: string) => {
    if (!projectPath) return { success: false };
    try {
      const filepath = path.join(projectPath, 'guideline.md');
      fs.writeFileSync(filepath, text, 'utf-8');
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Read global guideline
  ipcMain.handle(IPC_CHANNELS.READ_GLOBAL_GUIDELINE, async () => {
    try {
      const filepath = path.join(app.getPath('userData'), 'global-guideline.md');
      if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath, 'utf-8');
      }
    } catch {}
    return '';
  });

  // Write global guideline
  ipcMain.handle(IPC_CHANNELS.WRITE_GLOBAL_GUIDELINE, async (_event, text: string) => {
    try {
      const filepath = path.join(app.getPath('userData'), 'global-guideline.md');
      fs.writeFileSync(filepath, text, 'utf-8');
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // Get file tree
  ipcMain.handle(IPC_CHANNELS.GET_FILE_TREE, async (_event, dirPath: string) => {
    if (!dirPath) return [];
    try {
      if (!fs.existsSync(dirPath)) return [];
      const items = fs.readdirSync(dirPath);
      return items
        .filter(item => !item.startsWith('.') && item !== 'node_modules')
        .map(item => {
          try {
            const stat = fs.statSync(path.join(dirPath, item));
            return {
              name: item,
              path: path.join(dirPath, item),
              isDirectory: stat.isDirectory()
            };
          } catch {
            return { name: item, path: path.join(dirPath, item), isDirectory: false };
          }
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  });

  // Run analysis on a project
  ipcMain.handle(IPC_CHANNELS.RUN_ANALYSIS, async (_event, projectPath: string) => {
    if (!projectPath) return { error: 'No project path provided' }
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Analysis timeout')), 60000)
      )
      const result = await Promise.race([
        runAnalysis(projectPath),
        timeoutPromise
      ])
      const last_run = new Date().toISOString()
      db.prepare(`UPDATE projects SET status = 'Analysed', last_run = ? WHERE path = ?`).run(last_run, projectPath)
      return result
    } catch (err) {
      console.error('Analysis failed:', err)
      return { error: String(err) }
    }
  });

  // Apply accepted issues → write files + git commit
  ipcMain.handle(IPC_CHANNELS.APPLY_CHANGES, async (_event, { projectPath, issues }: { projectPath: string; issues: any[] }) => {
    try {
      const { applyAcceptedIssues } = await import('../engine/git')
      const result = await applyAcceptedIssues(projectPath, issues)
      return { success: true, ...result }
    } catch (err) {
      console.error('Apply failed:', err)
      return { success: false, error: String(err) }
    }
  });

  // Explain issue with AI
  ipcMain.handle(IPC_CHANNELS.EXPLAIN_ISSUE, async (_event, issue: any, fileSource: string) => {
    try {
      const { explainIssue } = await import('../engine/ai')
      return await explainIssue(issue, fileSource)
    } catch (err) {
      console.error('Explain failed:', err)
      return issue.problem
    }
  })

  // Generate AI briefing
  ipcMain.handle(IPC_CHANNELS.GENERATE_BRIEFING, async (_event, { projectPath, issues, scannedFiles }: any) => {
    try {
      const { generateBriefing } = await import('../engine/ai')
      return await generateBriefing(projectPath, issues, scannedFiles)
    } catch (err) {
      console.error('Briefing failed:', err)
      return null
    }
  })


  // Read file content
  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8')
      }
    } catch (err) {
      console.error('Read file failed:', err)
    }
    return ''
  })

  // Scan project dependencies
  ipcMain.handle(IPC_CHANNELS.GET_PROJECT_DEPENDENCIES, async (_event, projectPath: string) => {
    try {
      const { getProjectDependencies } = await import('../engine/codemap')
      return await getProjectDependencies(projectPath)
    } catch (err) {
      console.error('Dependency scan failed:', err)
      return []
    }
  })
}


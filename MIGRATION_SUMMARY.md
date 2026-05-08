# Refract Electron to Web Migration Summary

## Completed Changes

### 1. Removed Electron Dependencies
- Removed Electron, electron-builder, electron-vite from package.json
- Removed @electron-toolkit packages
- Removed better-sqlite3 (Node.js database)
- Added isomorphic-git for browser Git operations
- Updated scripts to use Vite instead of electron-vite

### 2. Project Structure Reorganization
- Moved `src/renderer/` → `src/` (removed renderer prefix)
- Deleted `src/main/` (entire Electron main process)
- Deleted `src/preload/` (Electron preload scripts)
- Deleted `src/shared/ipc.ts` (IPC channel definitions)
- Created `src/workers/` for Web Workers
- Created `src/shared/types.ts` for shared TypeScript types

### 3. Vite Configuration
- Created `vite.config.ts` with React plugin
- Configured path aliases (@/* → src/*)
- Added worker configuration for Web Workers
- Updated `tsconfig.json` to remove Electron-specific paths
- Created `index.html` for Vite entry point

### 4. Database Migration
- Created `src/lib/db.ts` with Supabase client functions
- Created `supabase-schema.sql` with PostgreSQL schema
- Replaced SQLite queries with Supabase queries
- Added RLS policies for user isolation
- Migrated tables: projects, health_snapshots, project_decisions, settings, activity

### 5. AST Analysis → Web Worker
- Created `src/workers/analysis.worker.ts`
- Ported entire analysis engine from Node.js to browser
- Removed Node.js-specific imports (fs, path)
- Uses in-memory file operations instead of file system
- Implements same 9 issue detectors

### 6. File Upload Component
- Created `src/components/DropZone.tsx`
- Uses `<input type="file" webkitdirectory>` for folder selection
- Supports drag and drop
- Handles file selection and passes FileList to parent

### 7. API Client
- Created `src/lib/api.ts` for backend API calls
- Implements AI proxy functions (explain, refactor, briefing)
- Implements GitHub API functions (repos, clone, PR)
- All calls authenticated with Supabase session

### 8. Auth Context Updates
- Removed deep link callback logic (Electron-specific)
- Removed window.electron references
- Kept Supabase auth flow intact
- Removed onboarding_completed check

### 9. UI Updates
- Updated `AppShell.tsx` to remove onboarding
- Removed OnboardingPage and AuthPage references
- Kept auth gate (session check)
- Updated HomePage to use db.ts instead of IPC
- Updated ProjectsPage to use db.ts instead of IPC
- Updated GuidelinesPage to use db.ts instead of IPC
- Updated ReposPage to use db.ts instead of IPC
- Updated NewProjectModal to use DropZone
- Updated CodeMap.tsx to use new types import
- Updated ProjectView.tsx to use new types import
- CodeMap.tsx shows message that dependency analysis is not available in web version

### 10. Type Definitions
- Created `src/shared/types.ts` with:
  - Project, Activity schemas
  - AnalysisIssue, AnalysisResult, ApplyResult
  - IssueCategory, Impact types

## Pending Work

### High Priority (Critical for basic functionality)
- **ProjectView.tsx migration** - This is the most complex component requiring:
  - File reading from uploaded FileList (instead of fs)
  - Analysis worker integration (run analysis on uploaded files)
  - AI API integration (explain, refactor, briefing)
  - Database operations (already have db.ts)
  - Git operations integration (isomorphic-git for apply changes)
  - Decision saving/loading (already have db.ts)

### High Priority (Infrastructure)
- Configure Supabase Storage for file uploads
- Create backend API endpoints (Vercel/Edge Functions) for AI proxy
- Test the app with npm run dev to verify compilation

### Medium Priority
- Migrate GitHub OAuth to Supabase OAuth provider
- Port Git operations to isomorphic-git (browser)
- Update SettingsPage (if it has IPC references)
- Create Vercel deployment configuration

### Low Priority (Nice to have)
- Re-implement CodeMap dependency analysis for web (parse imports from uploaded files)
- Add proper error handling for file uploads
- Test responsive design in browser
- Add loading states for API calls
- Optimize Web Worker performance

## Files Deleted
- `src/main/` (entire directory)
- `src/preload/` (entire directory)
- `src/shared/ipc.ts`
- `src/renderer/pages/OnboardingPage.tsx`
- `src/renderer/pages/AuthPage.tsx`
- `electron-builder.yml`
- `electron.vite.config.ts`

## Files Created
- `vite.config.ts`
- `index.html`
- `src/workers/analysis.worker.ts`
- `src/components/DropZone.tsx`
- `src/lib/db.ts`
- `src/lib/api.ts`
- `src/shared/types.ts`
- `supabase-schema.sql`
- `MIGRATION_SUMMARY.md`

## Files Modified
- `package.json` (removed Electron deps, added isomorphic-git)
- `tsconfig.json` (removed Electron paths)
- `src/lib/AuthContext.tsx` (removed deep link logic)
- `src/pages/AppShell.tsx` (removed onboarding)
- `src/pages/HomePage.tsx` (use db.ts instead of IPC)
- `src/pages/ProjectsPage.tsx` (use db.ts instead of IPC)
- `src/pages/GuidelinesPage.tsx` (use db.ts instead of IPC)
- `src/pages/ReposPage.tsx` (use db.ts instead of IPC)
- `src/components/NewProjectModal.tsx` (use DropZone)
- `src/pages/projectView/CodeMap.tsx` (new types import, disabled dependency analysis)
- `src/pages/projectView/ProjectView.tsx` (new types import, added API imports)

## Current Status

The migration is approximately **85% complete**. The core infrastructure is in place:
- ✅ Project structure reorganized for web
- ✅ Database migrated to Supabase
- ✅ Analysis engine ported to Web Worker
- ✅ File upload component created
- ✅ API client for backend calls created
- ✅ All simple pages migrated (Home, Projects, Guidelines, Repos)
- ✅ Auth updated for web
- ✅ Onboarding removed
- ✅ **All IPC_CHANNELS and window.electron references removed from codebase**
- ✅ ProjectView.tsx migrated to use API functions (with TODOs for file reading and analysis worker)

**Remaining major work:**
- ❌ **ProjectView analysis worker integration** - Needs to:
  - Read files from uploaded FileList (not from disk)
  - Wire up analysis worker to process files
  - This is the core analysis functionality

## Next Steps
1. **Implement file reading from uploaded FileList** in ProjectView:
   - Store uploaded files in state when project is created
   - Read file contents from FileList instead of disk
   - Pass file contents to analysis worker
2. **Wire up analysis worker** in ProjectView:
   - Convert FileList to worker-compatible format
   - Call analysis worker with file contents
   - Display analysis results in UI
3. Test the app with `npm run dev` to verify it compiles and runs
4. Set up Supabase Storage bucket for project files
5. Create Vercel Edge Functions for AI proxy (if not already done)
6. Configure GitHub OAuth in Supabase
7. Configure Tailwind CSS (verify existing styles work)
8. Test the full flow: upload → analyze → review

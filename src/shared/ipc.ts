import { z } from 'zod';

export const IPC_CHANNELS = {
  OPEN_PROJECT:        'project:open',
  CONNECT_REPO:        'repo:connect',
  GET_RECENT_PROJECTS: 'project:get-recent',
  GET_PROJECT:         'project:get',
  DELETE_PROJECT:      'project:delete',
  GET_ACTIVITY:        'activity:get',
  RUN_ANALYSIS:        'analysis:run',
  GET_REPORT:          'analysis:get-report',
  GET_APP_STATE:       'app:get-state',
  GET_ALL_PROJECTS:    'project:get-all',
  GET_FILE_TREE:       'project:get-file-tree',
  READ_GUIDELINE:      'guideline:read',
  WRITE_GUIDELINE:     'guideline:write',
  READ_GLOBAL_GUIDELINE:  'guideline:read-global',
  WRITE_GLOBAL_GUIDELINE: 'guideline:write-global',
  APPLY_CHANGES: 'changes:apply',
  EXPLAIN_ISSUE:      'ai:explain-issue',
  GENERATE_BRIEFING:  'ai:generate-briefing',
  READ_FILE:          'file:read',
  GET_PROJECT_DEPENDENCIES: 'project:get-dependencies',
} as const;

export const ProjectSchema = z.object({
  id:         z.string(),
  name:       z.string(),
  path:       z.string(),
  repo:       z.string().nullable().optional(),
  branch:     z.string().default('main'),
  status:     z.enum(['Refracted', 'Pending', 'Not analysed']).default('Not analysed'),
  created_at: z.string().optional(),
  last_run:   z.string().nullable().optional(),
});

export const ActivitySchema = z.object({
  id:           z.string(),
  project_id:   z.string(),
  project_name: z.string(),
  type:         z.string(),
  description:  z.string(),
  created_at:   z.string(),
});

export type Project  = z.infer<typeof ProjectSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ─── Analysis types ───────────────────────────────────────────────────────────

export type IssueCategory = 
  | 'oversized-component'
  | 'any-type'
  | 'dead-state'
  | 'missing-docs'

export type Impact = 'High' | 'Medium' | 'Low'

export interface AnalysisIssue {
  id: string
  file: string
  filePath: string
  category: IssueCategory
  problem: string
  impact: Impact
  lineStart: number
  lineEnd: number
  lines: {
    before: string[]
    after: string[]
  }
}

export interface AnalysisResult {
  projectPath: string
  scannedFiles: string[]
  issues: AnalysisIssue[]
  summary: {
    total: number
    high: number
    medium: number
    low: number
  }
}

export interface ApplyResult {
  success: boolean
  branch?: string
  filesChanged?: string[]
  commitHash?: string
  error?: string
}

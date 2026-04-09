export type InputMode =
  | 'zip'
  | 'file'
  | 'files'
  | 'folder_path'
  | 'multi_folder';

export type ProjectStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  inputMode: InputMode;
  totalFiles: number;
  processedFiles: number;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  // Included relations when fetched fully:
  files?: FileNodeData[];
  edges?: EdgeData[];
  analyses?: AnalysisData[];
}

export interface FileNodeData {
  id: string;
  projectId: string;
  relativePath: string;
  fileHash: string;
  language: string;
  linesOfCode: number;
  importCount: number;
  exportCount: number;
}

export interface EdgeData {
  id: string;
  projectId: string;
  sourceFileId: string;
  targetFileId: string;
  edgeType: string;
}

export interface AnalysisData {
  id: string;
  projectId: string;
  fileId: string;
  summary: string;
  workflow: string[];
  imports: string[];
  exports: string[];
  cachedAt: Date;
}

export interface ProjectWithRelations extends Project {
  files: FileNodeData[];
  edges: EdgeData[];
  analyses: AnalysisData[];
}

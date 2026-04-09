import ky from 'ky';
import { Project, ProjectWithRelations, ProjectStatus } from '../../shared/types/index';

export const api = ky.create({
  prefixUrl: '/api',
  timeout: 30000,
});

export type CreateProjectInput =
  | { mode: 'zip'; name: string; blob: Blob }
  | { mode: 'file'; name: string; file: File }
  | { mode: 'files'; name: string; files: File[] }
  | { mode: 'folderPath'; name: string; folderPath: string }
  | { mode: 'folderPaths'; name: string; folderPaths: string[] };

export const apiFn = {
  projects: {
    list: async (): Promise<Project[]> => {
      const res = await api.get('projects').json<{ projects: Project[] }>();
      return res.projects.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
    },
    get: async (id: string): Promise<ProjectWithRelations> => {
      const res = await api.get(`projects/${id}`).json<{ project: ProjectWithRelations }>();
      return {
        ...res.project,
        createdAt: new Date(res.project.createdAt),
        updatedAt: new Date(res.project.updatedAt),
      };
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`projects/${id}`);
    },
    status: async (id: string): Promise<{ status: ProjectStatus; progress: number }> => {
      return await api.get(`analysis/${id}/status`).json();
    },
    create: async (input: CreateProjectInput, onProgress?: (percent: number) => void): Promise<{ projectId: string }> => {
      switch (input.mode) {
        case 'zip': {
          const body = new FormData();
          body.append('folder', input.blob, `${input.name}.zip`);
          return api.post('projects', {
            headers: { 'x-project-name': input.name },
            body,
            onUploadProgress: (progress) => {
              if (onProgress) onProgress(progress.percent * 100);
            }
          }).json();
        }
        case 'file': {
          const body = new FormData();
          body.append('file', input.file);
          return api.post('projects', {
            headers: { 'x-project-name': input.name },
            body,
            onUploadProgress: (progress) => {
              if (onProgress) onProgress(progress.percent * 100);
            }
          }).json();
        }
        case 'files': {
          const body = new FormData();
          for (const f of input.files) {
            body.append('files[]', f);
          }
          return api.post('projects', {
            headers: { 'x-project-name': input.name },
            body,
            onUploadProgress: (progress) => {
              if (onProgress) onProgress(progress.percent * 100);
            }
          }).json();
        }
        case 'folderPath': {
          return api.post('projects', {
            headers: { 'x-project-name': input.name },
            json: { folderPath: input.folderPath },
            onUploadProgress: (progress) => {
               if (onProgress) onProgress(100);
            }
          }).json();
        }
        case 'folderPaths': {
          return api.post('projects', {
             headers: { 'x-project-name': input.name },
             json: { folderPaths: input.folderPaths },
             onUploadProgress: (progress) => {
                if (onProgress) onProgress(100);
             }
          }).json();
        }
      }
    }
  }
};

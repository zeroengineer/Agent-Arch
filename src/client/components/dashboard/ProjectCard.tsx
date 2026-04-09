import { CalendarDays, Files, Hexagon, Trash2, Tag } from 'lucide-react';
import { Project } from '../../../shared/types/index';
import { Link } from 'react-router';
import { clsx } from 'clsx';
import { apiFn } from '../../lib/api';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const inputModeLabels = {
  zip: 'Zip Upload',
  file: 'Single File',
  files: 'Multi File',
  folder_path: 'Local Folder',
  multi_folder: 'Multi Folder',
};

export function ProjectCard({ project }: { project: Project }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiFn.projects.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent navigation
    if (confirm(`Are you sure you want to delete ${project.name}?`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <Link 
      to={`/project/${project.id}`} 
      className="block relative bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-md transition-all group"
    >
      <div className="absolute top-4 right-4 flex space-x-2">
        <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium border", statusColors[project.status])}>
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </span>
        <button 
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete project"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center mb-4">
        <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600 mr-3">
          <Hexagon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
            {project.name}
          </h3>
          <div className="flex items-center text-xs text-gray-500 mt-1">
            <Tag className="w-3 h-3 mr-1" />
            {inputModeLabels[project.inputMode] || project.inputMode}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6 text-sm text-gray-600 border-t border-gray-100 pt-4 mt-2">
        <div className="flex items-center">
          <Files className="w-4 h-4 mr-1.5 text-gray-400" />
          {project.totalFiles} files
        </div>
        <div className="flex items-center">
          <CalendarDays className="w-4 h-4 mr-1.5 text-gray-400" />
          {project.createdAt.toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}

import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiFn } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import { Sidebar } from '../components/layout/Sidebar';
import { ArchGraph } from '../components/graph/ArchGraph';
import { ModulePanel } from '../components/graph/ModulePanel';
import { ProgressOverlay } from '../components/graph/ProgressOverlay';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { setActiveProject, buildGraph } = useProjectStore();
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);

  const { data: project, isLoading, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiFn.projects.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
       const status = query.state.data?.status;
       return (status === 'pending' || status === 'processing') ? 3000 : false;
    }
  });

  // Sync with Zustand and Dagre when project data arrives
  useEffect(() => {
    if (project) {
      setActiveProject(project);
      buildGraph(project);
    }
  }, [project, setActiveProject, buildGraph]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Failed to load project</h2>
        <p className="text-gray-500 mb-6">The project might have been deleted, or there is a server error.</p>
        <Link to="/dashboard" className="text-indigo-600 hover:underline">
           Return to Dashboard
        </Link>
      </div>
    );
  }

  const showOverlay = (project.status === 'pending' || project.status === 'processing') && !isOverlayDismissed;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-gray-50">
      
      {/* Top Bar Minimal */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0 z-20">
        <Link to="/dashboard" className="p-2 mr-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg text-gray-900 truncate pr-4">{project.name}</h1>
        
        <div className="ml-auto flex items-center space-x-4 text-sm text-gray-500">
          <span>{project.totalFiles} files</span>
          <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
            {project.status}
          </span>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar />
        
        <main className="flex-1 relative">
           <ArchGraph />
           {showOverlay && (
             <ProgressOverlay 
               projectId={project.id} 
               onComplete={() => {
                 setIsOverlayDismissed(true);
                 refetch();
               }} 
             />
           )}
        </main>
        
        <ModulePanel />
      </div>
    </div>
  );
}

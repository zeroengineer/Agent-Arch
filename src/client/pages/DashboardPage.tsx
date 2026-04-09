import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, LayoutGrid } from 'lucide-react';
import { apiFn } from '../lib/api';
import { Navbar } from '../components/layout/Navbar';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import { InputModal } from '../components/dashboard/InputModal';

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: apiFn.projects.list,
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-500 text-sm mt-1">Manage your architecture analysis projects.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-1" />
            New Project
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-20 bg-red-50 rounded-xl">Error loading projects.</div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-center py-24 bg-white border border-gray-200 border-dashed rounded-xl">
            <LayoutGrid className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">No projects yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new analysis project.</p>
            <div className="mt-6">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5 mr-1" />
                New Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <InputModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={(id) => navigate(`/project/${id}`)}
        />
      )}
    </div>
  );
}

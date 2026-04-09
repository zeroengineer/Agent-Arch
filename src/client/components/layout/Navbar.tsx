import { Link } from 'react-router';
import { LogOut, Layers } from 'lucide-react';
import { api } from '../../lib/api';

export function Navbar() {
  const handleLogout = async () => {
    await api.post('auth/sign-out');
    window.location.href = '/login';
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Agent Arch</span>
            </Link>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

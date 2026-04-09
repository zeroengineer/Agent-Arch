import { LoginForm } from '../components/auth/LoginForm';
import { GithubButton } from '../components/auth/GithubButton';
import { Layers } from 'lucide-react';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-xl">
        <div className="flex flex-col items-center">
          <div className="bg-indigo-600 p-3 rounded-xl mb-4">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Agent Arch
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Intelligent Code Architecture Analysis
          </p>
        </div>

        <LoginForm onSuccess={onLogin} />

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <GithubButton />
          </div>
        </div>
      </div>
    </div>
  );
}

import { GithubIcon } from 'lucide-react';

export function GithubButton() {
  const handleGithubLogin = () => {
    // Navigate strictly via standard window href as Better Auth OAuth flow creates redirects
    window.location.href = '/api/auth/sign-in/github'; 
  };

  return (
    <button 
      onClick={handleGithubLogin}
      className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      <GithubIcon className="w-5 h-5 mr-2" />
      Continue with GitHub
    </button>
  );
}

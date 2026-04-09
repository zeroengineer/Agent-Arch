import { useState } from 'react';
import { X } from 'lucide-react';
import { DropZone } from './DropZone';
import { LocalPathInput } from './LocalPathInput';
import { apiFn, CreateProjectInput } from '../../lib/api';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

export function InputModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (id: string) => void }) {
  const [tab, setTab] = useState<'upload' | 'local'>('upload');
  const [projectName, setProjectName] = useState('');
  
  // Payload state
  const [uploadInput, setUploadInput] = useState<{ mode: 'zip' | 'file' | 'files'; payload: any } | null>(null);
  const [localPaths, setLocalPaths] = useState<string[]>(['']);
  
  // Progress states
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputReady = (res: { mode: 'zip' | 'file' | 'files'; name: string; payload: any }) => {
    setUploadInput({ mode: res.mode, payload: res.payload });
    if (!projectName && res.name) setProjectName(res.name);
  };

  const isFormValid = () => {
    if (!projectName.trim()) return false;
    if (tab === 'upload' && !uploadInput) return false;
    if (tab === 'local' && localPaths.filter(p => p.trim()).length === 0) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    setIsSubmitting(true);
    setStatusMessage('Initiating upload...');

    try {
      let input: CreateProjectInput;
      
      if (tab === 'upload' && uploadInput) {
        if (uploadInput.mode === 'zip') {
          input = { mode: 'zip', name: projectName, blob: uploadInput.payload as Blob };
        } else if (uploadInput.mode === 'file') {
          input = { mode: 'file', name: projectName, file: uploadInput.payload as File };
        } else {
          input = { mode: 'files', name: projectName, files: uploadInput.payload as File[] };
        }
      } else {
        const validPaths = localPaths.filter(p => p.trim());
        if (validPaths.length === 1) {
          input = { mode: 'folderPath', name: projectName, folderPath: validPaths[0] };
        } else {
          input = { mode: 'folderPaths', name: projectName, folderPaths: validPaths };
        }
      }

      setStatusMessage('Uploading...');
      const { projectId } = await apiFn.projects.create(input, (percent) => setUploadProgress(percent));
      toast.success('Project uploaded successfully!');
      onSuccess(projectId);
      onClose();

    } catch (err: any) {
      toast.error(err.response?.statusText || 'Upload failed');
      setStatusMessage('');
      setUploadProgress(-1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">New Analysis Project</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input 
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. core-api, web-frontend"
              className="w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex space-x-6">
                <button
                  onClick={() => setTab('upload')}
                  className={clsx(
                    "whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors",
                    tab === 'upload' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  Upload Files
                </button>
                <button
                  onClick={() => setTab('local')}
                  className={clsx(
                    "whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors",
                    tab === 'local' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  Use Local Path (Desktop Only)
                </button>
              </nav>
            </div>

            {tab === 'upload' ? (
              <DropZone onInputReady={handleInputReady} setStatusMessage={setStatusMessage} />
            ) : (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3 text-sm mb-4">
                <strong>Note:</strong> This mode requires the backend server to be running on the same machine as the provided paths. It directly accesses the local filesystem.
              </div>
            )}
            
            {tab === 'local' && (
              <LocalPathInput paths={localPaths} onChange={setLocalPaths} />
            )}
          </div>

          {/* Progress Indication */}
          {(statusMessage || uploadProgress >= 0) && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="text-sm text-gray-600 mb-2 font-medium">{statusMessage}</div>
              {uploadProgress >= 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.max(5, uploadProgress)}%` }}></div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="button"
            disabled={!isFormValid() || isSubmitting}
            onClick={handleSubmit}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Uploading...' : 'Analyze Project'}
          </button>
        </div>

      </div>
    </div>
  );
}

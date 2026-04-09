import { X, Copy, Bot, LayoutList, Import, LogOut } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { AnalysisData, FileNodeData } from '../../../shared/types/index';

export function ModulePanel() {
  const { activeProject, selectedFileId, setSelectedFile } = useProjectStore();
  const [mountedSteps, setMountedSteps] = useState<number>(0);

  const file = activeProject?.files?.find(f => f.id === selectedFileId);
  const analysis = activeProject?.analyses?.find(a => a.fileId === selectedFileId);

  // Stagger workflow steps for nice effect
  useEffect(() => {
    if (!analysis || !analysis.workflow) {
      setMountedSteps(0);
      return;
    }
    setMountedSteps(0);
    const interval = setInterval(() => {
      setMountedSteps(prev => {
        if (prev >= analysis.workflow.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [analysis]);

  if (!selectedFileId || !file) return null;

  const fileName = file.relativePath.split('/').pop() || '';
  const isPendingAnalysis = activeProject?.status === 'processing';

  const copyPath = () => {
    navigator.clipboard.writeText(file.relativePath);
    toast.success('Path copied to clipboard');
  };

  const handleImportSelect = (sourcePath: string) => {
    // Try to find if this sourcePath corresponds to an internal file id.
    // It's a rough match.
    const targetFile = activeProject?.files?.find(f => 
      f.relativePath.includes(sourcePath.replace(/\.\//g, '').replace(/\.\.\//g, ''))
    );
    if (targetFile) {
       setSelectedFile(targetFile.id);
    } else {
       toast.info(`External import: ${sourcePath}`);
    }
  };

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 h-full flex flex-col shadow-xl absolute right-0 top-0 bottom-0 z-10 transition-transform transform translate-x-0">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-start justify-between bg-gray-50">
        <div className="flex-1 overflow-hidden pr-2">
          <div className="flex items-center space-x-2 mb-1 cursor-pointer group" onClick={copyPath} title="Copy Path">
            <h3 className="font-bold text-gray-900 truncate">{fileName}</h3>
            <Copy className="w-3 h-3 text-gray-400 group-hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
              {file.language}
            </span>
            <span className="text-gray-500">{file.linesOfCode} loc</span>
          </div>
        </div>
        <button onClick={() => setSelectedFile(null)} className="p-1 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-md">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2 bg-yellow-50 text-yellow-800 text-xs border-b border-yellow-100">
        Analyzed via {activeProject?.inputMode.replace('_', ' ')}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        
        {/* Core Relationships */}
        <div className="p-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <Import className="w-4 h-4 mr-1.5 text-indigo-500" /> Imports
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {analysis?.imports && analysis.imports.length > 0 ? (
               analysis.imports.map((imp, idx) => (
                 <button 
                  key={idx}
                  onClick={() => handleImportSelect(imp)}
                  className="px-2 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 text-xs rounded-md border border-gray-200 transition-colors"
                 >
                   {imp}
                 </button>
               ))
            ) : (
               <span className="text-xs text-gray-400 italic">No imports detected</span>
            )}
          </div>
          
          <h4 className="text-sm font-semibold text-gray-900 mt-5 mb-3 flex items-center">
            <LogOut className="w-4 h-4 mr-1.5 text-green-500" /> Exports
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {analysis?.exports && analysis.exports.length > 0 ? (
               analysis.exports.map((exp, idx) => (
                 <span key={idx} className="px-2 py-1 bg-green-50 text-green-700 font-mono text-[10px] rounded-md border border-green-100">
                   {exp}
                 </span>
               ))
            ) : (
               <span className="text-xs text-gray-400 italic">No exports detected</span>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <Bot className="w-4 h-4 mr-1.5 text-purple-500" /> AI Summary
          </h4>
          {!analysis && isPendingAnalysis ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6"></div>
            </div>
          ) : !analysis ? (
             <div className="text-sm text-gray-500">Summary unavailable.</div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              {analysis.summary}
            </p>
          )}

          <h4 className="text-sm font-semibold text-gray-900 mt-6 mb-3 flex items-center">
            <LayoutList className="w-4 h-4 mr-1.5 text-orange-500" /> Workflow
          </h4>
          {!analysis && isPendingAnalysis ? (
            <div className="space-y-3 animate-pulse">
               <div className="flex space-x-2"><div className="w-4 h-4 bg-gray-200 rounded-full"></div><div className="h-4 bg-gray-200 rounded w-full"></div></div>
               <div className="flex space-x-2"><div className="w-4 h-4 bg-gray-200 rounded-full"></div><div className="h-4 bg-gray-200 rounded w-4/5"></div></div>
            </div>
          ) : !analysis ? (
             <div className="text-sm text-gray-500">Workflow unavailable.</div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {analysis.workflow.slice(0, mountedSteps).map((step, idx) => (
                <div key={idx} className="relative flex items-center space-x-3 left-0 animate-fade-in-up">
                  <div className="flex items-center justify-center w-5 h-5 bg-white border-2 border-orange-400 rounded-full text-[10px] font-bold text-orange-600 z-10 shrink-0 shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="text-xs text-gray-700 font-medium">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

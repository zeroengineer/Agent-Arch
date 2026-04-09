import { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { WsManager } from '../../lib/ws';
import { useQueryClient } from '@tanstack/react-query';

interface ProgressOverlayProps {
  projectId: string;
  onComplete: () => void;
}

export function ProgressOverlay({ projectId, onComplete }: ProgressOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [completedLogs, setCompletedLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WsManager(projectId, {
      onFileDone: (data) => {
        setProgress(data.progress);
        setCompletedLogs(prev => [...prev, data.relativePath]);
      },
      onAnalysisComplete: (data) => {
        setProgress(100);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          onComplete();
        }, 1000);
      },
      onError: (err) => {
        console.error("Analysis Error via WS:", err);
      }
    });

    ws.connect();
    return () => ws.disconnect();
  }, [projectId, onComplete, queryClient]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [completedLogs]);

  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-40 flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full">
        <div className="text-center mb-6">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Analyzing Project...</h2>
          <p className="text-gray-500 mt-2">Parsing abstract syntax trees and prompting Gemini 2.0 Flash.</p>
        </div>

        <div className="bg-gray-100 rounded-full h-4 mb-6 shadow-inner overflow-hidden">
          <div 
            className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
            style={{ width: `${Math.max(5, progress)}%` }}
          >
            {progress > 10 && <span className="text-[10px] text-white font-bold">{progress}%</span>}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 h-64 overflow-y-auto shadow-2xl border border-gray-800 flex flex-col font-mono text-xs">
          {completedLogs.length === 0 ? (
            <div className="text-gray-500 italic mt-auto">Waiting for the first file to complete...</div>
          ) : (
            completedLogs.map((log, idx) => (
              <div key={idx} className="text-green-400 flex items-center space-x-2 py-1 animate-fade-in-up">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{log}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

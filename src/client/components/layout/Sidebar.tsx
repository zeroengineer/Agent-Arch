import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, FileCode2, Menu } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { clsx } from 'clsx';
import { FileNodeData } from '../../../shared/types/index';

// Simple tree builder
function buildTree(files: FileNodeData[]) {
  const root: any = {};
  for (const file of files) {
    const parts = file.relativePath.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
            current[part] = file;
        } else {
            if (!current[part]) current[part] = {};
            current = current[part];
        }
    }
  }
  return root;
}

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: 'bg-[#BA7517]',
  typescript: 'bg-[#7F77DD]',
  python: 'bg-[#1D9E75]',
  go: 'bg-[#378ADD]',
  rust: 'bg-[#D85A30]',
  java: 'bg-[#E04A3A]',
  cpp: 'bg-[#4372A1]',
  c: 'bg-[#5C6BC0]',
  csharp: 'bg-[#178600]'
};

export function Sidebar() {
  const { activeProject, selectedFileId, setSelectedFile } = useProjectStore();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  const files = activeProject?.files || [];

  const filteredFiles = useMemo(() => {
    if (!search) return files;
    return files.filter(f => f.relativePath.toLowerCase().includes(search.toLowerCase()));
  }, [files, search]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  if (!isOpen) {
    return (
      <div className="w-16 bg-white border-r border-gray-200 h-full flex flex-col items-center py-4">
        <button onClick={() => setIsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    );
  }

  const renderTree = (node: any, path: string = '', depth = 0) => {
    return Object.keys(node).map(key => {
      const item = node[key];
      const isFile = !!item.id;
      
      const fullPath = path ? `${path}/${key}` : key;
      const isSelected = selectedFileId === item.id;

      if (isFile) {
         return (
           <div 
             key={item.id}
             onClick={() => setSelectedFile(item.id)}
             className={clsx(
               "flex items-center text-sm py-1.5 px-2 cursor-pointer rounded-md break-all",
               isSelected ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
             )}
             style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
           >
             <div className={clsx("w-2 h-2 rounded-full mr-2 flex-shrink-0", LANGUAGE_COLORS[item.language] || 'bg-gray-400')} />
             <span className="truncate flex-1">{key}</span>
             <span className="text-xs text-gray-400 ml-2">{item.linesOfCode}</span>
           </div>
         )
      } else {
         return (
           <div key={fullPath}>
             <div 
               className="flex items-center text-sm py-1.5 px-2 text-gray-600 font-medium select-none"
               style={{ paddingLeft: `${depth * 1}rem` }}
             >
               <ChevronDown className="w-4 h-4 mr-1 text-gray-400" />
               <span className="truncate">{key}</span>
             </div>
             {renderTree(item, fullPath, depth + 1)}
           </div>
         );
      }
    });
  };

  return (
    <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 h-full flex flex-col transition-all duration-300">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center mb-1">
        <div className="flex items-center space-x-2">
            <FileCode2 className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Project Files</h2>
        </div>
        <button onClick={() => setIsOpen(false)} className="lg:hidden p-1 text-gray-400">
            <Menu className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredFiles.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No files found</p>
        ) : (
          renderTree(tree)
        )}
      </div>
    </div>
  );
}

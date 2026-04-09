import { Handle, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { useProjectStore } from '../../store/projectStore';
import { FileNodeData } from '../../../shared/types/index';

export function FileNode({ data }: { data: { file: FileNodeData; color: string } }) {
  const { file, color } = data;
  const { selectedFileId } = useProjectStore();
  
  const isSelected = selectedFileId === file.id;
  const fileName = file.relativePath.split('/').pop() || '';
  
  return (
    <div 
      className={clsx(
        "w-[180px] bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all group",
        isSelected ? "ring-4 ring-opacity-50" : "hover:border-gray-400"
      )}
      style={{ 
        borderColor: isSelected ? color : '#E5E7EB',
        '--tw-ring-color': isSelected ? color : 'transparent'
      } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="invisible" />
      <Handle type="source" position={Position.Bottom} className="invisible" />
      
      {/* Top Banner */}
      <div className="px-3 py-1.5 flex items-center bg-gray-50 border-b border-gray-100">
        <div 
          className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0" 
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
          {file.language}
        </span>
      </div>

      <div className="p-3">
        <div className="font-semibold text-gray-800 text-sm truncate" title={fileName}>
          {fileName}
        </div>
        <div className="text-[10px] text-gray-400 truncate mt-0.5 mb-2" title={file.relativePath}>
          {file.relativePath}
        </div>
        
        <div className="flex justify-between items-center mt-2 border-t border-dashed border-gray-200 pt-2">
          <div className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {file.linesOfCode} lines
          </div>
          <div className="flex space-x-1">
             {file.importCount > 0 && (
                 <div className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded" title="Imports">
                   +{file.importCount}
                 </div>
             )}
             {file.exportCount > 0 && (
                 <div className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded" title="Exports">
                   ^{file.exportCount}
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

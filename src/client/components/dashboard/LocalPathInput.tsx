import { Plus, X } from 'lucide-react';

interface LocalPathInputProps {
  paths: string[];
  onChange: (paths: string[]) => void;
}

export function LocalPathInput({ paths, onChange }: LocalPathInputProps) {
  
  const updatePath = (index: number, value: string) => {
    const newPaths = [...paths];
    newPaths[index] = value;
    onChange(newPaths);
  };

  const removePath = (index: number) => {
    const newPaths = paths.filter((_, i) => i !== index);
    if (newPaths.length === 0) newPaths.push(''); // Always keep at least one
    onChange(newPaths);
  };

  const addPath = () => {
    onChange([...paths, '']);
  };

  return (
    <div className="space-y-3">
      {paths.map((p, index) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="text"
            value={p}
            onChange={(e) => updatePath(index, e.target.value)}
            placeholder="/absolute/path/to/project"
            className="flex-grow rounded-md border-gray-300 border p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => removePath(index)}
            className="p-2 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPath}
        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center font-medium"
      >
        <Plus className="w-4 h-4 mr-1" />
        Add another path
      </button>
    </div>
  );
}

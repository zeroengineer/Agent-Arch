import { useCallback, useState } from 'react';
import { UploadCloud, Folder } from 'lucide-react';
import { createZipFromDataTransfer, createZipFromFileList } from '../../../shared/lib/zip';
import { clsx } from 'clsx';
import { toast } from 'sonner';

interface DropZoneProps {
  onInputReady: (input: { mode: 'zip' | 'file' | 'files'; name: string; payload: any }) => void;
  setStatusMessage: (msg: string) => void;
}

export function DropZone({ onInputReady, setStatusMessage }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [detectedType, setDetectedType] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.items.length === 0) return;

    try {
      // Create zip automatically using FileSystem API on dropped items
      const { blob, fileCount } = await createZipFromDataTransfer(e.dataTransfer.items, setStatusMessage);
      if (fileCount === 0) {
        toast.error("No valid files found");
        setDetectedType(null);
        return;
      }
      setDetectedType(`Detected ${fileCount} files in dropped items (Ready to upload)`);
      onInputReady({ mode: 'zip', name: 'dropped-items', payload: blob });
    } catch (err) {
      toast.error('Failed to process dropped items');
      console.error(err);
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const { blob, fileCount } = await createZipFromFileList(e.target.files, setStatusMessage);
      setDetectedType(`Folder selected: ${fileCount} files`);
      const folderName = e.target.files[0].webkitRelativePath?.split('/')[0] || 'folder';
      onInputReady({ mode: 'zip', name: folderName, payload: blob });
    } catch (err) {
      toast.error('Failed to process selected folder');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, multiple: boolean) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const count = e.target.files.length;
    
    if (!multiple) {
      setDetectedType(`1 file selected`);
      onInputReady({ mode: 'file', name: e.target.files[0].name, payload: e.target.files[0] });
    } else {
      setDetectedType(`${count} files selected`);
      onInputReady({ mode: 'files', name: 'uploaded-files', payload: Array.from(e.target.files) });
    }
  };

  return (
    <div className="space-y-4">
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          "w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all px-4 text-center",
          isDragging ? "border-indigo-500 bg-indigo-50 shadow-md scale-102" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        )}
      >
        <UploadCloud className={clsx("w-12 h-12 mb-3", isDragging ? 'text-indigo-600' : 'text-gray-400')} />
        <p className="text-sm font-medium text-gray-700">
          {detectedType ? detectedType : "Drag and drop a folder or files here"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supports zip creation client-side
        </p>
      </div>

      <div className="flex space-x-3 justify-center">
        {/* Hidden inputs */}
        <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          <Folder className="w-4 h-4 mr-2" />
          Select Folder
          <input 
            type="file" 
            className="hidden" 
            // @ts-ignore - webkitdirectory is non-standard but works across modern browsers
            webkitdirectory="true" 
            multiple 
            onChange={handleFolderSelect} 
          />
        </label>

        <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          Select File(s)
          <input 
            type="file" 
            className="hidden" 
            multiple 
            accept=".js,.ts,.jsx,.tsx,.py,.go,.rs,.java,.cpp,.c,.cs"
            onChange={(e) => handleFileSelect(e, true)} 
          />
        </label>
      </div>
    </div>
  );
}

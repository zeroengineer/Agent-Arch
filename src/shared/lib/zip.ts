import JSZip from 'jszip';

/**
 * recursively read a dragged folder DataTransferItem Entry into a flat list of files
 */
async function readEntry(entry: FileSystemEntry, relativePath: string = ''): Promise<{ path: string; file: File }[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve, reject) => {
      fileEntry.file((file) => {
        resolve([{ path: `${relativePath}${file.name}`, file }]);
      }, reject);
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    if (dirEntry.name === 'node_modules' || dirEntry.name === '.git') {
      return []; // skip heavy/irrelevant folders
    }
    const reader = dirEntry.createReader();
    
    // ReadAll pattern because readEntries might not return all files in one go
    const readAllEntries = async (): Promise<FileSystemEntry[]> => {
      let all: FileSystemEntry[] = [];
      let batch = await readEntriesPromise(reader);
      while (batch.length > 0) {
        all = all.concat(batch);
        batch = await readEntriesPromise(reader);
      }
      return all;
    };

    const entries = await readAllEntries();
    let files: { path: string; file: File }[] = [];
    for (const child of entries) {
      files = files.concat(await readEntry(child, `${relativePath}${dirEntry.name}/`));
    }
    return files;
  }
  return [];
}

function readEntriesPromise(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

/**
 * Takes dragged items and creates a zip blob. 
 * Invokes onProgress with string describing current state.
 */
export async function createZipFromDataTransfer(
  items: DataTransferItemList, 
  onStatusUpdate: (msg: string) => void
): Promise<{ blob: Blob, fileCount: number }> {
  
  onStatusUpdate('Scanning files...');
  let allFiles: { path: string; file: File }[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        const files = await readEntry(entry);
        allFiles = allFiles.concat(files);
      }
    }
  }

  onStatusUpdate(`Zipping ${allFiles.length} files...`);
  const zip = new JSZip();
  
  for (const { path, file } of allFiles) {
    zip.file(path, file);
  }

  const blob = await zip.generateAsync({ 
    type: 'blob', 
    compression: 'STORE' // Store is faster than DEFLATE for client-side
  });
  
  onStatusUpdate('Zip complete.');
  return { blob, fileCount: allFiles.length };
}

/**
 * Takes standard FileList (from an <input type="file" webkitdirectory>) and zips them.
 */
export async function createZipFromFileList(
  fileList: FileList,
  onStatusUpdate: (msg: string) => void
): Promise<{ blob: Blob, fileCount: number }> {
    onStatusUpdate('Scanning files...');
    const zip = new JSZip();
    let count = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Skip node_modules and .git paths
      if (file.webkitRelativePath.includes('/node_modules/') || file.webkitRelativePath.includes('/.git/')) {
          continue;
      }
      zip.file(file.webkitRelativePath || file.name, file);
      count++;
    }

    onStatusUpdate(`Zipping ${count} files...`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    onStatusUpdate('Zip complete.');
    return { blob, fileCount: count };
}

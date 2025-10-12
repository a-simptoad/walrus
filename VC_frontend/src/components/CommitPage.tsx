import React, { useState, useEffect } from 'react';
import { VersionFSClient } from '../../../versionfs/src/versionFSClient'; // Assuming VersionFSClient is in this path

// --- HELPER FUNCTIONS (moved inside the component to remove external dependencies) ---

/**
 * Returns a file icon emoji based on the file name or type.
 * @param fileName - The name of the file (e.g., 'script.js')
 * @param fileType - The MIME type of the file (e.g., 'image/png')
 * @returns An emoji string representing the file type.
 */
const getFileIcon = (fileName: string, fileType: string): string => {
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType.startsWith('video/')) return '🎬';
  if (fileType.startsWith('audio/')) return '🎵';
  
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return '📜'; // Script icon
    case 'json':
      return '📝';
    case 'md':
      return '📖';
    case 'zip':
    case 'gz':
    case 'rar':
      return '📦';
    case 'pdf':
      return '📄';
    default:
      return '📁'; // Generic file icon
  }
};

// Extend the input element attributes to support directory upload
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

// We now expect the vfsClient instance and the repository's capability object ID
interface CommitPageProps {
  repositoryId?: string;
  repoCapId?: string; // The user's capability object ID for this repo
  vfsClient: VersionFSClient; // The initialized client instance
  navigate: (path: string) => void;
}

const CommitPage: React.FC<CommitPageProps> = ({ repositoryId, repoCapId, vfsClient, navigate }) => {
  // --- NEW STATE VARIABLES ---
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Existing state
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // --- MOCK DATA REPLACEMENT ---
  // In a real app, you would fetch this data. For this self-contained component,
  // we'll use a placeholder object derived from props to avoid import errors.
  const repository = repositoryId 
    ? { id: repositoryId, name: `Repo ${repositoryId.substring(0, 10)}...` } 
    : undefined;

  // Set the repository context on the client when the component loads
  useEffect(() => {
    if (repositoryId && repoCapId) {
      vfsClient.setRepoIds(repositoryId, repoCapId);
    }
  }, [repositoryId, repoCapId, vfsClient]);

  if (!repository) {
    return (
      <div className="page">
        <div className="container">
          <h2>Repository not found</h2>
          <button 
            className="btn btn--secondary"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Reads a browser File object and converts its content to a Uint8Array
  const readFileAsUint8Array = (file: File): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(event.target.result));
        } else {
          reject(new Error('Failed to read file as ArrayBuffer.'));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleCommit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commitMessage.trim() || selectedFiles.length === 0) {
      setError('Please provide a commit message and select at least one file.');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      // 1. Format files for the VersionFSClient
      console.log('Reading files...');
      const filesToCommit = await Promise.all(
        selectedFiles.map(async (file) => {
          const data = await readFileAsUint8Array(file);
          const path = (file as any).webkitRelativePath || file.name;
          return { path, data };
        })
      );
      
      // 2. Call the client to perform the commit
      console.log('Calling vfsClient.commit...');
      const versionId = await vfsClient.commit(filesToCommit, commitMessage, 'main');
      
      console.log('Commit successful! Version ID:', versionId);

      // 3. Navigate back to repository on success
      navigate(`/repository/${repositoryId}?success=commit`);

    } catch (err) {
      console.error('Commit failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during commit.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        const files = Array.from(event.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleCancel = () => {
    navigate(`/repository/${repositoryId}`);
  };

  const handleFileClick = () => {
    document.getElementById('file-input')?.click();
  };

  const handleDirectoryClick = () => {
    document.getElementById('directory-input')?.click();
  };

  return (
    <div className="page">
      <div className="container">
        <h2>New Commit - {repository.name}</h2>
        
        <form className="commit-form" onSubmit={handleCommit}>
          <fieldset disabled={isCommitting}>
            <div className="form-group">
              <label className="form-label">Commit Message *</label>
              <textarea
                className="form-control"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe your changes..."
                rows={3}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Files &amp; Directories</label>
              <div 
                className={`upload-area ${isDragOver ? 'upload-area--active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <p>Drag &amp; drop files or folders here</p>
                <div style={{ 
                  display: 'flex', 
                  gap: 'var(--space-12)', 
                  marginTop: 'var(--space-12)',
                  justifyContent: 'center'
                }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleFileClick}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  >
                    Select Files
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleDirectoryClick}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  >
                    Select Directory
                  </button>
                </div>
              </div>
              
              <input id="file-input" type="file" className="file-input" multiple onChange={handleFileSelect} />
              <input id="directory-input" type="file" className="file-input" webkitdirectory="" directory="" multiple onChange={handleFileSelect} />
            </div>

            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <h4>Selected Files ({selectedFiles.length})</h4>
                {selectedFiles.map((file, index) => {
                  const filePath = (file as any).webkitRelativePath || file.name;
                  return (
                    <div key={index} className="selected-file">
                      <span>
                        {getFileIcon(file.name, file.type)} {filePath}
                        <span style={{ marginLeft: 'var(--space-8)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)'}}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </span>
                      <button type="button" className="remove-file" onClick={() => removeFile(index)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {error && <div className="error-message" style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

            <div className="commit-actions">
              <button type="button" className="btn btn--secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {isCommitting ? 'Committing...' : 'Commit Changes'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default CommitPage;


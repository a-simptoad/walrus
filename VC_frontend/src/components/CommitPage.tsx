import React, { useState } from 'react';
import { mockRepositories } from '../data/mockData';
import { getFileIcon } from '../utils/formatting';

// Define the props for the CommitPage component
interface CommitPageProps {
  repositoryId?: string;
  navigate: (path: string) => void;
}

const CommitPage: React.FC<CommitPageProps> = ({ repositoryId, navigate }) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const repository = mockRepositories.find(r => r.id === repositoryId);

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

  const handleCommit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commitMessage.trim()) {
      // Note: In a real app, use a toast or inline validation instead of alert.
      alert('Please enter a commit message');
      return;
    }
    
    // Simulate commit creation
    console.log('Creating commit:', {
      message: commitMessage,
      files: selectedFiles.map(f => f.name)
    });
    
    // Navigate back to repository with a success message query parameter
    navigate(`/repository/${repositoryId}?success=commit`);
  };

  const handleCancel = () => {
    navigate(`/repository/${repositoryId}`);
  };

  return (
    <div className="page">
      <div className="container">
        <h2>New Commit - {repository.name}</h2>
        
        <form className="commit-form" onSubmit={handleCommit}>
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
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <p>Drag &amp; drop files here, or click to select</p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Supports multiple files and directories
              </p>
            </div>
            <input
              id="file-input"
              type="file"
              className="file-input"
              multiple
              onChange={handleFileSelect}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h4>Selected Files ({selectedFiles.length})</h4>
              {selectedFiles.map((file, index) => (
                <div key={index} className="selected-file">
                  <span>
                    {getFileIcon(file.name, file.type)} {file.name}
                    <span style={{ 
                      marginLeft: 'var(--space-8)', 
                      color: 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </span>
                  <button 
                    type="button"
                    className="remove-file"
                    onClick={() => removeFile(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="commit-actions">
            <button 
              type="button"
              className="btn btn--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="btn btn--primary"
            >
              Commit Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommitPage;


import React, { useState, useEffect } from 'react';
import { mockRepositories } from '../data/mockData';
import { formatDate, getFileIcon } from '../utils/formatting';

// Define the props for the RepositoryPage component
interface RepositoryPageProps {
  repositoryId?: string;
  navigate: (path: string) => void;
}

const RepositoryPage: React.FC<RepositoryPageProps> = ({ repositoryId, navigate }) => {
  const [selectedVersion, setSelectedVersion] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const repository = mockRepositories.find(r => r.id === repositoryId);
  
  useEffect(() => {
    // Set the initial selected version to the latest one
    if (repository && repository.versions.length > 0) {
      setSelectedVersion(repository.versions[0].id);
    }
  }, [repository]);

  useEffect(() => {
    // Check for a success message from a new commit in the URL query params
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    if (urlParams.get('success') === 'commit') {
      setSuccessMessage('Commit created successfully!');
      
      // Clear the success message after 3 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('');
        // Clean up URL
        navigate(`/repository/${repositoryId}`);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [repositoryId, navigate]);

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

  const currentVersion = repository.versions.find(v => v.id === selectedVersion);

  const handleDownload = () => {
    // Note: In a real app, this would trigger a file download.
    alert(`Downloading ${repository.name} (${currentVersion?.name})...`);
  };

  return (
    <div className="page">
      <div className="container">
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}
        
        <div className="repository-header">
          <div>
            <h2>{repository.name}</h2>
            <p>{repository.description}</p>
          </div>
          <div className="repository-actions">
            <button 
              className="btn btn--outline"
              onClick={handleDownload}
            >
              Download Repository
            </button>
            <button 
              className="btn btn--primary"
              onClick={() => navigate(`/commit/${repository.id}`)}
            >
              New Commit
            </button>
          </div>
        </div>

        <div className="version-selector">
          <label className="form-label">Version:</label>
          <select 
            className="form-control"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            style={{ maxWidth: '200px' }}
          >
            {repository.versions.map(version => (
              <option key={version.id} value={version.id}>
                {version.name} ({formatDate(version.date)})
              </option>
            ))}
          </select>
        </div>

        {currentVersion && (
          <div className="file-list">
            <div className="file-list-header">
              Files &amp; Directories
            </div>
            {currentVersion.files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-icon">
                  {getFileIcon(file.name, file.type)}
                </div>
                <div className="file-name">{file.name}</div>
                <div className="file-size">
                  {file.size || (file.type === 'directory' ? '-' : '0 KB')}
                </div>
                <div className="file-date">
                  {formatDate(file.lastModified)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepositoryPage;


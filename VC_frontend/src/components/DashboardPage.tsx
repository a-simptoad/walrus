import React from 'react';
import { mockRepositories } from '../data/mockData';
import { formatDate } from '../utils/formatting';

interface DashboardPageProps {
  navigate: (path: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ navigate }) => {
  const handleCreateRepository = () => {
    alert('Repository creation would be implemented here');
  };

  return (
    <div className="page">
      <div className="container">
        <h2>Dashboard</h2>
        <div className="dashboard-actions">
          <button 
            className="btn btn--primary"
            onClick={handleCreateRepository}
          >
            Create New Repository
          </button>
        </div>
        <section>
          <h3>Your Repositories</h3>
          <div className="repositories-grid">
            {mockRepositories.map(repo => (
              <div 
                key={repo.id} 
                className="card repo-card"
                onClick={() => navigate(`/repository/${repo.id}`)}
              >
                <div className="card__body">
                  <h4>{repo.name}</h4>
                  <p>{repo.description}</p>
                  <div className="repo-meta">
                    <span>{repo.commitCount} commits</span>
                    <span>{formatDate(repo.lastUpdated)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
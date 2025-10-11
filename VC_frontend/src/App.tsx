import React from 'react';
import { useRouter } from './hooks/useRouter';

// Import Components
import Header from './components/Header';
import HomePage from './components/HomePage';
import DashboardPage from './components/DashboardPage';
import RepositoryPage from './components/RepositoryPage';
import CommitPage from './components/CommitPage';

const App: React.FC = () => {
  const { currentRoute, navigate } = useRouter();
  
  const renderPage = () => {
    const routeParts = currentRoute.split('?')[0].split('/'); // Ignore query params for routing
    const page = routeParts[1];
    
    switch (page) {
      case 'dashboard':
        return <DashboardPage navigate={navigate} />;
      case 'repository':
        const repositoryId = routeParts[2];
        return <RepositoryPage repositoryId={repositoryId} navigate={navigate} />;
      case 'commit':
        const commitRepoId = routeParts[2];
        return <CommitPage repositoryId={commitRepoId} navigate={navigate} />;
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  const showHeader = !currentRoute.startsWith('/home');

  return (
    <div className="app">
      {showHeader && <Header currentRoute={currentRoute} navigate={navigate} />}
      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
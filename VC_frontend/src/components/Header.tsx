import React from 'react';
import { mockRepositories } from '../data/mockData';
import { ConnectButton } from '@mysten/dapp-kit';


// Define the props for the Header component
interface HeaderProps {
  currentRoute: string;
  navigate: (path: string) => void;
}

const Header: React.FC<HeaderProps> = ({ currentRoute, navigate }) => {
  // Logic to determine the breadcrumb text based on the current route
  const getBreadcrumb = () => {
    const parts = currentRoute.split('/');
    if (parts.length <= 1 || parts[1] === '' || parts[1] === 'home') {
        return null;
    }
    if (parts[1] === 'dashboard') {
        return '';
    }
    if (parts[1] === 'repository') {
      const repoId = parts[2];
      const repo = mockRepositories.find(r => r.id === repoId);
      return `Repository › ${repo?.name || 'Unknown'}`;
    }
    if (parts[1] === 'commit') {
      const repoId = parts[2];
      const repo = mockRepositories.find(r => r.id === repoId);
      return `Commit › ${repo?.name || 'Unknown'}`;
    }
    return null;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="header">
      <div className="container">
        <div className="header__content">
          <div 
            className="logo"
            onClick={() => navigate('/dashboard')}
            style={{ cursor: 'pointer' }}
          >
            Repository Manager
          </div>
          {breadcrumb && (
            <div className="breadcrumb">
              {breadcrumb}
            </div>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
};

export default Header;


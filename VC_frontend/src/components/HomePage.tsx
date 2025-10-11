import React from 'react';

interface HomePageProps {
  navigate: (path: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ navigate }) => {
  return (
    <div className="page home-page">
      <div className="home-hero">
        <h1>Repository Manager</h1>
        <p>A modern git-style repository management system built with React &amp; TypeScript. Manage your repositories, browse files, and create commits with ease.</p>
        <button 
          className="btn btn--primary btn--lg"
          onClick={() => navigate('/dashboard')}
        >
          Connect
        </button>
      </div>
    </div>
  );
};

export default HomePage;
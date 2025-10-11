import { useState, useEffect } from 'react';

export const useRouter = () => {
  const [currentRoute, setCurrentRoute] = useState(() => {
    return window.location.hash.slice(1) || '/home';
  });

  const navigate = (path: string) => {
    window.location.hash = path;
    // The hashchange event listener will update the state
  };

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash.slice(1) || '/home');
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Also handle initial load correctly
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return { currentRoute, navigate };
};
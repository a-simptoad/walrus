import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/styles.css'; // Assuming you create a styles.css file

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
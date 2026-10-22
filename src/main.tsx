import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadConfigOverrides } from './config';
import './i18n/i18n';
import './styles/global.css';

loadConfigOverrides().finally(() => {
  const root = document.getElementById('root');
  if (!root) return;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

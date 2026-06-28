import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '12px',
        },
        success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
      }}
    />
    <App />
  </StrictMode>,
);

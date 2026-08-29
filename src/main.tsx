import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (error: any) {
    console.error("FATAL REACT RENDER ERROR:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; text-align: center;">
        <h2 style="color: red;">Critical Application Error</h2>
        <p>The application encountered a fatal error during startup.</p>
        <pre style="background: #eee; padding: 10px; text-align: left; overflow: auto; max-width: 800px; margin: 0 auto;">${error.message}</pre>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px;">Reload Application</button>
      </div>
    `;
  }
}

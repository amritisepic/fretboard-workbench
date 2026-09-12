import '@fontsource-variable/inter';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startPersistence } from './state/persistence';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Restore the saved session before the first render, so defaults never flash or overwrite it.
void startPersistence().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

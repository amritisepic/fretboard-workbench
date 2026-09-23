import '@fontsource-variable/inter';
// The sheets every screen needs, in cascade order. The scale wizard, the export dialog and the tour
// import their own sheets, so those arrive with their chunks rather than on first paint.
import './styles/base.css';
import './styles/workbench.css';
import './styles/sidebar.css';
import './styles/panels.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startPersistence } from './state/persistence';
import { followThemePreference } from './state/theme';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The page already wears the stored theme, set by index.html before it painted; from here the app
// keeps it in step with Settings, along with the browser's toolbar color.
followThemePreference();

// Restore the saved session before the first render, so defaults never flash or overwrite it.
void startPersistence().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

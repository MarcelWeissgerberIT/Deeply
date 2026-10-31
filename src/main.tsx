import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadInitialState } from './data/snapshot';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Element #root fehlt in index.html.');

let initial: ReturnType<typeof loadInitialState> | null = null;
try {
  initial = loadInitialState(new Date(), document);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Cockpit-Daten konnten nicht geladen werden:', message);
  const notice = document.createElement('p');
  notice.className = 'load-error';
  notice.textContent = `Die Cockpit-Daten konnten nicht geladen werden. ${message}`;
  container.replaceChildren(notice);
}

if (initial) {
  createRoot(container).render(
    <StrictMode>
      <App initial={initial} />
    </StrictMode>,
  );
}

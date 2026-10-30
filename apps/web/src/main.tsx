import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="bg-page text-ink">LOGINA</main>
  </StrictMode>,
);

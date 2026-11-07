import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { normalizarRutaActual } from './lib/rutas';
import './styles.css';

normalizarRutaActual();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

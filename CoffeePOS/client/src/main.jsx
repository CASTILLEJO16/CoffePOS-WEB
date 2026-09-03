import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remover preloader estático de index.html con fade suave (no bloquea render)
function removeInitialLoader() {
  const el = document.getElementById('initial-loader');
  if (!el) return;
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  setTimeout(() => el.remove(), 300);
}
// Espera a que React haya montado + un tick para evitar flash
if (document.readyState === 'complete') {
  setTimeout(removeInitialLoader, 100);
} else {
  window.addEventListener('load', () => setTimeout(removeInitialLoader, 100));
}
// Fallback: si React monta antes que window.load, remueve al siguiente frame
requestAnimationFrame(() => {
  setTimeout(() => {
    if (document.getElementById('initial-loader')) {
      // Solo remueve si #root ya tiene contenido (React montó)
      const root = document.getElementById('root');
      if (root && root.children.length > 0) removeInitialLoader();
    }
  }, 400);
});

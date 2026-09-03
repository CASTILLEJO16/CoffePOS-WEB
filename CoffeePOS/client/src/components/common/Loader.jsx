import './Loader.css';

/**
 * Loader reutilizable - Coffee POS
 * Usa design tokens de global.css (var(--color-primary) etc) - compatible light/dark
 * CSS puro, sin librerías externas.
 *
 * Props:
 * @param {string} size - "small" | "medium" | "large" | "fullscreen" (default: "medium")
 * @param {string} text - texto opcional debajo del spinner
 * @param {boolean} overlay - si true, cubre toda la pantalla con overlay (para modales/acciones)
 * @param {boolean} withBrand - solo con fullscreen, muestra logo Coffee animado
 * @param {string} className - clases extra
 */
export default function Loader({
  size = 'medium',
  text,
  overlay = false,
  withBrand = false,
  className = '',
  ...props
}) {
  const isFullscreen = size === 'fullscreen';
  const spinnerSize = isFullscreen ? 'fullscreen' : size;

  // variant de contenedor
  const containerClass = [
    'loader',
    isFullscreen ? 'loader--fullscreen' : 'loader--inline',
    overlay ? 'loader--overlay' : '',
    size === 'small' ? 'loader--small' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const spinnerClass = `loader-spinner loader-spinner--${spinnerSize}`;

  // Fullscreen con brand (logo + spinner)
  if (isFullscreen && withBrand) {
    return (
      <div className={containerClass} role="status" aria-live="polite" aria-label={text || 'Cargando'} {...props}>
        <div className="loader-brand">
          <div className="loader-logo" aria-hidden="true">
            {/* Coffee icon inline - evita dependencia extra en fullscreen inicial */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h13a2 2 0 0 1 2 2v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6z" />
              <path d="M17 8h2a3 3 0 0 1 0 6h-2" />
              <path d="M6 2v2" />
              <path d="M10 2v2" />
              <path d="M14 2v2" />
            </svg>
          </div>
          <div className={spinnerClass} aria-hidden="true" />
          {text && <p className="loader-text">{text}</p>}
        </div>
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div className={containerClass} role="status" aria-live="polite" aria-label={text || 'Cargando'} {...props}>
        <div className={spinnerClass} aria-hidden="true" />
        {text && <p className="loader-text">{text}</p>}
      </div>
    );
  }

  // Inline / small / overlay
  return (
    <div className={containerClass} role="status" aria-live="polite" aria-label={text || 'Cargando'} {...props}>
      <div className={spinnerClass} aria-hidden="true" />
      {text && <p className="loader-text">{text}</p>}
    </div>
  );
}

/**
 * Middleware de manejo de errores
 * Captura y procesa errores de forma centralizada
 */

/**
 * Manejador de errores global
 */
export const errorHandler = (err, req, res, next) => {
  // Logging seguro: no exponer información sensible en producción
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', {
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method
    });
  } else {
    // En desarrollo, log completo para debugging
    console.error('Error:', err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  // En producción, no exponer stack traces o detalles internos
  const response = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : message
  };

  // Solo en desarrollo incluir más detalles
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  // Error de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json(response);
  }

  // Error de base de datos
  if (err.message && err.message.includes('SQLITE')) {
    return res.status(500).json(response);
  }

  // Error por defecto
  res.status(statusCode).json(response);
}

/**
 * Middleware para rutas no encontradas
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
}

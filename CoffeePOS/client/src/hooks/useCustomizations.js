import { useState, useEffect } from 'react';
import { getCustomizations } from '../services/customizationService.js';

/**
 * Hook para cargar personalizaciones desde el servidor
 */
export function useCustomizations() {
  const [customizations, setCustomizations] = useState({});
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCustomizations();

    // Escuchar cambios de personalizaciones desde el admin
    function handleCustomizationsUpdate() {
      console.log('[useCustomizations] Evento customizationsUpdated recibido, recargando personalizaciones...');
      loadCustomizations();
    }

    window.addEventListener('customizationsUpdated', handleCustomizationsUpdate);
    return () => window.removeEventListener('customizationsUpdated', handleCustomizationsUpdate);
  }, []);

  async function loadCustomizations() {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getCustomizations();
      
      // Agrupar por tipo de forma dinámica
      const grouped = {};
      const uniqueTipos = new Set();
      
      data.forEach(c => {
        // Solo incluir personalizaciones activas: si el admin desactivó
        // una, no debe aparecer en la ventana de personalizar bebida
        // hasta que la vuelva a activar.
        if (!c.activo) return;

        if (!grouped[c.tipo]) {
          grouped[c.tipo] = [];
        }
        uniqueTipos.add(c.tipo);
        grouped[c.tipo].push({
          id: c.id ? c.id.toString() : c._id?.toString() || String(c._id),
          name: c.nombre,
          price: c.precio_adicional,
          tipo: c.tipo
        });
      });

      setCustomizations(grouped);
      setTipos(Array.from(uniqueTipos));
    } catch (err) {
      console.error('Error al cargar personalizaciones:', err);
      setError(err);
      // En caso de error
      setCustomizations({});
      setTipos([]);
    } finally {
      setLoading(false);
    }
  }

  return { customizations, tipos, loading, error, refetch: loadCustomizations };
}
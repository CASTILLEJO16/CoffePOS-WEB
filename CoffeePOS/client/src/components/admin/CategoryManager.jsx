import { useState, useEffect } from 'react';
import { Tag, Trash2, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import { getCategories, deleteCategory } from '../../services/categoryService.js';
import './CategoryManager.css';

const DEFAULT_NAMES = ['Cafés Calientes', 'Cafés Fríos', 'Frappés', 'Especiales', 'Tés', 'Postres', 'Todas'];

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCategories(); }, []);

  // Escuchar creación desde ProductForm
  useEffect(() => {
    function onUpdated() { loadCategories(); }
    window.addEventListener('categoriesUpdated', onUpdated);
    window.addEventListener('storage', (e) => { if (e.key === 'categories_updated_at') loadCategories(); });
    return () => {
      window.removeEventListener('categoriesUpdated', onUpdated);
    };
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(cat) {
    const id = cat._id || cat.id;
    const result = await Swal.fire({
      title: `¿Eliminar "${cat.nombre}"?`,
      text: 'No se podrá deshacer. Si tiene productos activos, primero reasígnalos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    try {
      await deleteCategory(id);
      Swal.fire({ title: 'Eliminada', text: `Categoría "${cat.nombre}" eliminada`, icon: 'success', timer: 1500, showConfirmButton: false });
      // Actualizar local y notificar a POS/ProductForm
      setCategories(prev => prev.filter(c => (c._id || c.id) !== id));
      try {
        window.dispatchEvent(new Event('categoriesUpdated'));
        localStorage.setItem('categories_updated_at', Date.now().toString());
      } catch {}
    } catch (error) {
      Swal.fire('Error', error.message || 'No se pudo eliminar la categoría', 'error');
    }
  }

  if (loading) {
    return <div className="category-manager loading">Cargando categorías...</div>;
  }

  return (
    <div className="category-manager">
      <div className="category-manager-header">
        <div className="category-manager-title">
          <Tag size={18} />
          <h3>Categorías ({categories.length})</h3>
        </div>
        <button className="icon-btn" onClick={loadCategories} title="Recargar">
          <RefreshCw size={16} />
        </button>
      </div>
      <p className="category-manager-hint">Solo el admin puede eliminar categorías. No se pueden eliminar categorías con productos activos.</p>
      {categories.length === 0 ? (
        <p className="category-empty">No hay categorías personalizadas. Usa “Crear nueva categoría” al agregar un producto, o se usarán las por defecto.</p>
      ) : (
        <div className="category-list">
          {categories.map(cat => {
            const id = cat._id || cat.id;
            const isDefault = DEFAULT_NAMES.includes(cat.nombre);
            return (
              <div key={id} className="category-chip">
                <span className="category-name">{cat.nombre}</span>
                {isDefault && <span className="category-badge-default">por defecto</span>}
                <button className="category-delete-btn" onClick={() => handleDelete(cat)} title={`Eliminar ${cat.nombre}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

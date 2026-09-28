import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Swal from 'sweetalert2';
import { Plus, Flame } from 'lucide-react';
import { getPromotions, createPromotion, updatePromotion, togglePromotion, deletePromotion } from '../services/promotionService.js';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import './AdminPromociones.css';

export default function AdminPromociones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'BUY_X_PAY_Y',
    productosParticipantes: [],
    cantidadComprar: 2,
    cantidadPagar: 1,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFinalizacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    horaInicio: '00:00',
    horaFinalizacion: '23:59',
    diasSemana: [],
    estado: 'Activa'
  });

  useEffect(() => {
    loadPromotions();
    loadProducts();
  }, []);

  async function loadPromotions() {
    try {
      setLoading(true);
      const response = await getPromotions();
      setPromotions(response.data || []);
    } catch (error) {
      console.error('Error cargando promociones:', error);
      Swal.fire('Error', 'No se pudieron cargar las promociones', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const { user } = useAuth();
      const token = user?.token;
      if (!token) return;
      const response = await fetch('/api/productos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  }

  function handleAdd() {
    setEditing(null);
    setFormData({
      nombre: '',
      tipo: 'BUY_X_PAY_Y',
      productosParticipantes: [],
      cantidadComprar: 2,
      cantidadPagar: 1,
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaFinalizacion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horaInicio: '00:00',
      horaFinalizacion: '23:59',
      diasSemana: [],
      estado: 'Activa'
    });
    setShowForm(true);
  }

  function handleEdit(promo) {
    setEditing(promo);
    setFormData({
      nombre: promo.nombre || '',
      tipo: promo.tipo || 'BUY_X_PAY_Y',
      productosParticipantes: promo.productosParticipantes?.map(p => p.producto_id) || [],
      cantidadComprar: promo.cantidadComprar || 2,
      cantidadPagar: promo.cantidadPagar || 1,
      fechaInicio: promo.fechaInicio ? new Date(promo.fechaInicio).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      fechaFinalizacion: promo.fechaFinalizacion ? new Date(promo.fechaFinalizacion).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      horaInicio: promo.horaInicio || '00:00',
      horaFinalizacion: promo.horaFinalizacion || '23:59',
      diasSemana: promo.diasSemana || [],
      estado: promo.estado || 'Activa'
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const productosParticipantes = formData.productosParticipantes.map(id => {
        const product = products.find(p => p._id === id);
        return {
          producto_id: id,
          nombre: product?.nombre || ''
        };
      });

      const data = {
        ...formData,
        productosParticipantes,
        fechaInicio: new Date(formData.fechaInicio),
        fechaFinalizacion: new Date(formData.fechaFinalizacion)
      };

      if (editing) {
        await updatePromotion(editing._id, data);
        Swal.fire('¡Actualizado!', 'Promoción actualizada correctamente', 'success');
      } else {
        await createPromotion(data);
        Swal.fire('¡Creado!', 'Promoción creada correctamente', 'success');
      }

      setShowForm(false);
      setEditing(null);
      await loadPromotions();
    } catch (error) {
      console.error('Error al guardar promoción:', error);
      const msg = error.response?.data?.error || error.message || 'Error al guardar promoción';
      Swal.fire('Error', msg, 'error');
    }
  }

  async function handleToggle(promo) {
    try {
      setTogglingId(promo._id);
      await togglePromotion(promo._id);
      await loadPromotions();
      Swal.fire({
        title: '¡Actualizado!',
        text: `Promoción ${promo.estado === 'Activa' ? 'desactivada' : 'activada'} correctamente`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      const msg = error.response?.data?.error || error.message || 'Error al cambiar estado';
      Swal.fire('Error', msg, 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id) {
    if (!id) {
      Swal.fire('Error', 'ID no válido', 'error');
      return;
    }
    const result = await Swal.fire({
      title: '¿Eliminar promoción?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    try {
      await deletePromotion(id);
      await loadPromotions();
      Swal.fire('Eliminado', 'Promoción eliminada correctamente', 'success');
    } catch (error) {
      console.error('Error al eliminar promoción:', error);
      const msg = error.response?.data?.error || error.message || 'Error al eliminar promoción';
      Swal.fire('Error', msg, 'error');
    }
  }

  function formatTipo(tipo) {
    const map = {
      'BUY_X_PAY_Y': '2x1 / X/Y',
      'PERCENTAGE_DISCOUNT': 'Descuento %',
      'FIXED_DISCOUNT': 'Descuento fijo'
    };
    return map[tipo] || tipo;
  }

  function handleProductChange(e) {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
    setFormData({ ...formData, productosParticipantes: selectedOptions });
  }

  function handleDaysChange(e) {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
    setFormData({ ...formData, diasSemana: selectedOptions });
  }

  return (
    <div className="admin-promociones-page">
      <div className="admin-promociones-header">
        <div className="admin-promociones-header-left">
          <div className="admin-promociones-title-wrapper">
            <Flame className="admin-promociones-title-icon" size={28} />
            <h1 className="admin-promociones-title">Promociones</h1>
          </div>
          <p className="admin-promociones-subtitle">Administra las promociones de productos</p>
        </div>
        <Button onClick={handleAdd} icon={Plus}>
          Nueva Promoción
        </Button>
      </div>

      <div className="admin-promociones-content">
        {loading ? (
          <div className="loading">Cargando promociones...</div>
        ) : promotions.length === 0 ? (
          <div className="empty-state">
            <p>No hay promociones para mostrar</p>
            <p>Crea tu primera promoción para comenzar</p>
          </div>
        ) : (
          <div className="promotions-grid">
            {promotions.map((promo) => (
              <div key={promo._id} className="promotion-card">
                <div className="promotion-card-header">
                  <span className="promotion-type-badge">
                    {formatTipo(promo.tipo)}
                  </span>
                  <span className={`promotion-status ${promo.estado === 'Activa' ? 'active' : 'inactive'}`}>
                    {promo.estado}
                  </span>
                </div>
                <div className="promotion-card-body">
                  <h3 className="promotion-nombre">{promo.nombre}</h3>
                  <p className="promotion-desc">
                    {promo.productosParticipantes?.map(pp => pp.nombre).join(', ') || 'Sin productos'}
                  </p>
                  <p className="promotion-rules">
                    {promo.tipo === 'BUY_X_PAY_Y' && (
                      <>
                        Comprar: {promo.cantidadComprar} | Pagar: {promo.cantidadPagar}
                        {promo.diasSemana && promo.diasSemana.length > 0 && ` | Días: ${promo.diasSemana.join(', ')}`}
                        {promo.horaInicio && promo.horaFinalizacion && ` | Horario: ${promo.horaInicio} - ${promo.horaFinalizacion}`}
                      </>
                    )}
                    {promo.tipo === 'PERCENTAGE_DISCOUNT' && '- Descuento porcentual en productos seleccionados'}
                    {promo.tipo === 'FIXED_DISCOUNT' && `- Descuento fijo de $${promo.cantidadPagar} en productos seleccionados`}
                  </p>
                </div>
                <div className="promotion-card-footer">
                  <Button
                    variant={promo.estado === 'Activa' ? 'secondary' : 'primary'}
                    size="small"
                    onClick={() => handleToggle(promo)}
                    disabled={togglingId === promo._id}
                  >
                    {togglingId === promo._id ? 'Guardando...' : promo.estado === 'Activa' ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="small"
                    onClick={() => handleEdit(promo)}
                  >
                    Editar
                  </Button>
                  <Button 
                    variant="danger" 
                    size="small"
                    onClick={() => handleDelete(promo._id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          title={editing ? 'Editar Promoción' : 'Nueva Promoción'}
        >
          <form onSubmit={handleSubmit} className="promotion-form">
            <div className="form-group">
              <label>Nombre *</label>
              <input 
                type="text" 
                name="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                placeholder="Ej: 2x1 Café Americano"
              />
            </div>

            <div className="form-group">
              <label>Tipo *</label>
              <select 
                name="tipo"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                required
              >
                <option value="BUY_X_PAY_Y">2x1 / X/Y (Comprar X, pagar Y)</option>
                <option value="PERCENTAGE_DISCOUNT">Descuento porcentual</option>
                <option value="FIXED_DISCOUNT">Descuento fijo</option>
              </select>
            </div>

            <div className="form-group">
              <label>Productos participantes *</label>
              <select 
                name="productosParticipantes"
                multiple
                value={formData.productosParticipantes}
                onChange={handleProductChange}
                style={{ width: '100%', minHeight: '120px' }}
                required
              >
                {products.map(producto => (
                  <option key={producto._id} value={producto._id}>
                    {producto.nombre}
                  </option>
                ))}
              </select>
              <small className="form-hint">Mantén presionada Ctrl para seleccionar múltiples</small>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Comprar *</label>
                <input 
                  type="number" 
                  name="cantidadComprar"
                  value={formData.cantidadComprar}
                  onChange={(e) => setFormData({ ...formData, cantidadComprar: parseInt(e.target.value) })}
                  required
                  min="1"
                />
              </div>
              <div className="form-group half">
                <label>Pagar *</label>
                <input 
                  type="number" 
                  name="cantidadPagar"
                  value={formData.cantidadPagar}
                  onChange={(e) => setFormData({ ...formData, cantidadPagar: parseInt(e.target.value) })}
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Fecha de inicio *</label>
                <input 
                  type="date" 
                  name="fechaInicio"
                  value={formData.fechaInicio}
                  onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                  required
                />
              </div>
              <div className="form-group half">
                <label>Fecha de finalización *</label>
                <input 
                  type="date" 
                  name="fechaFinalizacion"
                  value={formData.fechaFinalizacion}
                  onChange={(e) => setFormData({ ...formData, fechaFinalizacion: e.target.value })}
                  required
                  min={formData.fechaInicio}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Hora de inicio</label>
                <input 
                  type="time" 
                  name="horaInicio"
                  value={formData.horaInicio}
                  onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                />
              </div>
              <div className="form-group half">
                <label>Hora de finalización</label>
                <input 
                  type="time" 
                  name="horaFinalizacion"
                  value={formData.horaFinalizacion}
                  onChange={(e) => setFormData({ ...formData, horaFinalizacion: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Días de la semana</label>
              <select 
                name="diasSemana"
                multiple
                value={formData.diasSemana}
                onChange={handleDaysChange}
                style={{ width: '100%', minHeight: '120px' }}
              >
                <option value="Lunes">Lunes</option>
                <option value="Martes">Martes</option>
                <option value="Miércoles">Miércoles</option>
                <option value="Jueves">Jueves</option>
                <option value="Viernes">Viernes</option>
                <option value="Sábado">Sábado</option>
                <option value="Domingo">Domingo</option>
              </select>
              <small className="form-hint">Mantén presionada Ctrl para seleccionar múltiples</small>
            </div>

            <div className="form-group">
              <label>Estado</label>
              <select 
                name="estado"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
              </select>
            </div>

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editing ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}